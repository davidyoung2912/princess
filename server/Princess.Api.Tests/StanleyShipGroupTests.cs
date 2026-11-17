using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The missed-ship guard and group gaps (phase P8): the same landing time as the head-back notices, said in words with a screen, and counts of silence that are never a yes.</summary>
public class StanleyShipGroupTests
{
    private const long Aboard = 1_000_000_000_000;
    private static ShipGroupFacts Facts(long minutesBeforeAboard, bool away = true, bool tender = false, PollGap[]? polls = null) =>
        new(true, "Cozumel", away, tender, "17:00", Aboard, Aboard - minutesBeforeAboard * 60_000, null, true, polls ?? []);

    [Fact]
    public void PlentyOfTimeIsOkAndSaysHowLongIsLeft()
    {
        var f = Assert.Single(StanleyShipGroupRules.Findings(Facts(300)));
        Assert.Equal("ok", f.Severity);
        Assert.Contains("minutes", f.Detail);
    }

    [Fact]
    public void TheWarningsMatchTheHeadBackNoticeTimes()
    {
        var landingMinutes = (Aboard - AwayRules.LandingByMs(Aboard, false, null)) / 60_000;
        Assert.Equal("soon", StanleyShipGroupRules.Findings(Facts(landingMinutes + 10)).Single().Severity);
        Assert.Equal("ship:now", StanleyShipGroupRules.Findings(Facts(landingMinutes)).Single().Id);
        Assert.Equal("ship:gone", StanleyShipGroupRules.Findings(Facts(-1)).Single().Id);
    }

    [Fact]
    public void ATenderDayLeavesMoreTimeToGetBack()
    {
        var pier = AwayRules.LandingByMs(Aboard, false, null);
        var tender = AwayRules.LandingByMs(Aboard, true, null);
        Assert.True(tender < pier);
        Assert.Contains("tender landing", StanleyShipGroupRules.Findings(Facts(1, tender: true)).Single().Detail);
    }

    [Fact]
    public void NothingIsSaidAboutTheWayBackUnlessTheGuestIsAwayAndTheGapIsListed()
    {
        var f = Facts(10, away: false);
        Assert.Empty(StanleyShipGroupRules.Findings(f));
        Assert.Contains(StanleyShipGroupRules.NotChecked(f), x => x.Contains("ashore"));
    }

    [Fact]
    public void PollSilenceIsCountedNotGuessed()
    {
        var f = StanleyShipGroupRules.Findings(Facts(300, away: false, polls: [new("Snorkel or beach?", 2, 1), new("Done", 0, 3)]));
        var gap = Assert.Single(f);
        Assert.Equal("/plan/group-poll", gap.Route);
        Assert.Contains("2 people", gap.Title);
        Assert.Contains("not counted as a yes", gap.Detail);
    }

    [Fact]
    public void ClearOnlyWhenNothingNeedsAttention()
    {
        Assert.True(StanleyShipGroupRules.Build(Facts(300), "t").Clear);
        Assert.False(StanleyShipGroupRules.Build(Facts(-5), "t").Clear);
    }
}
