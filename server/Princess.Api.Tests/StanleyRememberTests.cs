using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The Remember pack, first part (phase P9f): recap, feedback and loyalty on the day the ship gets in. Nothing is built, drafted or sent.</summary>
public class StanleyRememberTests
{
    private static readonly DateOnly Departure = new(2027, 1, 10);

    private static RememberFacts On(int daysAfterSailing, int nights = 7) => new(Departure.AddDays(daysAfterSailing), Departure, nights);

    [Fact]
    public void ArrivalDayPointsToThreeScreens()
    {
        var f = StanleyRememberRules.Findings(On(7));
        Assert.Equal(["SR-11.1", "SR-11.2", "SR-11.5", "SR-11.3", "SR-11.4", "SR-11.6"], f.Select(x => x.Rule));
        Assert.Contains(f, x => x.Rule == "SR-11.2" && x.Detail.Contains("send nothing"));
    }

    [Fact]
    public void NothingOnOtherDays()
    {
        Assert.Empty(StanleyRememberRules.Findings(On(6)));
        Assert.Empty(StanleyRememberRules.Findings(On(8)));
        Assert.Empty(StanleyRememberRules.Findings(On(0, 0)));
    }

    [Fact]
    public void ItSaysWhatItCannotSee() =>
        Assert.Contains(StanleyRememberRules.NotChecked(On(7)), x => x.Contains("cannot see"));
}
