using Microsoft.Extensions.Options;

namespace Princess.Api.Services;

public sealed class RetentionOptions
{
    public const string Section = "Retention";
    /// <summary>Minutes between runs. 0 switches the job off.</summary>
    public int IntervalMinutes { get; set; } = 360;
}

/// <summary>
/// Deletes data past its retention date even if nobody opens the privacy centre (SEC-03).
/// Uses real time; the privacy centre still purges a demo person's booking at their own clock.
/// </summary>
public sealed class RetentionPurgeService(IServiceScopeFactory scopes, IOptions<RetentionOptions> options, ILogger<RetentionPurgeService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = options.Value.IntervalMinutes;
        if (minutes <= 0) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(minutes));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var n = await scope.ServiceProvider.GetRequiredService<PrivacyService>().PurgeAllDueAsync(stoppingToken);
                if (n > 0) log.LogInformation("Retention purge ran for {Count} booking(s)", n);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Retention purge failed; it will try again at the next interval");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
