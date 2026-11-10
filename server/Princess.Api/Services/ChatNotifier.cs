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

    private async Task Send(long userId, string kind, Guid connectionId, (string Title, string Body) text, CancellationToken ct)
    {
        try
        {
            if (await users.FindByIdAsync(userId, ct) is not { } user) return;
            var key = ChatConnectionRules.NoticeKey(kind, connectionId);
            var notice = new PushNotice(key, "chat", "chat", false, 50, "/chat", text.Title, text.Body, new() { ["connection"] = connectionId.ToString("N") });
            // Nobody has the app open here: the phone is told at once, as before.
            if (!realtime.IsConnected(user.PublicId)) { await push.NotifyChatAsync(user, notice, ct); return; }
            // An app is open: nudge it, and buzz the phone only if no app answers. The wait is off the request, so accepting a request never takes 8 seconds.
            var nudge = realtime.PublishAsync(user.PublicId, new ChatEvent(key, kind), AckWait, CancellationToken.None);
            _ = Task.Run(() => PhoneIfUnheardAsync(nudge, userId, notice));
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Chat notice {Kind} could not be sent", kind);
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
