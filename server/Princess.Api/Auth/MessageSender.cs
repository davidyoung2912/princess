using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

/// <summary>Sends one message to a guest. The only implementation is a stub: a real email or SMS provider replaces it (NOT-01).</summary>
public interface IMessageSender
{
    Task SendAsync(OutboxMessage message, CancellationToken ct);
}

/// <summary>
/// Records the message in the outbox as sent and sends nothing. In Development the body is also written to the log, so a
/// reset code can be read there; in any other environment the body (which holds a code) is never logged.
/// </summary>
public sealed class StubMessageSender(ISignInStore store, IClock clock, IHostEnvironment env, ILogger<StubMessageSender> log) : IMessageSender
{
    public async Task SendAsync(OutboxMessage message, CancellationToken ct)
    {
        await store.AddOutboxAsync(message, "sent", clock.UtcNow, ct);
        if (env.IsDevelopment()) log.LogInformation("STUB {Channel} to {To}: {Subject} | {Body}", message.Channel, message.To, message.Subject, message.Body);
        else log.LogInformation("STUB {Channel} {Category} message queued", message.Channel, message.Category);
    }
}
