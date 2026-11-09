using Microsoft.Extensions.Options;
using Princess.Api.Data;

namespace Princess.Api.Services;

public sealed class SchedulerOptions
{
    public const string Section = "Scheduler";
    /// <summary>Minutes between runs. 0 switches the scheduler off.</summary>
    public int IntervalMinutes { get; set; } = 15;
    /// <summary>The most people looked after in one run.</summary>
    public int MaxPeople { get; set; } = 500;
}

/// <summary>
/// Runs the same check the app triggers when it opens (automatic instalments, then the push notices) for everyone who has a phone signed up for alerts or an automatic
/// instalment, so they work with the app closed. The rules are unchanged: <see cref="PushService.DispatchAsync"/> keeps each notice to once, and the guest's quiet hours,
/// calm mode and budget still apply. Waits one interval before the first run, so starting the server never charges anyone at once. One person failing does not stop the rest. A database lock (<see cref="IWatchLock"/>) keeps two server instances from running a pass together.
/// </summary>
public sealed class WatchSchedulerService(IServiceScopeFactory scopes, IOptions<SchedulerOptions> options, ILogger<WatchSchedulerService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = options.Value.IntervalMinutes;
        if (minutes <= 0) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(minutes));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "The watch scheduler run failed; it will try again at the next interval"); }
        }
    }

    /// <summary>One pass over everyone; returns how many people were checked.</summary>
    public async Task<int> RunOnceAsync(CancellationToken ct)
    {
        List<long> ids;
        // Only one server instance runs a pass at a time; if another has it, this one skips the pass.
        await using var scopeForLock = scopes.CreateAsyncScope();
        await using var held = await scopeForLock.ServiceProvider.GetRequiredService<IWatchLock>().TryAcquireAsync(ct);
        if (held is null) return 0;
        await using (var scope = scopes.CreateAsyncScope())
            ids = await scope.ServiceProvider.GetRequiredService<IWatchTargetStore>().ListUserIdsAsync(Math.Max(1, options.Value.MaxPeople), ct);
        var checkedCount = 0;
        foreach (var id in ids)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                if (await scope.ServiceProvider.GetRequiredService<IUserStore>().FindByIdAsync(id, ct) is not { } user) continue;
                await scope.ServiceProvider.GetRequiredService<PushService>().DispatchAsync(user, null, ct);
                checkedCount++;
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "The watch scheduler could not check user {UserId}", id);
            }
        }
        return checkedCount;
    }
}
