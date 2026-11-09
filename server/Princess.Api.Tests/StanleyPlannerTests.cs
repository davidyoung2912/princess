using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>
/// Stanley's planner, group diplomat and sea-time intelligence (docs/stanley-gap-analysis-and-plan.md, phase 9). The planner cannot offer an opening that does not exist; conflicts are found on the right
/// clock (port or ship), tender ports need longer to get back, what the guest holds is never moved, and a group's silence is never a yes.
/// </summary>
public class StanleyPlannerTests
{
    private const string Sailing = "sun-2027-03-21";
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static readonly Timeline T = Timeline.Legacy(Departure);
    private static readonly IReadOnlyList<PlanChange> NoFeed = [];

    private static PlannerReserved Tour(int day, string id, string start, int minutes) => new(day, id, ExcursionRules.ById(id)!.Name, "tour", start, minutes, null);
    private static PlannerReserved Dinner(int day, string start) => new(day, "eclipse", "Dinner", "dinner", start, 90, "eclipse");

    private static PlannerDayDto Shape(int day, string scenario = "mixed", string mobility = "any", bool kids = false, TravellerProfile? who = null, params PlannerReserved[] held) =>
        StanleyPlannerRules.Shape(T, day, scenario, mobility, kids, held, NoFeed, null, Sailing, who);

    // ---- The day ----

    [Fact]
    public void EveryScenarioOnEveryDayBuildsOnlyRealOpeningsWithNoHardConflict()
    {
        foreach (var scenario in StanleyPlannerRules.Scenarios)
            foreach (var mobility in DayPlanRules.Mobilities)
                for (var day = 1; day <= T.Days.Count; day++)
                {
                    var plan = Shape(day, scenario, mobility);
                    Assert.DoesNotContain(plan.Conflicts, c => c.Severity == "hard");
                    Assert.Equal(plan.Segments.Count > 0, plan.Ready);
                    foreach (var s in plan.Segments.Where(s => s.Kind == "tour"))
                        Assert.Null(ExcursionRules.TimingProblem(ExcursionRules.ById(s.Id)!, T.Days[day - 1]));
                    foreach (var s in plan.Segments.Where(s => s.Kind == "event"))
                        Assert.Equal("on", ProgramRules.On(T, day, true, NoFeed).Single(e => e.Id == s.Id).Status);
                    Assert.Equal(plan.Segments.OrderBy(s => s.StartAt).Select(s => s.Id), plan.Segments.Select(s => s.Id));
                }
    }

    [Fact]
    public void ARelaxedDayOnAWheelchairKeepsToLevelToursAndAFamilyDayIsForTheChildren()
    {
        Assert.All(Shape(4, "relaxed", "wheelchair").Segments.Where(s => s.Kind == "tour"), s => Assert.True(ExcursionRules.ById(s.Id)!.Wheelchair));
        Assert.All(Shape(2, "family", "any", true).Segments.Where(s => s.Kind == "event"), s => Assert.NotEqual("adults", ProgramRules.ById(s.Id)!.Age));
    }

    [Fact]
    public void WhatTheGuestHoldsIsNeverMovedAndASuggestionThatOverlapsItIsLeftOutWithAReason()
    {
        var held = Tour(3, "coz-beach", "09:30", 360);
        var plan = Shape(3, "mixed", "any", false, null, held);
        Assert.Contains(plan.Segments, s => s.Id == "coz-beach" && s.Source == "reserved" && s.Start == "09:30");
        Assert.DoesNotContain(plan.Segments, s => s.Kind == "tour" && s.Id != "coz-beach");
        Assert.DoesNotContain(plan.Segments.Where(s => s.Source == "suggested" && s.Kind != "dinner"), s => s.StartAt < plan.Segments.Single(x => x.Id == "coz-beach").EndAt && s.EndAt > plan.Segments.Single(x => x.Id == "coz-beach").StartAt);
    }

    [Fact]
    public void ATourIsCheckedOnThePortsClockAndTheShipsClockIsOneHourAheadAtCozumel()
    {
        // Cozumel keeps UTC-5 all year; the ship is on New York time (UTC-4 on 23 March). The snorkel tour 08:30 to 12:00 port time is 09:30 to 13:00 on the ship's clock.
        var tour = Tour(3, "coz-snorkel", "08:30", 210);
        var overlapping = Shape(3, "mixed", "any", false, null, tour, Dinner(3, "12:30"));
        Assert.Contains(overlapping.Conflicts, c => c is { Severity: "hard", Code: "overlap" });
        Assert.False(overlapping.Ready);
        var seg = overlapping.Segments.Single(s => s.Id == "coz-snorkel");
        Assert.Equal(("port", "08:30", "12:00"), (seg.Clock, seg.Start, seg.End));
        Assert.Equal("ship", overlapping.Segments.Single(s => s.Kind == "dinner").Clock);
        // On a naive clock 13:30 would be an hour and a half after the tour; in real time it is 30 minutes, too short to get back aboard.
        Assert.Contains(Shape(3, "mixed", "any", false, null, tour, Dinner(3, "13:30")).Conflicts, c => c is { Severity: "hard", Code: "backTight" });
        Assert.DoesNotContain(Shape(3, "mixed", "any", false, null, tour, Dinner(3, "14:00")).Conflicts, c => c.Code is "backTight" or "overlap");
    }

    [Fact]
    public void ATenderPortNeedsLongerToGetBackThanADockedOne()
    {
        var reef = Tour(4, "bze-reef", "09:00", 240);   // Belize is a tender port: 90 minutes to get back; Cozumel needs 45.
        Assert.Contains(Shape(4, "mixed", "any", false, null, reef, Dinner(4, "14:00")).Conflicts, c => c is { Severity: "hard", Code: "backTight" });
        Assert.DoesNotContain(Shape(4, "mixed", "any", false, null, reef, Dinner(4, "14:30")).Conflicts, c => c.Code == "backTight");
    }

    [Fact]
    public void ATourOnTheWrongDayOrOutsideTheShipsHoursBlocksReady()
    {
        var wrong = Shape(4, "mixed", "any", false, null, Tour(4, "coz-snorkel", "08:30", 210));
        Assert.Contains(wrong.Conflicts, c => c.Code == "wrongPort");
        Assert.False(wrong.Ready);
        var late = Shape(3, "mixed", "any", false, null, Tour(3, "coz-glass", "15:30", 150));
        Assert.Contains(late.Conflicts, c => c.Code == "tourTooLate");
        Assert.False(late.Ready);
    }

    [Fact]
    public void AFullTourDayLeavesWindowsThatKeepTheLandingTimeAndAreAtLeastFortyFiveMinutes()
    {
        var plan = Shape(3, "mixed", "any", false, null, Tour(3, "coz-snorkel", "08:30", 210));
        Assert.All(plan.Windows, w => Assert.True(w.Minutes >= StanleyPlannerRules.WindowMinutes));
        var tour = plan.Segments.Single(s => s.Id == "coz-snorkel");
        Assert.All(plan.Windows, w => Assert.True(w.EndAt <= tour.StartAt - 30 * 60_000L || w.StartAt >= tour.EndAt + 45 * 60_000L));
    }

    // ---- The hour, the evening, the message ----

    [Fact]
    public void ThreeWaysToSpendTheHourAreOpenReachableAndLabelledAndSayThereIsNoCrowdData()
    {
        var hour = StanleyPlannerRules.Hour(T, 2, "10:00", "piazza", [], "any", false, NoFeed, null);
        Assert.InRange(hour.Options.Count, 1, 3);
        Assert.Contains("no live crowd data", hour.Occupancy, StringComparison.OrdinalIgnoreCase);
        var today = ProgramRules.On(T, 2, true, NoFeed);
        foreach (var o in hour.Options)
        {
            Assert.Contains(o.Cost, new[] { "free", "included", "paid" });
            if (o.Kind == "event")
            {
                var e = today.Single(x => x.Id == o.Id);
                Assert.Equal("on", e.Status);
                Assert.Equal(o.Cost == "paid", e.Extra > 0);
            }
            else
            {
                var begin = TripRules.ToMs(Itinerary.LocalToUtc(T.Departure.AddDays(1), new TimeOnly(10, 0), T.ShipZoneOnDate(T.Departure.AddDays(1))));
                Assert.DoesNotContain(today, e => e.PlaceId == o.Id && e.Status != "cancelled" && e.StartAt < begin + 3_600_000L && e.EndAt > begin);
            }
        }
    }

    [Fact]
    public void ForAWheelchairEveryOptionIsStepFreeAndWalkingIsSlower()
    {
        var places = AboardPlans.For(ShipDining.SunId)!.Places.ToDictionary(p => p.Id);
        var hour = StanleyPlannerRules.Hour(T, 2, "10:00", "piazza", [], "wheelchair", false, NoFeed, null);
        Assert.All(hour.Options, o => Assert.True(o.Kind == "event" ? places[ProgramRules.On(T, 2, true, NoFeed).Single(e => e.Id == o.Id).PlaceId].StepFree : places[o.Id].StepFree));
        Assert.True(StanleyPlannerRules.Walk("piazza", "lido-pool", null, "wheelchair") >= 2 * StanleyPlannerRules.Walk("piazza", "lido-pool", null, "any") - 1);
        Assert.Equal(0, StanleyPlannerRules.Walk("piazza", "piazza", null, "any"));
    }

    [Fact]
    public void WhenTheGuestIsBusyTheHourHasNoOptionsFromThatMoment()
    {
        var tour = Shape(3, "mixed", "any", false, null, Tour(3, "coz-snorkel", "08:30", 210)).Segments.Single(s => s.Id == "coz-snorkel");
        Assert.Empty(StanleyPlannerRules.Hour(T, 3, "10:00", null, [tour], "any", false, NoFeed, null).Options);
    }

    [Fact]
    public void TheEveningRunsDinnerThenAShowThenADrinkInOrderWithWalksAndNeverBooksAnything()
    {
        var evening = StanleyPlannerRules.Evening(T, 2, "any", false, null, NoFeed, null);
        Assert.Equal("dinner", evening.Steps[0].Kind);
        Assert.Equal("suggested", evening.Steps[0].Source);
        Assert.Contains(evening.Notes, n => n.Contains("not booked", StringComparison.OrdinalIgnoreCase));
        var times = evening.Steps.Select(s => s.Start).ToList();
        Assert.Equal(times.OrderBy(x => x, StringComparer.Ordinal), times);
        Assert.All(evening.Steps, s => Assert.True(s.WalkFromPrevious >= 0));
        Assert.Equal(evening.Steps.Count == 3, evening.Complete);
    }

    [Fact]
    public void TheGuestsOwnTableIsUsedAndTheLastMorningHasNoEvening()
    {
        var evening = StanleyPlannerRules.Evening(T, 2, "any", false, Dinner(2, "19:00"), NoFeed, null);
        Assert.Equal(("reserved", "19:00"), (evening.Steps[0].Source, evening.Steps[0].Start));
        Assert.Empty(StanleyPlannerRules.Evening(T, T.Days.Count, "any", false, null, NoFeed, null).Steps);
    }

    [Fact]
    public void AMeetingMessageNamesThePlaceDeckAndShipTimeAndAddsAllAboardOnAPortDay()
    {
        var m = StanleyPlannerRules.Meeting("piazza", "17:10", "  Bring the tickets  ", null)!;
        Assert.Contains("The Piazza", m.Text);
        Assert.Contains("deck 7", m.Text);
        Assert.Contains("17:10 ship time", m.Text);
        Assert.EndsWith("Bring the tickets", m.Text);
        Assert.Contains("all aboard is 16:30 port time", StanleyPlannerRules.Meeting("piazza", "17:10", null, null, "16:30")!.Text);
        Assert.Null(StanleyPlannerRules.Meeting("piazza", "25:00", null, null));
        Assert.Null(StanleyPlannerRules.Meeting("no-such-place", "17:10", null, null));
        Assert.Equal(StanleyPlannerRules.NoteMax, StanleyPlannerRules.Meeting("piazza", "17:10", new string('x', 500), null)!.Text.Count(c => c == 'x'));
    }

    // ---- A named traveller ----

    [Fact]
    public void ADayForSomeoneInAWheelchairNamesWhatToChangeAndAnUnverifiedProfileNeedsAPerson()
    {
        var who = new TravellerProfile("Dad", "wheelchair", "relaxed", "reported");
        var check = Shape(3, "mixed", "any", false, who, Tour(3, "coz-snorkel", "08:30", 210)).Traveller!;
        Assert.Equal("Dad", check.Name);
        Assert.Contains(check.Changes, c => c.Id == "coz-snorkel" && c.Severity == "change" && c.Text.Contains("wheelchair"));
        Assert.Contains(check.Changes, c => c.Text.Contains("Coz", StringComparison.OrdinalIgnoreCase) || c.Text.Contains("beach", StringComparison.OrdinalIgnoreCase) || c.Text.Contains("Glass", StringComparison.OrdinalIgnoreCase));
        Assert.True(check.HumanCheck);
        Assert.Contains("not verified", check.Note);
    }

    [Fact]
    public void AStepFreeClaimThatDependsOnABoatIsStillChecked_EvenWhenVerified()
    {
        var who = new TravellerProfile(null, "wheelchair", "steady", "verified");
        var check = Shape(3, "mixed", "any", false, who, Tour(3, "coz-glass", "13:00", 150)).Traveller!;
        Assert.Equal("this traveller", check.Name);
        Assert.Contains(check.Changes, c => c.Severity == "check" && c.Text.Contains("operator"));
        Assert.True(check.HumanCheck);
        Assert.False(StanleyPlannerRules.CheckTraveller(T, 2, [], new("A", "any", "active", "unknown"), null).HumanCheck);
    }

    [Fact]
    public void ABadTravellerProfileIsRefused()
    {
        Assert.False(StanleyPlannerRules.ValidTraveller(new("A", "flying", "steady", "verified")));
        Assert.False(StanleyPlannerRules.ValidTraveller(new("A", "any", "sprint", "verified")));
        Assert.False(StanleyPlannerRules.ValidTraveller(new("A", "any", "steady", "rumour")));
        Assert.False(StanleyPlannerRules.ValidTraveller(new(new string('n', 31), "any", "steady", "verified")));
        Assert.True(StanleyPlannerRules.ValidTraveller(null));
    }

    // ---- Excursions ----

    [Fact]
    public void TwoExcursionsAreComparedOnTheSameRowsWithThePartysPriceAndNothingInvented()
    {
        var c = StanleyPlannerRules.CompareTours(T, Sailing, "coz-snorkel", "coz-beach", [40, 10], new DateOnly(2027, 3, 1))!;
        Assert.Equal(["when", "start", "duration", "exertion", "transport", "return", "price", "included", "stepFree", "places"], c.Rows.Select(r => r.Key));
        Assert.Equal("$134 for 2 guests", c.Rows.Single(r => r.Key == "price").A);
        Assert.Equal("No", c.Rows.Single(r => r.Key == "stepFree").A);
        Assert.True(c.Rows.Single(r => r.Key == "duration").Differs);
        Assert.Empty(c.Missing);
        var unknown = StanleyPlannerRules.CompareTours(T, Sailing, "rtb-zip", "rtb-wildlife", [40], new DateOnly(2027, 3, 1))!;
        Assert.Equal(2, unknown.Missing.Count);
        Assert.Contains(unknown.Risks, r => r.Contains("sold out"));
        Assert.Null(StanleyPlannerRules.CompareTours(T, Sailing, "rtb-zip", "rtb-zip", [], new DateOnly(2027, 3, 1)));
        Assert.Null(StanleyPlannerRules.CompareTours(T, Sailing, "nope", "rtb-zip", [], new DateOnly(2027, 3, 1)));
    }

    [Fact]
    public void ARiskIsRaisedForAChildUnderTheMinimumAgeAndForNoAdult()
    {
        var c = StanleyPlannerRules.CompareTours(T, Sailing, "bze-cave", "coz-glass", [10], new DateOnly(2027, 3, 1))!;
        Assert.Contains(c.Risks, r => r.Contains("minimum age of 12"));
        Assert.Contains(c.Risks, r => r.Contains("needs an adult"));
        Assert.Contains(c.Risks, r => r.Contains("tender port"));
    }

    // ---- Consequences ----

    [Fact]
    public void AddingATourShowsTheNewConflictThePriceForThePartyAndTheLastFreeCancelDate()
    {
        var snorkel = ExcursionRules.ById("coz-snorkel")!;
        var p = StanleyPlannerRules.Preview(T, Sailing, snorkel, "mixed", "any", false, [Dinner(3, "12:30")], NoFeed, null, [40, 10], new DateOnly(2027, 3, 1))!;
        Assert.Equal(3, p.Day);
        Assert.Null(p.Problem);
        Assert.True(p.ReadyBefore);
        Assert.False(p.ReadyAfter);
        Assert.Contains(p.NewConflicts, c => c.Code == "overlap");
        Assert.Equal(13_400, p.PriceChangeCents);
        Assert.Equal("2027-03-21", p.FreeCancelUntil);
        Assert.True(p.FreeCancelOpen);
        Assert.False(StanleyPlannerRules.Preview(T, Sailing, snorkel, "mixed", "any", false, [], NoFeed, null, [40], new DateOnly(2027, 3, 22))!.FreeCancelOpen);
    }

    [Fact]
    public void ATourAlreadyHeldOrSoldOutOrPastIsReportedAndNotAdded()
    {
        var zip = ExcursionRules.ById("rtb-zip")!;
        var sold = StanleyPlannerRules.Preview(T, Sailing, zip, "mixed", "any", false, [], NoFeed, null, [40], new DateOnly(2027, 3, 1))!;
        Assert.Equal("soldOut", sold.Problem);
        Assert.Equal(0, sold.PriceChangeCents);
        var snorkel = ExcursionRules.ById("coz-snorkel")!;
        Assert.Equal("alreadyBooked", StanleyPlannerRules.Preview(T, Sailing, snorkel, "mixed", "any", false, [Tour(3, "coz-snorkel", "08:30", 210)], NoFeed, null, [40], new DateOnly(2027, 3, 1))!.Problem);
        Assert.Equal("closed", StanleyPlannerRules.Preview(T, Sailing, snorkel, "mixed", "any", false, [], NoFeed, null, [40], new DateOnly(2027, 3, 25))!.Problem);
    }

    // ---- Group diplomat ----

    private static readonly GroupOption[] Opts = [new("a", "Snorkel"), new("b", "Ruins"), new("c", "Beach")];
    private static GroupMember M(string name, params (string Option, string Answer)[] answers) => new(name, answers.ToDictionary(a => a.Option, a => a.Answer));
    private static GroupStatusRequest Req(IReadOnlyList<GroupMember> members, long? created = 0, long? closes = 10_000, bool? closed = null, bool organiser = false) =>
        new("Which tour?", Opts, members, created, closes, closed, organiser);

    [Fact]
    public void SilenceIsNeverAYesAndALeadWithSilentMembersIsOnlyLeading()
    {
        var s = StanleyPlannerRules.GroupStatus(Req([M("Ann", ("a", "yes"), ("b", "no")), M("Bo", ("a", "yes")), new("Cy", null), new("Di", new Dictionary<string, string>())]), 1_000);
        Assert.Equal((2, 2), (s.Answered, s.Silent));
        Assert.Equal("leading", s.Suggestion.Kind);
        Assert.Equal(["a"], s.Suggestion.OptionIds);
        Assert.Equal(2, s.Tally.Single(t => t.Id == "a").Yes);
        Assert.Contains("not counted as a yes", s.Suggestion.Text);
        Assert.Contains("not a yes", s.Note);
    }

    [Fact]
    public void WhenEveryoneAnsweredAndNobodyObjectsTheChoiceIsClearAndATieIsNamed()
    {
        Assert.Equal("clear", StanleyPlannerRules.GroupStatus(Req([M("Ann", ("a", "yes")), M("Bo", ("a", "yes"), ("b", "maybe"))]), 1).Suggestion.Kind);
        var tie = StanleyPlannerRules.GroupStatus(Req([M("Ann", ("a", "yes"), ("b", "yes")), M("Bo", ("a", "yes"), ("b", "yes"))]), 1).Suggestion;
        Assert.Equal(("tie", 2), (tie.Kind, tie.OptionIds.Count));
    }

    [Fact]
    public void WhenEveryOptionHasAnObjectionTheFewestIsOfferedAsACompromiseWithoutNamingAnyone()
    {
        var s = StanleyPlannerRules.GroupStatus(Req([M("Ann", ("a", "no"), ("b", "yes"), ("c", "no")), M("Bo", ("a", "yes"), ("b", "no"), ("c", "no")), M("Cy", ("a", "yes"), ("b", "yes"), ("c", "yes"))]), 1);
        Assert.Equal("compromise", s.Suggestion.Kind);
        Assert.Equal(["a"], s.Suggestion.OptionIds);   // a and b each have one no; a is first by yes count then id
        Assert.DoesNotContain("Ann", s.Suggestion.Text);
        Assert.DoesNotContain("Bo", s.Suggestion.Text);
    }

    [Fact]
    public void AReminderIsDueHalfwayThroughForTheSilentAndNeverForAClosedPoll()
    {
        var members = new[] { M("Ann", ("a", "yes")), new GroupMember("Bo", null) };
        Assert.False(StanleyPlannerRules.GroupStatus(Req(members), 4_000).ReminderDue);
        var due = StanleyPlannerRules.GroupStatus(Req(members), 6_000);
        Assert.True(due.ReminderDue);
        Assert.Contains("1 of 2 have not answered", due.ReminderText);
        Assert.DoesNotContain("Bo", due.ReminderText);
        Assert.False(StanleyPlannerRules.GroupStatus(Req(members, closed: true), 6_000).ReminderDue);
        var expired = StanleyPlannerRules.GroupStatus(Req(members), 20_000);
        Assert.Equal("expired", expired.State);
        Assert.False(expired.ReminderDue);
        Assert.Equal("closed", StanleyPlannerRules.GroupStatus(Req(members, closed: true), 1).State);
    }

    [Fact]
    public void OnlyTheOrganiserGetsOwnerControlsAndWhatRemainsIsListed()
    {
        var members = new[] { M("Ann", ("a", "yes")), new GroupMember("Bo", null) };
        Assert.Equal(["remind", "extend", "close"], StanleyPlannerRules.GroupStatus(Req(members, organiser: true), 1).Controls);
        Assert.Equal(["answer"], StanleyPlannerRules.GroupStatus(Req(members), 1).Controls);
        var remains = StanleyPlannerRules.GroupStatus(Req(members), 1).Remains;
        Assert.Contains(remains, r => r.Contains("1 person has not answered"));
    }

    [Fact]
    public void AGroupRequestWithReasonsUnknownOptionsOrTheWrongShapeIsRefused()
    {
        Assert.Null(StanleyPlannerRules.GroupProblem(Req([M("Ann", ("a", "yes"))])));
        Assert.Equal("answers", StanleyPlannerRules.GroupProblem(Req([M("Ann", ("a", "because I get seasick"))])));
        Assert.Equal("answers", StanleyPlannerRules.GroupProblem(Req([M("Ann", ("zzz", "yes"))])));
        Assert.Equal("question", StanleyPlannerRules.GroupProblem(Req([M("Ann")]) with { Question = " " }));
        Assert.Equal("options", StanleyPlannerRules.GroupProblem(Req([M("Ann")]) with { Options = [new("a", "Only")] }));
        Assert.Equal("options", StanleyPlannerRules.GroupProblem(Req([M("Ann")]) with { Options = [new("a", "One"), new("a", "Two")] }));
        Assert.Equal("members", StanleyPlannerRules.GroupProblem(Req([])));
        Assert.Equal("members", StanleyPlannerRules.GroupProblem(Req(Enumerable.Range(0, 21).Select(i => M("P" + i)).ToList())));
        Assert.Equal("times", StanleyPlannerRules.GroupProblem(Req([M("Ann")], created: -1)));
        Assert.Equal("question", StanleyPlannerRules.GroupProblem(null));
    }

    // ---- Access records ----

    private static readonly DateOnly Today = new(2027, 3, 1);
    private static TravellerRecord Rec(string source = "reported", string? checkedOn = null, string mobility = "wheelchair") => new("dad", "Dad", mobility, "relaxed", source, checkedOn, null, null);

    [Fact]
    public void ARecordNeedsAShapeAndAVerifiedOneNeedsADateThatIsNotInTheFuture()
    {
        Assert.Null(StanleyTravellerRules.Problem(Rec(), Today));
        Assert.Null(StanleyTravellerRules.Problem(Rec("verified", "2027-02-01"), Today));
        Assert.Equal("checkedOn", StanleyTravellerRules.Problem(Rec("verified"), Today));
        Assert.Equal("checkedOn", StanleyTravellerRules.Problem(Rec("verified", "2027-03-02"), Today));
        Assert.Equal("checkedOn", StanleyTravellerRules.Problem(Rec("verified", "March"), Today));
        Assert.Equal("id", StanleyTravellerRules.Problem(Rec() with { Id = "bad id!" }, Today));
        Assert.Equal("name", StanleyTravellerRules.Problem(Rec() with { Name = " " }, Today));
        Assert.Equal("mobility", StanleyTravellerRules.Problem(Rec(mobility: "flying"), Today));
        Assert.Equal("source", StanleyTravellerRules.Problem(Rec("rumour"), Today));
        Assert.Equal("note", StanleyTravellerRules.Problem(Rec() with { Note = new string('x', 101) }, Today));
        Assert.Equal("id", StanleyTravellerRules.Problem(null, Today));
    }

    [Fact]
    public void TheServerStampsTheDateWhenARecordIsNewOrChangedAndKeepsItWhenNothingChanged()
    {
        var first = StanleyTravellerRules.Clean(Rec("reported", "2020-01-01") with { Name = " Dad " }, null, Today);
        Assert.Equal(("Dad", null, "2027-03-01"), (first.Name, first.CheckedOn, first.AsOf));
        var later = new DateOnly(2027, 3, 9);
        Assert.Equal("2027-03-01", StanleyTravellerRules.Clean(Rec(), first, later).AsOf);
        Assert.Equal("2027-03-09", StanleyTravellerRules.Clean(Rec() with { Pace = "active" }, first, later).AsOf);
    }

    [Fact]
    public void ConfidenceIsHighOnlyForARecentVerificationAndAStaleOneCountsAsAReport()
    {
        Assert.Equal("high", StanleyTravellerRules.Confidence(Rec("verified", "2027-01-15"), Today));
        Assert.Equal("medium", StanleyTravellerRules.Confidence(Rec("verified", "2026-08-01"), Today));
        Assert.True(StanleyTravellerRules.Stale(Rec("verified", "2026-08-01"), Today));
        Assert.Equal("medium", StanleyTravellerRules.Confidence(Rec("reported"), Today));
        Assert.Equal("low", StanleyTravellerRules.Confidence(Rec("unknown"), Today));
        Assert.False(StanleyTravellerRules.Stale(Rec("reported"), Today));
        var view = StanleyTravellerRules.View(Rec("verified", "2026-08-01"), Today);
        Assert.Equal(("medium", true), (view.Confidence, view.Stale));
    }

    [Fact]
    public void AFreshVerificationNeedsNoPersonButAStaleOneDoes()
    {
        var fresh = StanleyPlannerRules.CheckTraveller(T, 2, [], StanleyTravellerRules.Profile(Rec("verified", "2027-02-20")), null, null, Today);
        Assert.False(fresh.HumanCheck);
        Assert.Equal("high", fresh.Confidence);
        Assert.Contains("verified on 2027-02-20", fresh.Note);
        var stale = StanleyPlannerRules.CheckTraveller(T, 2, [], StanleyTravellerRules.Profile(Rec("verified", "2026-06-01")), null, null, Today);
        Assert.True(stale.HumanCheck);
        Assert.Equal("medium", stale.Confidence);
        Assert.Contains("check the route again", stale.Note);
        Assert.Equal("low", StanleyPlannerRules.CheckTraveller(T, 2, [], StanleyTravellerRules.Profile(Rec("unknown")), null, null, Today).Confidence);
    }
}
