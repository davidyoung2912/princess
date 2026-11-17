using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Whatever knows how to check and deliver one trigger type. A reminder source, a rule pack or a check-up each register one.</summary>
public interface IStanleyDueHandler
{
    /// <summary>The <see cref="StanleyTrigger"/> this handler serves.</summary>
    string Trigger { get; }
    /// <summary>Re-reads the stop fact just before delivery: false when the need has gone (the reminder was removed, the booking was made), so nothing is sent.</summary>
    Task<bool> StillNeededAsync(StanleyDue due, CancellationToken ct);
    /// <summary>Puts the card in the guest's thread, and on their phone when <see cref="StanleyCard.Push"/> is set. Must be safe to repeat for the same keys.</summary>
    Task DeliverAsync(long userId, StanleyCard card, CancellationToken ct);
}

/// <summary>The guest's limits for this moment (budget, quiet hours, calm mode, a ship alert in progress). Null when the guest is gone.</summary>
public interface IStanleyDueContext
{
    Task<ArbiterContext?> LoadAsync(long userId, CancellationToken ct);
}

/// <summary>Reads the context from the same rules the push dispatch uses, so the arbiter and the phone agree.</summary>
public sealed class PushStanleyDueContext(IUserStore users, PushService push) : IStanleyDueContext
{
    public async Task<ArbiterContext?> LoadAsync(long userId, CancellationToken ct) =>
        await users.FindByIdAsync(userId, ct) is { } user ? await push.ProactiveContextAsync(user, ct) : null;
}

/// <summary>What one pass did, for tests and the log.</summary>
public sealed record StanleyDueSummary(int Claimed, int Cards, int Held, int Dropped, int Rescheduled);

/// <summary>
/// The scheduler worker (phase P2c). Each pass claims what is due under a lease (so two server instances never work the same item), re-reads each item's stop fact, applies the
/// operator's kill switches and the class circuit breakers, runs one guest's items through the arbiter, and delivers the cards. Time comes from <see cref="IClock"/>, so a test pins it.
/// An item that cannot be delivered is put back for later, never lost; one guest failing does not stop the rest.
/// </summary>
public sealed class StanleyDueWorker(IServiceScopeFactory scopes, IOptions<SchedulerOptions> options, IClock clock, ILogger<StanleyDueWorker> log) : BackgroundService
{
    private readonly string _owner = $"{Environment.MachineName}:{Guid.NewGuid():N}";
    private static readonly TimeSpan RetryAfter = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan KeepFor = TimeSpan.FromDays(7);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var seconds = options.Value.DueIntervalSeconds;
        if (seconds <= 0) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(seconds));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "The Stanley due worker pass failed; it will try again at the next interval"); }
        }
    }

    public async Task<StanleyDueSummary> RunOnceAsync(CancellationToken ct)
    {
        var o = options.Value;
        var now = clock.UtcNow;
        List<StanleyDueRow> claimed;
        await using (var scope = scopes.CreateAsyncScope())
        {
            var store = scope.ServiceProvider.GetRequiredService<IStanleyDueStore>();
            claimed = await store.ClaimDueAsync(now, _owner, TimeSpan.FromSeconds(Math.Max(10, o.LeaseSeconds)), Math.Max(1, o.DueBatch), ct);
            if (claimed.Count == 0) await store.DeleteOlderThanAsync(now - KeepFor, ct);
        }
        int cards = 0, held = 0, dropped = 0, back = 0;
        foreach (var guest in claimed.GroupBy(r => r.UserId))
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var (c, h, d, b) = await RunGuestAsync(guest.Key, [.. guest], now, ct);
                cards += c; held += h; dropped += d; back += b;
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                // The leases run out and the items are claimed again; nothing is lost.
                log.LogWarning(e, "The Stanley due worker could not run user {UserId}", guest.Key);
            }
        }
        return new(claimed.Count, cards, held, dropped, back);
    }

    private async Task<(int Cards, int Held, int Dropped, int Back)> RunGuestAsync(long userId, List<StanleyDueRow> rows, DateTime now, CancellationToken ct)
    {
        var o = options.Value;
        await using var scope = scopes.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var store = sp.GetRequiredService<IStanleyDueStore>();
        var breakers = sp.GetRequiredService<IStanleyBreakerStore>();
        var handlers = sp.GetServices<IStanleyDueHandler>().ToDictionary(h => h.Trigger);
        int cardCount = 0, heldCount = 0, droppedCount = 0, backCount = 0;

        async Task Close(StanleyDueRow r, string state, string reason)
        {
            await store.CompleteAsync(r.Id, _owner, state, reason, ct);
            if (state == StanleyDueState.Held) heldCount++; else droppedCount++;
        }

        var ctx = await sp.GetRequiredService<IStanleyDueContext>().LoadAsync(userId, ct);
        if (ctx is null)
        {
            foreach (var r in rows) await Close(r, StanleyDueState.Dropped, "noUser");
            return (0, 0, droppedCount, 0);
        }
        ctx = ctx with { OffClasses = new HashSet<string>(ctx.OffClasses.Concat(o.OffClasses ?? [])) };

        var byKey = rows.ToDictionary(r => r.IdemKey);
        var live = new List<StanleyDue>();
        foreach (var r in rows)
        {
            if (!handlers.TryGetValue(r.TriggerKind, out var handler)) { await Close(r, StanleyDueState.Held, "noHandler"); continue; }
            if (!ctx.OffClasses.Contains(r.ClassId) && !await handler.StillNeededAsync(r.ToDue(), ct)) { await Close(r, StanleyDueState.Dropped, "stale"); continue; }
            live.Add(r.ToDue());
        }

        var result = StanleyArbiter.Arbitrate(live, ctx);
        foreach (var d in result.Dropped) await Close(byKey[d.Key], StanleyDueState.Dropped, d.Reason);
        foreach (var k in result.Duplicates) await Close(byKey[k], StanleyDueState.Dropped, "duplicate");
        foreach (var h in result.Held) await Close(byKey[h.Key], StanleyDueState.Held, h.Reason);

        foreach (var card in result.Cards)
        {
            var first = byKey[card.Keys[0]];
            var cardRows = card.Keys.Select(k => byKey[k]).ToList();
            var breaker = await breakers.GetAsync(first.ClassId, ct);
            // A critical card is never held back by a breaker: the breaker guards convenience, not safety.
            if (!card.Critical && StanleyBreakerRules.IsPaused(breaker, now))
            {
                foreach (var r in cardRows) { await store.RescheduleAsync(r.Id, _owner, breaker.PausedUntil!.Value, "breaker", ct); backCount++; }
                continue;
            }
            try
            {
                await handlers[first.TriggerKind].DeliverAsync(userId, card, ct);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Delivery of a Stanley card failed for user {UserId}; it will be tried again", userId);
                foreach (var r in cardRows) { await store.RescheduleAsync(r.Id, _owner, now + RetryAfter, "failed", ct); backCount++; }
                continue;
            }
            foreach (var r in cardRows) await store.CompleteAsync(r.Id, _owner, StanleyDueState.Done, null, ct);
            cardCount++;
            if (!card.Critical)
                await breakers.SaveAsync(first.ClassId, StanleyBreakerRules.Record(breaker, now, 1, o.BreakerLimit, TimeSpan.FromMinutes(o.BreakerWindowMinutes), TimeSpan.FromMinutes(o.BreakerPauseMinutes)), ct);
        }
        return (cardCount, heldCount, droppedCount, backCount);
    }
}
