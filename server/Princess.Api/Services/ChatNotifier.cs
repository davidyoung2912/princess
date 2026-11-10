using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Tells a person about a chat event the moment it happens (docs/chat-plan.md, 4.4). Phase 1 sends a phone alert; phase 3 adds the live connection for open apps in front of it.
/// The connection row is what the app shows, so a notice that does not arrive (no phone, quiet hours, a failed send) never loses the request: it is waiting in the app.
/// A failed send is logged and never fails the action that caused it.
/// </summary>
public sealed class ChatNotifier(PushService push, IUserStore users, ILogger<ChatNotifier> log)
{
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
            var notice = new PushNotice(ChatConnectionRules.NoticeKey(kind, connectionId), "chat", "chat", false, 50, "/chat", text.Title, text.Body, new() { ["connection"] = connectionId.ToString("N") });
            await push.NotifyChatAsync(user, notice, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Chat notice {Kind} could not be sent", kind);
        }
    }
}
