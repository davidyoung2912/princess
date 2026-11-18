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

    [Fact]
    public void OffersUpToThreeToursBestFirst()
    {
        var ranked = ExcursionRules.RankForToday([Offer("coz-snorkel"), Offer("coz-beach"), Offer("coz-ruins"), Offer("coz-glass")], []);
        Assert.Equal(ExcursionRules.PlanOptions, ranked.Count);
        Assert.Equal("coz-snorkel", ranked[0].Id);
        Assert.Equal(ranked.Select(x => x.Id).Distinct().Count(), ranked.Count);
        Assert.Equal("coz-snorkel", ExcursionRules.PickForToday([Offer("coz-snorkel"), Offer("coz-beach")], [])!.Id);
    }

    [Fact]
    public void WhatTheGuestLikesComesBeforeRating()
    {
        var offers = new[] { Offer("coz-snorkel"), Offer("coz-beach"), Offer("coz-ruins"), Offer("coz-glass") };
        var theme = offers.Select(o => o.Item).Where(x => x.Id != offers[0].Item.Id).SelectMany(x => x.Interests).Except(offers[0].Item.Interests).FirstOrDefault();
        if (theme is null) return;
        var ranked = ExcursionRules.RankForToday(offers, [], new ExcursionRules.PlanWishes([theme], null));
        Assert.Contains(theme, ranked[0].Interests);
    }

    [Fact]
    public void ABudgetLeavesOutToursThatCostMoreAPerson()
    {
        var offers = new[] { Offer("coz-snorkel"), Offer("coz-beach"), Offer("coz-ruins"), Offer("coz-glass") };
        var cheapest = offers.Min(o => o.Item.Price);
        var ranked = ExcursionRules.RankForToday(offers, [], new ExcursionRules.PlanWishes([], cheapest));
        Assert.NotEmpty(ranked);
        Assert.All(ranked, x => Assert.True(x.Price <= cheapest));
        Assert.Empty(ExcursionRules.RankForToday(offers, [], new ExcursionRules.PlanWishes([], cheapest - 1)));
    }

    [Fact]
    public void AheadLeavesADayTheGuestHasPlannedAndNeverOffersAGoneTour()
    {
        var offers = new[] { Offer("coz-snorkel", days: 2), Offer("coz-beach", days: 2), Offer("coz-ruins", days: 4), Offer("coz-glass", days: -1) };
        var ranked = ExcursionRules.RankAhead(offers, ["coz-beach"]);
        Assert.Equal(["coz-ruins"], ranked.Select(x => x.Id));
        Assert.Empty(ExcursionRules.RankAhead([Offer("coz-glass", days: -1), Offer("coz-ruins", spots: 0, days: 3), Offer("coz-beach", days: 3, timing: "tooLate")], []));
    }
}
