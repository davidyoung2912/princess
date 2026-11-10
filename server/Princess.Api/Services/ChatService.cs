using Princess.Api.Audit;
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
public sealed class ChatService(IChatStore store, IAccountStore accounts, IUserClock userClock, ChatNotifier notifier, ChatSmsService sms, ChatFanoutQueue fanoutQueue, ChatFanout fanout, IAuditLog audit, StanleyThreadService stanley, StanleyReminderService? reminders = null)
{
    private static string Describe(string? text) => (text ?? "").Trim();

    /// <summary>The level to show: nothing for a normal message, so ordinary messages look and weigh the same as before.</summary>
    private static string? Flag(string? urgency) => urgency is ChatUrgencyRules.Important or ChatUrgencyRules.Urgent ? urgency : null;

    private static string ShortName(ChatPeerRow p) => ChatConnectionRules.ShortName(p.FirstName, p.LastName);

    /// <summary>The caller's conversations, newest activity first. The booking's "My group" is made on first use so there is always one to open.</summary>
    public async Task<List<ChatConversationDto>> ConversationsAsync(UserRecord actor, CancellationToken ct, bool ensureParty = true)
    {
        if (ensureParty)
        {
            await store.EnsurePartyAsync(actor.Id, ct);
            await stanley.EnsureAsync(actor, ct);   // the permanent thread is always there, and always first
        }
        var rows = await store.ListConversationsAsync(actor.Id, ct);
        var list = new List<ChatConversationDto>();
        // One query for everyone in every conversation, not one per conversation.
        var membersOf = await store.ListMembersForAsync([.. rows.Select(r => r.GroupId)], ct);
        foreach (var r in rows)
        {
            var members = membersOf[r.GroupId];
            list.Add(Conversation(actor, r, members, r.Unread, r.LastMessageId is null ? null : Last(actor, r, members), r.LastAt ?? r.CreatedAt));
        }
        return list;
    }

    private static ChatLastDto Last(UserRecord actor, ChatConversationRow r, List<ChatPeerRow> members)
    {
        var mine = r.LastFromUserId == actor.Id;
        var from = members.FirstOrDefault(m => m.UserId == r.LastFromUserId);
        return new(ChatConversationRules.Preview(r.LastText), r.LastPhoto, mine, mine || from is null ? "" : ShortName(from), Shipboard.Ms(r.LastAt ?? r.CreatedAt), Flag(r.LastUrgency));
    }

    private static ChatConversationDto Conversation(UserRecord actor, ChatMemberRow m, List<ChatPeerRow> members, int unread, ChatLastDto? last, DateTime at)
    {
        var others = members.Where(p => p.UserId != actor.Id && p.Status == ChatConversationRules.Active).Select(ShortName).ToList();
        return new(m.GroupPublicId, m.Kind, ChatConversationRules.DisplayName(m.Kind, m.Name, others), others, last, unread, m.Muted,
            ChatConversationRules.IsClosed(m.Kind, m.Status, m.DirectEnded), Shipboard.Ms(at),
            ChatSafetyRules.GuardianCanRead(members.Select(p => (p.Status, p.IsSupervised))), m.NotifyAway,
            Permanent: ChatConversationRules.IsPermanent(m.Kind), Voice: m.Persona, Subtitle: m.Subtitle);
    }

    /// <summary>The caller's place in the conversation, or a 404 that is the same whether it does not exist or is someone else's.</summary>
    private async Task<ChatMemberRow> MemberAsync(UserRecord actor, Guid conversationId, CancellationToken ct) =>
        await store.GetMemberAsync(actor.Id, conversationId, ct) ?? throw ApiException.NotFound();

    /// <summary>The chips under a message, with the others' names for a screen reader. People the reader blocked are left out.</summary>
    private static List<ChatReactionDto> ReactionDtos(IEnumerable<ChatReactionRow> rows, long reader, Dictionary<long, ChatPeerRow> byId, ISet<long> blocked) =>
        [.. ChatReactionRules.Summarise(rows.Select(r => (r.UserId, r.Emoji, byId.TryGetValue(r.UserId, out var p) ? ShortName(p) : "")), reader, blocked)
            .Select(t => new ChatReactionDto(t.Emoji, t.Count, t.Mine, [.. t.Names]))];

    /// <summary>The quote above a reply. An original the reader may no longer read (outside their window, from someone they blocked, or not a person's message) shows only "Message removed".</summary>
    private static ChatQuoteDto QuoteDto(ChatQuoteRow? q, long reader, Dictionary<long, ChatPeerRow> byId)
    {
        if (q is null || q.IsSystem) return new(null, ChatReactionRules.RemovedText, Removed: true);
        var mine = q.FromUserId == reader;
        var from = q.FromUserId == 0 ? StanleyPersonaRules.Name : mine ? null : byId.TryGetValue(q.FromUserId, out var p) ? ShortName(p) : null;
        return new(q.PublicId, ChatReactionRules.QuoteText(q.Text, q.HasPhoto), from, mine);
    }

    /// <summary>The latest page of a conversation, or the page before the message <paramref name="before"/>.</summary>
    public async Task<ChatThreadDto> ThreadAsync(UserRecord actor, Guid conversationId, Guid? before, int? limit, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind))
        {
            await stanley.EnsureAsync(actor, ct);   // a deep link can open the thread before the list has: bring the voice up to date
            member = await MemberAsync(actor, conversationId, ct);
        }
        var size = ChatConversationRules.ClampPage(limit);
        var members = await store.ListMembersAsync(member.GroupId, ct);
        var mine = await store.GetReceiptsAsync(actor.Id, ct);
        var page = await store.ListMessagesAsync(member.GroupId, actor.Id, before, size, ct);
        var more = page.Count > size;
        var now = await userClock.NowAsync(actor, ct);
        if (more) page.RemoveAt(0);   // the extra, oldest one was only read to know there is more
        var byId = members.ToDictionary(p => p.UserId);
        var receiptsOf = (long id) => id == actor.Id ? mine : byId.TryGetValue(id, out var p) && p.ReceiptsOn;
        var publicOf = (long id) => id == actor.Id ? actor.PublicId : byId.TryGetValue(id, out var p) ? p.PublicId : (Guid?)null;
        // Phase 1: reactions (a block hides the blocked person's reactions as it hides their messages), the quote above a reply, and Delivered. Blocks are read only when some message has a reaction.
        var blocked = page.Any(m => m.Reactions.Count > 0) ? new HashSet<long>(await store.ListBlocksAsync(actor.Id, ct)) : new HashSet<long>();
        var firstUnread = before is null ? page.FirstOrDefault(m => !m.IsSystem && ChatConversationRules.IsUnread(m.Id, m.FromUserId, actor.Id, member.LastReadMessageId))?.PublicId : null;
        var messages = new List<ChatMessageDto>();
        foreach (var m in page)
        {
            // Stanley has no user: his messages (and the lines marking a change of voice) are shown as his, under the subtitle they were sent with.
            if (m.FromStanley)
            {
                var expired = m.ExpiresAt is { } e && e <= now;
                var replaced = m.SupersededAt is not null;
                var notice = m.Lane is null ? null : new ChatNoticeDto(m.Lane, m.NoticeKind ?? "", m.NoticePath ?? "", expired, replaced,
                    m.ExpiresAt is { } until ? Shipboard.Ms(until) : null,
                    StanleyNoticeRules.ActionsFor(m.NoticeKind ?? "", m.NoticeSubject, expired, replaced), expired || replaced ? [] : StanleyNoticeRules.RepliesOf(m.Lane), m.NoticeSubject);
                // A relayed notice asks for Got it when it is critical or important; the guest sees whether they have, and a replaced or expired one no longer asks.
                var asks = notice is not null && ChatUrgencyRules.CanAck(m.Urgency, m.IsSystem, false, true) && !notice.Expired && !notice.Superseded;
                messages.Add(new ChatMessageDto(m.PublicId, Guid.Empty, m.Text, Shipboard.Ms(m.At), FromName: StanleyPersonaRules.Name, System: m.IsSystem, Stanley: true, Subtitle: m.Subtitle,
                    Urgency: notice is null ? null : Flag(m.Urgency), Acked: asks ? m.AckedBy.Contains(actor.Id) : null, Notice: notice));
                continue;
            }
            if (publicOf(m.FromUserId) is not { } from) continue;
            if (m.IsSystem) { messages.Add(new ChatMessageDto(m.PublicId, from, m.Text, Shipboard.Ms(m.At), System: true)); continue; }
            var seen = receiptsOf(m.FromUserId) ? m.SeenBy.Where(id => id != m.FromUserId && receiptsOf(id)).Select(publicOf).OfType<Guid>().ToList() : null;
            var name = m.FromUserId == actor.Id || !byId.TryGetValue(m.FromUserId, out var sender) ? null : ShortName(sender);
            // Urgent only: the sender sees who has acknowledged (members only), a reader sees whether they have. Nobody else's acknowledgement is shown to a reader.
            var urgent = m.Urgency == ChatUrgencyRules.Urgent;
            var ackedBy = urgent && m.FromUserId == actor.Id ? m.AckedBy.Select(publicOf).OfType<Guid>().ToList() : null;
            bool? acked = urgent && m.FromUserId != actor.Id ? m.AckedBy.Contains(actor.Id) : null;
            var reactions = m.Reactions.Count == 0 ? null : ReactionDtos(m.Reactions, actor.Id, byId, blocked);
            var delivered = m.FromUserId == actor.Id && receiptsOf(actor.Id) && m.DeliveredBy.Any(id => id != actor.Id && receiptsOf(id));
            messages.Add(new ChatMessageDto(m.PublicId, from, m.Text, Shipboard.Ms(m.At), m.Photo, seen, name, ViaSms: m.ViaSms, Urgency: Flag(m.Urgency), AckedBy: ackedBy, Acked: acked, HasPhoto: m.HasPhoto,
                Reactions: reactions, ReplyTo: m.ReplyToId is null ? null : QuoteDto(m.Reply, actor.Id, byId), Delivered: delivered));
        }
        // Who is ashore and answers by text: only people with the bridge on are looked at, so a thread with none costs one query.
        var ashore = await sms.AshoreAsync([.. members.Where(p => p.UserId != actor.Id && p.Status == ChatConversationRules.Active).Select(p => p.UserId)], ct);
        var mayUrgent = ChatUrgencyRules.MaySend(ChatUrgencyRules.Urgent, actor.Role == "admin",
            ChatUrgencyRules.IsGuardianHere(actor.Id, actor.IsSupervised, members.Select(p => (p.Status, p.IsSupervised, p.BookerUserId))));
        return new(Conversation(actor, member, members, 0, null, member.CreatedAt), messages, more, [.. members.Where(p => ashore.Contains(p.UserId)).Select(ShortName)], mayUrgent, firstUnread);
    }

    public async Task<ChatMessageDto> SendAsync(UserRecord actor, Guid conversationId, SendChatRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");   // a question to Stanley goes through his own route
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var text = ChatConversationRules.CleanText(body?.Text) ?? throw ApiException.Invalid("text");
        var now = await userClock.NowAsync(actor, ct);
        if (ServiceRules.ChildSafeProblem(text, await AgeAsync(actor, now, ct)) is { } problem) throw ApiException.Invalid(problem);
        // Not sent, not stored, not logged; the matched word is never returned.
        if (ProfanityFilter.IsBlocked(text)) throw ApiException.Invalid("blocked");
        var urgency = ChatUrgencyRules.Parse(body?.Urgency) ?? throw ApiException.Invalid("urgency");
        // A reply names a message the sender may read in this conversation (their window, nobody they blocked) that a person said; anything else is refused the same way.
        ChatMessageRow? quoted = null;
        if (body?.ReplyTo is { } replyTo)
        {
            quoted = await store.FindMessageAsync(member.GroupId, actor.Id, replyTo, ct);
            if (quoted is null || !ChatReactionRules.CanTarget(quoted.IsSystem, quoted.FromStanley)) throw ApiException.Invalid("replyTo");
        }
        if (urgency == ChatUrgencyRules.Urgent)
        {
            var members = await store.ListMembersAsync(member.GroupId, ct);
            var guardianHere = ChatUrgencyRules.IsGuardianHere(actor.Id, actor.IsSupervised, members.Select(p => (p.Status, p.IsSupervised, p.BookerUserId)));
            if (!ChatUrgencyRules.MaySend(urgency, actor.Role == "admin", guardianHere)) throw ApiException.Forbidden("urgency");
        }
        // The hourly limit for important and urgent messages (urgent is already limited to staff and guardians).
        if (urgency != ChatUrgencyRules.Normal && ChatUrgencyRules.OverLimit(urgency, await store.CountSentAsync(actor.Id, urgency, now.AddHours(-1), ct))) throw ApiException.TooMany("urgencyLimit");
        var sent = await StoreAsync(actor, member, text, null, body?.ClientId, now, ct, urgency: urgency, quoted: quoted);
        // Who sent an urgent message and where, never what it said.
        if (urgency == ChatUrgencyRules.Urgent)
            await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "chat.urgent.send", Outcome = AuditOutcome.Success, Target = "conversation:" + conversationId, Detail = actor.Role == "admin" ? "staff" : "guardian" }, ct);
        return sent;
    }

    /// <summary>
    /// A message a guest ashore sent by text (docs/chat-plan.md, 4.9). The same checks as <see cref="SendAsync"/> (membership, closed, length, the word filter), the carrier's message id as the
    /// idempotency key, and the message is labelled "by text". Adults only, so the age rule does not apply.
    /// </summary>
    public async Task<ChatMessageDto> SendFromTextAsync(UserRecord actor, Guid conversationId, string? body, Guid key, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var text = ChatConversationRules.CleanText(body) ?? throw ApiException.Invalid("text");
        if (ProfanityFilter.IsBlocked(text)) throw ApiException.Invalid("blocked");
        return await StoreAsync(actor, member, text, null, key, await userClock.NowAsync(actor, ct), ct, viaSms: true);
    }

    public async Task<ChatMessageDto> SendPhotoAsync(UserRecord actor, Guid conversationId, ChatPhotoRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        var now = await userClock.NowAsync(actor, ct);
        var age = await AgeAsync(actor, now, ct);
        var problem = ServiceRules.PhotoProblem(body?.Type, body?.Bytes ?? 0, age);
        if (problem == "age") throw ApiException.Forbidden("age");
        if (problem is not null) throw ApiException.Invalid(problem);
        if (body!.DataUrl is not { } url || !url.StartsWith($"data:{body.Type};base64,", StringComparison.Ordinal) || url.Length > ServiceRules.MaxPhotoDataUrl) throw ApiException.Invalid("size");
        var caption = Describe(body.Caption);
        if (caption.Length > 200) caption = caption[..200];
        if (ServiceRules.ChildSafeProblem(caption, age) is { } bad) throw ApiException.Invalid(bad);
        if (ProfanityFilter.IsBlocked(caption)) throw ApiException.Invalid("blocked");
        return await StoreAsync(actor, member, caption, url, null, now, ct);
    }

    private async Task<ChatMessageDto> StoreAsync(UserRecord actor, ChatMemberRow member, string text, string? photo, Guid? clientId, DateTime now, CancellationToken ct, bool viaSms = false, string urgency = ChatUrgencyRules.Normal, ChatMessageRow? quoted = null)
    {
        var sent = await store.AddMessageAsync(member.GroupId, actor.Id, text, photo, clientId, now, ct, viaSms, urgency, quoted?.Id);
        ChatQuoteDto? quote = null;
        if (quoted is not null)
        {
            var peers = (await store.ListMembersAsync(member.GroupId, ct)).ToDictionary(p => p.UserId);
            quote = QuoteDto(new ChatQuoteRow { Id = quoted.Id, PublicId = quoted.PublicId, FromUserId = quoted.FromUserId, Text = quoted.Text, HasPhoto = quoted.Photo is not null, IsSystem = quoted.IsSystem }, actor.Id, peers);
        }
        var dto = new ChatMessageDto(sent.Row.PublicId, actor.PublicId, sent.Row.Text, Shipboard.Ms(sent.Row.At), sent.Row.Photo, ViaSms: viaSms, Urgency: Flag(sent.Row.Urgency), HasPhoto: sent.Row.Photo is not null, ReplyTo: quote);
        if (!sent.Created) return dto;   // a retry of a message that already went out: nobody is told twice
        await TellAsync(actor, member, sent.Row);
        return dto;
    }

    /// <summary>
    /// The photo of one message the caller may read, as the data URL it was sent as (a thread page leaves it out, so a refetch does not carry megabytes). 404 for anything the caller cannot read.
    /// A photo never changes, so the answer can be kept by the app.
    /// </summary>
    public async Task<ChatPhotoDto> PhotoAsync(UserRecord actor, Guid conversationId, Guid messageId, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct);
        return message?.Photo is { } photo ? new ChatPhotoDto(photo) : throw ApiException.NotFound();
    }

    /// <summary>
    /// Hands the message to <see cref="ChatFanoutQueue"/>: the sender's answer does not wait for the notices (who is told, and how, is in <see cref="ChatFanout"/>).
    /// Only if the line is full is it done here, so an alert is never dropped.
    /// </summary>
    private async Task TellAsync(UserRecord actor, ChatMemberRow member, ChatMessageRow message)
    {
        var job = new ChatFanoutJob(actor.Id, member.GroupId, member.GroupPublicId, message);
        if (!fanoutQueue.TryEnqueue(job)) await fanout.RunAsync(job, CancellationToken.None);
    }

    /// <summary>The caller has read the conversation up to now: the unread count clears on every device, and receipts are recorded only when the caller has them on.</summary>
    public async Task ReadAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        await store.MarkReadAsync(member.GroupId, actor.Id, await store.GetReceiptsAsync(actor.Id, ct), await userClock.NowAsync(actor, ct), ct);
        await notifier.ReadAsync(actor.Id, conversationId, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), ct);
    }

    /// <summary>
    /// Reacts to a message with one of the six emoji (phase 1): a different one replaces the caller's old reaction, the same one again takes it away. Returns the chips now under the message.
    /// The other members' open apps are nudged to refetch; no phone alert is ever sent for a reaction. 400 emoji or notMessage (a line about the group, or a notice); 403 stanley; 404 for a message the caller cannot read; 409 closed.
    /// </summary>
    public async Task<List<ChatReactionDto>> ReactAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatReactRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        if (ChatConversationRules.IsClosed(member.Kind, member.Status, member.DirectEnded)) throw ApiException.Conflict("closed");
        if (!ChatReactionRules.IsAllowed(body?.Emoji)) throw ApiException.Invalid("emoji");
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (!ChatReactionRules.CanTarget(message.IsSystem, message.FromStanley)) throw ApiException.Invalid("notMessage");
        var now = await userClock.NowAsync(actor, ct);
        await store.SetReactionAsync(message.Id, actor.Id, ChatReactionRules.Toggle(await store.GetReactionAsync(message.Id, actor.Id, ct), body!.Emoji!), now, ct);
        await TellThreadChangedAsync(actor, member, "reaction", ct);
        var peers = (await store.ListMembersAsync(member.GroupId, ct)).ToDictionary(p => p.UserId);
        return ReactionDtos(await store.ListReactionsAsync(message.Id, ct), actor.Id, peers, new HashSet<long>(await store.ListBlocksAsync(actor.Id, ct)));
    }

    /// <summary>
    /// A device of the caller has the conversation's messages (phase 1): everything others sent is marked delivered, and the senders are nudged once to show Delivered. Repeating it changes nothing and tells no one.
    /// </summary>
    public async Task DeliveredAsync(UserRecord actor, Guid conversationId, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        var senders = await store.MarkDeliveredAsync(member.GroupId, actor.Id, await userClock.NowAsync(actor, ct), ct);
        await Task.WhenAll(senders.Where(id => id != actor.Id).Select(id => notifier.ThreadChangedAsync(id, conversationId, "delivered", ct)));
    }

    /// <summary>A live nudge to the other active members (who have not blocked the caller) and the caller's other devices, so their threads refetch. Never a phone alert.</summary>
    private async Task TellThreadChangedAsync(UserRecord actor, ChatMemberRow member, string kind, CancellationToken ct)
    {
        var recipients = await store.ListRecipientsAsync(member.GroupId, actor.Id, ct);
        await Task.WhenAll(recipients.Select(r => r.UserId).Append(actor.Id).Select(id => notifier.ThreadChangedAsync(id, member.GroupPublicId, kind, ct)));
    }

    /// <summary>
    /// The caller acknowledges an urgent message from someone else ("Got it"). Idempotent. The sender and the caller's other devices are nudged so the sender's "seen by" and the pinned state update.
    /// 404 for a message the caller cannot read; 400 notUrgent for one that cannot be acknowledged.
    /// </summary>
    public async Task AckAsync(UserRecord actor, Guid conversationId, Guid messageId, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (member.Status != ChatConversationRules.Active) throw ApiException.NotFound();
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (!ChatUrgencyRules.CanAck(message.Urgency, message.IsSystem, message.FromUserId == actor.Id, message.Lane is not null)) throw ApiException.Invalid("notUrgent");
        var at = await userClock.NowAsync(actor, ct);
        if (!await store.AddAckAsync(message.Id, actor.Id, at, ct)) return;
        // The delivery log keeps kind, lane, key and time, never the text; a failure to log must not undo the acknowledgement.
        if (message.Lane is not null && message.NoticeKey is not null)
            try { await store.LogNoticeDeliveryAsync(actor.Id, message.NoticeKey, message.NoticeKind ?? "", message.Lane, StanleyNoticeRules.EventAcked, at, ct); } catch (Exception e) when (e is not OperationCanceledException) { /* counts are best effort */ }
        if (!message.FromStanley) await notifier.AckedAsync(message.FromUserId, conversationId, messageId, ct);   // Stanley has no one to tell
        await notifier.AckedAsync(actor.Id, conversationId, messageId, ct);
    }

    /// <summary>
    /// A chip on a relayed notice (phase 0c): "Why?" and "What should I do?" are answered from the notice's own kind and state, not from the chat history, and are written to the thread as
    /// Stanley's lines. "Remind me later" sets a reminder an hour on (the existing reminder service, so it reaches the phone with the app closed) and is refused for a critical notice.
    /// 400 reply or notNotice; 404 for a message the caller cannot read; 409 expired for Remind me later on a notice that no longer applies.
    /// </summary>
    public async Task<ChatNoticeReplyDto> NoticeReplyAsync(UserRecord actor, Guid conversationId, Guid messageId, ChatNoticeReplyRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (member.Status != ChatConversationRules.Active || !ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.NotFound();
        var message = await store.FindMessageAsync(member.GroupId, actor.Id, messageId, ct) ?? throw ApiException.NotFound();
        if (!message.FromStanley || message.Lane is null) throw ApiException.Invalid("notNotice");
        var reply = body?.Reply ?? "";
        if (!StanleyNoticeRules.RepliesOf(message.Lane).Contains(reply)) throw ApiException.Invalid("reply");
        var now = await userClock.NowAsync(actor, ct);
        var expired = message.ExpiresAt is { } e && e <= now;
        var replaced = message.SupersededAt is not null;
        if (reply == StanleyNoticeRules.ReplyLater)
        {
            if (expired || replaced) throw ApiException.Conflict("expired");
            if (reminders is null) throw ApiException.Invalid("reply");
            var headline = message.Text.Split('\n', 2)[0];
            var due = await reminders.SetInAsync(actor, TimeSpan.FromMinutes(StanleyNoticeRules.LaterMinutes), headline, ct);
            return new("I will remind you in an hour.", Shipboard.Ms(due));
        }
        return new(StanleyNoticeRules.AnswerTo(reply, message.NoticeKind ?? "", expired, replaced) ?? throw ApiException.Invalid("reply"));
    }

    public async Task<bool> MuteAsync(UserRecord actor, Guid conversationId, ChatMuteRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");   // quieted by category in Stanley notices, never as a whole
        var on = body?.On == true;
        await store.SetMutedAsync(member.GroupId, actor.Id, on, ct);
        return on;
    }

    /// <summary>Turns "tell this chat when I leave or return to the ship" on or off for the caller in one conversation. 403 supervised; 404 not a member. Off unless asked for.</summary>
    public async Task<bool> NotifyAwayAsync(UserRecord actor, Guid conversationId, ChatNotifyAwayRequest? body, CancellationToken ct)
    {
        var member = await MemberAsync(actor, conversationId, ct);
        if (ChatConversationRules.IsPermanent(member.Kind)) throw ApiException.Forbidden("stanley");
        var on = body?.On == true;
        if (on && !ChatAwayRules.MayEnable(actor.IsSupervised)) throw ApiException.Forbidden("supervised");
        await store.SetNotifyAwayAsync(member.GroupId, actor.Id, on, ct);
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
    private async Task<int> AgeAsync(UserRecord actor, DateTime now, CancellationToken ct) =>
        await accounts.GetProfileAsync(actor.Id, ct) is { } p ? AccountRules.AgeOn(DateOnly.FromDateTime(p.Dob), TripRules.Today(now)) : actor.IsSupervised ? 0 : 18;
}
