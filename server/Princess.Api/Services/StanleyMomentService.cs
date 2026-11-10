using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Chat phase 6 (docs/chat-features-research.md, section 7): posts at most one suggestion card at a time into the guest's permanent Stanley chat, from trip facts, by the rules in
/// <see cref="ChatProactiveRules"/>. It runs when the guest's notices are checked (the app asks, or the scheduled pass does) and is best effort: a failure is logged without text and never
/// reaches the notice path. It sends no phone alert: a card is a quiet badge (the unread count) and is read in the app.
/// </summary>
public sealed class StanleyMomentService(IChatStore store, IStanleyMemoryStore memory, ILogger<StanleyMomentService> log)
{
    /// <summary>
    /// Decides and, if one is due, posts a card. <paramref name="held"/> is true in quiet hours or do-not-disturb: nothing is posted, and the card waits for the next check. Returns the moment key posted, or null.
    /// </summary>
    public async Task<string?> PostAsync(UserRecord actor, MomentFacts facts, bool held, CancellationToken ct)
    {
        try
        {
            if (actor.IsSupervised || held) return null;
            var mode = ChatProactiveRules.ModeOf(await memory.GetLevelAsync(actor.Id, ct));
            if (mode == ChatProactiveRules.ModeOff) return null;
            var off = (await store.GetTopicsOffAsync(actor.Id, ct)).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var history = await store.ListMomentsAsync(actor.Id, ct);
            var pick = ChatProactiveRules.Choose(ChatProactiveRules.Candidates(facts), history, new(mode, off, held, actor.IsSupervised), facts.Now);
            if (pick is null) return null;
            await store.EnsureStanleyAsync(actor.Id, StanleyPersonaRules.Welcome(actor.FirstName), facts.Now, ct);
            var (voice, subtitle) = await store.LastStanleyPersonaAsync(actor.Id, ct) ?? (StanleyPersonaRules.Company, StanleyPersonaRules.CompanyName);
            if (!await store.AddStanleyNoticeAsync(actor.Id, ChatProactiveRules.ToNotice(pick, facts.Now), voice, subtitle, facts.Now, ct)) return null;
            await store.SaveMomentAsync(actor.Id, new(pick.Key, pick.Topic, facts.Now, pick.ExpiresAt, null, null, pick.FactsHash), ct);
            return pick.Key;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "A Stanley suggestion could not be posted for user {UserId}", actor.Id);
            return null;
        }
    }

    /// <summary>
    /// <c>Not now</c> (snooze to tomorrow) or <c>Don't show again</c> (until the facts change) on a card. 400 action or notMoment; 404 for a conversation or message the caller cannot read; 403 for a card that
    /// is not in their own Stanley chat.
    /// </summary>
    public async Task PutAwayAsync(UserRecord actor, Guid conversationId, Guid messageId, string? action, DateTime now, CancellationToken ct)
    {
        if (!ChatProactiveRules.ValidAction(action)) throw ApiException.Invalid("action");
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active) throw ApiException.NotFound();
        if (!ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (!message.FromStanley || message.Lane != ChatProactiveRules.Lane || ChatProactiveRules.KeyOf(message.NoticeKey) is not { } key) throw ApiException.Invalid("notMoment");
        var snooze = action == ChatProactiveRules.Snooze;
        if (!await store.PutAwayMomentAsync(actor.Id, message.Id, key, snooze ? null : now, snooze ? now + ChatProactiveRules.SnoozeFor : null, now, ct)) throw ApiException.NotFound();
    }

    /// <summary>The topics Stanley may suggest, and which of them the guest turned off. The level (how much Stanley speaks up) is the existing Stanley memory choice, so it is shown here, not stored twice.</summary>
    public async Task<StanleyChatPrefsDto> PrefsAsync(UserRecord actor, CancellationToken ct) =>
        new(ChatProactiveRules.Topics, [.. (await store.GetTopicsOffAsync(actor.Id, ct)).Split(' ', StringSplitOptions.RemoveEmptyEntries)], ChatProactiveRules.ModeOf(await memory.GetLevelAsync(actor.Id, ct)));

    /// <summary>Saves the topics switched off. 400 topics for a name that is not a topic.</summary>
    public async Task<StanleyChatPrefsDto> SetPrefsAsync(UserRecord actor, StanleyChatPrefsRequest? body, CancellationToken ct)
    {
        var off = (body?.TopicsOff ?? []).Distinct().ToList();
        if (!ChatProactiveRules.ValidTopics(off)) throw ApiException.Invalid("topics");
        await store.SetTopicsOffAsync(actor.Id, string.Join(' ', off), ct);
        return await PrefsAsync(actor, ct);
    }
}
