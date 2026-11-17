using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

public class StanleyArbiterTests
{
    private static readonly DateTime T = new(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc);
    private static ArbiterContext Ctx(int budget = 3, int sent = 0, bool quiet = false, bool dnd = false, bool calm = false, bool ship = false, params string[] off) =>
        new(budget, sent, quiet, dnd, calm, ship, new HashSet<string>(off));
    private static StanleyDue Due(string key, int rank = StanleyRank.Convenience, string subject = "", string fact = "", bool critical = false, string cls = "plan", int minutes = 0) =>
        new(key, 1, T.AddMinutes(minutes), StanleyTrigger.Time, cls, rank, critical, subject, fact);

    [Fact]
    public void SafetyAndCriticalIgnoreBudgetQuietHoursAndShipAlerts()
    {
        var r = StanleyArbiter.Arbitrate([Due("a", StanleyRank.Safety), Due("b", critical: true)], Ctx(budget: 0, quiet: true, ship: true));
        Assert.Equal(2, r.Cards.Count);
        Assert.All(r.Cards, c => Assert.True(c.Critical && c.Push));
        Assert.Empty(r.Held);
    }

    [Fact]
    public void KeepsToTheBudgetInPriorityOrderAndHoldsTheRest()
    {
        var r = StanleyArbiter.Arbitrate([Due("sug", StanleyRank.Suggestion), Due("money", StanleyRank.Money), Due("plan", StanleyRank.PlanProblem)], Ctx(budget: 3, sent: 1));
        Assert.Equal(["money", "plan"], r.Cards.Select(c => c.Keys[0]));
        Assert.Equal([new StanleyHeld("sug", "budget")], r.Held);
    }

    [Fact]
    public void RollsItemsAboutOneBookingIntoOneCardThatCostsOneOfTheBudget()
    {
        var r = StanleyArbiter.Arbitrate([Due("a", subject: "B1"), Due("b", subject: "B1"), Due("c", subject: "B1"), Due("d", subject: "B2")], Ctx(budget: 2));
        Assert.Equal(2, r.Cards.Count);
        Assert.Equal(3, r.Cards.Single(c => c.Subject == "B1").Count);
        Assert.Empty(r.Held);
    }

    [Fact]
    public void TheSameFactFromTwoSourcesIsOneItem()
    {
        var r = StanleyArbiter.Arbitrate([Due("rule", StanleyRank.Convenience, fact: "tour:9"), Due("checkup", StanleyRank.PlanProblem, fact: "tour:9")], Ctx());
        Assert.Equal(["checkup"], r.Cards.Select(c => c.Keys[0]));
        Assert.Equal(["rule"], r.Duplicates);
    }

    [Theory]
    [InlineData(true, false, false, "shipAlert")]
    [InlineData(false, true, false, "dnd")]
    [InlineData(false, false, true, "quiet")]
    public void HoldsOrdinaryItemsWhileAShipAlertDoNotDisturbOrQuietHoursApply(bool ship, bool dnd, bool quiet, string reason)
    {
        var r = StanleyArbiter.Arbitrate([Due("a")], Ctx(ship: ship, dnd: dnd, quiet: quiet));
        Assert.Empty(r.Cards);
        Assert.Equal([new StanleyHeld("a", reason)], r.Held);
    }

    [Fact]
    public void CalmModeKeepsCardsInTheThreadWithoutAPush() =>
        Assert.False(StanleyArbiter.Arbitrate([Due("a")], Ctx(calm: true)).Cards.Single().Push);

    [Fact]
    public void ASwitchedOffClassIsDroppedEvenWhenCritical()
    {
        var r = StanleyArbiter.Arbitrate([Due("a", critical: true, cls: "rule"), Due("b")], Ctx(off: "rule"));
        Assert.Equal(["b"], r.Cards.Select(c => c.Keys[0]));
        Assert.Equal([new StanleyHeld("a", "classOff")], r.Dropped);
    }

    [Fact]
    public void ABreakerPausesOnlyAfterTheLimitAndStartsAgainAfterTheWindow()
    {
        var w = TimeSpan.FromMinutes(10); var p = TimeSpan.FromMinutes(60);
        var s = StanleyBreakerRules.Record(StanleyBreakerRules.Fresh, T, 3, 3, w, p);
        Assert.False(StanleyBreakerRules.IsPaused(s, T));
        s = StanleyBreakerRules.Record(s, T.AddMinutes(1), 1, 3, w, p);
        Assert.True(StanleyBreakerRules.IsPaused(s, T.AddMinutes(2)));
        Assert.False(StanleyBreakerRules.IsPaused(s, T.AddMinutes(62)));
        var again = StanleyBreakerRules.Record(s, T.AddMinutes(70), 1, 3, w, p);
        Assert.Equal(1, again.Count);
        Assert.False(StanleyBreakerRules.IsPaused(again, T.AddMinutes(70)));
    }
}

public class StanleyDueWorkerTests
{
    private sealed class Pin(DateTime now) : IClock { public DateTime UtcNow { get; set; } = now; }

    private sealed class Handler(bool needed = true, bool fail = false) : IStanleyDueHandler
    {
        public string Trigger => StanleyTrigger.Time;
        public readonly List<StanleyCard> Delivered = [];
        public Task<bool> StillNeededAsync(StanleyDue due, CancellationToken ct) => Task.FromResult(needed);
        public Task DeliverAsync(long userId, StanleyCard card, CancellationToken ct)
        {
            if (fail) throw new InvalidOperationException("down");
            Delivered.Add(card);
            return Task.CompletedTask;
        }
    }

    private sealed class Context(ArbiterContext? ctx) : IStanleyDueContext
    {
        public Task<ArbiterContext?> LoadAsync(long userId, CancellationToken ct) => Task.FromResult(ctx);
    }

    private static readonly DateTime T = new(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc);
    private static ArbiterContext Open(int budget = 5) => new(budget, 0, false, false, false, false, new HashSet<string>());

    private static (StanleyDueWorker Worker, MemoryStanleyDueStore Store, Pin Clock) Make(Handler h, ArbiterContext? ctx, SchedulerOptions? o = null)
    {
        var store = new MemoryStanleyDueStore();
        var clock = new Pin(T);
        var sp = new ServiceCollection().AddSingleton<IStanleyDueStore>(store).AddSingleton<IStanleyBreakerStore>(new MemoryStanleyBreakerStore())
            .AddSingleton<IStanleyDueHandler>(h).AddSingleton<IStanleyDueContext>(new Context(ctx)).BuildServiceProvider();
        return (new(sp.GetRequiredService<IServiceScopeFactory>(), Options.Create(o ?? new SchedulerOptions()), clock, NullLogger<StanleyDueWorker>.Instance), store, clock);
    }

    private static StanleyDueRow Row(string key, int minutes = 0, string subject = "", string cls = "plan", int rank = StanleyRank.Convenience) =>
        new() { UserId = 1, IdemKey = key, DueAt = T.AddMinutes(minutes), ClassId = cls, RankNo = rank, Subject = subject, CreatedAt = T };

    [Fact]
    public async Task QueuingTheSameKeyTwiceDoesNothing()
    {
        var (_, store, _) = Make(new(), Open());
        Assert.True(await store.EnqueueAsync(Row("k"), default));
        Assert.False(await store.EnqueueAsync(Row("k"), default));
    }

    [Fact]
    public async Task DeliversWhatIsDueOnTimeAndNotBefore()
    {
        var h = new Handler();
        var (w, store, clock) = Make(h, Open());
        await store.EnqueueAsync(Row("later", 30), default);
        Assert.Equal(0, (await w.RunOnceAsync(default)).Claimed);
        clock.UtcNow = T.AddMinutes(31);
        var s = await w.RunOnceAsync(default);
        Assert.Equal(1, s.Cards);
        Assert.Single(h.Delivered);
        Assert.Equal(0, (await w.RunOnceAsync(default)).Claimed);   // done: never delivered twice
    }

    [Fact]
    public async Task DropsAnItemWhoseNeedHasGone()
    {
        var h = new Handler(needed: false);
        var (w, store, _) = Make(h, Open());
        await store.EnqueueAsync(Row("a"), default);
        var s = await w.RunOnceAsync(default);
        Assert.Equal(1, s.Dropped);
        Assert.Empty(h.Delivered);
    }

    [Fact]
    public async Task AStormOfItemsAboutOneBookingIsOneCard()
    {
        var h = new Handler();
        var (w, store, _) = Make(h, Open());
        for (var i = 0; i < 12; i++) await store.EnqueueAsync(Row($"k{i}", subject: "B1"), default);
        var s = await w.RunOnceAsync(default);
        Assert.Equal(1, s.Cards);
        Assert.Equal(12, h.Delivered.Single().Count);
    }

    [Fact]
    public async Task AFailedDeliveryIsPutBackNotLost()
    {
        var (w, store, clock) = Make(new Handler(fail: true), Open());
        await store.EnqueueAsync(Row("a"), default);
        Assert.Equal(1, (await w.RunOnceAsync(default)).Rescheduled);
        Assert.Equal(0, (await w.RunOnceAsync(default)).Claimed);   // waits for the retry time
        clock.UtcNow = T.AddMinutes(6);
        Assert.Equal(1, (await w.RunOnceAsync(default)).Claimed);
    }

    [Fact]
    public async Task ARunawayClassPausesItselfAndItsItemsWait()
    {
        var h = new Handler();
        var (w, store, _) = Make(h, Open(budget: 100), new SchedulerOptions { BreakerLimit = 2 });
        for (var i = 0; i < 5; i++) await store.EnqueueAsync(Row($"k{i}", cls: "rule"), default);
        var s = await w.RunOnceAsync(default);
        Assert.Equal(3, s.Cards);   // two inside the limit, the one that crossed it, then the rest wait
        Assert.Equal(2, s.Rescheduled);
        Assert.Equal(3, h.Delivered.Count);
    }

    [Fact]
    public async Task AnOperatorKillSwitchDropsTheClass()
    {
        var h = new Handler();
        var (w, store, _) = Make(h, Open(), new SchedulerOptions { OffClasses = ["rule"] });
        await store.EnqueueAsync(Row("a", cls: "rule"), default);
        var s = await w.RunOnceAsync(default);
        Assert.Equal(1, s.Dropped);
        Assert.Empty(h.Delivered);
    }

    [Fact]
    public async Task AGuestWhoIsGoneIsDropped()
    {
        var (w, store, _) = Make(new Handler(), null);
        await store.EnqueueAsync(Row("a"), default);
        Assert.Equal(1, (await w.RunOnceAsync(default)).Dropped);
    }

    [Fact]
    public async Task AnExpiredLeaseLetsAnotherWorkerTakeTheItemOver()
    {
        var (_, store, _) = Make(new Handler(), Open());
        await store.EnqueueAsync(Row("a"), default);
        Assert.Single(await store.ClaimDueAsync(T, "w1", TimeSpan.FromSeconds(60), 10, default));
        Assert.Empty(await store.ClaimDueAsync(T.AddSeconds(30), "w2", TimeSpan.FromSeconds(60), 10, default));
        Assert.Single(await store.ClaimDueAsync(T.AddSeconds(61), "w2", TimeSpan.FromSeconds(60), 10, default));
    }
}
