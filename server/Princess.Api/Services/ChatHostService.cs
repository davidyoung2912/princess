using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Switches for Stanley as host: <c>HostOn</c> (role R6: meet-ups, "introduce me", flags) and <c>RoomHostOn</c> (role R11: welcome and library answers in rooms, off until moderation is proven).</summary>
public sealed class ChatHostOptions
{
    public const string Section = "Chat:Host";
    public bool HostOn { get; set; } = true;
    public bool RoomHostOn { get; set; }
}

/// <summary>
/// Stanley as host for strangers (R6) and room host (R11), docs/chat-features-research.md, phase 12. A meet-up is posted as the guest's own words through the ordinary send (so slow mode, the rules and the hold on links all apply),
/// with answers kept apart: in and maybe are counted, a no is never shown. "Introduce me" pairs two guests in the same room who both asked for the same interest; each is told in their own Stanley thread, and either may then
/// send an ordinary chat request. Room answers come from the curated library only. A flag goes to staff as ids and a reason. Stanley never removes, mutes, pins or closes anything, and says nothing where the member muted him
/// or a supervised child is present. Nothing here logs or audits a name or a message.
/// </summary>
public sealed class ChatHostService(IChatHostStore store, IChatStore chat, ChatService chatService, IChatGroupStore groups, IChatHuddleStore profiles, IUserClock userClock, IClock clock, IAuditLog audit, IOptions<ChatHostOptions> options, IOptions<ChatRoomOptions> roomOptions)
{
    public const string IntroTail = " You can send a chat request from your chats if you like.";
    private const int MaxMeetUps = 20;

    private void RequireHost() { if (!options.Value.HostOn) throw ApiException.Conflict(ChatHostRules.Off); }
    private void RequireRoomHost() { if (!options.Value.RoomHostOn) throw ApiException.Conflict(ChatHostRules.Off); }

    private async Task<ChatMemberRow> MemberAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var m = await chat.GetMemberAsync(actor.Id, id, ct);
        if (m is null || m.Status != ChatConversationRules.Active || m.Kind is not (ChatRoomRules.Room or ChatConversationRules.Group)) throw ApiException.NotFound();
        if (m.Kind == ChatRoomRules.Room && !ChatRoomRules.IsOn(roomOptions.Value, m.Kind, m.RoomKind)) throw ApiException.Conflict(ChatHostRules.Off);
        return m;
    }

    private static ChatMeetUpDto Dto(ChatMeetUpRow r, long actorId) => new(r.PublicId, r.Title, r.Place, r.In, r.Maybe, r.Mine, r.StartedBy == actorId, Shipboard.Ms(r.CreatedAt));

    // ---- Meet-ups ----

    public async Task<List<ChatMeetUpDto>> ListMeetUpsAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        RequireHost();
        var m = await MemberAsync(actor, id, ct);
        return [.. (await store.ListMeetUpsAsync(m.GroupId, actor.Id, MaxMeetUps, ct)).Select(r => Dto(r, actor.Id))];
    }

    /// <summary>Starts a meet-up. 400 text|contactInfo; 403 supervised; 404; 409 off|closed plus the room's own post refusals; 429 limit (three a day).</summary>
    public async Task<ChatMeetUpDto> StartMeetUpAsync(UserRecord actor, Guid id, ChatMeetUpBody? body, CancellationToken ct)
    {
        RequireHost();
        var m = await MemberAsync(actor, id, ct);
        var title = Clean(body?.Title, ChatHostRules.MaxMeetUpTitle) ?? throw ApiException.Invalid(ChatHostRules.BadText);
        string? place = null;
        if (!string.IsNullOrWhiteSpace(body?.Place)) place = Clean(body.Place, ChatHostRules.MaxMeetUpPlace) ?? throw ApiException.Invalid(ChatHostRules.BadText);
        var now = await userClock.NowAsync(actor, ct);
        var started = await store.MeetUpsStartedSinceAsync(actor.Id, now.AddHours(-24), ct);
        if (ChatHostRules.MeetUpRefusal(actor.IsSupervised, true, m.DirectEnded, started) is { } no)
            throw no == ChatHostRules.Supervised ? ApiException.Forbidden(no) : no == ChatHostRules.Limit ? ApiException.TooMany(no) : ApiException.Conflict(no);
        // The post is the guest's own, through the ordinary send, so slow mode, the rules and the hold on links all apply and nothing is posted by Stanley.
        await chatService.SendAsync(actor, id, new SendChatRequest(ChatHostRules.MeetUpPreview(title) + (place is null ? "" : " at " + place)), ct);
        var meetUpId = await store.CreateMeetUpAsync(m.GroupId, actor.Id, title, place, null, now, ct);
        var row = await store.FindMeetUpAsync(actor.Id, meetUpId, ct) ?? throw ApiException.NotFound();
        await store.SetAnswerAsync(row.Id, actor.Id, ChatHostRules.MeetIn, now, ct);
        return Dto((await store.FindMeetUpAsync(actor.Id, meetUpId, ct))!, actor.Id);
    }

    private static string? Clean(string? text, int max) => ChatHostRules.CleanMeetUpText(text, max);

    /// <summary>Answers a meet-up in, maybe or no. Changing it is allowed. 400 answer; 403 supervised; 404 unless a member.</summary>
    public async Task<ChatMeetUpDto> AnswerMeetUpAsync(UserRecord actor, Guid meetUpId, ChatMeetUpAnswerBody? body, CancellationToken ct)
    {
        RequireHost();
        if (actor.IsSupervised) throw ApiException.Forbidden(ChatHostRules.Supervised);
        var row = await store.FindMeetUpAsync(actor.Id, meetUpId, ct) ?? throw ApiException.NotFound();
        var answer = ChatHostRules.ParseMeetAnswer(body?.Answer) ?? throw ApiException.Invalid("answer");
        await store.SetAnswerAsync(row.Id, actor.Id, answer, await userClock.NowAsync(actor, ct), ct);
        return Dto((await store.FindMeetUpAsync(actor.Id, meetUpId, ct))!, actor.Id);
    }

    // ---- Introduce me ----

    private static ChatIntroDto Intro(string state, string? interest = null, DateTime? ends = null, string? name = null) =>
        new(state, interest, ends is { } e ? Shipboard.Ms(e) : null, name, [.. ChatHostRules.Interests]);

    public async Task<ChatIntroDto> IntroStatusAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        RequireHost();
        var m = await MemberAsync(actor, id, ct);
        var live = await store.LiveOptInAsync(actor.Id, m.GroupId, clock.UtcNow, ct);
        return live is null ? Intro("none") : Intro("waiting", live.Interest, live.EndsAt);
    }

    /// <summary>
    /// "Introduce me" in a room: one interest from the list, for a day. When another guest in the same room asked for the same interest, both are introduced at once and told in their own Stanley thread; otherwise this waits.
    /// 400 unknown; 403 supervised|notAdult; 404; 409 off|notRoom; 429 limit. Nothing but the interest is read about either guest.
    /// </summary>
    public async Task<ChatIntroDto> IntroOptInAsync(UserRecord actor, Guid id, ChatIntroBody? body, CancellationToken ct)
    {
        RequireHost();
        var m = await MemberAsync(actor, id, ct);
        if (m.Kind != ChatRoomRules.Room) throw ApiException.Conflict("notRoom");
        var now = clock.UtcNow;
        var age = await profiles.BornAsync(actor.Id, ct) is { } born ? ChatHuddleRules.AgeOn(born, DateOnly.FromDateTime(now)) : (int?)null;
        var today = await store.IntroducedSinceAsync(actor.Id, now.AddHours(-24), ct);
        if (ChatHostRules.OptInRefusal(actor.IsSupervised, age is >= ChatHuddleRules.AdultAge, body?.Interest, today) is { } no)
            throw no switch { ChatHostRules.Supervised or ChatHostRules.NotAdult => ApiException.Forbidden(no), ChatHostRules.Limit => ApiException.TooMany(no), _ => ApiException.Invalid(no) };
        var interest = ChatHostRules.CleanInterest(body?.Interest)!;
        await store.AddOptInAsync(actor.Id, m.GroupId, interest, now, ChatHostRules.OptInEnds(now), ct);
        var met = await TryMatchAsync(m.GroupId, actor.Id, now, ct);
        return met is { } other ? Intro("introduced", interest, null, other) : Intro("waiting", interest, ChatHostRules.OptInEnds(now));
    }

    /// <summary>The guest takes back their asking, now, in every room.</summary>
    public async Task WithdrawIntroAsync(UserRecord actor, CancellationToken ct)
    {
        RequireHost();
        await store.WithdrawOptInsAsync(actor.Id, clock.UtcNow, ct);
    }

    /// <summary>Pairs the live opt-ins of one room and tells each pair, in their own Stanley thread. Returns the short name of whoever <paramref name="me"/> was paired with, or null.</summary>
    private async Task<string?> TryMatchAsync(long groupId, long me, DateTime now, CancellationToken ct)
    {
        var live = await store.ListLiveOptInsAsync(groupId, now, ct);
        var counts = new Dictionary<long, int>();
        foreach (var o in live) counts[o.UserId] = await store.IntroducedSinceAsync(o.UserId, now.AddHours(-24), ct);
        var blocked = new HashSet<(long, long)>();
        var met = new HashSet<(long, long)>();
        foreach (var a in live)
            foreach (var b in live.Where(x => x.UserId != a.UserId && x.Interest == a.Interest))
            {
                if (await groups.HasBlockedAsync(a.UserId, b.UserId, ct)) blocked.Add((a.UserId, b.UserId));
                if (await store.WereIntroducedAsync(a.UserId, b.UserId, ct)) met.Add((a.UserId, b.UserId));
            }
        var pairs = ChatHostRules.Match(live.Select(o => new IntroCandidate(o.UserId, o.Interest, o.AskedAt, o.Adult, o.Supervised, counts[o.UserId])), (a, b) => blocked.Contains((a, b)), (a, b) => met.Contains((a, b)));
        string? mine = null;
        foreach (var p in pairs)
        {
            if (!await store.CreateIntroductionAsync(p.A, p.B, groupId, p.Interest, now, ct)) continue;
            var names = await store.NamesAsync([p.A, p.B], ct);
            string Short(long u) => names.TryGetValue(u, out var n) ? ChatConnectionRules.ShortName(n.First, n.Last) : "Someone";
            var line = ChatHostRules.IntroLine(Short(p.A), Short(p.B), p.Interest) + IntroTail;
            await chat.AddStanleyLineAsync(p.A, line, "ship", "Introduction to " + Short(p.B), now, ct);
            await chat.AddStanleyLineAsync(p.B, line, "ship", "Introduction to " + Short(p.A), now, ct);
            if (p.A == me) mine = Short(p.B); else if (p.B == me) mine = Short(p.A);
        }
        return mine;
    }

    // ---- Room host ----

    /// <summary>What a room says to a new member: the welcome, the rules and what Stanley can answer. The line is null (and nothing is shown) when room hosting is off, this member muted Stanley, or a supervised child is present.</summary>
    public async Task<ChatHostWelcomeDto> WelcomeAsync(UserRecord actor, Guid id, CancellationToken ct)
    {
        var m = await MemberAsync(actor, id, ct);
        var rules = m.Rules ?? ChatRoomRules.DefaultRules;
        if (!options.Value.RoomHostOn || !ChatHostRules.MaySpeak(m.StanleyMuted, await store.HasSupervisedMemberAsync(m.GroupId, ct))) return new(null, rules, []);
        return new(ChatHostRules.RoomWelcome(m.Name, rules), rules, [.. ChatHostRules.Library.Select(e => e.Id)]);
    }

    /// <summary>
    /// A question to Stanley in a room. Only a library answer is ever given, and it is posted to the room for everyone; anything else gets the plain "ask Guest Services" words, shown only to the asker.
    /// 400 text; 404; 409 off. Where the member muted Stanley, nothing is posted.
    /// </summary>
    public async Task<ChatHostAnswerDto> AskAsync(UserRecord actor, Guid id, ChatHostAskBody? body, CancellationToken ct)
    {
        RequireRoomHost();
        var m = await MemberAsync(actor, id, ct);
        var text = ChatConversationRules.CleanText(body?.Text) ?? throw ApiException.Invalid(ChatHostRules.BadText);
        var entry = ChatHostRules.FindAnswer(text);
        if (entry is null || !ChatHostRules.MaySpeak(m.StanleyMuted, await store.HasSupervisedMemberAsync(m.GroupId, ct))) return new(false, ChatHostRules.NoAnswer);
        await store.PostLineAsync(m.GroupId, entry.Answer, await userClock.NowAsync(actor, ct), ct);
        return new(true, entry.Answer);
    }

    // ---- Flags ----

    /// <summary>Flags a post to staff. Nothing happens to the post or the person until staff decide. 400 unknown; 403 supervised; 404 unless the post is in a room or group the caller is in; 429 limit.</summary>
    public async Task FlagAsync(UserRecord actor, Guid messageId, ChatHostFlagBody? body, CancellationToken ct)
    {
        RequireHost();
        if (actor.IsSupervised) throw ApiException.Forbidden(ChatHostRules.Supervised);
        var now = clock.UtcNow;
        if (ChatHostRules.FlagRefusal(body?.Reason, await store.FlagsSinceAsync(actor.Id, now.AddHours(-24), ct)) is { } no)
            throw no == ChatHostRules.Limit ? ApiException.TooMany(no) : ApiException.Invalid(no);
        var (ok, room) = await store.AddFlagAsync(actor.Id, messageId, body!.Reason!, now, ct);
        if (!ok) throw ApiException.NotFound();
        await AuditAsync(actor, "chat.host.flag", room, ct);
    }

    public async Task<List<ChatHostFlagDto>> ListFlagsAsync(UserRecord admin, CancellationToken ct) =>
        [.. (await store.ListOpenFlagsAsync(100, ct)).Select(f => new ChatHostFlagDto(f.Id, f.RoomId, f.RoomName, f.MessageId, f.Reason, Shipboard.Ms(f.CreatedAt)))];

    /// <summary>Staff mark a flag looked at. Removing, muting or pinning are the room tools; this only closes the flag. 404 when it is gone or already decided.</summary>
    public async Task DecideFlagAsync(UserRecord admin, Guid flagId, CancellationToken ct)
    {
        if (!await store.DecideFlagAsync(flagId, clock.UtcNow, ct)) throw ApiException.NotFound();
        await AuditAsync(admin, "chat.host.flag.decide", null, ct);
    }

    private Task AuditAsync(UserRecord who, string action, Guid? room, CancellationToken ct) =>
        audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = action, Outcome = AuditOutcome.Success, ActorPublicId = who.PublicId, ActorRole = who.Role, Target = room is null ? null : "room:" + room }, ct);
}
