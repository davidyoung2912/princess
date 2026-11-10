using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Realtime;

namespace Princess.Api.Services;

/// <summary>
/// Tells a person about a chat event the moment it happens (docs/chat-plan.md, 4.4). An open app is nudged first over the live connection and sends back an acknowledgement; a phone alert follows only when nobody acknowledged within <see cref="AckWait"/> (or no app is connected at all).
/// The connection row is what the app shows, so a notice that does not arrive (no phone, quiet hours, a failed send) never loses the request: it is waiting in the app.
/// A failed send is logged and never fails the action that caused it.
/// </summary>
public sealed class ChatNotifier(PushService push, IUserStore users, IRealtimeHub realtime, IServiceScopeFactory scopes, ILogger<ChatNotifier> log)
{
    /// <summary>How long an open app has to say it got the nudge before the phone is buzzed.</summary>
    public static readonly TimeSpan AckWait = TimeSpan.FromSeconds(8);

    /// <summary>A guest has a new request. <paramref name="from"/> is the sender's short name.</summary>
    public Task RequestAsync(long toUserId, Guid connectionId, string from, CancellationToken ct) =>
        Send(toUserId, "request", connectionId, ChatConnectionRules.RequestNotice(from), ct);

    /// <summary>The target agreed.</summary>
    public Task AcceptedAsync(long toUserId, Guid connectionId, string by, CancellationToken ct) =>
        Send(toUserId, "accepted", connectionId, ChatConnectionRules.AcceptedNotice(by), ct);

    /// <summary>The target said no. The notice says nothing more than that there is an answer.</summary>
    public Task DeclinedAsync(long toUserId, Guid connectionId, CancellationToken ct) =>
        Send(toUserId, "declined", connectionId, ChatConnectionRules.DeclinedNotice(), ct);

    /// <summary>A guardian is asked to approve something for their child.</summary>
    public Task ApprovalAsync(long guardianUserId, Guid connectionId, string child, CancellationToken ct) =>
        Send(guardianUserId, "approval", connectionId, ChatConnectionRules.ApprovalNotice(child), ct);

    /// <summary>A guest is invited to a group. The notice names the inviter and the group.</summary>
    public Task GroupInviteAsync(long toUserId, Guid inviteId, string from, string group, CancellationToken ct) =>
        Deliver(toUserId, "groupInvite", Notice(ChatGroupRules.NoticeKey("invite", inviteId), ChatGroupRules.InviteNotice(from, group), inviteId), true, ct);

    /// <summary>A guardian is asked to approve a group invitation for their child.</summary>
    public Task GroupApprovalAsync(long guardianUserId, Guid inviteId, string child, CancellationToken ct) =>
        Deliver(guardianUserId, "groupApproval", Notice(ChatGroupRules.NoticeKey("approval", inviteId), ChatGroupRules.ApprovalNotice(child), inviteId), true, ct);

    private static PushNotice Notice(string key, (string Title, string Body) text, Guid id) =>
        new(key, "chat", "chat", false, 50, "/chat", text.Title, text.Body, new() { ["invite"] = id.ToString("N") });

    /// <summary>
    /// A new message in a conversation (docs/chat-plan.md, 4.4). The text is on the lock screen only when the recipient opted in (<paramref name="showPreview"/>).
    /// A muted conversation never buzzes the phone, unless the message is urgent (<see cref="ChatUrgencyRules"/>); an open app is still nudged so its unread count stays right. Notices of one conversation share a tag, so a phone shows one line for a busy group.
    /// </summary>
    public Task MessageAsync(long toUserId, Guid conversationId, Guid messageId, string from, string? text, bool showPreview, bool muted, CancellationToken ct, string urgency = ChatUrgencyRules.Normal, long senderId = 0)
    {
        var words = ChatConversationRules.MessageNotice(from, text, showPreview, urgency);
        var key = ChatConversationRules.NoticeKey(conversationId, messageId);
        // Urgent breaks through do-not-disturb, calm mode and a muted conversation; important and normal do not.
        var breaks = ChatUrgencyRules.BreaksThrough(urgency);
        var notice = new PushNotice(key, "chat", "chat", breaks, breaks ? 90 : 50, ChatConversationRules.NoticePath(conversationId), words.Title, words.Body,
            new() { ["conversation"] = conversationId.ToString("N") }, ChatConversationRules.NoticeTag(conversationId));
        // An open app that answers the nudge has the message: that is Delivered for the sender, even in a muted chat.
        return Deliver(toUserId, "message", notice, breaks || !muted, ct, senderId == 0 ? null : new DeliveryRef(conversationId, messageId, senderId));
    }

    /// <summary>A connected guest left or returned to the ship. A normal notice: it obeys do-not-disturb, and a muted conversation gets the line but no phone alert.</summary>
    public Task AwayAsync(long toUserId, Guid conversationId, string who, ChatAwayRules.Change change, long atMs, bool muted, CancellationToken ct)
    {
        var words = ChatAwayRules.Notice(who, change);
        var notice = new PushNotice(ChatAwayRules.NoticeKey(conversationId, toUserId, change, atMs), "chat", "chat", false, 50, ChatConversationRules.NoticePath(conversationId), words.Title, words.Body,
            new() { ["conversation"] = conversationId.ToString("N") }, ChatConversationRules.NoticeTag(conversationId));
        return Deliver(toUserId, "away", notice, !muted, ct);
    }

    /// <summary>An urgent message was acknowledged: a live nudge only (never a phone notice) so the sender's "seen by" and the reader's pinned state refresh at once.</summary>
    public Task AckedAsync(long userId, Guid conversationId, Guid messageId, CancellationToken ct) =>
        Deliver(userId, "acked", new PushNotice($"chat:ack:{conversationId:N}:{messageId:N}:{userId}", "chat", "chat", false, 50, ChatConversationRules.NoticePath(conversationId), "", "",
            new() { ["conversation"] = conversationId.ToString("N") }), false, ct);

    /// <summary>A conversation was read: a live nudge only, to the reader's own devices, so an app still open on another one refreshes its numbers and takes the stale alert away.</summary>
    public Task ReadAsync(long userId, Guid conversationId, long atMs, CancellationToken ct) =>
        Deliver(userId, "read", new PushNotice($"chat:read:{conversationId:N}:{userId}:{atMs}", "chat", "chat", false, 50, ChatConversationRules.NoticePath(conversationId), "", "",
            new() { ["conversation"] = conversationId.ToString("N") }), false, ct);

    /// <summary>
    /// A reaction was added, changed or removed, or a device received messages: a live nudge only, never a phone notice (docs/chat-features-research.md, phase 1), so the other members' screens refetch and show it.
    /// Nobody with the app closed hears anything, and nothing is lost: the next thread read carries it.
    /// </summary>
    public Task ThreadChangedAsync(long userId, Guid conversationId, string kind, CancellationToken ct) =>
        Deliver(userId, kind, new PushNotice($"chat:{kind}:{conversationId:N}:{userId}:{Guid.NewGuid():N}", "chat", "chat", false, 50, ChatConversationRules.NoticePath(conversationId), "", "",
            new() { ["conversation"] = conversationId.ToString("N") }), false, ct);

    private Task Send(long userId, string kind, Guid connectionId, (string Title, string Body) text, CancellationToken ct) =>
        Deliver(userId, kind, new PushNotice(ChatConnectionRules.NoticeKey(kind, connectionId), "chat", "chat", false, 50, "/chat", text.Title, text.Body, new() { ["connection"] = connectionId.ToString("N") }), true, ct);

    /// <summary>The message a nudge is about, so an app that answers it can be recorded as having it and the sender told.</summary>
    private sealed record DeliveryRef(Guid ConversationId, Guid MessageId, long SenderId);

    private async Task Deliver(long userId, string kind, PushNotice notice, bool phone, CancellationToken ct, DeliveryRef? delivery = null)
    {
        try
        {
            if (await users.FindByIdAsync(userId, ct) is not { } user) return;
            var key = notice.Key;
            // Nobody has the app open here: the phone is told at once, as before.
            if (!realtime.IsConnected(user.PublicId)) { if (phone) await push.NotifyChatAsync(user, notice, ct); return; }
            // An app is open: nudge it, and buzz the phone only if no app answers. The wait is off the request, so accepting a request never takes 8 seconds.
            var nudge = realtime.PublishAsync(user.PublicId, new ChatEvent(key, kind), AckWait, CancellationToken.None);
            if (phone) _ = Task.Run(() => PhoneIfUnheardAsync(nudge, userId, notice));
            if (delivery is not null) _ = Task.Run(() => RecordDeliveredAsync(nudge, userId, delivery));
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Chat notice {Kind} could not be sent", kind);
        }
    }

    /// <summary>When the open app answered the nudge, records the delivery (once; a repeat changes nothing) and nudges the sender to show Delivered. A failure is logged and never reaches anyone.</summary>
    private async Task RecordDeliveredAsync(Task<bool> nudge, long userId, DeliveryRef delivery)
    {
        try
        {
            if (!await nudge) return;
            using var scope = scopes.CreateScope();
            if (!await scope.ServiceProvider.GetRequiredService<IChatStore>().AddDeliveryAsync(delivery.MessageId, userId, DateTime.UtcNow, CancellationToken.None)) return;
            await ThreadChangedAsync(delivery.SenderId, delivery.ConversationId, "delivered", CancellationToken.None);
        }
        catch (Exception e)
        {
            log.LogWarning(e, "A delivery could not be recorded for {Key}", delivery.MessageId);
        }
    }

    private async Task PhoneIfUnheardAsync(Task<bool> nudge, long userId, PushNotice notice)
    {
        try
        {
            if (await nudge) return;
            using var scope = scopes.CreateScope();
            if (await scope.ServiceProvider.GetRequiredService<IUserStore>().FindByIdAsync(userId, CancellationToken.None) is not { } user) return;
            await scope.ServiceProvider.GetRequiredService<PushService>().NotifyChatAsync(user, notice, CancellationToken.None);
        }
        catch (Exception e)
        {
            log.LogWarning(e, "Chat notice {Kind} could not be sent after the live nudge", notice.Key);
        }
    }
}
