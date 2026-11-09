using System.Collections.Concurrent;

namespace Princess.Api.Services;

/// <summary>
/// An email to send. When <see cref="UnsubscribeUrl"/> is set, a real provider adds the one-click headers (RFC 8058): <c>List-Unsubscribe: &lt;url&gt;</c> and
/// <c>List-Unsubscribe-Post: List-Unsubscribe=One-Click</c>, so a mail app can offer its own "unsubscribe" button that posts to the same link.
/// </summary>
public sealed record EmailMessage(string To, string Subject, string Body, string? UnsubscribeUrl = null)
{
    /// <summary>The headers a provider should add for the one-click unsubscribe; empty when there is no link.</summary>
    public IReadOnlyDictionary<string, string> ListHeaders => UnsubscribeUrl is null
        ? new Dictionary<string, string>()
        : new Dictionary<string, string> { ["List-Unsubscribe"] = $"<{UnsubscribeUrl}>", ["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click" };
}

/// <summary>
/// Sends a plain email (small delights DL5). The seam a real provider replaces (<c>Providers:Email</c>); the front end never knows which is in use.
/// Returns whether the provider accepted the message, so a failure is tried again at the next check rather than recorded as sent.
/// </summary>
public interface IEmailSender
{
    Task<bool> SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>Records what would be sent and delivers nothing.</summary>
public sealed class SimEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _sent = new();

    /// <summary>Everything "sent" so far, oldest first; for tests and the local log.</summary>
    public IReadOnlyCollection<EmailMessage> Sent => _sent;

    public Task<bool> SendAsync(EmailMessage message, CancellationToken ct)
    {
        _sent.Enqueue(message);
        while (_sent.Count > 200) _sent.TryDequeue(out _);
        return Task.FromResult(true);
    }
}
