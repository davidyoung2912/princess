using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The Disembark pack, first part (phase P9d): bag night, customs and the last look. Nothing is filled in or sent.</summary>
public class StanleyDisembarkTests
{
    private static readonly DateOnly Departure = new(2027, 1, 10);

    private static DisembarkFacts On(int daysToArrival, int nights = 7) => new(Departure.AddDays(nights - daysToArrival), Departure, nights);

    [Fact]
    public void LastEveningGivesBagsAndCustomsAsScreensToOpen()
    {
        var list = StanleyDisembarkRules.Findings(On(1));
        Assert.Contains(list, x => x.Rule == "SR-10.1" && x.Route == "/home/disembark/bags");
        Assert.Contains(list, x => x.Rule == "SR-10.3" && x.Route == "/home/disembark/customs" && x.Detail.Contains("do not fill it in"));
        Assert.DoesNotContain(list, x => x.Rule == "SR-10.6");
    }

    [Fact]
    public void LastMorningGivesTheLastLook() =>
        Assert.Equal("SR-10.6", Assert.Single(StanleyDisembarkRules.Findings(On(0))).Rule);

    [Theory]
    [InlineData(2)]
    [InlineData(-1)]
    public void NothingOtherDays(int toArrival) => Assert.Empty(StanleyDisembarkRules.Findings(On(toArrival)));

    [Fact]
    public void ItSaysWhatItCannotSee() =>
        Assert.Contains(StanleyDisembarkRules.NotChecked(On(1)), x => x.Contains("cannot see"));
}
