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
    public static bool AdminOf(ChatMemberRow member, long userId) => (member.Kind is ChatConversationRules.Group or ChatHuddleRules.Kind) && ChatPlanningRules.IsAdmin(member.CreatedByUserId == userId, member.IsAdmin);

    /// <summary>The answers to a poll or plan as <paramref name="reader"/> sees them, or null for any other message.</summary>
    public static ChatTallyDto? TallyOf(ChatMessageRow m, IReadOnlyCollection<ChatResponseRow> rows, long reader, DateTime now, bool isAdmin, IReadOnlyDictionary<long, ChatPeerRow> byId, ISet<long> blocked, string? kind = null, IReadOnlyCollection<ChatOutcomeRow>? outcomes = null)
    {
        var mine = rows.FirstOrDefault(r => r.UserId == reader);
        if (m.Kind == ChatPlanningRules.Poll)
        {
            if (ChatPlanningRules.ParsePoll(m.Payload) is not { } poll) return null;
            var closed = ChatPlanningRules.IsClosed(m.ClosedAt, m.At, now);
            return new(ChatPlanningRules.Tally(rows.Select(r => r.Choice), poll.Options.Count), mine?.Choice, closed, Shipboard.Ms(ChatPlanningRules.ClosesAt(m.At)), !closed && ChatPlanningRules.MayClose(m.FromUserId == reader, isAdmin),
                Decided: m.DecidedOption, MayDecide: m.DecidedOption is null && ChatPlanningRules.MayDecide(kind ?? ChatConversationRules.Group, m.FromUserId == reader, isAdmin),
                How: m.DecidedOption is null ? null : ChatPlanningRules.HowCounts((outcomes ?? Array.Empty<ChatOutcomeRow>()).Where(o => !blocked.Contains(o.UserId) || o.UserId == reader).Select(o => o.Rating)),
                MyHow: m.DecidedOption is null ? null : (outcomes ?? Array.Empty<ChatOutcomeRow>()).FirstOrDefault(o => o.UserId == reader)?.Rating);
        }
        if (m.Kind == ChatBoardRules.Kind)
        {
            if (ChatBoardRules.Parse(m.Payload) is not { } board) return null;
            var masks = rows.Where(r => !blocked.Contains(r.UserId) || r.UserId == reader).Select(r => r.Choice);
            return new(ChatBoardRules.Counts(masks, board.Refs.Count), mine?.Choice ?? 0, false, null, false);
        }
        if (m.Kind == ChatBundleRules.Kind)
        {
            // Phase B10: "Done it" on a bundle (a puzzle solved, a thing visited). Reporting is the choice to be named: only people who ticked it appear, first name and last initial; nobody else's lack of an answer is shown.
            var done = rows.Where(r => r.Choice == ChatBundleRules.DoneChoice && !blocked.Contains(r.UserId)).ToList();
            var names = done.Where(r => r.UserId != reader && byId.TryGetValue(r.UserId, out var p) && p.Status == ChatConversationRules.Active)
                .Select(r => ChatConnectionRules.ShortName(byId[r.UserId].FirstName, byId[r.UserId].LastName)).ToList();
            return new([done.Count], mine?.Choice == ChatBundleRules.DoneChoice ? ChatBundleRules.DoneChoice : null, false, null, false, names);
        }
        if (m.Kind != ChatCardRules.Plan) return null;
        var going = rows.Where(r => r.Choice == ChatPlanningRules.Going && r.UserId != reader && !blocked.Contains(r.UserId) && byId.TryGetValue(r.UserId, out var p) && p.Status == ChatConversationRules.Active)
            .Select(r => ChatConnectionRules.ShortName(byId[r.UserId].FirstName, byId[r.UserId].LastName)).ToList();
        return new(ChatPlanningRules.Tally(rows.Select(r => r.Choice), ChatPlanningRules.Answers), mine?.Choice, false, null, false, going, mine?.AddedToPlan == true);
    }

    private async Task<(ChatMemberRow Member, ChatMessageRow Message, DateTime Now)> TargetAsync(UserRecord actor, Guid conversationId, Guid messageId, string kind, CancellationToken ct, string? alsoKind = null)
    {
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if ((message.Kind != kind && message.Kind != alsoKind) || message.DeletedAt is not null) throw ApiException.Invalid(kind == ChatPlanningRules.Poll ? "notPoll" : kind == ChatBoardRules.Kind ? "notBoard" : kind == ChatBundleRules.Kind ? "notBundle" : "notPlan");
        return (member, message, await clock.NowAsync(actor, ct));
    }

    private async Task<ChatTallyDto> TallyAsync(UserRecord actor, ChatMemberRow member, ChatMessageRow message, DateTime now, CancellationToken ct)
    {
        var rows = await store.ListResponsesAsync([message.Id], ct);
        var peers = (await store.ListMembersAsync(member.GroupId, ct)).ToDictionary(p => p.UserId);
        var blocked = new HashSet<long>(await store.ListBlocksAsync(actor.Id, ct));
        var outcomes = message.Kind == ChatPlanningRules.Poll && message.DecidedOption is not null ? await store.ListOutcomesAsync([message.Id], ct) : null;
        return TallyOf(message, rows, actor.Id, now, AdminOf(member, actor.Id), peers, blocked, member.Kind, outcomes) ?? throw ApiException.Invalid("notPoll");
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
    /// Phase B4: decides a poll on one option, which closes it. The person who asked it, an admin of a made group, or either person in a direct chat; once only. A winner that is a thing from the app must still be available to the decider
    /// (a cancelled, past or not-on-this-sailing option cannot win). Nothing is booked or added to anyone's day: each member chooses that themselves from the decision. Returns the counts with <c>Decided</c>.
    /// 400 option or notPoll; 403 decide; 404; 409 closed, decided or gone.
    /// </summary>
    public async Task<ChatTallyDto> DecideAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatDecideRequest? body, CancellationToken ct)
    {
        var (member, message, now) = await TargetAsync(actor, conversationId, messageId, ChatPlanningRules.Poll, ct);
        var poll = ChatPlanningRules.ParsePoll(message.Payload) ?? throw ApiException.Invalid("notPoll");
        if (!ChatPlanningRules.MayDecide(member.Kind, message.FromUserId == actor.Id, AdminOf(member, actor.Id))) throw ApiException.Forbidden("decide");
        if (message.DecidedOption is not null) throw ApiException.Conflict("decided");
        if (body?.Option is not { } option || !ChatPlanningRules.ValidOption(option, poll.Options.Count)) throw ApiException.Invalid("option");
        if (poll.Refs is { } refs && refs[option] is { } optionRef)
        {
            try { await share.BundleAsync(actor, optionRef, null, ct); }
            catch (ApiException) { throw ApiException.Conflict("gone"); }
        }
        if (await store.DecidePollAsync(message.Id, option, actor.Id, now, ct))
        {
            message.DecidedOption = option; message.DecidedBy = actor.Id; message.ClosedAt ??= now;
            await TellAsync(actor, member, "poll", ct);
        }
        else throw ApiException.Conflict("decided");
        return await TallyAsync(actor, member, message, now, ct);
    }

    /// <summary>
    /// Phase B6: "I'm in" (or not) for one item of a day board. Kept as a bit of the caller's one answer; nothing is added to a programme, booked or reserved (adding to your own day is a separate tap on the board).
    /// A supervised child's answer is recorded for the group. Returns the counts with <c>Mine</c> as the caller's bits. 400 item or notBoard; 403 stanley; 404; 409 closed.
    /// </summary>
    public async Task<ChatTallyDto> BoardAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatBoardRequest? body, CancellationToken ct)
    {
        var (member, message, now) = await TargetAsync(actor, conversationId, messageId, ChatBoardRules.Kind, ct);
        var board = ChatBoardRules.Parse(message.Payload) ?? throw ApiException.Invalid("notBoard");
        if (body is null || !ChatBoardRules.ValidItem(body.Item, board.Refs.Count)) throw ApiException.Invalid("item");
        var previous = await store.GetResponseAsync(message.Id, actor.Id, ct);
        await store.SetResponseAsync(message.Id, actor.Id, ChatBoardRules.With(previous?.Choice ?? 0, body.Item, body.In), false, now, ct);
        await TellAsync(actor, member, "board", ct);
        return await TallyAsync(actor, member, message, now, ct);
    }

    /// <summary>
    /// Phase B10: "I did this" on a bundle (a solved puzzle, a place visited), or taking it back. Counted for everyone in the thread, named only for the people who reported. Nothing else changes.
    /// 403 stanley; 404; 409 closed; 400 notBundle.
    /// </summary>
    public async Task<ChatTallyDto> OutcomeAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatOutcomeRequest? body, CancellationToken ct)
    {
        var (member, message, now) = await TargetAsync(actor, conversationId, messageId, ChatBundleRules.Kind, ct, alsoKind: ChatPlanningRules.Poll);
        if (message.Kind == ChatPlanningRules.Poll)
        {
            // Phase B10: "Done, how was it?" on a poll the group decided; a rating of nothing takes mine back.
            if (message.DecidedOption is null) throw ApiException.Invalid("notDecided");
            var how = body?.Done == true ? ChatPlanningRules.ParseHow(body.How) ?? throw ApiException.Invalid("how") : 0;
            await store.SetOutcomeAsync(message.Id, actor.Id, how, now, ct);
            await TellAsync(actor, member, "poll", ct);
            return await TallyAsync(actor, member, message, now, ct);
        }
        await store.SetResponseAsync(message.Id, actor.Id, body?.Done == true ? ChatBundleRules.DoneChoice : 0, false, now, ct);
        await TellAsync(actor, member, "bundle", ct);
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
        // A plan for an excursion or a dinner is only an answer: nothing is added to a programme, booked or reserved from chat.
        var mayChange = sailing is not null && !ChatPlanningRules.IsBookingPlan(card.EventId) && ChatPlanningRules.MayChangeProgramme(actor.IsSupervised);
        var inProgramme = mayChange && (await onboard.ListPlanAsync(actor.Id, sailing!, ct)).Any(r => r.EventId == card.EventId && r.Day == card.Day);
        var effect = ChatPlanningRules.Effect(previous?.Choice, previous?.AddedToPlan ?? false, next, inProgramme, mayChange);
        if (effect.Add) await onboard.SetPlanAsync(actor.Id, sailing!, card.EventId!, card.Day!.Value, true, null, ct);
        if (effect.Remove) await onboard.SetPlanAsync(actor.Id, sailing!, card.EventId!, card.Day!.Value, false, null, ct);
        await store.SetResponseAsync(message.Id, actor.Id, next, effect.Added, now, ct);
        await TellAsync(actor, member, "plan", ct);
        return await TallyAsync(actor, member, message, now, ct);
    }
}
