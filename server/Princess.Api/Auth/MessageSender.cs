using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Auth;

/// <summary>Sends one message to a guest: <see cref="ProviderMessageSender"/> through the email and text providers; <see cref="StubMessageSender"/> only records it (NOT-01).</summary>
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

/// <summary>
/// Sends a sign-in message (a code) through the same email and text providers as every other notice (<c>Providers:Email</c> and <c>Providers:Sms</c>: Pingram, or the simulated
/// ones), and records the outcome in the outbox. A message the provider did not accept is recorded as failed, never as sent. In Development the body is also written to the log so a
/// code can be read there; in any other environment the body (which holds a code) is never logged.
/// </summary>
public sealed class ProviderMessageSender(IEmailSender email, ISmsSender sms, ISignInStore store, IClock clock, IHostEnvironment env, ILogger<ProviderMessageSender> log) : IMessageSender
{
    public async Task SendAsync(OutboxMessage message, CancellationToken ct)
    {
        var accepted = message.Channel switch
        {
            "email" => await email.SendAsync(new EmailMessage(message.To, message.Subject, message.Body), ct),
            "sms" => await sms.SendAsync(new SmsMessage(message.To, message.Body), ct),
            _ => false,
        };
        await store.AddOutboxAsync(message, accepted ? "sent" : "failed", clock.UtcNow, ct);
        if (env.IsDevelopment()) log.LogInformation("{Channel} to {To}: {Subject} | {Body}", message.Channel, message.To, message.Subject, message.Body);
        else log.LogInformation("{Channel} {Category} message {Outcome}", message.Channel, message.Category, accepted ? "sent" : "failed");
    }
}
