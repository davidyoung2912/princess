using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class RatesTests
{
    [Fact]
    public void TheSameDayGivesTheSameTableAndDollarsNeverMove()
    {
        var a = RatesRules.TableFor(new DateOnly(2026, 11, 1));
        var b = RatesRules.TableFor(new DateOnly(2026, 11, 1));
        Assert.Equal("2026-11-01", a.AsOf);
        Assert.Equal(a.PerUsd, b.PerUsd);
        Assert.Equal(1, a.PerUsd["USD"]);
    }

    [Fact]
    public void EveryRateStaysWithinTheDriftOfItsSample()
    {
        foreach (var day in Enumerable.Range(1, 30))
        {
            var t = RatesRules.TableFor(new DateOnly(2026, 11, 1).AddDays(day));
            foreach (var (code, sample) in RatesRules.Sample)
                Assert.InRange(t.PerUsd[code], sample * (1 - RatesRules.Drift) - 0.0001, sample * (1 + RatesRules.Drift) + 0.0001);
        }
    }
}

public class ReferenceRulesTests
{
    [Fact]
    public void AccessibleCategoriesLeaveOutTheTwoTopSuites()
    {
        Assert.Equal(["interior", "oceanview", "balcony", "miniSuite"], CabinRules.AccessibleCategories);
    }

    [Fact]
    public void EveryExcursionHasADifficultyFigure()
    {
        Assert.Equal(12, ReferenceRules.Difficulty.Count);
        Assert.Equal(2, ReferenceRules.Difficulty["coz-ruins"].Km);
    }
}

public class FeedRulesTests
{
    [Fact]
    public void TheSkyIsTheSameEveryTimeAndSaysItIsSimulated()
    {
        var a = FeedRules.Sky("S1", 3, "cozumel");
        Assert.Equal(a, FeedRules.Sky("S1", 3, "cozumel"));
        Assert.Equal("sim", a.Source);
        Assert.InRange(a.TempF, 80, 88);
        Assert.Equal(a.RainFrom is null, a.RainTo is null);
    }

    [Fact]
    public void SeaDaysHaveALowerUvThanPortDays()
    {
        Assert.Equal(FeedRules.Sky("S1", 4, "cozumel").Uv - 2, FeedRules.Sky("S1", 4, "sea").Uv);
    }
}

public class FlightFeedTests
{
    [Fact]
    public void ANumberIsNormalisedAndValidated()
    {
        Assert.Equal("PR1234", FeedRules.NormalizeFlight(" pr 1234 "));
        Assert.True(FeedRules.ValidFlightNumber("PR1234"));
        Assert.False(FeedRules.ValidFlightNumber("P1"));
        Assert.False(FeedRules.ValidFlightNumber("PR12345"));
    }

    [Fact]
    public void AFlightHasOneStatusPerDateAndMostAreOnTime()
    {
        Assert.Equal(FeedRules.Flight("PR100", "2027-03-20"), FeedRules.Flight("PR100", "2027-03-20"));
        var states = Enumerable.Range(1, 200).Select(i => FeedRules.Flight($"PR{i}", "2027-03-20")).ToList();
        Assert.True(states.Count(s => s.State == "onTime") > states.Count / 2);
        Assert.All(states.Where(s => s.State == "delayed"), s => Assert.Contains(s.DelayMinutes, new[] { 20, 35, 50, 75, 110, 160 }));
        Assert.All(states.Where(s => s.State != "delayed"), s => Assert.Equal(0, s.DelayMinutes));
    }
}

public class RouteFeedTests
{
    [Theory]
    [InlineData("quiet", "light")]
    [InlineData("busy", "moderate")]
    [InlineData("busiest", "heavy")]
    public void TrafficFollowsTheCrowd(string crowd, string traffic) => Assert.Equal(traffic, FeedRules.Route("2027-03-21", crowd).Traffic);

    [Fact]
    public void LeaveEarlierAddsTrafficAndSky()
    {
        var r = FeedRules.Route("2027-03-21", "busiest");
        var sky = r.Sky == "storm" ? 25 : r.Sky == "rain" ? 10 : 0;
        Assert.Equal(20 + sky, r.LeaveEarlierMinutes);
        Assert.False(FeedRules.ValidCrowd("packed"));
    }
}
