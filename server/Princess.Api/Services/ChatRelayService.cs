using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Microsoft.Extensions.Options;

namespace Princess.Api.Services;

/// <summary>
/// Relay to a person and the group recap (docs/chat-features-research.md, phase 13, roles R7 and R12).
/// <b>Get a person:</b> <see cref="DraftAsync"/> builds the text of a hand-off from the messages the guest chose, and only those; it sends nothing and stores nothing. The guest reads and edits the text and sends it through the
/// ordinary hand-off route with their consent, so the desk sees exactly what the guest saw.
/// <b>Recap:</b> any member of a made group (no supervised child in it) starts one. Plans members posted become parts owned by their poster, who approves or declines their own; a member adds their own photos, which is their approval.
/// Nobody decides for another. Once every part is decided and one is approved, a member shares it: the group sees a line with counts, and the recap shows only approved parts. Before that, a member sees only their own parts.
/// </summary>
public sealed class ChatRelayService(IChatStore store, IChatRecapStore recaps, IUserClock clock, IAuditLog audit, IOptions<StanleyOptions> options)
{
    private static string ShortName(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    private static string Decision(ChatRecapItemRow i) => i.Decision;

    // ---- Get a person ----

    /// <summary>The draft hand-off text from the chosen messages. 403 <c>child|notChat</c>; 400 <c>none|tooMany</c>; 404 not a member, or a message that is not in the chat the caller may read.</summary>
    public async Task<ChatRelayDraftDto> DraftAsync(UserRecord actor, Guid conversationId, ChatRelayDraftBody? body, CancellationToken ct)
    {
        if (!options.Value.Switches.ChatRelay) throw ApiException.Forbidden(StanleySwitches.Stopped);
        if (actor.IsSupervised) throw ApiException.Forbidden(ChatRelayRules.Child);
        var member = await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active || !ChatRelayRules.Handable(member.Kind)) throw ApiException.Forbidden(ChatRelayRules.NotChat);
        var ids = (body?.MessageIds ?? []).Distinct().ToList();
        if (ids.Count == 0) throw ApiException.Invalid(ChatRelayRules.None);
        if (ids.Count > ChatRelayRules.MaxMessages) throw ApiException.Invalid(ChatRelayRules.TooMany);
        var people = (await store.ListMembersAsync(member.GroupId, ct)).ToDictionary(p => p.UserId);
        var blocked = new HashSet<long>(await store.ListBlocksAsync(actor.Id, ct));
        var chosen = new List<ChatMessageRow>();
        foreach (var id in ids)
        {
            // Read through the caller's own window, so a message from before they joined is not found.
            var m = await store.FindMessageAsync(member.GroupId, actor.Id, id, ct) ?? throw ApiException.NotFound();
            if (ChatRelayRules.Carriable(m.Kind, m.IsSystem, m.Persona is not null || m.FromUserId == 0, m.DeletedAt is not null, m.Text) && !blocked.Contains(m.FromUserId)) chosen.Add(m);
        }
        if (chosen.Count == 0) throw ApiException.Invalid(ChatRelayRules.None);
        var lines = chosen.OrderBy(m => m.At).ThenBy(m => m.Id).Select(m => (m.FromUserId == actor.Id ? "" : people.TryGetValue(m.FromUserId, out var p) ? ShortName(p) : "", m.Text));
        var text = ChatRelayRules.Draft(lines);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.relay.draft", Outcome = AuditOutcome.Success, Target = "conversation:" + conversationId, Detail = chosen.Count + " messages" }, ct);
        return new(text, chosen.Count, ids.Count - chosen.Count, StanleyHandoffRules.IssueMax);
    }

    // ---- The recap ----

    private sealed record Room(ChatMemberRow Member, List<ChatPeerRow> Active, string? Refusal);

    private async Task<Room> OpenAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        if (!options.Value.Switches.ChatRelay) throw ApiException.Forbidden(StanleySwitches.Stopped);
        var member = await store.GetMemberAsync(actor.Id, groupId, ct) ?? throw ApiException.NotFound();
        if (member.Status != ChatConversationRules.Active) throw ApiException.NotFound();
        var active = (await store.ListMembersAsync(member.GroupId, ct)).Where(p => p.Status == ChatConversationRules.Active).ToList();
        return new(member, active, ChatRelayRules.StartRefusal(member.Kind == ChatConversationRules.Group, active.Any(p => p.IsSupervised), active.Count));
    }

    private static Room Require(Room room) => room.Refusal is { } r ? throw ApiException.Forbidden(r) : room;

    /// <summary>Starts the group's recap (or returns it): plans the members posted become parts, each owned by whoever posted it. 403 <c>notGroup|child|small</c>; 404.</summary>
    public async Task<ChatRecapDto> StartAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var now = await clock.NowAsync(actor, ct);
        var recap = await recaps.FindAsync(room.Member.GroupId, ct);
        if (recap is null)
        {
            recap = await recaps.CreateAsync(room.Member.GroupId, actor.Id, now, ct);
            var activeIds = room.Active.Select(p => p.UserId).ToHashSet();
            var plans = (await store.ListMessagesAsync(room.Member.GroupId, actor.Id, null, 120, ct))
                .Where(m => m.DeletedAt is null && m.Kind == ChatCardRules.Plan && activeIds.Contains(m.FromUserId) && ChatCardRules.Parse(m.Payload) is not null).ToList();
            foreach (var byPoster in plans.GroupBy(m => m.FromUserId))
                await recaps.AddItemsAsync(recap.Id, ChatRelayRules.Plan, byPoster.Key, [.. byPoster.Select(m => m.Id)], false, now, ct);
            await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.recap.start", Outcome = AuditOutcome.Success, Target = "conversation:" + groupId, Detail = plans.Count + " plans" }, ct);
        }
        return await ViewAsync(actor, room, recap, ct);
    }

    /// <summary>The group's recap as the caller may see it. 404 when there is none yet.</summary>
    public async Task<ChatRecapDto> GetAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var room = await OpenAsync(actor, groupId, ct);
        var recap = await recaps.FindAsync(room.Member.GroupId, ct) ?? throw ApiException.NotFound();
        return await ViewAsync(actor, room, recap, ct);
    }

    private async Task<ChatRecapDto> ViewAsync(UserRecord actor, Room room, ChatRecapRow recap, CancellationToken ct)
    {
        var activeIds = room.Active.ToDictionary(p => p.UserId);
        var items = (await recaps.ListItemsAsync(recap.Id, ct)).Where(i => !i.Deleted && activeIds.ContainsKey(i.UserId)).ToList();
        var shared = recap.SharedAt is not null;
        var decided = items.Count(i => i.Decision != ChatRelayRules.Pending);
        var refusal = ChatRelayRules.ShareRefusal(shared, [.. items.Select(Decision)]);
        // Before it is shared a member sees only their own parts; after, only what each owner approved.
        var visible = items.Where(i => shared ? i.Decision == ChatRelayRules.Approved : i.UserId == actor.Id).ToList();
        var plans = new List<ChatRecapPlanDto>();
        foreach (var i in visible.Where(i => i.Kind == ChatRelayRules.Plan))
        {
            if (ChatCardRules.Parse(i.Payload) is not { } card) continue;
            plans.Add(new(i.MessagePublicId, card.Title, card.Day, card.Time, card.Place, i.UserId == actor.Id, i.Decision));
        }
        var photos = visible.Where(i => i.Kind == ChatRelayRules.Photo)
            .Select(i => new ChatRecapPhotoDto(i.MessagePublicId, shared && i.UserId != actor.Id ? ShortName(activeIds[i.UserId]) : null, i.UserId == actor.Id, i.Decision)).ToList();
        return new(recap.PublicId, shared, Shipboard.Ms(recap.StartedAt), recap.SharedAt is { } at ? Shipboard.Ms(at) : null, decided, items.Count, ChatRelayRules.Progress(decided, items.Count), plans, photos, refusal is null, refusal);
    }

    /// <summary>The caller's own photo messages they could add, newest first, with which are already in. Never anyone else's.</summary>
    public async Task<List<ChatRecapChoiceDto>> ChoicesAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var recap = await recaps.FindAsync(room.Member.GroupId, ct) ?? throw ApiException.NotFound();
        var have = (await recaps.ListItemsAsync(recap.Id, ct)).Where(i => i.UserId == actor.Id && i.Kind == ChatRelayRules.Photo).Select(i => i.MessagePublicId).ToHashSet();
        return [.. (await store.ListMessagesAsync(room.Member.GroupId, actor.Id, null, 120, ct))
            .Where(m => m.DeletedAt is null && m.FromUserId == actor.Id && m.HasPhoto)
            .OrderByDescending(m => m.At).Select(m => new ChatRecapChoiceDto(m.PublicId, Shipboard.Ms(m.At), have.Contains(m.PublicId)))];
    }

    /// <summary>Sets which of the caller's own photos are in the recap (at most six); choosing one is approving it. 409 <c>shared</c>; 400 <c>tooMany|notYours</c>.</summary>
    public async Task<ChatRecapDto> SetPhotosAsync(UserRecord actor, Guid groupId, ChatRecapPhotosBody? body, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var recap = await recaps.FindAsync(room.Member.GroupId, ct) ?? throw ApiException.NotFound();
        if (recap.SharedAt is not null) throw ApiException.Conflict(ChatRelayRules.Shared);
        var ids = (body?.MessageIds ?? []).Distinct().ToList();
        if (ids.Count > ChatRelayRules.MaxPhotosEach) throw ApiException.Invalid(ChatRelayRules.TooMany);
        var now = await clock.NowAsync(actor, ct);
        var mine = (await store.ListMessagesAsync(room.Member.GroupId, actor.Id, null, 120, ct)).Where(m => m.DeletedAt is null && m.FromUserId == actor.Id && m.HasPhoto).ToDictionary(m => m.PublicId);
        var rows = new List<long>();
        foreach (var id in ids)
        {
            if (!mine.TryGetValue(id, out var m)) throw ApiException.Invalid("notYours");
            rows.Add(m.Id);
        }
        await recaps.KeepPhotosAsync(recap.Id, actor.Id, rows, ct);
        await recaps.AddItemsAsync(recap.Id, ChatRelayRules.Photo, actor.Id, rows, true, now, ct);
        return await ViewAsync(actor, room, recap, ct);
    }

    /// <summary>The owner of a part approves or declines it. 400 <c>decision</c>; 404 when the part is not the caller's; 409 <c>shared</c>.</summary>
    public async Task<ChatRecapDto> DecideAsync(UserRecord actor, Guid groupId, Guid messageId, ChatRecapDecideBody? body, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var recap = await recaps.FindAsync(room.Member.GroupId, ct) ?? throw ApiException.NotFound();
        if (recap.SharedAt is not null) throw ApiException.Conflict(ChatRelayRules.Shared);
        var decision = body?.Decision ?? "";
        var item = (await recaps.ListItemsAsync(recap.Id, ct)).FirstOrDefault(i => i.MessagePublicId == messageId) ?? throw ApiException.NotFound();
        if (!ChatRelayRules.MayDecide(item.UserId, actor.Id, decision)) throw item.UserId == actor.Id ? ApiException.Invalid("decision") : ApiException.NotFound();
        await recaps.DecideAsync(recap.Id, actor.Id, item.MessageId, decision, await clock.NowAsync(actor, ct), ct);
        return await ViewAsync(actor, room, recap, ct);
    }

    /// <summary>A member shares the recap: the group reads a line with counts and can then see the approved parts. 409 <c>shared|waiting|empty</c>.</summary>
    public async Task<ChatRecapDto> ShareAsync(UserRecord actor, Guid groupId, CancellationToken ct)
    {
        var room = Require(await OpenAsync(actor, groupId, ct));
        var recap = await recaps.FindAsync(room.Member.GroupId, ct) ?? throw ApiException.NotFound();
        var activeIds = room.Active.Select(p => p.UserId).ToHashSet();
        var items = (await recaps.ListItemsAsync(recap.Id, ct)).Where(i => !i.Deleted && activeIds.Contains(i.UserId)).ToList();
        if (ChatRelayRules.ShareRefusal(recap.SharedAt is not null, [.. items.Select(Decision)]) is { } refusal) throw ApiException.Conflict(refusal);
        var now = await clock.NowAsync(actor, ct);
        if (!await recaps.MarkSharedAsync(recap.Id, actor.Id, now, ct)) throw ApiException.Conflict(ChatRelayRules.Shared);
        var approved = items.Where(i => i.Decision == ChatRelayRules.Approved).ToList();
        await store.AddSystemLineAsync(room.Member.GroupId, actor.Id, ChatRelayRules.ShareLine(ChatConnectionRules.ShortName(actor.FirstName, actor.LastName), approved.Count(i => i.Kind == ChatRelayRules.Plan), approved.Count(i => i.Kind == ChatRelayRules.Photo)), now, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.recap.share", Outcome = AuditOutcome.Success, Target = "conversation:" + groupId, Detail = approved.Count + " parts" }, ct);
        recap.SharedAt = now;
        return await ViewAsync(actor, room, recap, ct);
    }

    /// <summary>One approved photo of a shared recap, for a member of the group. 404 for anything else: not shared, not approved, not a member.</summary>
    public async Task<string> PhotoAsync(UserRecord actor, Guid groupId, Guid messageId, CancellationToken ct)
    {
        var room = await OpenAsync(actor, groupId, ct);
        var recap = await recaps.FindAsync(room.Member.GroupId, ct);
        if (recap?.SharedAt is null) throw ApiException.NotFound();
        var activeIds = room.Active.Select(p => p.UserId).ToHashSet();
        var item = (await recaps.ListItemsAsync(recap.Id, ct)).FirstOrDefault(i => i.MessagePublicId == messageId && i.Kind == ChatRelayRules.Photo && i.Decision == ChatRelayRules.Approved && !i.Deleted && activeIds.Contains(i.UserId));
        return item is null ? throw ApiException.NotFound() : await recaps.PhotoAsync(item.MessageId, ct) ?? throw ApiException.NotFound();
    }
}
