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
