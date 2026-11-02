using System.Collections.Concurrent;

namespace Princess.Api.Services;

public sealed record EmailMessage(string To, string Subject, string Body);

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
