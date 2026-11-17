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
    public void DatesThatMatterBecomeFiveReminders()
    {
        var c = StanleyAutoRules.Candidates(Facts(new(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(5, c.Count);
        Assert.Contains(c, x => x.Key == "aut02:bags:2027-03-27");
        Assert.All(c, x => Assert.StartsWith(StanleyAutoRules.Marker, x.Key));
        Assert.Equal(c.Count, c.Select(x => x.Key).Distinct().Count());
    }

    [Fact]
    public void WithoutATimelineThereIsNoExitReminder() =>
        Assert.DoesNotContain(StanleyAutoRules.Candidates(Facts(new(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc))), x => x.Key.Contains(":exit:"));

    [Fact]
    public void NoTravellersMeansNoDocumentsReminder() =>
        Assert.DoesNotContain(StanleyAutoRules.Candidates(Facts(new(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc))), x => x.Key.Contains(":docs:"));

    [Fact]
    public void NoTravellersStillGivesADiningFreezeReminderBeforeTheFreeze() =>
        Assert.Contains(StanleyAutoRules.Candidates(Facts(new(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc))), x => x.Key.Contains(":dining:"));

    [Fact]
    public void APaidBalanceAndAnOpenCheckinLeaveOnlyBagNight() =>
        Assert.Equal(["dining", "bags"], StanleyAutoRules.Candidates(Facts(new(2027, 3, 10, 0, 0, 0, DateTimeKind.Utc), "paid", "open")).Select(x => x.Key.Split(':')[1]));

    [Fact]
    public void WhatIsAlreadySetPastOrOutOfRangeIsNotSetAgain()
    {
        var now = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        var all = StanleyAutoRules.Candidates(Facts(now));
        var (add, waiting) = StanleyAutoRules.Plan(all, new HashSet<string> { all.Single(x => x.Key.Contains("pay2")).Key }, 1, now);
        Assert.Equal(["pay7"], add.Select(x => x.Key.Split(':')[1]));
        Assert.Equal(3, waiting.Count);
        Assert.All(waiting, w => Assert.Contains("Not yet in range", w));
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

    private static readonly PackItem Hat = new("hat", "sun", "Sun hat", "Sunny"), Coat = new("coat", "rain", "Rain jacket", "Wet"), Mine = new("c1", "mine", "My book", "Added by you.");

    [Fact]
    public void AFirstLookReportsNothing() => Assert.Null(StanleyAutoRules.Diff([Hat], null));

    [Fact]
    public void ANewSuggestionIsAddedAndADroppedOneIsRemoved()
    {
        var change = StanleyAutoRules.Diff([Hat, Coat], ["hat", "gone-item"]);
        Assert.NotNull(change);
        Assert.Equal(["Rain jacket"], change.Added);
        Assert.Equal(["gone item"], change.Removed);
    }

    [Fact]
    public void TheGuestsOwnItemsAreNeverReported() => Assert.Null(StanleyAutoRules.Diff([Hat, Mine], ["hat"]));

    [Fact]
    public void TheRecordRoundTripsWithoutTheGuestsOwnItems()
    {
        var ids = StanleyAutoRules.Parse(StanleyAutoRules.ToJson([Coat, Hat, Mine]));
        Assert.Equal(["coat", "hat"], ids);
        Assert.Null(StanleyAutoRules.Parse("not json"));
    }

    private static ChecklistEntry Entry(string id, string state) => new(id, 30, null, null, "", state, true);

    [Fact]
    public void TheChecklistSaysWhatIsNewlyDoneAndWhatIsNot()
    {
        Assert.Null(StanleyAutoRules.ChecklistDiff([Entry("paid", "done")], null));
        var change = StanleyAutoRules.ChecklistDiff([Entry("paid", "done"), Entry("tours", "done"), Entry("dining", "open")], ["paid", "dining"]);
        Assert.NotNull(change);
        Assert.Equal(["tours"], change.Added);
        Assert.Equal(["dining"], change.Removed);
        Assert.Null(StanleyAutoRules.ChecklistDiff([Entry("paid", "done")], ["paid"]));
    }

    [Fact]
    public void TheShortlistSaysWhatIsNewAndWhatIsGoneOrClosed()
    {
        var open = new Dictionary<string, string> { ["a"] = "Alaska, 2027-06-01", ["c"] = "Caribbean, 2027-02-01" };
        Assert.Null(StanleyAutoRules.ShortlistDiff(["a"], open, null));
        var change = StanleyAutoRules.ShortlistDiff(["a", "c"], open, ["a", "old-one"]);
        Assert.NotNull(change);
        Assert.Equal(["Caribbean, 2027-02-01"], change.Added);
        Assert.Equal(["old one"], change.Removed);
        Assert.Null(StanleyAutoRules.ShortlistDiff(["a"], open, ["a"]));
    }
}
