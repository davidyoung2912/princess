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
        var sky = w.Sky(new DateOnly(2027, 3, 21), "cozumel");
        Assert.Equal("sim", sky.Source);
        Assert.Equal(sky, w.Sky(new DateOnly(2027, 3, 21), "cozumel"));
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

/// <summary>
/// The on-board and planning feeds (multi-device plan 2, Phase 3). The expected figures were read from the client's own functions
/// (<c>levelAt</c>, <c>stormWatch</c>, <c>skyNight</c>, <c>loungerOthers</c>, <c>seenToday</c>, <c>simulatedOpening</c>), so a drift in a hash, table or rounding fails here.
/// </summary>
public class OnboardFeedTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static readonly long Base = DateTimeOffset.Parse("2027-03-23T15:20:00Z").ToUnixTimeMilliseconds();

    [Fact]
    public void PulseLevelsMatchTheClientSimulation()
    {
        IShipTelemetry ship = new SimShipTelemetry();
        var p = ship.Pulse(Departure, Base);
        Assert.Equal("sim", p.Source);
        Assert.Equal(Base, p.ObservedAt);
        var expected = new Dictionary<string, (int Now, int Later, int Night)>
        {
            ["lido-pool"] = (23, 47, 10), ["lido"] = (27, 7, 3), ["eatery"] = (24, 13, 0), ["arena"] = (7, 0, 26),
            ["lotus"] = (39, 52, 0), ["guest-services"] = (67, 59, 9), ["promenade"] = (0, 13, 0),
        };
        var night = DateTimeOffset.Parse("2027-03-21T03:07:00Z").ToUnixTimeMilliseconds();
        foreach (var (id, e) in expected)
        {
            Assert.Equal(e.Now, p.Venues[id].Observed);
            Assert.Equal(9, p.Venues[id].Ahead.Length);
            Assert.Equal(e.Now, p.Venues[id].Ahead[0]);
            Assert.Equal(e.Later, p.Venues[id].Ahead[5]);
            Assert.Equal(e.Night, OnboardFeedRules.PulseLevel(id, night, Departure));
        }
        Assert.All(p.Venues.Values.SelectMany(v => v.Ahead), l => Assert.InRange(l, 0, 100));
        Assert.Equal(p, ship.Pulse(Departure, Base));
    }

    [Fact]
    public void PulseObservedMarkIsTheLastFiveMinutes()
    {
        var p = OnboardFeedRules.Pulse(Departure, Base + 4 * 60_000 + 59_000);
        Assert.Equal(Base, p.ObservedAt);
        Assert.Equal(p.Venues["lido"].Observed, OnboardFeedRules.PulseLevel("lido", Base, Departure));
    }

    [Fact]
    public void StormWatchMatchesTheClientReading()
    {
        IStormOutlook storm = new SimStormOutlook();
        var calm = storm.Outlook("2027-03-21", 9);
        Assert.Equal(new[] { "none", "watch", "2027-03-28" }, new[] { calm.Band, calm.Phase, calm.Returns });
        Assert.False(calm.InSeason);
        Assert.Empty(calm.LineMay);
        Assert.Empty(calm.YouCan);
        var peak = storm.Outlook("2027-09-12", 0);
        Assert.Equal(15, peak.Percent);
        Assert.Equal(new[] { "higher", "sailing" }, new[] { peak.Band, peak.Phase });
        Assert.True(peak.InSeason);
        Assert.True(peak.Peak);
        Assert.Equal(new[] { "reroute", "swap", "shorten", "delay", "cancel" }, peak.LineMay);
        Assert.Equal(new[] { "insurance", "flights", "early", "follow", "plan" }, peak.YouCan);
        Assert.Equal("far", storm.Outlook("2027-03-21", 30).Phase);
        Assert.Equal(new[] { "insurance", "flights" }, storm.Outlook("2027-06-27", 20).YouCan);
        Assert.False(OnboardFeedRules.ValidStormQuery("2027-13-01", 5));
        Assert.False(OnboardFeedRules.ValidStormQuery("2027-03-21", 5000));
    }

    [Fact]
    public void SkyNightMatchesTheClientFiguresToTheMinute()
    {
        IShipTelemetry ship = new SimShipTelemetry();
        var d3 = ship.SkyNight("2027-03-21", 3);
        Assert.Equal(("cozumel", "07:50", "19:58", "port", "17:00", false), (d3.Port, d3.Sunrise, d3.Sunset, d3.SunsetSide, d3.SailAway, d3.SailAwayAtSunset));
        Assert.Equal(new MoonDto("full", "Full moon", 98), d3.Moon);
        Assert.Equal(new[] { "Leo", "Gemini", "Ursa Major" }, d3.Stars);
        Assert.False(d3.DarkSky);
        // Trigonometry may differ in the last bit between runtimes; the instant is the same to the millisecond or two.
        Assert.InRange(d3.SunsetAt, 1805846338500 - 2, 1805846338500 + 2);
        var d4 = ship.SkyNight("2027-03-21", 4);
        Assert.Equal(("belize", "05:55", "18:04", "neither", true), (d4.Port, d4.Sunrise, d4.Sunset, d4.SunsetSide, d4.SailAwayAtSunset));
        Assert.Equal(new MoonDto("waningGibbous", "Waning gibbous", 95), d4.Moon);
        var d7 = ship.SkyNight("2027-03-21", 7);
        Assert.Equal(("sea", "07:26", "19:41", "port"), (d7.Port, d7.Sunrise, d7.Sunset, d7.SunsetSide));
        Assert.Null(d7.SailAway);
        Assert.Equal(new MoonDto("waningGibbous", "Waning gibbous", 73), d7.Moon);
        Assert.True(OnboardFeedRules.ValidSkyQuery("2027-03-21", 8));
        Assert.False(OnboardFeedRules.ValidSkyQuery("2027-03-21", 9));
    }

    [Fact]
    public void LoungersSightingsAndTheLostListMatchTheClient()
    {
        IShipTelemetry ship = new SimShipTelemetry();
        var l = ship.Loungers(Base);
        Assert.Equal(8, l.Loungers.Length);
        Assert.All(l.Loungers.Take(7), x => Assert.Equal(("free", (int?)null), (x.State, x.ReturnsIn)));
        Assert.Equal(new LoungerDto(8, "held", 25), l.Loungers[7]);
        Assert.Equal(l, ship.Loungers(Base + 30_000));
        var seen = new[]
        {
            new[] { "frigatebird", "turtle" }, new[] { "turtle", "whale" }, new[] { "whale", "ray" }, new[] { "ray", "dolphins" },
            new[] { "dolphins", "flyingFish" }, new[] { "flyingFish", "frigatebird" }, new[] { "frigatebird", "turtle" }, new[] { "turtle", "whale" },
        };
        for (var day = 1; day <= 8; day++) Assert.Equal(seen[day - 1], ship.Sightings(day).Species);
        ILostProperty lost = new SimLostProperty();
        var found = lost.Found();
        Assert.Equal(5, found.Items.Length);
        Assert.All(found.Items, i => Assert.Contains(i.At, new[] { "guest-services", "eatery", "lido-pool" }));
        Assert.Contains(found.Items, i => i.Id == "f2" && i.What == "Child’s green hat" && i.Keywords.Contains("hat"));
    }

    [Fact]
    public void SlotWatchOpeningMatchesTheClient()
    {
        ISlotWatchFeed feed = new SimSlotWatchFeed();
        var o = feed.Opening("w-1", Base, Base + 48 * 3_600_000L);
        Assert.Equal(1805821200000, o.OpensAt);
        Assert.Equal("sim", o.Source);
        Assert.Null(feed.Opening("w-1", Base, Base + 20 * 60_000L).OpensAt);
        Assert.True(OnboardFeedRules.ValidWatchQuery("w-1", Base, Base + 1));
        Assert.False(OnboardFeedRules.ValidWatchQuery("w 1", Base, Base + 1));
        Assert.False(OnboardFeedRules.ValidWatchQuery("w-1", Base, Base - 1));
        Assert.False(OnboardFeedRules.ValidMoment(5));
    }
}

public class PulseDayRulesTests
{
    [Fact]
    public void ADayHasFortyEightHalfHoursPerVenueThatAgreeWithTheLiveLevels()
    {
        var departure = new DateOnly(2027, 3, 21);
        var day = OnboardFeedRules.PulseDay(departure, 3);
        Assert.Equal(7, day.Venues.Count);
        Assert.All(day.Venues.Values, levels => { Assert.Equal(48, levels.Length); Assert.All(levels, l => Assert.InRange(l, 0, 100)); });
        Assert.Equal(OnboardFeedRules.PulseLevel("lido", day.StartAt + 20 * 30 * 60_000L, departure), day.Venues["lido"][20]);
        Assert.False(OnboardFeedRules.ValidPulseDay("2027-03-21", 0));
    }
}

public class EmbarkQueueRulesTests
{
    [Fact]
    public void TheQuietestWindowWinsAndNeedsAddTime()
    {
        var plain = EmbarkQueueRules.Queue(false, false, false, null);
        Assert.DoesNotContain(plain.Windows, w => w.Start == "10:30");
        Assert.Contains(EmbarkQueueRules.Queue(true, false, false, null).Windows, w => w.Start == "10:30");
        var quietest = plain.Windows.Single(w => w.Start == plain.Recommended);
        Assert.Equal(plain.Windows.Min(w => w.WaitMinutes), quietest.WaitMinutes);
        var slow = EmbarkQueueRules.Queue(false, true, false, null);
        Assert.Equal(plain.Windows[0].WaitMinutes + EmbarkQueueRules.MobilityExtra, slow.Windows[0].WaitMinutes);
        Assert.All(slow.Windows, w => Assert.Equal(4, w.Steps.Count));
        Assert.All(EmbarkQueueRules.Queue(false, false, false, "13:00").Windows, w => Assert.True(string.CompareOrdinal(w.Start, "13:00") >= 0));
        Assert.True(EmbarkQueueRules.ValidEarliest(null));
        Assert.False(EmbarkQueueRules.ValidEarliest("soon"));
    }
}

public class SailingQualityRulesTests
{
    [Fact]
    public void AFriendsReplyIsStableAndAboutOneInFourDecline()
    {
        Assert.Equal(SailingQualityRules.Reply("Sam"), SailingQualityRules.Reply("sam"));
        var declined = Enumerable.Range(0, 400).Count(i => SailingQualityRules.Reply($"friend{i}").Reply == "declined");
        Assert.InRange(declined, 60, 140);
        Assert.False(SailingQualityRules.ValidFriendName(" "));
        Assert.False(SailingQualityRules.ValidFriendName(new string('a', SailingQualityRules.FriendNameMax + 1)));
    }
}

public class OnboardFeedApiTests : JourneyWorld
{
    private static readonly long Base = DateTimeOffset.Parse("2027-03-23T15:20:00Z").ToUnixTimeMilliseconds();

    [Fact]
    public async Task TheFeedRoutesRefuseBadQueriesAndAnswerGoodOnes()
    {
        var token = await SignIn(Daniel);
        foreach (var bad in new[] { "/feeds/pulse?departure=nope&now=1", "/feeds/storm?departure=2027-03-21&days=99999", "/feeds/sky-night?departure=2027-03-21&day=12", "/feeds/loungers?now=3", "/feeds/sightings?day=0", "/feeds/watch-opening?id=a&created=1&slot=2", "/feeds/sailing-quality?sailing=nope", "/feeds/friend-reply?name=", "/feeds/embark-queue?earliest=soon", "/feeds/pulse-day?departure=2027-03-21&day=9", "/feeds/ship-position?departure=nope&now=1", "/feeds/sea-conditions?departure=2027-03-21&now=3", "/feeds/along-the-way?departure=2027-03-21" })
            Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Get, $"/api/v1{bad}", token)).Status);
        foreach (var good in new[] { $"/feeds/pulse?departure=2027-03-21&now={Base}", "/feeds/storm?departure=2027-03-21&days=9", "/feeds/sky-night?departure=2027-03-21&day=3", $"/feeds/loungers?now={Base}", "/feeds/sightings?day=2", "/feeds/found", "/feeds/friend-reply?name=Sam", "/feeds/pulse-day?departure=2027-03-21&day=3", $"/feeds/ship-position?departure=2027-03-21&now={Base}", $"/feeds/sea-conditions?departure=2027-03-21&now={Base}", $"/feeds/along-the-way?departure=2027-03-21&now={Base}", "/feeds/embark-queue?priority=true&mobility=true&earliest=11:30", $"/feeds/watch-opening?id=w-1&created={Base}&slot={Base + 172_800_000}" })
            Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Get, $"/api/v1{good}", token)).Status);
    }
}

public class CabinGuideRulesTests
{
    private static readonly CabinFilterDto None = new(false, false, false, false, true);

    [Fact]
    public void ScoresAreOneToFiveWithReasonsAndTheBestComeFirst()
    {
        var guide = CabinGuideRules.Guide("sun-2027-03-21", "balcony", None, null);
        Assert.NotEmpty(guide.Cabins);
        Assert.All(guide.Cabins, c =>
        {
            Assert.InRange(c.Sleep, 1, 5);
            Assert.InRange(c.Motion, 1, 5);
            Assert.InRange(c.Noise, 1, 5);
            Assert.NotEmpty(c.Reasons.Sleep);
            Assert.NotNull(c.Sun);
        });
        var totals = guide.Cabins.Select(c => c.Sleep + c.Motion + c.Noise).ToList();
        Assert.Equal(totals.OrderByDescending(t => t), totals);
        Assert.Null(CabinGuideRules.Guide("sun-2027-03-21", "interior", None, null).Cabins[0].Sun);
    }

    [Fact]
    public void FiltersNarrowTheListAndTakenCabinsAreLeftOutUnlessAsked()
    {
        var all = CabinGuideRules.Guide("sun-2027-03-21", "oceanview", None with { AvailableOnly = false }, null).Cabins;
        var taken = new HashSet<string> { all[0].Cabin.Number };
        Assert.DoesNotContain(CabinGuideRules.Guide("sun-2027-03-21", "oceanview", None, taken).Cabins, c => c.Cabin.Number == all[0].Cabin.Number);
        Assert.All(CabinGuideRules.Guide("sun-2027-03-21", "oceanview", None with { ClearView = true }, null).Cabins, c => Assert.False(c.Cabin.Obstructed));
        Assert.All(CabinGuideRules.Guide("sun-2027-03-21", "balcony", None with { CalmSea = true }, null).Cabins, c => Assert.True(c.Motion >= 4));
        Assert.False(CabinGuideRules.ValidCategory("penthouse"));
    }

    [Fact]
    public void TheSunSummaryCoversEightDaysAndPicksALabel()
    {
        foreach (var side in new[] { "port", "starboard" })
        {
            var sun = CabinGuideRules.Sun(side);
            Assert.InRange(sun.Mornings, 0, 8);
            Assert.InRange(sun.Afternoons, 0, 8);
            Assert.Contains(sun.Label, new[] { "morning", "afternoon", "both", "shaded" });
        }
    }
}
