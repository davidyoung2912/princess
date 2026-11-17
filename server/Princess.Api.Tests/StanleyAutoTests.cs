using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Rung 4 safe classes, first part (phase P10a): AUT-02 deadline reminders. Pure rules; the switch itself is tested with the permission rows.</summary>
public class StanleyAutoTests
{
    private static readonly DateOnly Departure = new(2027, 3, 20);
    private static readonly DateOnly FinalDue = new(2027, 1, 20);

    private static CheckupFacts Facts(DateTime now, string payment = "upcoming", string checkin = "notOpen") =>
        new(DateOnly.FromDateTime(now), now, Departure, 7, null!, payment, FinalDue, checkin, TripRules.CheckinOpensAt(Departure), TripRules.CheckinClosesAt(Departure), false, [], [], []);

    [Fact]
    public void DatesThatCanCostSomethingBecomeThreeReminders()
    {
        var c = StanleyAutoRules.Candidates(Facts(new(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(3, c.Count);
        Assert.All(c, x => Assert.StartsWith(StanleyAutoRules.Marker, x.Key));
        Assert.Equal(c.Count, c.Select(x => x.Key).Distinct().Count());
    }

    [Fact]
    public void APaidBalanceAndAnOpenCheckinGiveNothing() =>
        Assert.Empty(StanleyAutoRules.Candidates(Facts(new(2027, 3, 10, 0, 0, 0, DateTimeKind.Utc), "paid", "open")));

    [Fact]
    public void WhatIsAlreadySetPastOrOutOfRangeIsNotSetAgain()
    {
        var now = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        var all = StanleyAutoRules.Candidates(Facts(now));
        var (add, waiting) = StanleyAutoRules.Plan(all, new HashSet<string> { all.Single(x => x.Key.Contains("pay2")).Key }, 1, now);
        Assert.Equal(["pay7"], add.Select(x => x.Key.Split(':')[1]));
        Assert.Single(waiting);
        Assert.Contains("Not yet in range", waiting[0]);
    }

    [Fact]
    public void NothingGoesPastTheLimitOfThirty()
    {
        var now = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        var (add, waiting) = StanleyAutoRules.Plan(StanleyAutoRules.Candidates(Facts(now)), new HashSet<string>(), StanleyAutoRules.MaxPerTrip, now);
        Assert.Empty(add);
        Assert.Contains(waiting, w => w.Contains("limit of 30"));
    }

    [Fact]
    public void TheClassCardMeetsTheFormat()
    {
        var card = StanleyRuleCards.All.Single(c => c.Id == "AUT-02");
        Assert.Empty(StanleyRuleCards.Problems(card));
        Assert.Equal(StanleyAutoRules.Row, "CL-08");
        Assert.Equal(StanleyAutoRules.MaxPerTrip, card.DailyCap);
    }
}
