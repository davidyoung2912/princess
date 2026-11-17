using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Microsoft.Extensions.Options;

namespace Princess.Api.Services;

/// <summary>
/// The group coordinator (docs/chat-features-research.md, phase 11, role R5). For a made group whose admin has let Stanley help: an admin sees a tally of a poll or plan in counts, can post it to the group after seeing the
/// exact text (the group sees "Alex asked Stanley to share this" and then Stanley's line), can remind the people who have not answered (each reads it privately in their own Stanley chat; the organiser is told only a count),
/// and can see what still remains. Stanley never posts or reminds on his own. Nothing names a person who has not answered; no price, reason or detail is carried. The same gates as the other shared cards apply
/// (<see cref="ChatGroupMomentRules.Refusal"/>) and the group's off switch for Stanley also stops this. Every member can switch reminders off for themselves, and hide Stanley's group lines with the existing mute.
/// </summary>
public sealed class ChatCoordinatorService(IChatStore store, IChatStanleyStore uses, IChatCoordinatorStore coordinator, IUserStore users, StanleyThreadService stanleyThread, ChatShareService share,
    ChatFanout fanout, IUserClock clock, IAuditLog audit, IOptions<StanleyOptions> options)
{
    private sealed record Room(ChatMemberRow Member, List<ChatPeerRow> Active, bool IsAdmin, string? Refusal);

    private static string ShortName(UserRecord u) => ChatConnectionRules.ShortName(u.FirstName, u.LastName);

    /// <summary>An active member of a made group, with the group-level refusal (admin, opt-in, no supervised child, not switched off) worked out. 404 for anyone else.</summary>
    private async Task<Room> OpenAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        if (!options.Value.Switches.ChatCoordinator) throw ApiException.Forbidden(StanleySwitches.Stopped);
        var member = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || member.Kind is not (ChatConversationRules.Group or ChatHuddleRules.Kind)) throw ApiException.NotFound();
        var active = (await store.ListMembersAsync(member.GroupId, ct)).Where(p => p.Status == ChatConversationRules.Active).ToList();
        var admin = ChatPlanningService.AdminOf(member, actor.Id);
        var on = await store.GetGroupStanleyAsync(member.GroupId, ct) && !await uses.IsOffAsync(member.GroupId, ct);
        var refusal = ChatGroupMomentRules.Refusal(admin, on, true, active.Any(p => p.IsSupervised), false);
        if (refusal is null && active.Count < ChatGroupMomentRules.MinMembers) refusal = ChatGroupMomentRules.NotGroup;
        return new(member, active, admin, refusal);
    }

    private static Room Require(Room room) => room.Refusal is { } r ? throw ApiException.Forbidden(r) : room;

    /// <summary>The poll or plan the caller means, as a message they can read. 400 <c>notPoll</c> for anything else.</summary>
    private async Task<ChatMessageRow> TargetAsync(UserRecord actor, Room room, Guid messageId, CancellationToken ct)
    {
        var message = await store.FindMessageAsync(room.Member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (message.DeletedAt is not null || (message.Kind != ChatPlanningRules.Poll && message.Kind != ChatCardRules.Plan)) throw ApiException.Invalid("notPoll");
        return message;
    }

    private sealed record Standing(ChatCoordinatorRules.Progress Progress, List<int> Counts, List<long> Unanswered, bool Closed, DateTime ClosesAt, string? Tally, string? Compromise, string Status, string Title);

    private async Task<Standing> StandingAsync(Room room, ChatMessageRow message, DateTime now, CancellationToken ct)
    {
        var rows = await store.ListResponsesAsync([message.Id], ct);
        var ids = room.Active.Select(p => p.UserId).ToList();
        var by = rows.Select(r => r.UserId).ToList();
        var progress = ChatCoordinatorRules.CountAnswers(ids, by);
        var unanswered = ChatCoordinatorRules.Unanswered(ids, by);
        var closesAt = ChatPlanningRules.ClosesAt(message.At);
        if (message.Kind == ChatPlanningRules.Poll)
        {
            var poll = ChatPlanningRules.ParsePoll(message.Payload) ?? throw ApiException.Invalid("notPoll");
            var closed = ChatPlanningRules.IsClosed(message.ClosedAt, message.At, now);
            var counts = ChatPlanningRules.Tally(rows.Where(r => ids.Contains(r.UserId)).Select(r => r.Choice), poll.Options.Count);
            var idea = ChatCoordinatorRules.Compromise(poll.Options, counts);
            var status = ChatStanleyRules.Filter($"{ChatCoordinatorRules.Answered(progress)} {ChatCoordinatorRules.ClosesPhrase(closed, closesAt, now)}", ChatCoordinatorRules.MaxTally) ?? "";
            return new(progress, counts, unanswered, closed, closesAt, ChatCoordinatorRules.PollTally(poll, counts, progress, closed, closesAt, now), idea is null ? null : ChatStanleyRules.Filter(idea, ChatCoordinatorRules.MaxTally), status, poll.Question);
        }
        var card = ChatCardRules.Parse(message.Payload) ?? throw ApiException.Invalid("notPoll");
        var tally = ChatPlanningRules.Tally(rows.Where(r => ids.Contains(r.UserId)).Select(r => r.Choice), ChatPlanningRules.Answers);
        var planIdea = ChatCoordinatorRules.PlanCompromise(tally[ChatPlanningRules.Going], tally[ChatPlanningRules.Maybe], tally[ChatPlanningRules.No]);
        return new(progress, tally, unanswered, false, closesAt,
            ChatCoordinatorRules.PlanTally(card.Title, tally[ChatPlanningRules.Going], tally[ChatPlanningRules.Maybe], tally[ChatPlanningRules.No], progress),
            planIdea, ChatCoordinatorRules.Answered(progress), card.Title);
    }

    private async Task<List<long>> WhoToRemindAsync(UserRecord actor, Room room, Standing s, DateTime now, CancellationToken ct)
    {
        var blocked = new HashSet<long>(await store.ListBlocksAsync(actor.Id, ct));
        var supervised = room.Active.Where(p => p.IsSupervised).Select(p => p.UserId).ToHashSet();
        return ChatCoordinatorRules.Recipients(s.Unanswered, actor.Id, supervised, await coordinator.RemindersMutedAsync(room.Member.GroupId, ct), blocked, await coordinator.LastRemindedAsync(room.Member.GroupId, ct), now);
    }

    /// <summary>
    /// What the organiser would post and send for one poll or plan, shown before they do either: the exact tally text, the exact reminder text, and how many people a reminder would reach (a count).
    /// 403 <c>notAdmin|off|child|notGroup</c>; 400 <c>notPoll</c>; 404.
    /// </summary>
    public async Task<ChatCoordinatorPreviewDto> PreviewAsync(UserRecord actor, Guid groupId, Guid messageId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var message = await TargetAsync(actor, room, messageId, ct);
        var now = await clock.NowAsync(actor, ct);
        var s = await StandingAsync(room, message, now, ct);
        var reason = ChatCoordinatorRules.ReminderRefusal(s.Closed, message.At, now);
        var recipients = reason is null ? await WhoToRemindAsync(actor, room, s, now, ct) : new List<long>();
        if (reason is null && recipients.Count == 0) reason = ChatCoordinatorRules.NoOne;
        return new(s.Status, s.Compromise, s.Tally ?? s.Status, ChatCoordinatorRules.ReminderText(ShortName(actor), message.Kind == ChatPlanningRules.Poll), recipients.Count, reason is null, reason);
    }

    /// <summary>
    /// "Post this to the group?" (the organiser's tap): a line says whose request it was, then Stanley's tally. One post at a time (the same cooldown as his answers). 403 <c>notAdmin|off|child|notGroup</c>;
    /// 400 <c>notPoll</c>; 404; 429 <c>busy</c>.
    /// </summary>
    public async Task ShareAsync(UserRecord actor, Guid groupId, Guid messageId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var message = await TargetAsync(actor, room, messageId, ct);
        var now = await clock.NowAsync(actor, ct);
        if (ChatAskStanleyRules.OverCooldown(await uses.CountAnswersAsync(room.Member.GroupId, now - ChatAskStanleyRules.CooldownWindow, ct))) throw ApiException.TooMany("busy");
        var s = await StandingAsync(room, message, now, ct);
        var text = s.Tally ?? throw ApiException.Invalid("notPoll");
        await store.AddSystemLineAsync(room.Member.GroupId, actor.Id, ChatGroupMomentRules.ShareLine(ShortName(actor)), now, ct);
        var row = await store.AddGroupStanleyMessageAsync(room.Member.GroupId, text, false, now, ct);
        await fanout.RunAsync(new ChatFanoutJob(0, room.Member.GroupId, room.Member.GroupPublicId, row, room.Member.Kind), ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.coordinator.share", Outcome = AuditOutcome.Success, Target = "conversation:" + groupId, Detail = message.Kind }, ct);
    }

    /// <summary>
    /// The organiser's tap on Remind: each person who has not answered (and is not muted, blocked, a child, or reminded in the last 3 days) reads a short private note in their own Stanley chat. The organiser learns only how many.
    /// 403 <c>notAdmin|off|child|notGroup</c>; 400 <c>notPoll</c>; 404; 409 <c>closed</c> or <c>tooSoon</c> (half the poll's time must have gone).
    /// </summary>
    public async Task<ChatRemindedDto> RemindAsync(UserRecord actor, Guid groupId, Guid messageId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var message = await TargetAsync(actor, room, messageId, ct);
        var now = await clock.NowAsync(actor, ct);
        var s = await StandingAsync(room, message, now, ct);
        if (ChatCoordinatorRules.ReminderRefusal(s.Closed, message.At, now) is { } refusal) throw ApiException.Conflict(refusal);
        var text = ChatCoordinatorRules.ReminderText(ShortName(actor), message.Kind == ChatPlanningRules.Poll);
        var sent = new List<long>();
        foreach (var id in await WhoToRemindAsync(actor, room, s, now, ct))
        {
            try
            {
                var person = await users.FindByIdAsync(id, ct);
                if (person is null || person.IsSupervised) continue;
                await stanleyThread.EnsureAsync(person, ct);
                var voice = await store.LastStanleyPersonaAsync(id, ct);
                var notice = new StanleyNotice($"remind:{message.PublicId:N}:{now:yyyyMMdd}", StanleyNoticeRules.Info, "chatHelp", ChatGroupMomentRules.GroupPath(groupId), text, null, now + ChatCoordinatorRules.ReminderGap, "normal");
                if (await store.AddStanleyNoticeAsync(id, notice, voice?.Voice ?? StanleyPersonaRules.Company, voice?.Subtitle ?? StanleyPersonaRules.CompanyName, now, ct)) sent.Add(id);
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { /* one person's thread failing never stops the others */ }
        }
        await coordinator.RecordRemindersAsync(room.Member.GroupId, message.Id, sent, now, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.coordinator.remind", Outcome = AuditOutcome.Success, Target = "conversation:" + groupId, Detail = sent.Count + " reminded" }, ct);
        return new(sent.Count, ChatCoordinatorRules.RemindedLine(sent.Count));
    }

    /// <summary>The organiser's private "what remains": the open polls and plans that still wait for someone, in counts. Never posted. 403 <c>notAdmin|off|child|notGroup</c>; 404.</summary>
    public async Task<ChatRemainingDto> RemainingAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var now = await clock.NowAsync(actor, ct);
        var day = await share.CruiseDayAsync(actor, now, ct);
        var messages = (await store.ListMessagesAsync(room.Member.GroupId, actor.Id, null, 120, ct))
            .Where(m => m.DeletedAt is null && (m.Kind == ChatPlanningRules.Poll || m.Kind == ChatCardRules.Plan)).ToList();
        var responses = messages.Count == 0 ? new List<ChatResponseRow>() : await store.ListResponsesAsync([.. messages.Select(m => m.Id)], ct);
        var ids = room.Active.Select(p => p.UserId).ToList();
        var items = new List<(ChatRemainingItemDto Dto, ChatCoordinatorRules.Item Item)>();
        foreach (var m in messages)
        {
            var progress = ChatCoordinatorRules.CountAnswers(ids, responses.Where(r => r.MessageId == m.Id).Select(r => r.UserId));
            if (m.Kind == ChatPlanningRules.Poll)
            {
                if (ChatPlanningRules.ParsePoll(m.Payload) is not { } poll) continue;
                var closed = ChatPlanningRules.IsClosed(m.ClosedAt, m.At, now);
                items.Add((new(m.PublicId, "poll", poll.Question, progress.Answered, progress.Total, closed, Shipboard.Ms(ChatPlanningRules.ClosesAt(m.At))), new(!closed, progress)));
            }
            else
            {
                if (ChatCardRules.Parse(m.Payload) is not { } card) continue;
                var open = day <= 0 || card.Day is null || card.Day >= day;
                items.Add((new(m.PublicId, "plan", card.Title, progress.Answered, progress.Total, !open, null), new(open, progress)));
            }
        }
        var (waiting, outstanding) = ChatCoordinatorRules.Remaining(items.Select(i => i.Item));
        return new(waiting, outstanding, [.. items.Where(i => i.Item.Open && i.Item.Progress.Answered < i.Item.Progress.Total).Select(i => i.Dto)]);
    }

    /// <summary>Whether the caller has switched Stanley's reminders off in this group.</summary>
    public async Task<ChatRemindersDto> RemindersAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || member.Kind is not (ChatConversationRules.Group or ChatHuddleRules.Kind)) throw ApiException.NotFound();
        return new((await coordinator.RemindersMutedAsync(member.GroupId, ct)).Contains(actor.Id));
    }

    /// <summary>The caller stops (or allows) Stanley's reminders in this group, for themselves only. Nobody is told. 400 <c>muted</c>; 404.</summary>
    public async Task<ChatRemindersDto> SetRemindersMutedAsync(UserRecord actor, Guid groupId, ChatRemindersMuteBody? body, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || member.Kind is not (ChatConversationRules.Group or ChatHuddleRules.Kind)) throw ApiException.NotFound();
        var muted = body?.Muted ?? throw ApiException.Invalid("muted");
        await coordinator.SetRemindersMutedAsync(member.GroupId, actor.Id, muted, ct);
        return new(muted);
    }
}
