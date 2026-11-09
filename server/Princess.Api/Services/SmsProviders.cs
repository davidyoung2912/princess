using System.Collections.Concurrent;

namespace Princess.Api.Services;

public sealed record SmsMessage(string To, string Body);

/// <summary>
/// Sends a short text message (X14). The seam a real provider replaces (<c>Providers:Sms</c>); the front end never knows which is in use.
/// Returns whether the provider accepted the message, so a failure is tried again at the next check rather than recorded as sent.
/// </summary>
public interface ISmsSender
{
    Task<bool> SendAsync(SmsMessage message, CancellationToken ct);
}

/// <summary>Records what would be sent and delivers nothing.</summary>
public sealed class SimSmsSender : ISmsSender
{
    private readonly ConcurrentQueue<SmsMessage> _sent = new();

    /// <summary>Everything "sent" so far, oldest first; for tests and the local log.</summary>
    public IReadOnlyCollection<SmsMessage> Sent => _sent;

    public Task<bool> SendAsync(SmsMessage message, CancellationToken ct)
    {
        _sent.Enqueue(message);
        while (_sent.Count > 200) _sent.TryDequeue(out _);
        return Task.FromResult(true);
    }
}
