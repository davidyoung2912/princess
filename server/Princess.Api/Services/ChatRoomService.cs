using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Channels and rooms beyond the ship (docs/chat-features-research.md, section 8 and phase 8). A channel or room is an ordinary conversation of kind <c>channel</c> or <c>room</c>, so reading, sending, reactions and reports
/// are <see cref="ChatService"/>'s; this adds who may join (a booking, never a supervised child), who may post right now (<see cref="ChatRoomRules.PostProblem"/>), the hold on links and numbers, and the staff tools.
/// Every staff action is audited with who and what, never the words. A feature switch per kind (<see cref="ChatRoomOptions"/>) turns channels, sailing rooms or interest rooms off without a release.
/// </summary>
public sealed class ChatRoomService(IChatRoomStore rooms, IChatStore chat, IUserClock userClock, IClock clock, IAuditLog audit, IOptions<ChatRoomOptions> options, ChatFanoutQueue fanoutQueue, ChatFanout fanout, ChatNotifier notifier)
{
    /// <summary>The most pinned posts a room shows.</summary>
    public const int MaxPins = 3;

    private static bool IsStaff(UserRecord u) => u.Role == "admin";

    private bool On(string kind, string? roomKind) => ChatRoomRules.IsOn(options.Value, kind, roomKind);

    // ---- Guests ----

    /// <summary>
    /// The channels and rooms a guest may see: every open channel, the interest rooms (to read the rules and ask to join), and the sailing rooms of a sailing they are booked on. A room staff have not opened,
    /// or whose switch is off, is shown only to people already in it. <c>Blocked</c> says why they cannot join.
    /// </summary>
    public async Task<List<ChatRoomListItemDto>> ListAsync(UserRecord actor, CancellationToken ct)
    {
        var list = new List<ChatRoomListItemDto>();
        foreach (var r in await rooms.ListAsync(actor.Id, ct))
        {
            var visible = r.Joined || (On(r.Kind, r.RoomKind) && !r.Closed && (r.Kind == ChatRoomRules.Channel || r.RoomKind == ChatRoomRules.InterestRoom || r.BookedOnSailing || IsStaff(actor)));
            if (visible) list.Add(Item(actor, r));
        }
        return list;
    }

    private ChatRoomListItemDto Item(UserRecord actor, ChatRoomRow r) =>
        new(r.GroupPublicId, r.Kind, r.RoomKind, r.Name, r.Topic, r.Members, r.Joined, r.Joined ? null : Problem(actor, r), r.Closed);

    private string? Problem(UserRecord actor, ChatRoomRow r)
    {
        if (r.Removed) return "removed";
        var staff = IsStaff(actor);
        return ChatRoomRules.JoinProblem(r.Kind, r.RoomKind, actor.IsSupervised, staff || r.BookedOnSailing, staff || r.AnyBooking, r.Members, r.Cap, On(r.Kind, r.RoomKind), r.Closed);
    }

    /// <summary>Follows a channel or joins a room. The conversation starts muted: it never alerts a phone unless the guest turns it on or is mentioned. 403 child|noBooking|removed, 404, 409 off|closed|full.</summary>
    public async Task<ChatRoomListItemDto> JoinAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var r = await rooms.FindAsync(actor.Id, id, ct) ?? throw ApiException.NotFound();
        if (!r.Joined)
        {
            if (Problem(actor, r) is { } problem)
                throw problem is ChatRoomRules.Child or ChatRoomRules.NoBooking or "removed" ? ApiException.Forbidden(problem) : ApiException.Conflict(problem);
            var result = await rooms.JoinAsync(r.GroupId, actor.Id, r.Kind == ChatRoomRules.Room ? r.Cap : int.MaxValue, await userClock.NowAsync(actor, ct), ct);
            if (result == "full") throw ApiException.Conflict(ChatRoomRules.Full);
            if (result == "removed") throw ApiException.Forbidden("removed");
            r = await rooms.FindAsync(actor.Id, id, ct) ?? throw ApiException.NotFound();
        }
        return Item(actor, r);
    }

    /// <summary>The guest stops following or leaves. They read nothing said after they go, and can come back (unless staff removed them).</summary>
    public async Task LeaveAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var r = await rooms.FindAsync(actor.Id, id, ct) ?? throw ApiException.NotFound();
        await rooms.LeaveAsync(r.GroupId, actor.Id, await userClock.NowAsync(actor, ct), ct);
    }

    /// <summary>
    /// The rules and what staff chose to show, readable by any signed-in guest, in a room or not (decision 2: curated only). A guest's live post is never in it.
    /// A room that is not open, or whose switch is off, shows only to those inside it.
    /// </summary>
    public async Task<ChatRoomPreviewDto> PreviewAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var r = await rooms.FindAsync(actor.Id, id, ct) ?? throw ApiException.NotFound();
        if (!r.Joined && (r.Closed || !On(r.Kind, r.RoomKind) || (r.RoomKind == ChatRoomRules.SailingRoom && !r.BookedOnSailing && !IsStaff(actor)))) throw ApiException.NotFound();
        var lines = await rooms.PreviewAsync(r.GroupId, r.Kind, MaxPins, ct);
        return new(r.GroupPublicId, r.Kind, r.Name, r.Rules ?? ChatRoomRules.DefaultRules, [.. lines.Select(l => new ChatRoomPreviewLineDto(ChatConversationRules.Preview(l.Text, 240), Shipboard.Ms(l.At)))], await rooms.ListPopularAsync(r.GroupId, 10, ct));
    }

    /// <summary>
    /// A guest suggests a question for a room's popular questions, whether or not they are in it (they may be asking before they book). It reaches staff only; nothing shows to others until staff mark it popular.
    /// 400 text|contactInfo|blocked, 403 child, 404 for a room the caller cannot see, 429 tooMany (three waiting).
    /// </summary>
    public async Task SuggestQuestionAsync(UserRecord actor, Guid id, ChatRoomQuestionBody? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden(ChatRoomRules.Child);
        await PreviewAsync(actor, id, ct);   // the same visibility as the preview, so a hidden room is a 404
        var r = (await rooms.FindAsync(actor.Id, id, ct))!;
        var text = ChatRoomRules.CleanQuestion(body?.Text) ?? throw ApiException.Invalid("text");
        if (ProfanityFilter.IsBlocked(text)) throw ApiException.Invalid("blocked");
        if (ChatRoomRules.QuestionProblem(text, await rooms.CountOpenQuestionsAsync(r.GroupId, actor.Id, ct)) is { } problem)
            throw problem == "tooMany" ? ApiException.TooMany(problem) : ApiException.Invalid(problem);
        await rooms.AddQuestionAsync(r.GroupId, actor.Id, text, await userClock.NowAsync(actor, ct), ct);
    }

    /// <summary>The member says yes to the rules (asked on the first post). Repeating changes nothing. 404 unless they are a member of a room.</summary>
    public async Task AcceptRulesAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var r = await rooms.FindAsync(actor.Id, conversationId, ct);
        if (r is not { Joined: true }) throw ApiException.NotFound();
        await rooms.AcceptRulesAsync(r.GroupId, actor.Id, await userClock.NowAsync(actor, ct), ct);
    }

    /// <summary>What a conversation of this kind shows about itself: the rules, whether slow mode applies now and whether this member may post. Null for anything that is not a channel or room.</summary>
    public ChatRoomInfoDto? InfoOf(ChatMemberRow m, bool isStaff, int members, DateTime utcNow)
    {
        if (!ChatRoomRules.IsRoomKind(m.Kind)) return null;
        var slow = m.Kind == ChatRoomRules.Room && ChatRoomRules.SlowNow(m.SlowMode, utcNow, m.RefOffsetMinutes);
        var why = ChatRoomRules.PostProblem(m.Kind, isStaff, m.Status == ChatConversationRules.Active, m.DirectEnded, On(m.Kind, m.RoomKind), m.RulesAcceptedAt is not null, m.ModMutedUntil, slow: false, sinceLastPost: null, utcNow);
        // "Rules not accepted" does not stop the post box from showing: the guest is asked on the first post, so it is not a reason the box is hidden.
        var canPost = why is null or ChatRoomRules.RulesFirst;
        return new(m.RoomKind ?? "", m.Topic, m.Rules ?? ChatRoomRules.DefaultRules, slow, m.RulesAcceptedAt is not null, canPost, canPost ? null : why, m.Kind == ChatRoomRules.Channel, members);
    }

    /// <summary>
    /// The checks before a post in a channel or room is stored. Refused with 403 staffOnly|muted, 409 off|rulesNotAccepted|held, 429 slow, 400 emergency. A post with a link or phone number is not sent: it is kept for staff
    /// and the sender is told 409 <c>held</c>. Called after the word filter, so nothing the filter blocks is ever held.
    /// </summary>
    public async Task GuardPostAsync(UserRecord actor, ChatMemberRow member, string text, DateTime userNow, CancellationToken ct)
    {
        var utc = clock.UtcNow;
        var staff = IsStaff(actor);
        var slow = member.Kind == ChatRoomRules.Room && ChatRoomRules.SlowNow(member.SlowMode, utc, member.RefOffsetMinutes);
        TimeSpan? since = null;
        if (slow && !staff && await rooms.LastPostAsync(member.GroupId, actor.Id, ct) is { } last) since = userNow - last;
        var problem = ChatRoomRules.PostProblem(member.Kind, staff, member.Status == ChatConversationRules.Active, member.DirectEnded, On(member.Kind, member.RoomKind), member.RulesAcceptedAt is not null, member.ModMutedUntil, slow, since, utc);
        if (problem is not null)
            throw problem switch
            {
                ChatRoomRules.StaffOnly or ChatRoomRules.Muted => ApiException.Forbidden(problem),
                ChatRoomRules.Slow => ApiException.TooMany(problem),
                _ => ApiException.Conflict(problem),
            };
        if (staff) return;
        // A room is not where an emergency is handled: the guest is pointed to Get help now, and nothing is posted.
        if (ChatRoomRules.LooksLikeEmergency(text)) throw ApiException.Invalid("emergency");
        if (ChatRoomRules.NeedsHold(member.Kind, text))
        {
            await rooms.AddHeldAsync(member.GroupId, actor.Id, text, ChatRoomRules.HeldReason, userNow, ct);
            await AuditAsync(actor, "chat.room.hold", member.GroupPublicId, null, ct);
            throw ApiException.Conflict("held");
        }
    }

    // ---- Staff ----

    private async Task<ChatRoomRow> FindAsync(UserRecord admin, Guid id, CancellationToken ct) =>
        await rooms.FindAsync(admin.Id, id, ct) ?? throw ApiException.NotFound();

    private ChatRoomAdminDto AdminItem(ChatRoomRow r, DateTime utc) =>
        new(r.GroupPublicId, r.Kind, r.RoomKind, r.Name, r.Topic, r.SailingId, r.Members, r.Cap, r.Moderators, r.Closed, r.SlowMode, ChatRoomRules.InModeratorHours(utc, r.RefOffsetMinutes), r.Rules ?? ChatRoomRules.DefaultRules);

    public async Task<List<ChatRoomAdminDto>> ListAdminAsync(UserRecord admin, CancellationToken ct)
    {
        var utc = clock.UtcNow;
        return [.. (await rooms.ListAllAsync(ct)).Select(r => AdminItem(r, utc))];
    }

    /// <summary>Opens a channel (live at once: only staff post in it) or a room (closed until its rota is named and a moderator opens it). 400 kind|roomKind|name|topic|sailing|rules|cap.</summary>
    public async Task<ChatRoomAdminDto> CreateAsync(UserRecord admin, ChatRoomCreateBody? body, CancellationToken ct)
    {
        var kind = body?.Kind;
        if (kind is not (ChatRoomRules.Channel or ChatRoomRules.Room)) throw ApiException.Invalid("kind");
        var name = ChatRoomRules.CleanName(body?.Name) ?? throw ApiException.Invalid("name");
        string? roomKind = null, topic = null, sailing = null;
        if (kind == ChatRoomRules.Room)
        {
            roomKind = body?.RoomKind;
            if (roomKind is not (ChatRoomRules.SailingRoom or ChatRoomRules.InterestRoom)) throw ApiException.Invalid("roomKind");
            if (roomKind == ChatRoomRules.InterestRoom) topic = ChatRoomRules.CleanTopic(body?.Topic) ?? throw ApiException.Invalid("topic");
        }
        else topic = string.IsNullOrWhiteSpace(body?.Topic) ? null : ChatRoomRules.CleanTopic(body.Topic) ?? throw ApiException.Invalid("topic");
        if (roomKind == ChatRoomRules.SailingRoom || !string.IsNullOrWhiteSpace(body?.SailingId))
        {
            sailing = body?.SailingId?.Trim();
            if (string.IsNullOrEmpty(sailing) || !await rooms.SailingExistsAsync(sailing, ct)) throw ApiException.Invalid("sailing");
        }
        var rules = string.IsNullOrWhiteSpace(body?.Rules) ? ChatRoomRules.DefaultRules : ChatRoomRules.CleanRules(body.Rules) ?? throw ApiException.Invalid("rules");
        var cap = body?.Cap ?? ChatRoomRules.DefaultMemberCap;
        if (cap is < 2 or > 5000) throw ApiException.Invalid("cap");
        var offset = Math.Clamp(body?.ReferenceOffsetMinutes ?? 0, -14 * 60, 14 * 60);
        var utc = clock.UtcNow;
        var (groupId, publicId) = await rooms.CreateAsync(kind, roomKind, name, topic, sailing, offset, cap, rules, admin.Id, utc, ct);
        await rooms.LogActionAsync(groupId, admin.Id, ChatRoomRules.ActOpen, null, null, utc, ct);
        await AuditAsync(admin, "chat.room.create", publicId, new { kind, roomKind }, ct);
        return AdminItem((await rooms.FindAsync(admin.Id, publicId, ct))!, utc);
    }

    /// <summary>Slow mode on or off, open or close, new rules, or a named moderator. A room opens only with at least two moderators (409 <c>rota</c>). 400 action|rules|person.</summary>
    public async Task<ChatRoomAdminDto> ActAsync(UserRecord admin, Guid id, ChatRoomActionBody? body, CancellationToken ct)
    {
        var r = await FindAsync(admin, id, ct);
        var utc = clock.UtcNow;
        switch (body?.Action)
        {
            case "slow":
                await rooms.SetSlowAsync(r.GroupId, body.On ?? !r.SlowMode, ct);
                await rooms.LogActionAsync(r.GroupId, admin.Id, ChatRoomRules.ActSlow, null, null, utc, ct);
                break;
            case "open":
                if (ChatRoomRules.OpenProblem(r.Kind, await rooms.CountModeratorsAsync(r.GroupId, ct)) is { } gate) throw ApiException.Conflict(gate);
                await rooms.SetClosedAsync(r.GroupId, false, ct);
                await rooms.LogActionAsync(r.GroupId, admin.Id, ChatRoomRules.ActOpen, null, null, utc, ct);
                break;
            case "close":
                await rooms.SetClosedAsync(r.GroupId, true, ct);
                await rooms.LogActionAsync(r.GroupId, admin.Id, ChatRoomRules.ActClose, null, null, utc, ct);
                break;
            case "rules":
                await rooms.SetRulesAsync(r.GroupId, ChatRoomRules.CleanRules(body.Rules) ?? throw ApiException.Invalid("rules"), ct);
                await rooms.LogActionAsync(r.GroupId, admin.Id, ChatRoomRules.ActRules, null, null, utc, ct);
                break;
            case "moderator" or "unmoderator":
                if (body.PersonId is not { } person || !await rooms.SetModeratorAsync(r.GroupId, person, body.Action == "moderator", utc, ct)) throw ApiException.Invalid("person");
                break;
            default:
                throw ApiException.Invalid("action");
        }
        await AuditAsync(admin, "chat.room." + body!.Action, id, null, ct);
        return AdminItem((await rooms.FindAsync(admin.Id, id, ct))!, utc);
    }

    /// <summary>Mutes a person for an hour, a day or the room, lifts a mute, or removes them for good. 400 action|for, 404 when they are not in the room.</summary>
    public async Task PersonAsync(UserRecord admin, Guid id, Guid personId, ChatRoomPersonBody? body, CancellationToken ct)
    {
        var r = await FindAsync(admin, id, ct);
        var utc = clock.UtcNow;
        long? target;
        string action;
        switch (body?.Action)
        {
            case "mute":
                var until = ChatRoomRules.MuteEnd(body.For, utc) ?? throw ApiException.Invalid("for");
                target = await rooms.MuteMemberAsync(r.GroupId, personId, until, ct);
                action = ChatRoomRules.ActMute;
                break;
            case "unmute":
                target = await rooms.MuteMemberAsync(r.GroupId, personId, null, ct);
                action = ChatRoomRules.ActUnmute;
                break;
            case "remove":
                target = await rooms.RemoveMemberAsync(r.GroupId, personId, utc, ct);
                action = ChatRoomRules.ActKick;
                break;
            default:
                throw ApiException.Invalid("action");
        }
        if (target is null) throw ApiException.NotFound();
        await rooms.LogActionAsync(r.GroupId, admin.Id, action, target, null, utc, ct);
        await AuditAsync(admin, "chat.room." + action, id, null, ct);
    }

    /// <summary>Takes a message away for everyone (the words are kept for the report case, and open reports on it are closed) or pins it as staff. 400 action, 404 for a message that is not a person's live post here, 409 pinsFull.</summary>
    public async Task MessageAsync(UserRecord admin, Guid id, Guid messageId, ChatRoomMessageBody? body, CancellationToken ct)
    {
        var r = await FindAsync(admin, id, ct);
        var utc = clock.UtcNow;
        long? mid;
        switch (body?.Action)
        {
            case "remove":
                mid = (await rooms.RemoveMessageAsync(r.GroupId, messageId, admin.Id, utc, ct))?.Id;
                if (mid is null) throw ApiException.NotFound();
                await rooms.LogActionAsync(r.GroupId, admin.Id, ChatRoomRules.ActRemove, null, mid, utc, ct);
                // Open apps refetch at once and drop the text; no phone is ever alerted for a removal.
                await Task.WhenAll((await rooms.ActiveMemberIdsAsync(r.GroupId, ct)).Select(u => notifier.ThreadChangedAsync(u, r.GroupPublicId, "deleted", ct)));
                break;
            case "pin":
                if (!await rooms.PinAsync(r.GroupId, messageId, admin.Id, utc, MaxPins, ct)) throw ApiException.Conflict("pinsFull");
                await rooms.LogActionAsync(r.GroupId, admin.Id, ChatRoomRules.ActPin, null, null, utc, ct);
                break;
            default:
                throw ApiException.Invalid("action");
        }
        await AuditAsync(admin, "chat.room." + body!.Action, id, null, ct);
    }

    // ---- What staff pick from (posts, people, rota) ----

    /// <summary>The latest live posts of a room, newest first, with the words, for staff to remove or pin. Sender first name and last initial only. The read is audited. 404 for no such room.</summary>
    public async Task<List<ChatRoomPostDto>> PostsAsync(UserRecord admin, Guid id, CancellationToken ct)
    {
        var r = await FindAsync(admin, id, ct);
        var rows = await rooms.ListPostsAsync(r.GroupId, 50, ct);
        await AuditAsync(admin, "chat.room.posts.read", id, new { count = rows.Count }, ct);
        return [.. rows.Select(p => new ChatRoomPostDto(p.PublicId, p.FromPublicId, ChatConnectionRules.ShortName(p.FirstName, p.LastName), p.Text, Shipboard.Ms(p.At), p.Pinned))];
    }

    /// <summary>The active members of a room (first name and last initial) with their mute, for staff to mute, unmute or remove. The read is audited. 404 for no such room.</summary>
    public async Task<List<ChatRoomPersonDto>> PeopleAsync(UserRecord admin, Guid id, CancellationToken ct)
    {
        var r = await FindAsync(admin, id, ct);
        var utc = clock.UtcNow;
        var rows = await rooms.ListPeopleAsync(r.GroupId, 500, ct);
        await AuditAsync(admin, "chat.room.people.read", id, new { count = rows.Count }, ct);
        return [.. rows.Select(p => new ChatRoomPersonDto(p.PublicId, ChatConnectionRules.ShortName(p.FirstName, p.LastName), p.MutedUntil > utc, p.MutedUntil > utc ? Shipboard.Ms(p.MutedUntil.Value) : null))];
    }

    /// <summary>The administrators who could be on a room's rota, with whether each is named. 404 for no such room.</summary>
    public async Task<List<ChatRoomModeratorDto>> RotaAsync(UserRecord admin, Guid id, CancellationToken ct)
    {
        var r = await FindAsync(admin, id, ct);
        return [.. (await rooms.ListModeratorsAsync(r.GroupId, ct)).Select(m => new ChatRoomModeratorDto(m.PublicId, ChatConnectionRules.ShortName(m.FirstName, m.LastName), m.Named))];
    }

    // ---- Suggested questions (staff) ----

    /// <summary>The suggested questions waiting for staff, oldest first. No names. The read is audited.</summary>
    public async Task<List<ChatQuestionDto>> QuestionsAsync(UserRecord admin, CancellationToken ct)
    {
        var rows = await rooms.ListSuggestedAsync(100, ct);
        await AuditAsync(admin, "chat.room.questions.read", null, new { count = rows.Count }, ct);
        return [.. rows.Select(q => new ChatQuestionDto(q.PublicId, q.GroupPublicId, q.GroupName, q.Text, Shipboard.Ms(q.At)))];
    }

    /// <summary>Marks a suggested question popular or rejects it. 400 decision, 404, 409 decided.</summary>
    public async Task DecideQuestionAsync(UserRecord admin, Guid id, ChatQuestionDecisionBody? body, CancellationToken ct)
    {
        var popular = body?.Decision == "popular";
        if (!popular && body?.Decision != "reject") throw ApiException.Invalid("decision");
        var q = await rooms.GetQuestionAsync(id, ct) ?? throw ApiException.NotFound();
        if (!await rooms.ResolveQuestionAsync(q.Id, popular ? ChatRoomRules.Popular : ChatRoomRules.Rejected, admin.Id, clock.UtcNow, ct)) throw ApiException.Conflict("decided");
        await AuditAsync(admin, "chat.room.question." + (popular ? "popular" : "reject"), q.GroupPublicId, null, ct);
    }

    // ---- Held posts ----

    /// <summary>The posts waiting for staff, oldest first. The words are shown to staff only, with the sender's first name and last initial. The read is audited.</summary>
    public async Task<List<ChatHeldDto>> HeldAsync(UserRecord admin, CancellationToken ct)
    {
        var rows = await rooms.ListHeldAsync(100, ct);
        await AuditAsync(admin, "chat.room.held.read", null, new { count = rows.Count }, ct);
        return [.. rows.Select(h => new ChatHeldDto(h.PublicId, h.GroupPublicId, h.GroupName, ChatConnectionRules.ShortName(h.FirstName, h.LastName), h.Text, h.Reason, Shipboard.Ms(h.At)))];
    }

    /// <summary>Releases a held post (it is posted as the guest's, now) or rejects it (the words are cleared). 400 decision, 404, 409 decided|left.</summary>
    public async Task DecideHeldAsync(UserRecord admin, Guid heldId, ChatHeldDecisionBody? body, CancellationToken ct)
    {
        var release = body?.Decision == "release";
        if (!release && body?.Decision != "reject") throw ApiException.Invalid("decision");
        var held = await rooms.GetHeldAsync(heldId, ct) ?? throw ApiException.NotFound();
        if (held.Status != "held") throw ApiException.Conflict("decided");
        var utc = clock.UtcNow;
        if (release)
        {
            // A guest who has since left or been removed is not posted for.
            var sender = await chat.GetMemberAsync(held.FromUserId, held.GroupPublicId, ct);
            if (sender is not { Status: ChatConversationRules.Active }) throw ApiException.Conflict("left");
            if (!await rooms.ResolveHeldAsync(held.Id, "released", admin.Id, utc, ct)) throw ApiException.Conflict("decided");
            var sent = await chat.AddMessageAsync(held.GroupId, held.FromUserId, held.Text, null, null, utc, ct);
            var job = new ChatFanoutJob(held.FromUserId, held.GroupId, held.GroupPublicId, sent.Row, sender.Kind);
            if (!fanoutQueue.TryEnqueue(job)) await fanout.RunAsync(job, CancellationToken.None);
        }
        else if (!await rooms.ResolveHeldAsync(held.Id, "rejected", admin.Id, utc, ct)) throw ApiException.Conflict("decided");
        await rooms.LogActionAsync(held.GroupId, admin.Id, release ? ChatRoomRules.ActRelease : ChatRoomRules.ActReject, held.FromUserId, null, utc, ct);
        await AuditAsync(admin, "chat.room." + (release ? "release" : "reject"), held.GroupPublicId, null, ct);
    }

    // ---- Weekly summary ----

    /// <summary>What the last <paramref name="days"/> days (1 to 31, default 7) looked like: reports, staff actions, the busiest rooms and the open rooms without their rota. Counts and room names only.</summary>
    public async Task<ChatRoomSummaryDto> SummaryAsync(UserRecord admin, int? days, CancellationToken ct)
    {
        var d = Math.Clamp(days ?? 7, 1, 31);
        var since = clock.UtcNow.AddDays(-d);
        var all = await rooms.ListAllAsync(ct);
        return new(d, await rooms.CountReportsAsync(since, ct),
            [.. (await rooms.ActionCountsAsync(since, ct)).Select(a => new ChatRoomActionCountDto(a.Action, a.Count))],
            [.. (await rooms.BusiestAsync(since, 5, ct)).Select(b => new ChatRoomBusyDto(b.GroupPublicId, b.Name, b.Count))],
            [.. all.Where(r => ChatRoomRules.NeedsModerator(r.Kind, r.Closed, r.Moderators)).Select(r => new ChatRoomGapDto(r.GroupPublicId, r.Name, r.Moderators))],
            await rooms.CountHeldAsync(ct));
    }

    private Task AuditAsync(UserRecord who, string action, Guid? room, object? detail, CancellationToken ct) =>
        audit.RecordAsync(new AuditEntry
        {
            Category = AuditCategory.Domain, Action = action, Outcome = AuditOutcome.Success, ActorPublicId = who.PublicId, ActorRole = who.Role,
            Target = room is null ? null : "room:" + room, Detail = detail is null ? null : AuditContext.Json(detail),
        }, ct);
}
