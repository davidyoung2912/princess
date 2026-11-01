using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure rules of Phase 11, ported from src/domain/disembark.ts and postcruise.ts. The sailing leaves 21 March 2027; the ship ties up on the 28th, Eastern daylight time (UTC-4).</summary>
public class FinishRulesTests
{
    private static readonly DateOnly Sailing = new(2027, 3, 21);
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);

    // ---- Tag groups and times ----

    [Fact]
    public void TheHashIsFnv1aOverTheText()
    {
        Assert.Equal(2166136261u, DisembarkRules.Hash(""));
        Assert.Equal(0xE40C292Cu, DisembarkRules.Hash("a"));
    }

    [Fact]
    public void PriorityGuestsAreGoldOneAndOthersGetASteadyPickFromTheRest()
    {
        Assert.Equal(new TagGroup("gold", 1, "07:00"), DisembarkRules.GroupFor("PC243902|sun-2027-03-21", priority: true));
        foreach (var booking in new[] { "PC243902", "PC179254", "PC508532", "AG7P31BK" })
        {
            var g = DisembarkRules.GroupFor(booking, priority: false);
            Assert.NotEqual("gold", g.Color);
            Assert.Equal(g, DisembarkRules.GroupFor(booking, priority: false));
        }
    }

    [Fact]
    public void TheLastDayRunsOnEasternTimeWithTheBagsOutTimeTheEveningBefore()
    {
        var t = DisembarkRules.Times(Sailing);
        Assert.Equal(Utc(28, 10), t.ArrivalAt);        // 06:00 EDT
        Assert.Equal(Utc(28, 2), t.BagsOutAt);         // 22:00 EDT on the 27th
        Assert.Equal(Utc(28, 0), t.TipBy);             // 20:00 EDT
        Assert.Equal(Utc(28, 12, 30), t.VacateAt);     // 08:30 EDT
        Assert.Equal(new DateOnly(2027, 3, 28), t.Date);
    }

    [Fact]
    public void EachWayOfGettingOffHasItsOwnEarliestTime()
    {
        var gold = DisembarkRules.TagGroups[0];
        Assert.Equal(Utc(28, 11), DisembarkRules.OffAt(Sailing, "tagged", gold));              // 07:00
        Assert.Equal(Utc(28, 12, 30), DisembarkRules.OffAt(Sailing, "tagged", DisembarkRules.TagGroups[3]));   // orange, 08:30
        Assert.Equal(Utc(28, 11, 30), DisembarkRules.OffAt(Sailing, "selfAssist", gold));
        Assert.Equal(Utc(28, 10, 30), DisembarkRules.OffAt(Sailing, "earlyWalkOff", gold));
    }

    // ---- The choice ----

    private static Dictionary<Guid, int> Bags(params int[] n) => n.ToDictionary(_ => Guid.NewGuid(), x => x);

    [Theory]
    [InlineData("tagged", new[] { 2, 1 }, null)]
    [InlineData("tagged", new[] { 6, 0 }, null)]
    [InlineData("selfAssist", new[] { 2, 2 }, null)]
    [InlineData("earlyWalkOff", new[] { 0, 0 }, null)]
    [InlineData("tagged", new[] { 0, 0 }, "noBags")]
    [InlineData("selfAssist", new[] { 3, 0 }, "tooManyToCarry")]
    [InlineData("tagged", new[] { 7, 0 }, "badBags")]
    [InlineData("tagged", new[] { -1, 1 }, "badBags")]
    [InlineData("flying", new[] { 1, 1 }, "badOption")]
    public void AChoiceNeedsAKnownWayAndSensibleBags(string option, int[] bags, string? problem)
    {
        var withGuids = new Dictionary<Guid, int>();
        foreach (var n in bags) withGuids[Guid.NewGuid()] = n;
        Assert.Equal(problem, DisembarkRules.ChoiceProblem(option, withGuids));
    }

    [Fact]
    public void ALabelNamesTheGroupTheGuestAndTheStateroom() =>
        Assert.Equal("BLUE 2 · HARPER/DANIEL · 8101", DisembarkRules.TagLabel(DisembarkRules.TagGroups[1], "HARPER/DANIEL", "8101"));

    // ---- Customs ----

    [Fact]
    public void TheAllowanceIsPerPersonAndOnlyTheExcessIsDeclared()
    {
        var blank = DisembarkRules.CustomsSummaryOf(DisembarkRules.BlankCustoms(), 2);
        Assert.Equal((0, 1600), (blank.OverUsd, blank.AllowanceUsd));
        Assert.Empty(blank.Declare);
        var s = DisembarkRules.CustomsSummaryOf(new CustomsDeclaration(true, true, 2000, ""), 2);
        Assert.Equal(["food", "cash", "goods"], s.Declare);
        Assert.Equal(400, s.OverUsd);
        Assert.Empty(DisembarkRules.CustomsSummaryOf(new CustomsDeclaration(false, false, 1600, ""), 2).Declare);
    }

    [Theory]
    [InlineData(0, 0, null)]
    [InlineData(100_000, 200, null)]
    [InlineData(-1, 0, "badGoods")]
    [InlineData(100_001, 0, "badGoods")]
    [InlineData(0, 201, "badNote")]
    public void ADeclarationKeepsGoodsAndTheNoteWithinLimits(int goods, int noteLength, string? problem) =>
        Assert.Equal(problem, DisembarkRules.CustomsProblem(new CustomsDeclaration(false, false, goods, new string('x', noteLength))));

    // ---- Onward travel ----

    private static OnwardPlan Ride(string flightAt) => new("rideshare", flightAt, "UA 482", "");

    [Theory]
    [InlineData("14:30", "ok", 180)]
    [InlineData("12:00", "tight", 30)]
    [InlineData("08:00", "tooEarly", -210)]
    public void AFlightIsMadeWhenThereIsTimeAfterTheShipTheQueueTheRideAndThreeHoursAtTheAirport(string flightAt, string status, int spare)
    {
        // off at 07:30, 45 minutes of customs and 15 minutes in the car: at the airport kerb at 08:30
        var check = DisembarkRules.CheckOnward(Sailing, Ride(flightAt), Utc(28, 11, 30));
        Assert.Equal((status, spare), (check.Status, check.Spare));
        Assert.Equal("11:30", check.EarliestFlight);
    }

    [Fact]
    public void WithoutAFlightThereIsNothingToCheckButTheEarliestFlightIsStillGiven()
    {
        var check = DisembarkRules.CheckOnward(Sailing, Ride(""), Utc(28, 11, 30));
        Assert.Equal(("noFlight", null, null), (check.Status, check.LeaveBy, check.Spare));
    }

    [Theory]
    [InlineData("rideshare", "14:30", "UA 482", "", null)]
    [InlineData("rideshare", "", "", "", null)]
    [InlineData("train", "14:30", "UA 482", "", "badMode")]
    [InlineData("rideshare", "25:00", "UA 482", "", "badFlightTime")]
    [InlineData("rideshare", "2pm", "UA 482", "", "badFlightTime")]
    [InlineData("rideshare", "14:30", "UA 4821234", "", "badFlight")]
    [InlineData("rideshare", "14:30", "UA-482", "", "badFlight")]
    public void APlanNeedsAKnownModeAndATimeAndFlightThatLookRight(string mode, string at, string flight, string note, string? problem) =>
        Assert.Equal(problem, DisembarkRules.OnwardProblem(new OnwardPlan(mode, at, flight, note)));

    // ---- The final night ----

    [Fact]
    public void BagsAndTagsAreOnlyOnTheListForGuestsWhoseBagsGoOutWithTags()
    {
        var none = new HashSet<string>();
        Assert.Contains(DisembarkRules.NightEntries(Sailing, Utc(27, 12), null, false, false, none), e => e.Id == "bagsOut");
        Assert.Contains(DisembarkRules.NightEntries(Sailing, Utc(27, 12), "tagged", false, false, none), e => e.Id == "tags");
        var carried = DisembarkRules.NightEntries(Sailing, Utc(27, 12), "selfAssist", false, false, none);
        Assert.DoesNotContain(carried, e => e.Id is "tags" or "bagsOut");
        Assert.Equal(7, carried.Count);
    }

    [Fact]
    public void AnItemIsDoneByTheThingItNamesOrByAPatOnTheBackAndLateOnesAreOverdue()
    {
        var at = Utc(27, 23);       // 19:00 EDT: the bill is due at 20:00, the rest at 22:00
        var entries = DisembarkRules.NightEntries(Sailing, at, "tagged", customsDone: true, tagsOn: false, new HashSet<string> { "valuables" });
        string State(string id) => entries.Single(e => e.Id == id).State;
        Assert.Equal("dueSoon", State("bill"));
        Assert.Equal("done", State("choose"));
        Assert.Equal("done", State("customs"));
        Assert.Equal("upcoming", State("tags"));       // due at 22:00, three hours away
        Assert.Equal("done", State("valuables"));
        Assert.True(entries.Single(e => e.Id == "customs").Automatic);
        Assert.Equal("upcoming", State("documents"));
        Assert.Equal("overdue", DisembarkRules.NightEntries(Sailing, Utc(28, 3), "tagged", true, false, new HashSet<string>()).Single(e => e.Id == "bagsOut").State);
    }

    // ---- The final bill ----

    [Fact]
    public void TheGratuityIsSevenNightsPerGuestExceptWhereAPackageCoversIt()
    {
        Assert.Equal(2 * 1650 * 7, DisembarkRules.GratuityCharged([new(false, false), new(false, false)]));
        Assert.Equal(1850 * 7, DisembarkRules.GratuityCharged([new(true, false), new(true, true)]));
        Assert.Equal(0, DisembarkRules.GratuityCharged([new(false, true)]));
    }

    [Theory]
    [InlineData(100, 0)]
    [InlineData(75, 5775)]
    [InlineData(50, 11550)]
    [InlineData(0, 23100)]
    public void KeepingLessOfTheGratuityEarnsTheDifferenceBack(int keep, long credit) => Assert.Equal(credit, DisembarkRules.TipCredit(23100, keep));

    // ---- Cases ----

    [Theory]
    [InlineData("lostItem", "Blue scarf left in the theatre", "Princess Theater", "", 0, null)]
    [InlineData("lostItem", "Blue scarf left in the theatre", " ", "", 0, "noPlace")]
    [InlineData("billing", "Charged twice for the same drink", "", "line-1", 1500, null)]
    [InlineData("billing", "Charged twice for the same drink", "", "", 1500, "noLine")]
    [InlineData("billing", "Charged twice for the same drink", "", "line-1", 0, "badAmount")]
    [InlineData("claim", "Suitcase handle broken by the crew", "", "", 25_000, null)]
    [InlineData("claim", "Suitcase handle broken by the crew", "", "", 500_001, "badAmount")]
    [InlineData("complaint", "The air conditioning never worked", "", "", 0, null)]
    [InlineData("complaint", "hmm", "", "", 0, "badSummary")]
    [InlineData("recovery", "Opened by the ship, not by a guest", "", "", 0, "badKind")]
    public void ACaseNeedsWhatItsKindNeeds(string kind, string summary, string place, string line, long cents, string? problem) =>
        Assert.Equal(problem, PostCruiseRules.CaseProblem(kind, summary, place, line, cents));

    [Fact]
    public void ACaseNumberIsTheSameEveryTimeForTheSameBookingKindAndCount()
    {
        var n = PostCruiseRules.CaseNumber("lostItem", "PC243902", 0);
        Assert.Matches(@"^PC-LF-\d{5}$", n);
        Assert.Equal(n, PostCruiseRules.CaseNumber("lostItem", "PC243902", 0));
        Assert.NotEqual(n, PostCruiseRules.CaseNumber("lostItem", "PC243902", 1));
        Assert.StartsWith("PC-SR-", PostCruiseRules.CaseNumber("recovery", "PC243902", 0));
    }

    private static CaseTimes Opened(string kind, long cents = 3150) => new(kind, "PC-XX-10001", Utc(28, 12), cents, null);

    [Fact]
    public void ACaseIsReceivedThenInReviewThenAnsweredWhenItsTimeIsUp()
    {
        var c = Opened("lostItem");
        Assert.Equal("received", PostCruiseRules.StatusOf(c, Utc(28, 13)).Stage);
        Assert.Equal("inReview", PostCruiseRules.StatusOf(c, Utc(29, 13)).Stage);
        var due = PostCruiseRules.StatusOf(c, Utc(28, 13)).DueAt;
        Assert.Equal(c.OpenedAt.AddHours(72), due);
        var answered = PostCruiseRules.StatusOf(c, due);
        Assert.Equal("resolved", answered.Stage);
        Assert.Contains(answered.Outcome, new[] { "found", "notFound" });
        Assert.True(PostCruiseRules.Withdrawable(PostCruiseRules.StatusOf(c, Utc(29, 13))));
        Assert.False(PostCruiseRules.Withdrawable(answered));
    }

    [Fact]
    public void AWithdrawnCaseStaysWithdrawn()
    {
        var s = PostCruiseRules.StatusOf(Opened("complaint") with { WithdrawnAt = Utc(29, 1) }, Utc(31, 12));
        Assert.Equal(("withdrawn", null, null), (s.Stage, s.Outcome, s.Refund));
    }

    [Fact]
    public void ABillQueryIsEitherExplainedOrRefundedInFullAndTheRefundArrivesThreeDaysAfterTheAnswer()
    {
        var c = Opened("billing");
        var due = c.OpenedAt.AddHours(120);
        var s = PostCruiseRules.StatusOf(c, due);
        if (s.Outcome == "explained") Assert.Null(s.Refund);
        else
        {
            Assert.Equal(("refunded", 3150L, false), (s.Outcome, s.Refund!.Cents, s.Refund.Sent));
            Assert.Equal(TripRules.ToMs(due.AddDays(3)), s.Refund.ExpectedBy);
            Assert.True(PostCruiseRules.StatusOf(c, due.AddDays(3)).Refund!.Sent);
        }
    }

    [Fact]
    public void AClaimPaysHalfAndARecoveryCaseGivesTheCreditAtOnce()
    {
        var claim = PostCruiseRules.StatusOf(Opened("claim", 25_001), Opened("claim").OpenedAt.AddHours(240));
        Assert.Equal(("goodwill", 12_501L), (claim.Outcome, claim.Refund!.Cents));      // half of 25001 rounds up
        var rec = PostCruiseRules.StatusOf(Opened("recovery"), Opened("recovery").OpenedAt.AddHours(48));
        Assert.Equal(("credit", 5000L, true), (rec.Outcome, rec.Refund!.Cents, rec.Refund.Sent));
        Assert.Null(PostCruiseRules.StatusOf(Opened("complaint"), Opened("complaint").OpenedAt.AddHours(72)).Refund);
    }

    // ---- Feedback ----

    [Fact]
    public void FeedbackNeedsAnOverallScoreAndKeepsEverythingElseWithinLimits()
    {
        Assert.Null(PostCruiseRules.FeedbackProblem(4, new Dictionary<string, int> { ["ship"] = 5 }, "Lovely", ["Marisol"]));
        Assert.Equal("noOverall", PostCruiseRules.FeedbackProblem(0, null, "", []));
        Assert.Equal("noOverall", PostCruiseRules.FeedbackProblem(6, null, "", []));
        Assert.Equal("badRating", PostCruiseRules.FeedbackProblem(4, new Dictionary<string, int> { ["ship"] = 9 }, "", []));
        Assert.Equal("badRating", PostCruiseRules.FeedbackProblem(4, new Dictionary<string, int> { ["bridge"] = 3 }, "", []));
        Assert.Equal("badComment", PostCruiseRules.FeedbackProblem(4, null, new string('x', 1001), []));
        Assert.Equal("badCrew", PostCruiseRules.FeedbackProblem(4, null, "", ["a", "b", "c", "d"]));
        Assert.Equal("badCrew", PostCruiseRules.FeedbackProblem(4, null, "", [" "]));
    }

    [Fact]
    public void PoorScoresOverallOrInAnyAreaStartServiceRecovery()
    {
        Feedback F(int overall, params (string, int)[] areas) => new(overall, areas.ToDictionary(a => a.Item1, a => a.Item2), "", [], true, false);
        Assert.False(PostCruiseRules.NeedsRecovery(F(3, ("ship", 3))));
        Assert.True(PostCruiseRules.NeedsRecovery(F(2)));
        Assert.True(PostCruiseRules.NeedsRecovery(F(5, ("dining", 1))));
    }

    [Fact]
    public void StoredFeedbackIsReadBackAndAHandWrittenRowIsReadAsFarAsItFits()
    {
        var f = new Feedback(4, new Dictionary<string, int> { ["ship"] = 5 }, "Great", ["Joy"], true, false);
        Assert.Equal(f.Overall, PostCruiseRules.ParseFeedback(PostCruiseRules.FeedbackJson(f)).Overall);
        var back = PostCruiseRules.ParseFeedback(PostCruiseRules.FeedbackJson(f));
        Assert.Equal((5, "Great", true), (back.Areas["ship"], back.Comment, back.AllowContact));
        Assert.Equal(["Joy"], back.Crew);

        var seeded = PostCruiseRules.ParseFeedback("""{"overall":4,"ship":5,"dining":4,"comment":"Lovely trip, one billing error."}""");
        Assert.Equal((4, 5, 4, "Lovely trip, one billing error."), (seeded.Overall, seeded.Areas["ship"], seeded.Areas["dining"], seeded.Comment));
        Assert.Equal(0, PostCruiseRules.ParseFeedback("not json").Overall);
    }

    // ---- Captain's Circle ----

    [Theory]
    [InlineData(0, "none")]
    [InlineData(5, "gold")]
    [InlineData(29, "gold")]
    [InlineData(30, "ruby")]
    [InlineData(90, "platinum")]
    [InlineData(150, "elite")]
    public void DaysReachALevel(int days, string tier) => Assert.Equal(tier, PostCruiseRules.TierForDays(days));

    [Fact]
    public void TheCruiseCountsOnceTheShipHasTiedUpAndALevelAlreadyHeldIsNeverLost()
    {
        var before = PostCruiseRules.Loyalty("gold", 28, 7, counted: false);
        Assert.Equal(("gold", "gold", 28, 28, "ruby", 2, false), (before.Before, before.After, before.DaysBefore, before.DaysAfter, before.Next, before.DaysToNext, before.Promoted));
        var after = PostCruiseRules.Loyalty("gold", 28, 7, counted: true);
        Assert.Equal(("ruby", 35, "platinum", 55, true), (after.After, after.DaysAfter, after.Next, after.DaysToNext, after.Promoted));
        var kept = PostCruiseRules.Loyalty("platinum", 10, 7, counted: true);
        Assert.Equal(("platinum", false), (kept.After, kept.Promoted));
        var top = PostCruiseRules.Loyalty("elite", 300, 7, counted: true);
        Assert.Equal((null, null), (top.Next, top.DaysToNext));
    }

    [Fact]
    public void ACodeIsTheFirstNameAndThreeDigitsAndEarnedCreditIsPerFriendWhoSailed()
    {
        Assert.Matches(@"^GRACE\d{3}$", PostCruiseRules.ReferralCode("Grace"));
        Assert.Equal(PostCruiseRules.ReferralCode("Grace"), PostCruiseRules.ReferralCode("Grace"));
    }

    // ---- Rebooking ----

    [Fact]
    public void TheDepositIsAFifthOfTheFareInWholeDollarsOrTheLowerOnboardDeposit()
    {
        Assert.Equal(123_300, PostCruiseRules.HoldDeposit(616_400, 1, onboard: false));
        Assert.Equal(10_000, PostCruiseRules.HoldDeposit(616_400, 1, onboard: true));
        Assert.Equal(30_000, PostCruiseRules.HoldDeposit(616_400, 3, onboard: true));
        Assert.Equal(1000, PostCruiseRules.HoldDeposit(5000, 1, onboard: false));
        Assert.Equal(1000, PostCruiseRules.HoldDeposit(5000, 1, onboard: true));         // the lower of the two
    }

    [Fact]
    public void AHoldLastsAWeekAndTheFirstDateToHoldIsTwoWeeksAfterTheCruise()
    {
        Assert.Equal(Utc(28, 12).AddDays(7), PostCruiseRules.HoldExpiry(Utc(28, 12)));
        Assert.Equal(new DateOnly(2027, 4, 11), PostCruiseRules.EarliestRebook(new DateOnly(2027, 3, 28)));
        Assert.Equal(7500, PostCruiseRules.LevelCredit("platinum"));
        Assert.Equal(0, PostCruiseRules.LevelCredit("none"));
    }

    [Fact]
    public void TheDeskOpensTenToHalfPastFourEveryHalfHour()
    {
        var times = PostCruiseRules.DeskTimes();
        Assert.Equal(14, times.Count);
        Assert.Equal((new TimeOnly(10, 0), new TimeOnly(16, 30)), (times[0], times[^1]));
    }

    [Fact]
    public void NextSeasonDeparturesCanBePricedButAreNotOnOffer()
    {
        Assert.NotNull(Pricing.Quote("sun-2027-11-07", "balcony", 2));
        Assert.False(Pricing.HasPrice("sun-2027-11-07"));
        Assert.True(Pricing.HasPrice("sun-2027-03-21"));
    }
}
