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
public sealed class StanleyMomentService(IChatStore store, IStanleyMemoryStore memory, ILogger<StanleyMomentService> log, Microsoft.Extensions.Options.IOptions<StanleyOptions> options, IStateStore state)
{
    /// <summary>
    /// Decides and, if one is due, posts a card. <paramref name="held"/> is true in quiet hours or do-not-disturb: nothing is posted, and the card waits for the next check. Returns the moment key posted, or null.
    /// </summary>
    public async Task<string?> PostAsync(UserRecord actor, MomentFacts facts, bool held, CancellationToken ct)
    {
        try
        {
            if (actor.IsSupervised || held || !options.Value.Switches.ChatHerald) return null;
            var mode = ChatProactiveRules.ModeOf(await memory.GetLevelAsync(actor.Id, ct));
            if (mode == ChatProactiveRules.ModeOff) return null;
            var off = (await store.GetTopicsOffAsync(actor.Id, ct)).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var history = await store.ListMomentsAsync(actor.Id, ct);
            if (!off.Contains(ChatProactiveRules.Planning) && ChatProactiveRules.ModeAllows(mode, ChatProactiveRules.ClassSuggestion) && await GroupOfferAsync(actor, ct) is { } group) facts = facts with { ShareGroup = group };
            if (!off.Contains(ChatProactiveRules.Planning) && facts.Stage is StageRules.Book or StageRules.Manage or StageRules.Prebook or StageRules.GetToShip) facts = await BookingChatsAsync(actor, facts, ct);
            if (!off.Contains(ChatProactiveRules.Onboard) && ChatProactiveRules.ModeAllows(mode, ChatProactiveRules.ClassSuggestion) && facts.CruiseDay > 0) facts = await GroupsTodayAsync(actor, facts, ct);
            var pick = ChatProactiveRules.Choose(ChatProactiveRules.Candidates(facts), history, new(mode, off, held, actor.IsSupervised), facts.Now, await PutAsideAsync(actor.Id, facts.Now, ct));
            if (pick is null) return null;
            await store.EnsureStanleyAsync(actor.Id, StanleyPersonaRules.Welcome(actor.FirstName), facts.Now, ct);
            var (voice, subtitle) = await store.LastStanleyPersonaAsync(actor.Id, ct) ?? (StanleyPersonaRules.Company, StanleyPersonaRules.CompanyName);
            if (!await store.AddStanleyNoticeAsync(actor.Id, ChatProactiveRules.ToNotice(pick, facts.Now), voice, subtitle, facts.Now, ct)) return null;
            await LogAsync(actor.Id, ChatProactiveRules.ToNotice(pick, facts.Now), StanleyNoticeRules.EventPosted, facts.Now, ct);
            await store.SaveMomentAsync(actor.Id, new(pick.Key, pick.Topic, facts.Now, pick.ExpiresAt, null, null, pick.FactsHash), ct);
            return pick.Key;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "A Stanley suggestion could not be posted for user {UserId}", actor.Id);
            return null;
        }
    }

    /// <summary>The guide tasks the guest put aside on Home (not for me, or later until a day not yet come), so a card about one is not posted. An unreadable document counts as none.</summary>
    private async Task<IReadOnlySet<string>> PutAsideAsync(long userId, DateTime now, CancellationToken ct)
    {
        var row = await state.GetAsync(false, userId, "guideChoices", ct);
        if (row is null) return new HashSet<string>();
        try { return GuideRules.PutAside(GuideRules.ReadChoices(System.Text.Json.Nodes.JsonNode.Parse(row.Json) as System.Text.Json.Nodes.JsonObject), DateOnly.FromDateTime(now)); }
        catch (System.Text.Json.JsonException) { return new HashSet<string>(); }
    }

    /// <summary>
    /// The hand-offs into the booking (13.7): the guest's trip huddle, if they are in one (it can be made the party chat), and the booking's party chat once it has more than one person in it. Trip facts and membership only: nothing anyone wrote is read.
    /// </summary>
    private async Task<MomentFacts> BookingChatsAsync(UserRecord actor, MomentFacts facts, CancellationToken ct)
    {
        var mine = (await store.ListConversationsAsync(actor.Id, ct)).Where(c => c.Status == ChatConversationRules.Active).ToList();
        if (mine.FirstOrDefault(c => c.Kind == ChatHuddleRules.Kind) is { } huddle) facts = facts with { HuddleToCarry = huddle.GroupPublicId };
        if (mine.FirstOrDefault(c => c.Kind == ChatConversationRules.Party) is { } party && (await store.ListMembersAsync(party.GroupId, ct)).Count(p => p.Status == ChatConversationRules.Active) > 1) facts = facts with { PartyChat = party.GroupPublicId };
        return facts;
    }

    /// <summary>
    /// Phase 7c: the first group the guest is an admin of that may be offered a meeting place (a sea day, a plan today with enough going) and the first that may be offered the port day for lunch (a port day, midday on,
    /// a plan today). Both need Stanley on in the group, three or more active members and no supervised child.
    /// </summary>
    private async Task<MomentFacts> GroupsTodayAsync(UserRecord actor, MomentFacts facts, CancellationToken ct)
    {
        var wantMeet = facts.Stage == StageRules.Sea;
        var wantLunch = facts.Stage == StageRules.Port && facts.ShipHour >= ChatGroupMomentRules.LunchFromHour;
        var wantDigest = facts.Stage is StageRules.Sea or StageRules.Port && facts.ShipHour is >= ChatGroupMomentRules.DigestFromHour and < ChatGroupMomentRules.DigestToHour;
        if (!wantMeet && !wantLunch && !wantDigest) return facts;
        foreach (var g in (await store.ListConversationsAsync(actor.Id, ct)).Where(c => c.Kind == ChatConversationRules.Group && c.Status == ChatConversationRules.Active && ChatPlanningService.AdminOf(c, actor.Id)))
        {
            if (!await store.GetGroupStanleyAsync(g.GroupId, ct)) continue;
            var members = (await store.ListMembersAsync(g.GroupId, ct)).Where(p => p.Status == ChatConversationRules.Active).ToList();
            if (members.Count < ChatGroupMomentRules.MinMembers || members.Any(p => p.IsSupervised)) continue;
            var plans = await GroupDayPlans.ListAsync(store, g.GroupId, ct);
            if (wantMeet && facts.MeetGroup is null && ChatGroupMomentRules.Gathering(plans, facts.CruiseDay, GroupDayPlans.ShipPlaces()) is not null) facts = facts with { MeetGroup = g.GroupPublicId };
            if (wantLunch && facts.LunchGroup is null && ChatGroupMomentRules.HasDayPlan(plans, facts.CruiseDay)) facts = facts with { LunchGroup = g.GroupPublicId };
            if (wantDigest && facts.DigestGroup is null && ChatGroupMomentRules.Digest(plans, facts.CruiseDay) is not null) facts = facts with { DigestGroup = g.GroupPublicId };
        }
        return facts;
    }

    /// <summary>The first group the guest is an admin of that may be offered a shared poll (7.4): Stanley is on there, three or more are in it, no supervised child is, and it has no poll or plan yet.</summary>
    private async Task<Guid?> GroupOfferAsync(UserRecord actor, CancellationToken ct)
    {
        foreach (var g in (await store.ListConversationsAsync(actor.Id, ct)).Where(c => c.Kind == ChatConversationRules.Group && c.Status == ChatConversationRules.Active && ChatPlanningService.AdminOf(c, actor.Id)))
        {
            if (!await store.GetGroupStanleyAsync(g.GroupId, ct)) continue;
            var members = (await store.ListMembersAsync(g.GroupId, ct)).Where(p => p.Status == ChatConversationRules.Active).ToList();
            if (ChatGroupMomentRules.Offer(true, true, members.Count, members.Any(p => p.IsSupervised), await store.HasPlanningAsync(g.GroupId, ct))) return g.GroupPublicId;
        }
        return null;
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
        await LogAsync(actor.Id, message.NoticeKey!, snooze ? StanleyNoticeRules.EventSnooze : StanleyNoticeRules.EventDismiss, now, ct);
    }

    /// <summary>Kind, lane, key and time only, as for every notice. Best effort: a counting failure never reaches the guest.</summary>
    private async Task LogAsync(long userId, StanleyNotice n, string evt, DateTime at, CancellationToken ct) => await LogAsync(userId, n.Key, evt, at, ct);

    private async Task LogAsync(long userId, string noticeKey, string evt, DateTime at, CancellationToken ct)
    {
        try { await store.LogNoticeDeliveryAsync(userId, noticeKey, ChatProactiveRules.KindOf, ChatProactiveRules.Lane, evt, at, ct); }
        catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "A suggestion card could not be counted"); }
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
