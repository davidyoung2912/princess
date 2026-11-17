using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Microsoft.Extensions.Options;

namespace Princess.Api.Services;

/// <summary>
/// Stanley on tap in a thread (docs/chat-features-research.md, phase 10): a private catch-up, a poll preview made from one message, the plain meaning of a cruise word, a draft for a delayed or meeting message,
/// and the creator's off switch. Everything reads through the same window and block rule as the thread, so Stanley never shows a person a message they could not already read. Nothing he makes is stored in the thread
/// or sent to anyone: a preview is posted only when the person taps through the ordinary poll route. There is no model call, so nothing a member writes can steer him. Not offered in Stanley's own chat, a channel
/// or room, a conversation with a supervised child in it, or one whose creator turned it off.
/// </summary>
public sealed class ChatStanleyService(IChatStore store, IChatStanleyStore uses, IUserClock clock, IAuditLog audit, IOptions<StanleyOptions> options, IConciergeModel model, IConciergeLimiter limiter)
{
    private const int ReadAtMost = 120;

    private static string ShortName(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    private sealed record Room(ChatMemberRow Member, List<ChatPeerRow> People, bool Off);

    private async Task<Room> OpenAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        var people = await store.ListMembersAsync(member.GroupId, ct);
        return new(member, people, await uses.IsOffAsync(member.GroupId, ct));
    }

    private static string? ReasonFor(Room r, string role = "R1") =>
        ChatStanleyRules.Unavailable(r.Member.Kind, r.People.Any(p => p.Status == ChatConversationRules.Active && p.IsSupervised), r.Off, role);

    /// <summary>Whether Stanley's help is on in a conversation, and whether the caller may switch it. 404 when the caller is not a member.</summary>
    public async Task<ChatStanleyTapDto> TapAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var room = await OpenAsync(actor, conversationId, ct);
        var reason = ReasonFor(room);
        return new(reason is null, ChatStanleyRules.MayConfigure(room.Member.Kind, actor.Id, room.Member.CreatedByUserId) && room.Member.Status == ChatConversationRules.Active, room.Off, reason, room.Member.StanleyMuted);
    }

    /// <summary>Turns Stanley's help off or on for a group the caller made. 403 <c>notCreator</c> for anyone else; 404 when the caller is not a member.</summary>
    public async Task<ChatStanleyTapDto> SetOffAsync(UserRecord actor, Guid conversationId, ChatStanleyOffBody? body, CancellationToken ct)
    {
        var room = await OpenAsync(actor, conversationId, ct);
        if (!ChatStanleyRules.MayConfigure(room.Member.Kind, actor.Id, room.Member.CreatedByUserId) || room.Member.Status != ChatConversationRules.Active) throw ApiException.Forbidden("notCreator");
        var off = body?.Off ?? throw ApiException.Invalid("off");
        if (off != room.Off)
        {
            await uses.SetOffAsync(room.Member.GroupId, off, ct);
            // The conversation says so, for everyone, so his silence is never a surprise.
            await store.AddSystemLineAsync(room.Member.GroupId, actor.Id, ChatStanleyRules.SwitchLine(off), await clock.NowAsync(actor, ct), ct);
        }
        return await TapAsync(actor, conversationId, ct);
    }

    /// <summary>Hides Stanley's answers in this conversation for the caller only (or shows them again). Nobody is told. 404 when the caller is not a member.</summary>
    public async Task<ChatStanleyTapDto> SetMutedAsync(UserRecord actor, Guid conversationId, ChatStanleyMuteBody? body, CancellationToken ct)
    {
        var room = await OpenAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(room.Member.Kind) || ChatRoomRules.IsRoomKind(room.Member.Kind)) throw ApiException.Forbidden("kind");
        var muted = body?.Muted ?? throw ApiException.Invalid("muted");
        if (muted != room.Member.StanleyMuted) await uses.SetMutedAsync(room.Member.GroupId, actor.Id, muted, ct);
        return await TapAsync(actor, conversationId, ct);
    }

    private async Task<Room> RequireOnAsync(UserRecord actor, Guid conversationId, bool roleOn, string role, CancellationToken ct)
    {
        if (!roleOn) throw ApiException.Forbidden(StanleySwitches.Stopped);
        var room = await OpenAsync(actor, conversationId, ct);
        if (ReasonFor(room, role) is { } reason) throw ApiException.Forbidden(reason);
        return room;
    }

    /// <summary>
    /// A private summary of what the caller may read in one conversation: the last 60 messages or the last day, whichever is smaller. It is returned to the caller only. 403 <c>kind|child|off</c>;
    /// 404 not a member; 409 <c>tooShort</c> (fewer than 3 messages to read); 429 <c>catchUpLimit</c> (3 an hour). Only a catch-up that was given counts against the limit. Audited without any text.
    /// </summary>
    public async Task<ChatCatchUpDto> CatchUpAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var room = await RequireOnAsync(actor, conversationId, options.Value.Switches.ChatCatchUp, "R3", ct);
        var now = await clock.NowAsync(actor, ct);
        if (!ChatStanleyRules.UnderCap(await uses.CountUsesAsync(actor.Id, now - ChatStanleyRules.CapWindow, ct))) throw ApiException.TooMany("catchUpLimit");
        var rows = ChatStanleyRules.Window(await store.ListMessagesAsync(room.Member.GroupId, actor.Id, null, ReadAtMost, ct), room.Member.Kind, room.Member.JoinedAt, room.Member.LeftAt, now);
        if (rows.Count < ChatStanleyRules.MinMessages) throw ApiException.Conflict("tooShort");
        var byId = room.People.ToDictionary(p => p.UserId);
        var said = rows.Select(r => new ChatStanleyRules.Said(r.FromUserId, r.FromUserId == actor.Id ? "You" : byId.TryGetValue(r.FromUserId, out var p) ? ShortName(p) : "Someone", r.Text)).ToList();
        var summary = ChatStanleyRules.Summarise(said);
        var (written, how) = await WrittenAsync(actor, said, summary, ct);
        await uses.RecordUseAsync(actor.Id, room.Member.GroupId, now, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.catchUp", Outcome = AuditOutcome.Success, Target = "conversation:" + conversationId, Detail = rows.Count + " messages, " + how }, ct);
        var shown = written ?? summary;
        return new("Stanley's summary, not a full record", rows.Count, Shipboard.Ms(rows[0].At), shown.Decided, shown.Open, shown.Latest, written is not null);
    }

    /// <summary>
    /// A model-written version of the summary, or null with the reason the quoted one is used: <c>quoted</c> (switch off or no model), <c>safety</c> (a line the safety screen keeps from a model), <c>limit</c>, <c>failed</c> or <c>unusable</c>.
    /// The call has no tools and the conversation is data inside a block; the reply must be JSON, every line passes the output filter and a number the chat never held is dropped. The reason is audited, never any text.
    /// </summary>
    private async Task<(ChatStanleyRules.Summary? Written, string How)> WrittenAsync(UserRecord actor, List<ChatStanleyRules.Said> said, ChatStanleyRules.Summary quoted, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.Switches.ChatCatchUpModel || !o.Switches.Model || !model.Available) return (null, "quoted");
        if (!ChatStanleyRules.MayCallModel(said)) return (null, "safety");
        var meter = new ModelMeter(model, c => limiter.TryTakeAsync(actor.Id, DateTime.UtcNow, o.DailyCeiling, TimeSpan.FromDays(1), c), 1);
        var turn = ChatStanleyRules.ModelTurn(said);
        try
        {
            var reply = await meter.CallAsync(ChatStanleyRules.ModelSystem, StanleyService.NoTools, [new System.Text.Json.Nodes.JsonObject { ["role"] = "user", ["content"] = turn }], ModelTier.Small, ct);
            var text = string.Concat((reply["content"] as System.Text.Json.Nodes.JsonArray ?? []).OfType<System.Text.Json.Nodes.JsonObject>().Where(b => b["type"]?.GetValue<string>() == "text").Select(b => b["text"]?.GetValue<string>()));
            return ChatStanleyRules.ParseModelSummary(text, turn, quoted) is { } written ? (written, "written") : (null, "unusable");
        }
        catch (ConciergeModelException e) { return (null, e.Code == "limit" ? "limit" : "failed"); }
    }

    /// <summary>One chosen message the caller may read, and up to two text messages before it (oldest first), or an error when it is not an ordinary message of theirs to read.</summary>
    private async Task<(ChatMessageRow Chosen, List<string> Earlier)> ChosenAsync(UserRecord actor, Room room, Guid messageId, CancellationToken ct)
    {
        var rows = await store.ListMessagesAsync(room.Member.GroupId, actor.Id, null, ReadAtMost, ct);
        var at = rows.FindIndex(r => r.PublicId == messageId);
        if (at < 0) throw ApiException.Invalid("notMessage");
        var chosen = rows[at];
        if (chosen.DeletedAt is not null || chosen.IsSystem || chosen.FromStanley || chosen.Kind != "text" || string.IsNullOrWhiteSpace(chosen.Text)) throw ApiException.Invalid("notMessage");
        var earlier = rows.Take(at).Where(r => r.DeletedAt is null && !r.IsSystem && !r.FromStanley && r.Kind == "text" && !string.IsNullOrWhiteSpace(r.Text)).TakeLast(ChatStanleyRules.MaxContext).Select(r => r.Text).ToList();
        return (chosen, earlier);
    }

    /// <summary>
    /// A poll made from one message (and, when it is too short to stand alone, the one before it), for the caller to look at and post. Nothing is posted and no price is carried.
    /// 400 <c>notMessage</c> (not an ordinary message the caller can read) or <c>noPlan</c> (nothing to ask); 403 <c>kind|child|off</c>; 404.
    /// </summary>
    public async Task<ChatPlanPreviewDto> MakePlanAsync(UserRecord actor, Guid conversationId, ChatPlanBody? body, CancellationToken ct)
    {
        var room = await RequireOnAsync(actor, conversationId, options.Value.Switches.ChatPlan, "R4", ct);
        var (chosen, earlier) = await ChosenAsync(actor, room, body?.MessageId ?? Guid.Empty, ct);
        var poll = ChatStanleyRules.PlanFrom(chosen.Text, earlier) ?? throw ApiException.Invalid("noPlan");
        return new(poll.Question, poll.Options);
    }

    /// <summary>The cruise words in one message the caller can read, from the library (never a model). An empty list when there are none. 400 <c>notMessage</c>; 403 <c>kind|child|off</c>; 404.</summary>
    public async Task<ChatTermsDto> ExplainAsync(UserRecord actor, Guid conversationId, ChatPlanBody? body, CancellationToken ct)
    {
        var room = await RequireOnAsync(actor, conversationId, options.Value.Switches.ChatWords, "R8", ct);
        var (chosen, _) = await ChosenAsync(actor, room, body?.MessageId ?? Guid.Empty, ct);
        return new([.. ChatStanleyRules.Explain(chosen.Text).Select(t => new ChatTermDto(t.Word, t.Meaning))]);
    }

    /// <summary>
    /// Stanley's private look at one message (phase 4): what it asks for (money, gift cards, a number, another app, pressure) and a few polite replies. Pattern checks only, no model; the message is not stored or logged
    /// and the sender is never told. Never the caller's own message, a supervised child's, or an important or urgent one. 400 <c>notMessage</c>; 403 <c>kind|child|off|urgent|stopped</c>; 404.
    /// </summary>
    public async Task<ChatCheckDto> CheckAsync(UserRecord actor, Guid conversationId, ChatPlanBody? body, CancellationToken ct)
    {
        var room = await RequireOnAsync(actor, conversationId, options.Value.Switches.ChatCheck, "R10", ct);
        var (chosen, _) = await ChosenAsync(actor, room, body?.MessageId ?? Guid.Empty, ct);
        var sender = room.People.FirstOrDefault(p => p.UserId == chosen.FromUserId);
        if (ChatNudgeRules.Refusal(chosen.FromUserId == actor.Id, sender?.IsSupervised == true, chosen.Urgency) is { } refusal) throw refusal == "notMessage" ? ApiException.Invalid(refusal) : ApiException.Forbidden(refusal);
        var flags = ChatNudgeRules.Check(chosen.Text);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.check", Outcome = AuditOutcome.Success, Target = "conversation:" + conversationId, Detail = flags.Count + " flags" }, ct);
        return new(ChatNudgeRules.Headline(flags), [.. flags.Select(f => new ChatCheckFlagDto(f, ChatNudgeRules.Explain(f)))], ChatNudgeRules.Replies(flags), ChatNudgeRules.Calm, ChatNudgeRules.Looks(flags));
    }

    /// <summary>A short message to edit before sending: running late, or asking to meet. Nothing is sent. 400 <c>draft</c> for an unknown kind, an unusable place or time, or minutes outside 5 to 180.</summary>
    public Task<ChatDraftDto> DraftAsync(ChatDraftBody? body) =>
        !options.Value.Switches.ChatDraft ? throw ApiException.Forbidden(StanleySwitches.Stopped) : Task.FromResult(new ChatDraftDto(ChatStanleyRules.Draft(body?.Kind, body?.Minutes, body?.Place, body?.Time) ?? throw ApiException.Invalid("draft")));
}
