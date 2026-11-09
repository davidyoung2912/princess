using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>
/// Multi-device plan 3, Phase 6. Every registered implementation of every provider seam must honour the same contract, so a real provider
/// can replace a simulated one with no front-end change. A new implementation added to <see cref="ProviderRegistration.Catalogue"/> is
/// picked up here automatically.
/// </summary>
public class ProviderContractTests
{
    private static readonly DateOnly Day = new(2027, 3, 21);

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value)).Build();

    private static ServiceProvider Build(IConfiguration config)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IDbConnectionFactory>(_ => throw new InvalidOperationException("no database in this test"));
        services.AddProviders(config);
        return services.BuildServiceProvider();
    }

    public static IEnumerable<object[]> Implementations() =>
        ProviderRegistration.Catalogue.SelectMany(s => s.Implementations.Select(i => new object[] { s.Key, i.Key }));

    [Fact]
    public void EverySeamHasTheSimulationAndNamesAreUnique()
    {
        Assert.Equal(ProviderRegistration.Catalogue.Count, ProviderRegistration.Catalogue.Select(s => s.Key).Distinct().Count());
        Assert.All(ProviderRegistration.Catalogue, s => Assert.Contains(ProviderRegistration.Sim, s.Implementations.Keys));
        Assert.All(ProviderRegistration.Catalogue, s => Assert.All(s.Implementations.Values, t => Assert.True(s.Contract.IsAssignableFrom(t))));
        // The six the plan names are all there.
        foreach (var key in new[] { "Weather", "Flight", "Route", "Telemetry", "StaffQueue" })
            Assert.Contains(ProviderRegistration.Catalogue, s => s.Key == key);
    }

    [Fact]
    public void WithNoConfigurationEverySeamResolvesToTheSimulation()
    {
        using var sp = Build(Config());
        foreach (var seam in ProviderRegistration.Catalogue)
            Assert.IsType(seam.Implementations[ProviderRegistration.Sim], sp.GetRequiredService(seam.Contract));
        Assert.IsType<UnavailableConciergeModel>(sp.GetRequiredService<IConciergeModel>());
    }

    [Fact]
    public void AnUnknownProviderNameStopsStartUpAndNamesTheChoices()
    {
        var e = Assert.Throws<InvalidOperationException>(() => Build(Config(("Providers:Weather", "acme"))));
        Assert.Contains("Providers:Weather", e.Message);
        Assert.Contains("sim", e.Message);
        Assert.Throws<InvalidOperationException>(() => Build(Config(("Providers:Concierge", "acme"))));
        Assert.Throws<InvalidOperationException>(() => Build(Config(("Providers:ConciergeLimit", "acme"))));
        Assert.Throws<InvalidOperationException>(() => Build(Config(("Providers:Concierge", "anthropic"))));
    }

    [Fact]
    public void TheConciergeModelAndLimiterFollowConfiguration()
    {
        using (var sp = Build(Config(("Concierge:ApiKey", "k"))))
            Assert.IsType<AnthropicConciergeModel>(sp.GetRequiredService<IConciergeModel>());
        using (var sp = Build(Config(("Concierge:ApiKey", "k"), ("Providers:Concierge", "sim"))))
            Assert.IsType<UnavailableConciergeModel>(sp.GetRequiredService<IConciergeModel>());
        using (var sp = Build(Config(("Providers:ConciergeLimit", "memory"))))
            Assert.IsType<MemoryConciergeLimiter>(sp.GetRequiredService<IConciergeLimiter>());
        using (var sp = Build(Config()))
        {
            using var scope = sp.CreateScope();
            Assert.IsType<DapperConciergeLimiter>(scope.ServiceProvider.GetRequiredService<IConciergeLimiter>());
        }
    }

    [Theory]
    [MemberData(nameof(Implementations))]
    public async Task EveryImplementationHonoursItsContract(string key, string name)
    {
        var seam = ProviderRegistration.Catalogue.Single(s => s.Key == key);
        var impl = ActivatorUtilities.CreateInstance(new ServiceCollection().AddLogging().BuildServiceProvider(), seam.Implementations[name]);
        var sailing = new SailingRow { Id = "S1", Departure = new DateTime(2027, 3, 21), Nights = 7, BookingOpen = true };

        switch (impl)
        {
            case IWeatherService w:
                Assert.NotNull(w.Sky(Day, "cozumel"));
                Assert.NotNull(w.Climate(Day));
                Assert.NotNull(w.Today(Day, false));
                // Packing, the day brief and the sky agree on the same model: the same inputs give the same answer.
                Assert.Equal(w.Sky(Day, "cozumel"), w.Sky(Day, "cozumel"));
                break;
            case IFlightStatusProvider f:
                var flight = f.Status("AA123", "2027-03-21");
                Assert.Contains(flight.State, new[] { "onTime", "delayed", "cancelled" });
                Assert.True(flight.DelayMinutes >= 0);
                break;
            case IRouteConditionsProvider r:
                var route = r.Conditions("2027-03-21", "busy");
                Assert.Contains(route.Traffic, new[] { "light", "moderate", "heavy" });
                Assert.True(route.LeaveEarlierMinutes >= 0);
                break;
            case IShipTelemetry t:
                Assert.NotNull(t.PortCrowd("cozumel", "2027-03-22"));
                Assert.NotNull(t.Pulse(Day, 0));
                Assert.NotNull(t.PulseDay(Day, 2));
                Assert.NotNull(t.Loungers(0));
                Assert.NotNull(t.Sightings(2));
                Assert.NotNull(t.SkyNight("2027-03-21", 2));
                break;
            case IShipNavigation nav:
                var navAt = new DateTimeOffset(2027, 3, 22, 18, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
                Assert.NotNull(nav.Position(Day, navAt));
                Assert.NotNull(nav.Sea(Day, navAt));
                Assert.NotNull(nav.Along(Day, navAt));
                break;
            case IStaffQueue q:
                var now = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
                var ticket = await q.EnqueueAsync(Guid.NewGuid(), "callback", "other", now, CancellationToken.None);
                Assert.Equal("callback", ticket.Kind);
                Assert.True(ticket.Position >= 1);
                Assert.True(ticket.ReadyAt >= ticket.At);
                break;
            case IFareFeed fare: Assert.NotNull(fare.History("B1", 500_000, "2027-01-01", "2027-02-01")); break;
            case IProgramChanges p: Assert.NotNull(p.Current()); break;
            case IStormOutlook s: Assert.NotNull(s.Outlook("2027-08-01", 30)); break;
            case IWalletPassIssuer wp:
                Assert.True(wp.Issue("PR1", "2027-03-20", [new("PR1-1", "Sam", "code", "8012", 8, "A", "3")]).Accepted);
                Assert.False(wp.Issue("PR1", "2027-03-20", []).Accepted);
                break;
            case ITenderOutlook t: Assert.NotNull(t.Outlook("belize", "2027-03-23")); break;
            case ILostProperty l: Assert.NotNull(l.Found()); break;
            case ISlotWatchFeed w: Assert.NotNull(w.Opening("w1", 1_000, 2_000)); break;
            case ISailingQuality sq: Assert.NotNull(sq.Notes(sailing, ["S1"])); break;
            case IEmbarkQueue e: Assert.NotNull(e.Queue(false, false, false, null)); break;
            case IFriendReply fr: Assert.NotNull(fr.Reply("Sam")); break;
            case ICabinGuide c: Assert.NotNull(c.Guide("S1", "balcony", new CabinFilterDto(false, false, false, false, false), null)); break;
            case ITelemetrySink sink: await sink.AcceptAsync([], CancellationToken.None); break;
            case IPushSender push:
                Assert.False(string.IsNullOrEmpty(push.PublicKey));
                var sent = await push.SendAsync(new PushSubscriptionRow("https://push.example/abc", "k", "a", 3, false, ""), new PushMessage("k", "payment", "t", "b", "/me/payments", false, []), CancellationToken.None);
                Assert.Equal(PushResult.Delivered, sent);
                break;
            case IPaymentGateway pay:
                var result = await pay.ChargeAsync("ref-1", [new ChargePart("wallet", null, null, null, false, 1_000)], null, CancellationToken.None);
                Assert.False(string.IsNullOrEmpty(result.Reference));
                Assert.Single(result.Parts);
                break;
            default: Assert.Fail($"No contract check for {seam.Contract.Name}; add one here when a seam is added.");
                break;
        }
    }

    [Fact]
    public async Task TheMemoryLimiterCountsPerPersonAndForgetsOldQuestions()
    {
        var limiter = new MemoryConciergeLimiter();
        var now = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 3; i++) Assert.True(await limiter.TryTakeAsync(1, now, 3, CancellationToken.None));
        Assert.False(await limiter.TryTakeAsync(1, now.AddMinutes(30), 3, CancellationToken.None));
        Assert.True(await limiter.TryTakeAsync(2, now, 3, CancellationToken.None));
        Assert.True(await limiter.TryTakeAsync(1, now.AddMinutes(61), 3, CancellationToken.None));
    }
}
