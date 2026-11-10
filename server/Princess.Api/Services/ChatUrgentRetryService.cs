using Princess.Api.Data;

namespace Princess.Api.Services;

/// <summary>
/// Once a minute, sends the single text reminder for an urgent chat message that went out by text and has not been confirmed with Got it (docs/chat-urgency-plan.md, phase 4).
/// The rules are in <see cref="ChatSmsService.RetryUnconfirmedAsync"/>; a database lock keeps two server instances from reminding twice. A failed pass is tried again next minute.
/// </summary>
public sealed class ChatUrgentRetryService(IServiceScopeFactory scopes, ILogger<ChatUrgentRetryService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await using var held = await scope.ServiceProvider.GetRequiredService<IWatchLock>().TryAcquireAsync(stoppingToken);
                if (held is null) continue;
                await scope.ServiceProvider.GetRequiredService<ChatSmsService>().RetryUnconfirmedAsync(stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "The urgent chat reminder pass failed; it will try again in a minute"); }
        }
    }
}
