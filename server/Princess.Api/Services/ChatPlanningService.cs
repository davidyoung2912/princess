using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Group planning (docs/chat-features-research.md, section 11, phase 4): answering a poll or a plan, and closing a poll early. A poll vote can be changed until the poll closes (on demand, or 24 hours after it was sent);
/// a poll's answers are counted, never named. A plan is answered Going, Maybe or No; Going puts the plan's programme event on the answerer's own programme when their sailing runs it that day, and a later change takes it off again
/// only when the plan put it there. A supervised child's answer is recorded for the group but never touches their programme. Every action names one conversation and is refused unless the caller is an active member of it.
/// </summary>
public sealed class ChatPlanningService(IChatStore store, ChatShareService share, IOnboardStore onboard, IUserClock clock, ChatNotifier notifier)
{
    /// <summary>Whether the member is an admin of the conversation: only a made group has them (its creator, and the one other person the creator named).</summary>
    public static bool AdminOf(ChatMemberRow member, long userId) => member.Kind == ChatConversationRules.Group && ChatPlanningRules.IsAdmin(member.CreatedByUserId == userId, member.IsAdmin);

    /// <summary>The answers to a poll or plan as <paramref name="reader"/> sees them, or null for any other message.</summary>
    public static ChatTallyDto? TallyOf(ChatMessageRow m, IReadOnlyCollection<ChatResponseRow> rows, long reader, DateTime now, bool isAdmin, IReadOnlyDictionary<long, ChatPeerRow> byId, ISet<long> blocked)
    {
        var mine = rows.FirstOrDefault(r => r.UserId == reader);
        if (m.Kind == ChatPlanningRules.Poll)
        {
            if (ChatPlanningRules.ParsePoll(m.Payload) is not { } poll) return null;
            var closed = ChatPlanningRules.IsClosed(m.ClosedAt, m.At, now);
            return new(ChatPlanningRules.Tally(rows.Select(r => r.Choice), poll.Options.Count), mine?.Choice, closed, Shipboard.Ms(ChatPlanningRules.ClosesAt(m.At)), !closed && ChatPlanningRules.MayClose(m.FromUserId == reader, isAdmin));
        }
        if (m.Kind != ChatCardRules.Plan) return null;
        var going = rows.Where(r => r.Choice == ChatPlanningRules.Going && r.UserId != reader && !blocked.Contains(r.UserId) && byId.TryGetValue(r.UserId, out var p) && p.Status == ChatConversationRules.Active)
            .Select(r => ChatConnectionRules.ShortName(byId[r.UserId].FirstName, byId[r.UserId].LastName)).ToList();
        return new(ChatPlanningRules.Tally(rows.Select(r => r.Choice), ChatPlanningRules.Answers), mine?.Choice, false, null, false, going, mine?.AddedToPlan == true);
    }

    private async Task<(ChatMemberRow Member, ChatMessageRow Message, DateTime Now)> TargetAsync(UserRecord actor, Guid conversationId, Guid messageId, string kind, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (message.Kind != kind || message.DeletedAt is not null) throw ApiException.Invalid(kind == ChatPlanningRules.Poll ? "notPoll" : "notPlan");
        return (member, message, await clock.NowAsync(actor, ct));
    }

    private async Task<ChatTallyDto> TallyAsync(UserRecord actor, ChatMemberRow member, ChatMessageRow message, DateTime now, CancellationToken ct)
    {
        var rows = await store.ListResponsesAsync([message.Id], ct);
        var peers = (await store.ListMembersAsync(member.GroupId, ct)).ToDictionary(p => p.UserId);
        var blocked = new HashSet<long>(await store.ListBlocksAsync(actor.Id, ct));
        return TallyOf(message, rows, actor.Id, now, AdminOf(member, actor.Id), peers, blocked) ?? throw ApiException.Invalid("notPoll");
    }

    /// <summary>A live nudge so the other members' open apps, and the caller's other devices, refetch the counts. Never a phone alert.</summary>
    private async Task TellAsync(UserRecord actor, ChatMemberRow member, string kind, CancellationToken ct)
    {
        var recipients = await store.ListRecipientsAsync(member.GroupId, actor.Id, ct);
        await Task.WhenAll(recipients.Select(r => r.UserId).Append(actor.Id).Select(id => notifier.ThreadChangedAsync(id, member.GroupPublicId, kind, ct)));
    }

    /// <summary>
    /// Votes for one option of a poll, or changes the vote to another. Returns the counts. 400 option or notPoll; 403 stanley; 404; 409 closed or pollClosed.
    /// </summary>
    public async Task<ChatTallyDto> VoteAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatVoteRequest? body, CancellationToken ct)
    {
        var (member, message, now) = await TargetAsync(actor, conversationId, messageId, ChatPlanningRules.Poll, ct);
        var poll = ChatPlanningRules.ParsePoll(message.Payload) ?? throw ApiException.Invalid("notPoll");
        if (ChatPlanningRules.IsClosed(message.ClosedAt, message.At, now)) throw ApiException.Conflict("pollClosed");
        if (body?.Option is not { } option || !ChatPlanningRules.ValidOption(option, poll.Options.Count)) throw ApiException.Invalid("option");
        await store.SetResponseAsync(message.Id, actor.Id, option, false, now, ct);
        await TellAsync(actor, member, "poll", ct);
        return await TallyAsync(actor, member, message, now, ct);
    }

    /// <summary>
    /// Closes a poll before its 24 hours are up: the person who asked it, or an admin of the group. Closing one that is already closed changes nothing. Returns the counts. 403 close; 404; 409 closed.
    /// </summary>
    public async Task<ChatTallyDto> CloseAsync(UserRecord actor, Guid conversationId, Guid messageId, CancellationToken ct)
    {
        var (member, message, now) = await TargetAsync(actor, conversationId, messageId, ChatPlanningRules.Poll, ct);
        if (!ChatPlanningRules.MayClose(message.FromUserId == actor.Id, AdminOf(member, actor.Id))) throw ApiException.Forbidden("close");
        if (!ChatPlanningRules.IsClosed(message.ClosedAt, message.At, now) && await store.ClosePollAsync(message.Id, now, ct))
        {
            message.ClosedAt = now;
            await TellAsync(actor, member, "poll", ct);
        }
        return await TallyAsync(actor, member, message, now, ct);
    }

    /// <summary>
    /// Answers a plan Going, Maybe or No (a later answer replaces the earlier one). Going puts the plan's event on the caller's programme when their own sailing runs it that day, and another answer takes it off again if the plan put it there.
    /// Returns the answers; <c>AddedToPlan</c> says whether the event is on the programme because of this answer. 400 choice or notPlan; 403 stanley; 404; 409 closed.
    /// </summary>
    public async Task<ChatTallyDto> RsvpAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatRsvpRequest? body, CancellationToken ct)
    {
        var (member, message, now) = await TargetAsync(actor, conversationId, messageId, ChatCardRules.Plan, ct);
        var next = ChatPlanningRules.ParseRsvp(body?.Choice) ?? throw ApiException.Invalid("choice");
        var card = ChatCardRules.Parse(message.Payload) ?? throw ApiException.Invalid("notPlan");
        var previous = await store.GetResponseAsync(message.Id, actor.Id, ct);
        var sailing = card.EventId is { } eventId && card.Day is { } day ? await share.ProgrammeSailingAsync(actor, eventId, day, ct) : null;
        var mayChange = sailing is not null && ChatPlanningRules.MayChangeProgramme(actor.IsSupervised);
        var inProgramme = mayChange && (await onboard.ListPlanAsync(actor.Id, sailing!, ct)).Any(r => r.EventId == card.EventId && r.Day == card.Day);
        var effect = ChatPlanningRules.Effect(previous?.Choice, previous?.AddedToPlan ?? false, next, inProgramme, mayChange);
        if (effect.Add) await onboard.SetPlanAsync(actor.Id, sailing!, card.EventId!, card.Day!.Value, true, ct);
        if (effect.Remove) await onboard.SetPlanAsync(actor.Id, sailing!, card.EventId!, card.Day!.Value, false, ct);
        await store.SetResponseAsync(message.Id, actor.Id, next, effect.Added, now, ct);
        await TellAsync(actor, member, "plan", ct);
        return await TallyAsync(actor, member, message, now, ct);
    }
}
