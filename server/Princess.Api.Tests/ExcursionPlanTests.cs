using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class ExcursionPlanTests
{
    private static ExcursionRules.TodayOffer Offer(string id, int days = 0, int spots = 10, string? timing = null) =>
        new(ExcursionRules.ById(id)!, days, spots, timing);

    [Fact]
    public void PicksTheBestRatedTourThatFitsToday()
    {
        var pick = ExcursionRules.PickForToday([Offer("coz-snorkel"), Offer("coz-beach"), Offer("coz-ruins")], []);
        Assert.Equal("coz-snorkel", pick!.Id);
    }

    [Fact]
    public void SkipsToursThatDoNotFitAreSoldOutOrOnAnotherDay()
    {
        var pick = ExcursionRules.PickForToday([Offer("coz-snorkel", timing: "tooLate"), Offer("coz-beach", spots: 0), Offer("coz-ruins", days: 1), Offer("coz-glass")], []);
        Assert.Equal("coz-glass", pick!.Id);
    }

    [Fact]
    public void HasNothingToPlanWhenTheGuestAlreadyHoldsATourToday()
    {
        Assert.Null(ExcursionRules.PickForToday([Offer("coz-snorkel"), Offer("coz-beach")], ["coz-beach"]));
    }

    [Fact]
    public void HasNothingToPlanWhenNothingFits()
    {
        Assert.Null(ExcursionRules.PickForToday([Offer("coz-snorkel", timing: "tooEarly")], []));
        Assert.Null(ExcursionRules.PickForToday([], []));
    }
}
