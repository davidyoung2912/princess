using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The simulated ship's track, sea and landmarks. Written without a run; the figures asserted are bounds the authored track must keep.</summary>
public class NavigationRulesTests
{
    private static readonly DateOnly Dep = new(2027, 3, 21);

    private static long At(int day, int hour, string zone = "America/New_York") =>
        new DateTimeOffset(Itinerary.LocalToUtc(Dep.AddDays(day - 1), new TimeOnly(hour, 0), zone), TimeSpan.Zero).ToUnixTimeMilliseconds();

    [Fact]
    public void AlongsideInPortTheShipIsStillAtThePortAndHeadsForTheNext()
    {
        var p = NavigationRules.Position(Dep, At(3, 12, "America/Cancun"));
        Assert.Equal("cozumel", p.InPort);
        Assert.Equal("belize", p.NextPort);
        Assert.Equal(0, p.SpeedKnots);
        Assert.Equal(0, p.NmSailed);
        Assert.True(p.NmRemaining > 150);
        Assert.Equal(Itinerary.Ports["cozumel"].Lat, p.Lat, 3);
    }

    [Fact]
    public void AtSeaTheShipMovesAtASensibleSpeedAndTheDistancesAddUp()
    {
        var p = NavigationRules.Position(Dep, At(2, 12));
        Assert.Null(p.InPort);
        Assert.Equal("fll", p.LastPort);
        Assert.Equal("cozumel", p.NextPort);
        Assert.InRange(p.SpeedKnots, 8, 20);
        Assert.InRange(p.HeadingDegrees, 0, 359);
        Assert.InRange(p.LegPercent, 1, 99);
        Assert.InRange(p.NmSailed + p.NmRemaining, 500, 700);
        Assert.Equal(p.VoyageNmTotal, NavigationRules.VoyageNmTotal);
    }

    [Fact]
    public void TheShipAdvancesAlongItsTrackAndNeverMovesBackwards()
    {
        var last = -1;
        for (var h = 15; h < 24 * 7; h += 3)
        {
            var p = NavigationRules.Position(Dep, At(1, 0) + h * 3_600_000L);
            Assert.True(p.VoyageNmSailed >= last, $"hour {h}");
            last = p.VoyageNmSailed;
        }
        Assert.Equal(NavigationRules.VoyageNmTotal, NavigationRules.Position(Dep, At(8, 12)).VoyageNmSailed);
        Assert.Null(NavigationRules.Position(Dep, At(8, 12)).NextPort);
    }

    [Fact]
    public void ShipTimeAndLocalTimeDifferWhereTheZonesDo()
    {
        var clock = NavigationRules.Position(Dep, At(4, 12, "America/Belize")).Clock;
        Assert.Equal("other", clock.ShipZone);
        Assert.Equal("belize", clock.LocalPlace);
        Assert.Equal(0, clock.DifferenceMinutes);
        var before = NavigationRules.Position(Dep, At(3, 20, "America/Cancun")).Clock;
        Assert.Equal("home", before.ShipZone);
        Assert.NotNull(before.NextChange);
    }

    [Fact]
    public void TheSeaIsInRangeAndDeepWaterShowsOnTheTroughLeg()
    {
        for (var h = 0; h < 24 * 7; h += 2)
        {
            var s = NavigationRules.Sea(Dep, At(1, 12) + h * 3_600_000L);
            Assert.InRange(s.Beaufort, 0, 12);
            Assert.InRange(s.SeaState, 0, 9);
            Assert.InRange(s.WaterTempC, 22, 33);
            Assert.True(s.DepthM > 0);
            Assert.Equal(NavigationRules.DepthClassOf(s.DepthM), s.DepthClass);
        }
        var trough = Enumerable.Range(0, 60).Select(h => NavigationRules.Sea(Dep, At(5, 17) + h * 3_600_000L)).Max(s => s.DepthM);
        Assert.True(trough >= 4000);
    }

    [Fact]
    public void BeaufortAndSeaStateFollowTheirScales()
    {
        Assert.Equal(0, NavigationRules.BeaufortOf(0));
        Assert.Equal(4, NavigationRules.BeaufortOf(13));
        Assert.Equal(8, NavigationRules.BeaufortOf(36));
        Assert.Equal(12, NavigationRules.BeaufortOf(80));
        Assert.Equal(0, NavigationRules.SeaStateOf(0));
        Assert.Equal(4, NavigationRules.SeaStateOf(1.6));
    }

    [Fact]
    public void LandmarksComeInOrderWithTheNextOnesAheadAndThePastBehind()
    {
        var a = NavigationRules.Along(Dep, At(2, 12));
        Assert.NotEmpty(a.Ahead);
        Assert.All(a.Ahead, l => Assert.True(l.PassesAt > a.Now));
        Assert.Equal(a.Ahead.OrderBy(l => l.PassesAt), a.Ahead);
        Assert.All(a.Behind, l => Assert.True(l.PassesAt < a.Now));
        Assert.NotEmpty(a.Zone.Wildlife);
    }

    [Fact]
    public void FirstAndLastLightFallOutsideSunriseAndSunset()
    {
        var s = OnboardFeedRules.SkyNight("2027-03-21", 2);
        Assert.True(string.CompareOrdinal(s.FirstLight, s.Sunrise) < 0);
        Assert.True(string.CompareOrdinal(s.LastLight, s.Sunset) > 0);
        Assert.True(string.CompareOrdinal(s.DarkAt, s.LastLight) > 0);
    }
}
