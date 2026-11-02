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
        var day = new DateOnly(2027, 3, 21);
        var a = FeedRules.Sky(day, "cozumel");
        Assert.Equal(a, FeedRules.Sky(day, "cozumel"));
        Assert.Equal("sim", a.Source);
        var usual = PlanRules.WeatherFor(day);
        Assert.InRange(a.TempF, usual.HighF - 2, usual.HighF);
        Assert.Equal(a.RainFrom is null, a.RainTo is null);
    }

    [Fact]
    public void SeaDaysHaveALowerUvThanPortDays()
    {
        var day = new DateOnly(2027, 3, 25);
        Assert.Equal(FeedRules.Sky(day, "cozumel").Uv - 2, FeedRules.Sky(day, "sea").Uv);
    }

    [Fact]
    public void TheSkyTodaysWeatherAndThePackingAdviceAgree()
    {
        for (var d = new DateOnly(2027, 1, 1); d.Year == 2027; d = d.AddDays(1))
        {
            var sky = FeedRules.Sky(d, "cozumel");
            var today = AboardRules.WeatherOn(d, false);
            var usual = PlanRules.WeatherFor(d);
            Assert.Equal(usual.HighF, today.HighF);
            Assert.Equal(sky.RainFrom is not null, today.Summary.StartsWith("Showers"));
            Assert.True(sky.TempF <= usual.HighF && sky.TempF >= usual.LowF);
        }
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
