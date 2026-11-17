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
    public void DatesThatMatterBecomeSevenReminders()
    {
        var c = StanleyAutoRules.Candidates(Facts(new(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(7, c.Count);
        Assert.Contains(c, x => x.Key == "aut02:pass:2027-03-20");
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
        Assert.Equal(["dining", "pass", "bags", "recap"], StanleyAutoRules.Candidates(Facts(new(2027, 3, 10, 0, 0, 0, DateTimeKind.Utc), "paid", "open")).Select(x => x.Key.Split(':')[1]));

    [Fact]
    public void WhatIsAlreadySetPastOrOutOfRangeIsNotSetAgain()
    {
        var now = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        var all = StanleyAutoRules.Candidates(Facts(now));
        var (add, waiting) = StanleyAutoRules.Plan(all, new HashSet<string> { all.Single(x => x.Key.Contains("pay2")).Key }, 1, now);
        Assert.Equal(["pay7"], add.Select(x => x.Key.Split(':')[1]));
        Assert.Equal(5, waiting.Count);
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

    [Fact]
    public void TheComparisonSaysAScoreThatMovedAndANewTop()
    {
        (string, string, int?)[] now = [("b", "Bravo", 80), ("a", "Alpha", 70)];
        Assert.Null(StanleyAutoRules.ComparisonDiff(now, null));
        Assert.Null(StanleyAutoRules.ComparisonDiff(now, ["b=80", "a=70"]));
        var change = StanleyAutoRules.ComparisonDiff(now, ["a=75", "b=80"]);
        Assert.NotNull(change);
        Assert.Contains("Alpha: 75 to 70 out of 100", change.Added);
        Assert.Contains("Bravo now scores highest", change.Added);
        Assert.Empty(change.Removed);
    }

    // ---- AUT-03 and AUT-06 (phase P10b) ----

    private static CheckupFacts Trip(DateOnly today, IReadOnlyList<CheckTour>? tours = null) =>
        new(today, today.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc), Departure, 7, TimelineBook.For(null, Departure), "paid", null, "open", TripRules.CheckinOpensAt(Departure), TripRules.CheckinClosesAt(Departure), false, [], tours ?? [], []);

    /// <summary>The first day of the trip on which Stanley finds something to add, with what he found.</summary>
    private static (CheckupFacts Facts, StanleyAutoRules.PicksDoc Doc) WithPicks()
    {
        for (var d = 1; d <= 6; d++)
        {
            var facts = Trip(Departure.AddDays(d));
            var (doc, _, _) = StanleyAutoRules.Top(facts, [], null, null);
            if (doc.Picks.Count > 0) return (facts, doc);
        }
        throw new Xunit.Sdk.XunitException("no day of the trip has a pick");
    }

    [Fact]
    public void PicksAreFreeFewAndClearOfEachOtherAndOfDinner()
    {
        var (facts, doc) = WithPicks();
        var first = facts.Today.DayNumber - Departure.DayNumber + 1;
        Assert.All(doc.Picks, p => Assert.InRange(p.Day, first, first + StanleyAutoRules.LookAheadDays - 1));
        Assert.All(doc.Picks.GroupBy(p => p.Day), g => Assert.True(g.Count() <= StanleyAutoRules.MaxPicksPerDay));
        Assert.All(doc.Picks, p => Assert.False(StanleyAutoRulesTestHelper.OverlapsDinner(p.Start, p.Minutes)));
        foreach (var day in doc.Picks.GroupBy(p => p.Day))
        {
            var ordered = day.OrderBy(p => p.Start, StringComparer.Ordinal).ToList();
            for (var i = 1; i < ordered.Count; i++)
                Assert.True(StanleyAutoRulesTestHelper.Minutes(ordered[i].Start) >= StanleyAutoRulesTestHelper.Minutes(ordered[i - 1].Start) + ordered[i - 1].Minutes);
        }
    }

    [Fact]
    public void ASecondRunChangesNothing()
    {
        var (facts, first) = WithPicks();
        var (second, added, removed) = StanleyAutoRules.Top(facts, [], null, first);
        Assert.Empty(added);
        Assert.Empty(removed);
        Assert.Equal(first.Picks, second.Picks);
    }

    [Fact]
    public void ARemovedPickIsNeverAddedAgainAndOnlyHisOwnCanBeRemoved()
    {
        var (facts, first) = WithPicks();
        var gone = first.Picks[0];
        var next = StanleyAutoRules.Dismiss(first, StanleyAutoRules.PickKey(gone.Day, gone.Id));
        Assert.DoesNotContain(next.Picks, p => p.Id == gone.Id && p.Day == gone.Day);
        var (again, _, _) = StanleyAutoRules.Top(facts, [], null, next);
        Assert.DoesNotContain(again.Picks, p => p.Id == gone.Id && p.Day == gone.Day);
        Assert.Same(first, StanleyAutoRules.Dismiss(first, "9:not-a-pick"));
    }

    [Fact]
    public void APickThatNoLongerFitsIsDroppedAndSaid()
    {
        var (facts, _) = WithPicks();
        var day = facts.Today.DayNumber - Departure.DayNumber + 1;
        var bogus = new StanleyAutoRules.Pick("event-that-does-not-exist", day, "Gone show", "10:00", 45, "theatre");
        var (doc, _, removed) = StanleyAutoRules.Top(facts, [], null, new([bogus], []));
        Assert.DoesNotContain(doc.Picks, p => p.Id == bogus.Id);
        Assert.Equal([$"Gone show on day {day}"], removed);
    }

    [Fact]
    public void NothingIsAddedOnTopOfABookedTour()
    {
        var (open, picks) = WithPicks();
        var day = picks.Picks[0].Day;
        var facts = Trip(open.Today, [new CheckTour(day, "Whole day tour", "00:00", 23.9)]);
        var (doc, _, _) = StanleyAutoRules.Top(facts, [], null, null);
        Assert.DoesNotContain(doc.Picks, p => p.Day == day);
    }

    [Fact]
    public void ThePicksRecordRoundTripsAndABadOneIsIgnored()
    {
        var doc = new StanleyAutoRules.PicksDoc([new("e1", 2, "Trivia", "10:00", 45, "bar")], ["2:e2"]);
        var back = StanleyAutoRules.ParsePicks(StanleyAutoRules.PicksToJson(doc));
        Assert.Equal(doc.Picks, back!.Picks);
        Assert.Equal(doc.Dismissed, back.Dismissed);
        Assert.Null(StanleyAutoRules.ParsePicks("not json"));
        Assert.Null(StanleyAutoRules.ParsePicks(null));
    }

    [Fact]
    public void TheNewRowsAreBuiltAtTheirLevels()
    {
        Assert.True(StanleyPermissionRules.Row(StanleyAutoRules.PlanRow)!.Built);
        Assert.Equal(4, StanleyPermissionRules.Row(StanleyAutoRules.PlanRow)!.NeedsLevel);
        Assert.True(StanleyPermissionRules.Row(StanleyAutoRules.DraftRow)!.Built);
    }

    private static BundleDto Tonight() =>
        StanleyBundleRules.Build("evening", "balanced", new BundleFacts(TimelineBook.For(null, Departure), 2, [], [], false, "any"));

    [Fact]
    public void DraftsAreSavedOncePerKindAndOnlyWhenTheWordsChange()
    {
        var now = new DateTime(2027, 3, 21, 9, 0, 0, DateTimeKind.Utc);
        var fresh = StanleyAutoRules.Fresh(Tonight(), now);
        Assert.Equal(["party-plan", "late-note"], fresh.Select(d => d.Kind));
        var (all, saved) = StanleyAutoRules.Merge([], fresh);
        Assert.Equal(2, all.Count);
        Assert.Equal(2, saved.Count);
        var (again, savedAgain) = StanleyAutoRules.Merge(all, StanleyAutoRules.Fresh(Tonight(), now.AddHours(1)));
        Assert.Empty(savedAgain);
        Assert.Equal(all, again);
    }

    [Fact]
    public void TheDraftsRecordKeepsOnlyKnownKinds()
    {
        var json = StanleyAutoRules.DraftsToJson([new("late-note", "Hello", "2027-03-21T09:00:00Z"), new("other", "x", "y")]);
        Assert.Equal(["late-note"], StanleyAutoRules.ParseDrafts(json).Select(d => d.Kind));
        Assert.Empty(StanleyAutoRules.ParseDrafts("nope"));
    }
}

public class StanleyAutoBookingTests
{
    private static readonly DateOnly Departure = new(2027, 3, 20);

    private static CheckupFacts Trip(DateOnly today, IReadOnlyList<StanleyItem>? meals = null, IReadOnlyList<CheckTour>? tours = null) =>
        new(today, today.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc), Departure, 7, TimelineBook.For(null, Departure), "paid", null, "open", TripRules.CheckinOpensAt(Departure), TripRules.CheckinClosesAt(Departure), false, [], tours ?? [], meals ?? []);

    [Fact]
    public void OnlyNightsWithNoDinnerAndWithinThreeDaysAreBooked()
    {
        var all = StanleyAutoRules.DinnerNights(Trip(Departure.AddDays(2)));
        Assert.NotEmpty(all);
        Assert.All(all, d => Assert.InRange(d, 3, 5));
        var some = StanleyAutoRules.DinnerNights(Trip(Departure.AddDays(2), [new StanleyItem(all[0], "Eclipse Dining Room", "18:00")]));
        Assert.DoesNotContain(all[0], some);
        Assert.Equal(all.Count - 1, some.Count);
    }

    [Fact]
    public void ADinnerStartIsOnTheShipsClockForThatNight()
    {
        var f = Trip(Departure);
        Assert.True(StanleyAutoRules.DinnerStartMs(f, 2, "20:00") > StanleyAutoRules.DinnerStartMs(f, 2, "18:00"));
        Assert.True(StanleyAutoRules.DinnerStartMs(f, 3, "18:00") > StanleyAutoRules.DinnerStartMs(f, 2, "20:30"));
    }

    [Fact]
    public void ADinnerOnATourIsFlaggedAndOneClearOfItIsNot()
    {
        var f = Trip(Departure, tours: [new CheckTour(3, "Old town", "17:00", 3)]);
        Assert.True(StanleyAutoRules.OnATour(f, 3, "18:30"));
        Assert.False(StanleyAutoRules.OnATour(f, 3, "20:30"));
        Assert.False(StanleyAutoRules.OnATour(f, 4, "18:30"));
    }

    [Fact]
    public void OnlyChangedItineraryDaysInRangeCount()
    {
        StandingChange C(string id, string kind, int? day, string consequence) => new(id, kind, day, "Show moved", consequence, false, []);
        var days = StanleyAutoRules.ChangedDays(
            [C("a", ChangeKinds.Itinerary, 4, ChangeConsequence.Conflict), C("b", ChangeKinds.Itinerary, 4, ChangeConsequence.Conflict), C("c", ChangeKinds.Itinerary, 5, ChangeConsequence.Optional),
             C("d", ChangeKinds.Tender, 6, ChangeConsequence.Conflict), C("e", ChangeKinds.Itinerary, 1, ChangeConsequence.Conflict), C("f", ChangeKinds.Itinerary, null, ChangeConsequence.Conflict), C("g", ChangeKinds.Itinerary, 7, ChangeConsequence.Improvement)], 3, 7);
        Assert.Equal([4, 7], days);
    }

    [Fact]
    public void ARequestIsRepeatedOnlyAfterThreeAsksAndNeverARepair()
    {
        var asked = new[] { ("ice", false), ("ice", false), ("ice", false), ("towels", false), ("towels", false), ("towels", true), ("plumbing", false), ("plumbing", false), ("plumbing", false) };
        Assert.Equal(["ice"], StanleyAutoRules.Repeated(asked));
    }

    [Fact]
    public void AStandingOrderIsDueFromTheTimeChosen()
    {
        var at = new DateTime(2027, 3, 21, 19, 5, 0);
        Assert.True(StanleyAutoRules.OrderDue("19:00", at));
        Assert.False(StanleyAutoRules.OrderDue("19:30", at));
        Assert.False(StanleyAutoRules.OrderDue("late", at));
    }

    [Theory]
    [InlineData("25:00", "", "", "usual")]
    [InlineData("18:30", "plumbing", "19:00", "item")]
    [InlineData("18:30", "ice", "19:00", "notRepeated")]
    [InlineData("", "towels", "7pm", "time")]
    public void AChoiceThatIsNotAllowedIsRefusedWithAClosedReason(string usual, string item, string time, string reason)
    {
        var problem = StanleyAutoRules.StandingProblem(usual, item, time, item == "towels" ? new[] { "towels" } : Array.Empty<string>());
        Assert.Equal(reason, problem);
    }

    [Fact]
    public void AGoodChoiceIsAcceptedAndStoredAsTimesAndIdsOnly()
    {
        Assert.Null(StanleyAutoRules.StandingProblem("18:30", "ice", "19:00", ["ice"]));
        Assert.Null(StanleyAutoRules.StandingProblem("", "", "", []));
        var json = StanleyAutoRules.StandingToJson(new("18:30", "ice", "19:00"));
        Assert.Equal(new StanleyAutoRules.AutoStanding("18:30", "ice", "19:00"), StanleyAutoRules.ParseStanding(json));
        Assert.Equal(new StanleyAutoRules.AutoStanding("", "", ""), StanleyAutoRules.ParseStanding("""{"usualDinner":"soon","orderItem":"plumbing","orderTime":"x"}"""));
        Assert.Equal(new StanleyAutoRules.AutoStanding("", "", ""), StanleyAutoRules.ParseStanding("not json"));
    }

    [Fact]
    public void TheGateAsksInsteadOfActingOnAPaidSharedOrSoonTable()
    {
        var now = new DateTimeOffset(2027, 3, 21, 12, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        StanleyGateResult Gate(StanleyItemFlags flags, int today = 0, int undone = 0, int minutes = 12 * 60) =>
            StanleyActGate.Decide(new(flags, new(true, false, false, today, StanleyAutoRules.DinnerCap, StanleyAutoRules.UndoMinutes, undone, true), now, minutes, 0, 15, true, false, false, false, false));
        var main = DiningRules.Venues.First(v => v.Kind == "main");
        var tomorrow = now + 24 * 3_600_000L;
        Assert.True(Gate(StanleyClassifier.Dining(main, tomorrow, 0)).Act);
        Assert.Contains("paid", Gate(StanleyClassifier.Dining(DiningRules.Venues.First(v => v.Kind == "specialty"), tomorrow, 0)).Reasons);
        Assert.Contains("shared", Gate(StanleyClassifier.Dining(main, tomorrow, 2)).Reasons);
        Assert.Contains("feeSoon", Gate(StanleyClassifier.Dining(main, now + 3_600_000L, 0)).Reasons);
        Assert.Contains("overCap", Gate(StanleyClassifier.Dining(main, tomorrow, 0), today: 2).Reasons);
        Assert.Contains("declined", Gate(StanleyClassifier.Dining(main, tomorrow, 0), undone: 2).Reasons);
        Assert.Contains("quiet", Gate(StanleyClassifier.Dining(main, tomorrow, 0), minutes: 23 * 60).Reasons);
    }

    [Fact]
    public void ARequestIsNeverHeldBackByQuietHoursAndItsUndoIsOnlyUntilTheCrewIsOnTheWay()
    {
        var now = new DateTimeOffset(2027, 3, 21, 12, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        foreach (var id in StanleyAutoRules.OrderItems)
        {
            var item = ServiceRules.RequestItemById(id)!;
            var undo = StanleyAutoRules.OrderUndoMinutes(item);
            Assert.InRange(undo, 1, item.EtaMin / 2);
            var gate = StanleyActGate.Decide(new(StanleyClassifier.Service(item, now), new(true, false, false, 0, StanleyAutoRules.OrderCap, undo, 0, true), now, 23 * 60, 0, 15, true, false, false, false, false));
            Assert.True(gate.Act, string.Join(",", gate.Reasons));
        }
    }

    [Fact]
    public void TheNewRowsAreBuiltAtLevelFourAndNeedTheCode()
    {
        foreach (var id in new[] { StanleyAutoRules.DinnerRow, StanleyAutoRules.TimingRow, StanleyAutoRules.OrderRow })
        {
            var row = StanleyPermissionRules.Row(id)!;
            Assert.True(row.Built);
            Assert.Equal(4, row.NeedsLevel);
            Assert.True(StanleyPermissionRules.RowNeedsStepUp(row, true));
            Assert.NotEmpty(row.Never);
        }
    }

    [Fact]
    public void TheNotCheckedWordsNameEveryClassAndSayNoShowsAreNotWatched()
    {
        var text = string.Join(" ", StanleyAutoRules.BookingNotChecked);
        Assert.Contains("AUT-04", text);
        Assert.Contains("AUT-08", text);
        Assert.Contains("AUT-09", text);
        Assert.Contains("turned up", text);
    }
}

internal static class StanleyAutoRulesTestHelper
{
    public static int Minutes(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..]);

    public static bool OverlapsDinner(string start, int minutes)
    {
        var s = Minutes(start);
        var d = 18 * 60 + 30;
        return s < d + DayPlanRules.DinnerMinutes && d < s + minutes;
    }
}
