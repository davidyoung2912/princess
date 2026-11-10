using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Conversations and messages (docs/chat-plan.md, phase 4) and their safeguards (MSG-05). A person has a list of conversations (the booking's "My group", and a direct chat for each connection),
/// each with its own history; every read and write names one conversation and is refused unless the caller is a member of it. A message from someone the reader has blocked is left out.
/// Read receipts show only when both the sender and the reader have them on. A message that fails <see cref="ProfanityFilter"/> is not stored and the sender is told. Under-18s cannot pass on phone numbers or links, and cannot send photos.
/// A repeated <c>clientId</c> returns the stored message, so a message queued offline never doubles.
/// </summary>
public sealed class ChatService(IChatStore store, IAccountStore accounts, IUserClock userClock, ChatNotifier notifier, ChatSmsService sms)
{
    private static string Describe(string? text) => (text ?? "").Trim();

    private static string ShortName(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    /// <summary>The caller's conversations, newest activity first. The booking's "My group" is made on first use so there is always one to open.</summary>
    public async Task<List<ChatConversationDto>> ConversationsAsync(UserRecord actor, CancellationToken ct)
    {
        await store.EnsurePartyAsync(actor.Id, ct);
        var rows = await store.ListConversationsAsync(actor.Id, ct);
        var list = new List<ChatConversationDto>();
        foreach (var r in rows)
        {
            var members = await store.ListMembersAsync(r.GroupId, ct);
            list.Add(Conversation(actor, r, members, r.Unread, r.LastMessageId is null ? null : Last(actor, r, members), r.LastAt ?? r.CreatedAt));
        }
        return list;
    }

    private static ChatLastDto Last(UserRecord actor, ChatConversationRow r, List<ChatPeerRow> members)
    {
        var mine = r.LastFromUserId == actor.Id;
        var from = members.FirstOrDefault(m => m.UserId == r.LastFromUserId);
        return new(ChatConversationRules.Preview(r.LastText), r.LastPhoto, mine, mine || from is null ? "" : ShortName(from), Shipboard.Ms(r.LastAt ?? r.CreatedAt));
    }

    private static ChatConversationDto Conversation(UserRecord actor, ChatMemberRow m, List<ChatPeerRow> members, int unread, ChatLastDto? last, DateTime at)
    {
        var others = members.Where(p => p.UserId != actor.Id && p.Status == ChatConversationRules.Active).Select(ShortName).ToList();
        return new(m.GroupPublicId, m.Kind, ChatConversationRules.DisplayName(m.Kind, m.Name, others), others, last, unread, m.Muted,
            ChatConversationRules.IsClosed(m.Kind, m.Status, m.DirectEnded), Shipboard.Ms(at));
    }

    /// <summary>The caller's place in the conversation, or a 404 that is the same whether it does not exist or is someone else's.</summary>
    private async Task<ChatMemberRow> MemberAsync(UserRecord actor, Guid conversationId, CancellationToken ct) =>
        await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();

    /// <summary>The latest page of a conversation, or the page before the message <paramref name="before"/>.</summary>
    public async Task<ChatThreadDto> ThreadAsync(UserRecord actor, Guid conversationId, Guid? before, int? limit, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        var size = ChatConversationRules.ClampPage(limit);
        var members = await store.ListMembersAsync(member.GroupId, ct);
        var mine = await store.GetReceiptsAsync(actor.Id, ct);
        var page = await store.ListMessagesAsync(member.GroupId, actor.Id, before, size, ct);
        var more = page.Count > size;
        if (more) page.RemoveAt(0);   // the extra, oldest one was only read to know there is more
        var byId = members.ToDictionary(p => p.UserId);
        var receiptsOf = (long id) => id == actor.Id ? mine : byId.TryGetValue(id, out var p) && p.ReceiptsOn;
        var publicOf = (long id) => id == actor.Id ? actor.PublicId : byId.TryGetValue(id, out var p) ? p.PublicId : (Guid?)null;
        var messages = new List<ChatMessageDto>();
        foreach (var m in page)
        {
            if (publicOf(m.FromUserId) is not { } from) continue;
            if (m.IsSystem) { messages.Add(new ChatMessageDto(m.PublicId, from, m.Text, Shipboard.Ms(m.At), System: true)); continue; }
            var seen = receiptsOf(m.FromUserId) ? m.SeenBy.Where(id => id != m.FromUserId && receiptsOf(id)).Select(publicOf).OfType<Guid>().ToList() : null;
            var name = m.FromUserId == actor.Id || !byId.TryGetValue(m.FromUserId, out var sender) ? null : ShortName(sender);
            messages.Add(new ChatMessageDto(m.PublicId, from, m.Text, Shipboard.Ms(m.At), m.Photo, seen, name, ViaSms: m.ViaSms));
        }
        // Who is ashore and answers by text: only people with the bridge on are looked at, so a thread with none costs one query.
        var ashore = await sms.AshoreAsync([.. members.Where(p => p.UserId != actor.Id && p.Status == ChatConversationRules.Active).Select(p => p.UserId)], ct);
        return new(Conversation(actor, member, members, 0, null, member.CreatedAt), messages, more, [.. members.Where(p => ashore.Contains(p.UserId)).Select(ShortName)]);
    }

    public async Task<ChatMessageDto> SendAsync(UserRecord actor, Guid conversationId, SendChatRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var text = ChatConversationRules.CleanText(body?.Text) ?? throw ApiException.Invalid("text");
        if (ServiceRules.ChildSafeProblem(text, await AgeAsync(actor, ct)) is { } problem) throw ApiException.Invalid(problem);
        // Not sent, not stored, not logged; the matched word is never returned.
        if (ProfanityFilter.IsBlocked(text)) throw ApiException.Invalid("blocked");
        return await StoreAsync(actor, member, text, null, body?.ClientId, ct);
    }

    /// <summary>
    /// A message a guest ashore sent by text (docs/chat-plan.md, 4.9). The same checks as <see cref="SendAsync"/> (membership, closed, length, the word filter), the carrier's message id as the
    /// idempotency key, and the message is labelled "by text". Adults only, so the age rule does not apply.
    /// </summary>
    public async Task<ChatMessageDto> SendFromTextAsync(UserRecord actor, Guid conversationId, string? body, Guid key, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var text = ChatConversationRules.CleanText(body) ?? throw ApiException.Invalid("text");
        if (ProfanityFilter.IsBlocked(text)) throw ApiException.Invalid("blocked");
        return await StoreAsync(actor, member, text, null, key, ct, viaSms: true);
    }

    public async Task<ChatMessageDto> SendPhotoAsync(UserRecord actor, Guid conversationId, ChatPhotoRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var age = await AgeAsync(actor, ct);
        var problem = ServiceRules.PhotoProblem(body?.Type, body?.Bytes ?? 0, age);
        if (problem == "age") throw ApiException.Forbidden("age");
        if (problem is not null) throw ApiException.Invalid(problem);
        if (body!.DataUrl is not { } url || !url.StartsWith($"data:{body.Type};base64,", StringComparison.Ordinal) || url.Length > ServiceRules.MaxPhotoDataUrl) throw ApiException.Invalid("size");
        var caption = Describe(body.Caption);
        if (caption.Length > 200) caption = caption[..200];
        if (ServiceRules.ChildSafeProblem(caption, age) is { } bad) throw ApiException.Invalid(bad);
        if (ProfanityFilter.IsBlocked(caption)) throw ApiException.Invalid("blocked");
        return await StoreAsync(actor, member, caption, url, null, ct);
    }

    private async Task<ChatMessageDto> StoreAsync(UserRecord actor, ChatMemberRow member, string text, string? photo, Guid? clientId, CancellationToken ct, bool viaSms = false)
    {
        var sent = await store.AddMessageAsync(member.GroupId, actor.Id, text, photo, clientId, await userClock.NowAsync(actor, ct), ct, viaSms);
        var dto = new ChatMessageDto(sent.Row.PublicId, actor.PublicId, sent.Row.Text, Shipboard.Ms(sent.Row.At), sent.Row.Photo, ViaSms: viaSms);
        if (!sent.Created) return dto;   // a retry of a message that already went out: nobody is told twice
        await TellAsync(actor, member, sent.Row, ct);
        return dto;
    }

    /// <summary>Tells every other active member who has not blocked the sender (<see cref="IChatStore.ListRecipientsAsync"/>). A failed notice never fails the send.</summary>
    private async Task TellAsync(UserRecord actor, ChatMemberRow member, ChatMessageRow message, CancellationToken ct)
    {
        try
        {
            var from = (await store.ListMembersAsync(member.GroupId, ct)).FirstOrDefault(p => p.UserId == actor.Id) is { } me ? ShortName(me) : "Guest";
            var recipients = await store.ListRecipientsAsync(member.GroupId, actor.Id, ct);
            foreach (var r in recipients)
            {
                await notifier.MessageAsync(r.UserId, member.GroupPublicId, message.PublicId, from, message.Text, r.ShowPreview, r.Muted, ct);
            }
            // People ashore who chose the text bridge hear it by text too (its own caps and checks; a failure there is never the sender's problem).
            await sms.MessageAsync(member.GroupId, from, message, recipients, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // The message is stored and shows in every member's app; only the alert was lost.
        }
    }

    /// <summary>The caller has read the conversation up to now: the unread count clears on every device, and receipts are recorded only when the caller has them on.</summary>
    public async Task ReadAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        await store.MarkReadAsync(member.GroupId, actor.Id, await store.GetReceiptsAsync(actor.Id, ct), await userClock.NowAsync(actor, ct), ct);
    }

    public async Task<bool> MuteAsync(UserRecord actor, Guid conversationId, ChatMuteRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        var on = body?.On == true;
        await store.SetMutedAsync(member.GroupId, actor.Id, on, ct);
        return on;
    }

    public Task<bool> ReceiptsAsync(UserRecord actor, CancellationToken ct) => store.GetReceiptsAsync(actor.Id, ct);

    public async Task<bool> SetReceiptsAsync(UserRecord actor, ChatReceiptsRequest? body, CancellationToken ct)
    {
        await store.SetReceiptsAsync(actor.Id, body?.On == true, ct);
        return body?.On == true;
    }

    public async Task<List<Guid>> BlockedAsync(UserRecord actor, CancellationToken ct)
    {
        var peers = (await store.ListPeersAsync(actor.Id, ct)).ToDictionary(p => p.UserId);
        return [.. (await store.ListBlocksAsync(actor.Id, ct)).Select(id => peers.TryGetValue(id, out var p) ? p.PublicId : (Guid?)null).OfType<Guid>()];
    }

    public async Task<List<Guid>> BlockAsync(UserRecord actor, Guid id, ChatBlockRequest? body, CancellationToken ct)
    {
        var peer = (await store.ListPeersAsync(actor.Id, ct)).FirstOrDefault(p => p.PublicId == id) ?? throw ApiException.Invalid("notInChat");
        await store.SetBlockAsync(actor.Id, peer.UserId, body?.On != false, ct);
        return await BlockedAsync(actor, ct);
    }

    public async Task ReportAsync(UserRecord actor, ChatReportRequest? body, CancellationToken ct)
    {
        if (body?.Reason is null || !ServiceRules.ReportReasons.Contains(body.Reason)) throw ApiException.Invalid("badReason");
        if (!await store.AddReportAsync(actor.Id, body.MessageId, body.Reason, await userClock.NowAsync(actor, ct), ct)) throw ApiException.NotFound();
    }

    /// <summary>The person's age today from their profile; someone with no date of birth on file counts as a child while their account is supervised, else an adult.</summary>
    private async Task<int> AgeAsync(UserRecord actor, CancellationToken ct) =>
        await accounts.GetProfileAsync(actor.Id, ct) is { } p ? AccountRules.AgeOn(DateOnly.FromDateTime(p.Dob), TripRules.Today(await userClock.NowAsync(actor, ct))) : actor.IsSupervised ? 0 : 18;
}
