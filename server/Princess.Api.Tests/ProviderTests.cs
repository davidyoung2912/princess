using System.Net;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>Contract tests for the external-source seams (multi-device plan 2, Phase 1). A real provider must pass the same shape checks.</summary>
public class ProviderTests
{
    [Fact]
    public void TheSimulatedWeatherServiceKeepsTheContractAndIsStable()
    {
        IWeatherService w = new SimWeatherService();
        var sky = w.Sky("S1", 3, "cozumel");
        Assert.Equal("sim", sky.Source);
        Assert.Equal(sky, w.Sky("S1", 3, "cozumel"));
        var climate = w.Climate(new DateOnly(2027, 3, 21));
        Assert.True(climate.HighF > climate.LowF);
        Assert.Contains(climate.Rain, new[] { "low", "some", "high" });
        Assert.Equal(climate.HighF, w.Today(new DateOnly(2027, 3, 21), false).HighF);
        Assert.Contains("rougher", w.Today(new DateOnly(2027, 3, 21), true).Sea);
    }

    [Fact]
    public void TheSimulatedFlightAndRouteProvidersAnswerInTheContractShape()
    {
        IFlightStatusProvider f = new SimFlightStatusProvider();
        var s = f.Status("PR100", "2027-03-20");
        Assert.Contains(s.State, new[] { "onTime", "delayed", "cancelled" });
        Assert.Equal("sim", s.Source);
        IRouteConditionsProvider r = new SimRouteConditionsProvider();
        var c = r.Conditions("2027-03-21", "busy");
        Assert.Contains(c.Traffic, new[] { "light", "moderate", "heavy" });
        Assert.Contains(c.Sky, new[] { "clear", "cloudy", "rain", "storm" });
        Assert.Equal("sim", c.Source);
    }

    private static TelemetryItemDto Err(string kind = "error", string msg = "boom") => new("error", kind, msg, null, null, "2027-03-21T10:00:00Z");
    private static TelemetryItemDto Evt(string name = "screen", string? screen = "ahead/plan") => new("event", null, null, name, screen, "2027-03-21T10:00:00Z");

    [Fact]
    public void TelemetryAcceptsOnlyKnownKindsEventsAndSafeScreens()
    {
        Assert.True(TelemetryRules.Valid([Err(), Evt(), Evt("install", null)]));
        Assert.False(TelemetryRules.Valid(null));
        Assert.False(TelemetryRules.Valid([]));
        Assert.False(TelemetryRules.Valid([Err("nope")]));
        Assert.False(TelemetryRules.Valid([Evt("signedIn")]));
        Assert.False(TelemetryRules.Valid([Evt("screen", "bookings/A1B2C3 detail")]));
        Assert.False(TelemetryRules.Valid([Err(msg: new string('x', TelemetryRules.MaxMessage + 1))]));
        Assert.False(TelemetryRules.Valid([.. Enumerable.Repeat(Evt(), TelemetryRules.MaxItems + 1)]));
        Assert.False(TelemetryRules.Valid([new TelemetryItemDto("event", null, "typed text", "screen", null, "2027-03-21T10:00:00Z")]));
    }
}

public class TelemetryApiTests : JourneyWorld
{
    [Fact]
    public async Task AGoodBatchIsAcceptedAndABadOneIsRefused()
    {
        var token = await SignIn(Daniel);
        var ok = await Call(HttpMethod.Post, "/api/v1/telemetry", token, new TelemetryBatchDto([new("event", null, null, "screen", "ahead/plan", "2027-03-21T10:00:00Z")]));
        Assert.Equal(HttpStatusCode.NoContent, ok.Status);
        var bad = await Call(HttpMethod.Post, "/api/v1/telemetry", token, new TelemetryBatchDto([new("event", null, null, "typedSecret", null, "2027-03-21T10:00:00Z")]));
        Assert.Equal(HttpStatusCode.BadRequest, bad.Status);
    }
}

public class ShipFeedTests
{
    [Fact]
    public void PortCrowdIsStableShapedAndFollowsTheClientFormula()
    {
        IShipTelemetry ship = new SimShipTelemetry();
        var c = ship.PortCrowd("cozumel", "2027-03-23");
        Assert.Equal(c, ship.PortCrowd("cozumel", "2027-03-23"));
        Assert.Equal("sim", c.Source);
        Assert.InRange(c.Ships, 1, 5);
        Assert.Equal(c.Ships * ShipFeedRules.ShipGuests, c.Guests);
        Assert.Equal(c.Level == "busy", c.StayAboardNote);
        Assert.Contains(c.Level, new[] { "quiet", "moderate", "busy" });
        foreach (var p in new[] { "cozumel", "belize", "roatan" }) Assert.InRange(ship.PortCrowd(p, "2027-03-24").Ships, 1, p == "belize" ? 3 : p == "roatan" ? 4 : 5);
        Assert.True(ShipFeedRules.ValidPort("belize"));
        Assert.False(ShipFeedRules.ValidPort("mars"));
        Assert.False(ShipFeedRules.ValidDate("2027-13-40"));
    }

    [Fact]
    public void FareHistoryStartsAtTheBookedFareIsWeeklyCappedAndStable()
    {
        IFareFeed fares = new SimFareFeed();
        var h = fares.History("A1B2C3", 480_000, "2027-01-04", "2027-03-01");
        Assert.Equal(new FarePointDto("2027-01-04", 480_000), h[0]);
        Assert.Equal(9, h.Count);
        Assert.Equal("2027-01-11", h[1].Date);
        Assert.All(h, p => Assert.True(p.Total >= 336_000 && p.Total % 100 == 0));
        Assert.Equal(h, fares.History("A1B2C3", 480_000, "2027-01-04", "2027-03-01"));
        Assert.Equal(26, fares.History("A1B2C3", 480_000, "2025-01-01", "2027-03-01").Count);
        Assert.True(ShipFeedRules.ValidFareQuery("A1B2C3", 1, "2027-01-01", "2027-01-01"));
        Assert.False(ShipFeedRules.ValidFareQuery("A1 2", 1, "2027-01-01", "2027-01-01"));
        Assert.False(ShipFeedRules.ValidFareQuery("A1", 1, "2027-02-01", "2027-01-01"));
    }
}
