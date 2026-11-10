using System.Globalization;
using System.Text.RegularExpressions;
using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>
/// Entitlement, spend and loyalty coach (docs/stanley-gap-analysis-and-plan.md, phase 12). The rules here are pure, so the figures are checked exactly. The last group holds the acceptance rule:
/// every amount on a chat card is one the rules produced from the service figures, so no model can change a figure.
/// </summary>
public class StanleyMoneyTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);

    private static Entitlements Plus => EntitlementRules.Compute("none", "plus", false);
    private static Entitlements None => EntitlementRules.Compute("none", "none", false);
    private static Entitlements Premier => EntitlementRules.Compute("platinum", "premier", false);

    private static EntitlementAnswer Ask(string item, Entitlements e, int age = 40, long? price = null, bool alcohol = true, int meals = 0, int wifi = 0, long credit = 0, string package = "plus") =>
        StanleyMoneyRules.Entitlement(item, "Anna", age, package, e, EntitlementRules.BalancesOf(e, meals, wifi), price, alcohol, credit);

    // ---- entitlement ----

    [Fact]
    public void AnUnpricedDrinkIsIncludedUpToTheCapAndNamesTheCap()
    {
        var a = Ask(MoneyItems.Drink, Plus);
        Assert.Equal(MoneyVerdicts.Included, a.Verdict);
        Assert.Contains("$15", a.Lines[0]);
        Assert.Null(a.YouPayCents);
    }

    [Fact]
    public void ADrinkUnderTheCapCostsNothingAndOverItThePersonPaysTheDifferenceAndTheServiceCharge()
    {
        Assert.Equal(0, Ask(MoneyItems.Drink, Plus, price: 1400).YouPayCents);
        var over = Ask(MoneyItems.Drink, Plus, price: 1900);
        Assert.Equal(MoneyVerdicts.Partly, over.Verdict);
        Assert.Equal(400 + 72, over.YouPayCents);
        Assert.Contains("$4.72", string.Join(" ", over.Lines));
    }

    [Fact]
    public void WithNoDrinksPackageADrinkIsChargedWithTheServiceCharge()
    {
        var a = Ask(MoneyItems.Drink, None, price: 1000, package: "none");
        Assert.Equal(MoneyVerdicts.NotIncluded, a.Verdict);
        Assert.Equal(1000 + 180, a.YouPayCents);
        Assert.Null(Ask(MoneyItems.Drink, None, package: "none").YouPayCents);
    }

    [Fact]
    public void NoPackageEverMakesAlcoholAvailableToSomeoneUnder21()
    {
        foreach (var e in new[] { None, Plus, Premier })
        {
            var a = Ask(MoneyItems.Drink, e, age: 17, price: 900);
            Assert.Equal(MoneyVerdicts.NotIncluded, a.Verdict);
            Assert.Contains("under 21", a.Lines[0]);
        }
        Assert.Equal(MoneyVerdicts.Included, Ask(MoneyItems.Drink, Plus, age: 17, alcohol: false, price: 600).Verdict);
    }

    [Fact]
    public void WifiAndSpecialtyDinnersCountWhatIsLeft()
    {
        Assert.Equal(MoneyVerdicts.Included, Ask(MoneyItems.Wifi, Plus, wifi: 0).Verdict);
        Assert.Contains("1 device", Ask(MoneyItems.Wifi, Plus).Lines[0]);
        Assert.Equal(MoneyVerdicts.AllUsed, Ask(MoneyItems.Wifi, Plus, wifi: 1).Verdict);
        var none = Ask(MoneyItems.Wifi, None, package: "none");
        Assert.Equal(MoneyVerdicts.NotIncluded, none.Verdict);
        Assert.Contains("$19.99", none.Lines[0]);

        Assert.Contains("2 of 2", Ask(MoneyItems.Specialty, Plus).Lines[0]);
        Assert.Contains("1 of 2", Ask(MoneyItems.Specialty, Plus, meals: 1).Lines[0]);
        Assert.Equal(MoneyVerdicts.AllUsed, Ask(MoneyItems.Specialty, Plus, meals: 2).Verdict);
        Assert.Equal(MoneyVerdicts.NotIncluded, Ask(MoneyItems.Specialty, None, package: "none").Verdict);
        Assert.Contains("$45", Ask(MoneyItems.Specialty, None, package: "none").Lines[0]);
    }

    [Fact]
    public void ExcursionCreditGratuityLaundryAndPriorityFollowTheEntitlements()
    {
        Assert.Equal(MoneyVerdicts.NotIncluded, Ask(MoneyItems.Excursion, Plus).Verdict);
        Assert.Equal(MoneyVerdicts.Partly, Ask(MoneyItems.Excursion, Premier, credit: 15_000).Verdict);
        Assert.Contains("$150", Ask(MoneyItems.Excursion, Premier, credit: 15_000).Lines[0]);
        Assert.Equal(MoneyVerdicts.AllUsed, Ask(MoneyItems.Excursion, Premier, credit: 0).Verdict);

        Assert.Equal(MoneyVerdicts.Included, Ask(MoneyItems.Gratuity, Plus).Verdict);
        Assert.Equal(MoneyVerdicts.NotIncluded, Ask(MoneyItems.Gratuity, None, package: "none").Verdict);
        Assert.Equal(MoneyVerdicts.Included, Ask(MoneyItems.Laundry, Premier).Verdict);
        Assert.Equal(MoneyVerdicts.NotIncluded, Ask(MoneyItems.Laundry, Plus).Verdict);
        Assert.Equal(MoneyVerdicts.Included, Ask(MoneyItems.Priority, Premier).Verdict);
        Assert.Equal(MoneyVerdicts.NotIncluded, Ask(MoneyItems.Priority, None, package: "none").Verdict);
    }

    [Fact]
    public void EveryAnswerNamesWhereItCameFromAndCleanItemRejectsAnythingElse()
    {
        foreach (var item in MoneyItems.All) Assert.False(string.IsNullOrWhiteSpace(Ask(item, Plus).Basis));
        Assert.Null(StanleyMoneyRules.CleanItem("anything"));
        Assert.Null(StanleyMoneyRules.CleanItem(null));
        Assert.Equal("wifi", StanleyMoneyRules.CleanItem("wifi"));
    }

    // ---- the spend scenario ----

    private static ScenarioLine Line(long unit, int units = 1, string label = "Drinks package") => new("addOn", "drinks", label, units, unit, unit * units, "basis");

    [Fact]
    public void TheScenarioAddsToWhatIsAlreadyPlannedAndAlwaysSaysItIsIllustrative()
    {
        var r = StanleyMoneyRules.Scenario(new(10_000, 20_000, 5_000), [Line(36_400, 2)], 110_000);
        Assert.Equal(72_800, r.AddedCents);
        Assert.Equal(35_000 + 72_800, r.NewTotalCents);
        Assert.Equal(110_000 - 107_800, r.LeftCents);
        Assert.Equal("near", r.State);
        Assert.True(r.Illustrative);
        Assert.Contains("$1,078", string.Join(" ", r.Lines));
        Assert.Contains(r.NotCounted, x => x.Contains("fare"));
    }

    [Fact]
    public void TheScenarioStatesAreWithinNearOverAndNoBudget()
    {
        MoneyCommitted now = new(0, 0, 0);
        Assert.Equal("within", StanleyMoneyRules.Scenario(now, [Line(10_000)], 100_000).State);
        Assert.Equal("near", StanleyMoneyRules.Scenario(now, [Line(95_000)], 100_000).State);
        var over = StanleyMoneyRules.Scenario(now, [Line(110_000)], 100_000);
        Assert.Equal("over", over.State);
        Assert.Equal(-10_000, over.LeftCents);
        Assert.Contains("$100 over", string.Join(" ", over.Lines));
        var none = StanleyMoneyRules.Scenario(now, [Line(10_000)], null);
        Assert.Equal("noBudget", none.State);
        Assert.Null(none.LeftCents);
        Assert.Contains("not set a budget", string.Join(" ", none.Lines));
    }

    // ---- pace ----

    [Fact]
    public void ThePaceIsAStraightLineFromTheDaysSoFarPlusWhatWasPlanned()
    {
        var p = StanleyMoneyRules.Pace(new(30_000, 5_000, 3, 7, 20_000, 120_000));
        Assert.Equal(70_000, p.ProjectedOnboardCents);
        Assert.Equal(90_000, p.ProjectedTotalCents);
        Assert.Equal("onTrack", p.State);
        Assert.True(p.Illustrative);
        Assert.Contains("$900", string.Join(" ", p.Lines));
        Assert.Contains("illustrative", string.Join(" ", p.Lines));
    }

    [Fact]
    public void ThePaceIsOnTrackNearOrOverAgainstTheBudget()
    {
        Assert.Equal("near", StanleyMoneyRules.Pace(new(30_000, 0, 3, 7, 20_000, 100_000)).State);
        var over = StanleyMoneyRules.Pace(new(30_000, 0, 3, 7, 20_000, 85_000));
        Assert.Equal("over", over.State);
        Assert.Equal(5_000, over.OverCents);
        Assert.Equal("onTrack", StanleyMoneyRules.Pace(new(30_000, 0, 3, 7, 20_000, 200_000)).State);
    }

    [Fact]
    public void ThePaceSaysNothingOfPaceInTheFirstTwoDaysOrWithoutABudget()
    {
        var early = StanleyMoneyRules.Pace(new(30_000, 0, 2, 7, 0, 100_000));
        Assert.Equal("tooEarly", early.State);
        Assert.Null(early.ProjectedTotalCents);
        var none = StanleyMoneyRules.Pace(new(30_000, 0, 4, 7, 0, null));
        Assert.Equal("noBudget", none.State);
        Assert.NotNull(none.ProjectedTotalCents);
        Assert.Null(none.OverCents);
        Assert.Equal("noBudget", StanleyMoneyRules.Pace(new(0, 0, 0, 7, 0, null)).State);
    }

    [Fact]
    public void OnlyANearOrOverPaceInTheMiddleOfTheWeekIsWorthAGentleWord()
    {
        // The onboard spend grows with the day, so the straight-line projection is $900 on every day.
        PaceResult P(string state, int day) => StanleyMoneyRules.Pace(new(10_000L * day, 0, day, 7, 20_000, state == "over" ? 85_000 : 100_000));
        Assert.True(StanleyMoneyRules.PaceAlertWorthy(P("over", 4)));
        Assert.True(StanleyMoneyRules.PaceAlertWorthy(P("near", 6)));
        Assert.False(StanleyMoneyRules.PaceAlertWorthy(P("over", 2)));
        Assert.False(StanleyMoneyRules.PaceAlertWorthy(P("over", 7)));
        Assert.False(StanleyMoneyRules.PaceAlertWorthy(StanleyMoneyRules.Pace(new(40_000, 0, 4, 7, 20_000, 500_000))));
    }

    // ---- the pace card through the phase 11 change engine ----

    private static ChangeFacts Facts(int day, PaceResult? pace) =>
        new(Departure.AddDays(day - 1).ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc), new StanleyTrip(Departure.AddDays(day - 1), Departure, 7, "Sun Princess", "Balcony", "Anytime", [40, 38], [], [], []),
            [], new HashSet<string>(), new HashSet<string>(), [], null, [], null, [], [], pace is null ? null : new SpendSignal(pace));

    /// <summary>The onboard spend grows with the day, so the projection is always $900 (a $700 cruise pace and $200 planned).</summary>
    private static PaceResult Pace(long? budget, int day = 4) => StanleyMoneyRules.Pace(new(10_000L * day, 0, day, 7, 20_000, budget));

    [Fact]
    public void AnOverPaceBecomesOneGentleSuggestionThatIsNeverAnAlert()
    {
        var card = Assert.Single(StanleyChangeRules.Cards(Facts(4, Pace(85_000))));
        Assert.Equal("spend:pace", card.Id);
        Assert.Equal(ChangeKinds.Spend, card.Kind);
        Assert.Equal(ChangeStatus.Forecast, card.Status);
        Assert.Equal(ChangeConsequence.Improvement, card.Consequence);
        Assert.False(card.Critical);
        Assert.True(card.Tip);
        Assert.Null(card.Recommended.Action);
        Assert.Contains("$", card.Title);
        Assert.Contains(ChangeKinds.Spend, ChangeKinds.All);
        Assert.False(StanleyChangeRules.PushWorthy(card));
    }

    [Fact]
    public void ANearPaceIsOptionalAndOnTrackTooEarlyNoBudgetAndTheLastDaysSayNothing()
    {
        Assert.Equal(ChangeConsequence.Optional, Assert.Single(StanleyChangeRules.Cards(Facts(4, Pace(100_000)))).Consequence);
        Assert.Empty(StanleyChangeRules.Cards(Facts(4, Pace(500_000))));
        Assert.Empty(StanleyChangeRules.Cards(Facts(2, Pace(100_000, 2))));
        Assert.Empty(StanleyChangeRules.Cards(Facts(4, Pace(null))));
        Assert.Empty(StanleyChangeRules.Cards(Facts(7, Pace(85_000, 7))));
        Assert.Empty(StanleyChangeRules.Cards(Facts(4, null)));
    }

    [Fact]
    public void ThePaceCardFollowsTheGuestsProactivityAndQuietHoursAndStaysDismissed()
    {
        var over = StanleyChangeRules.Cards(Facts(4, Pace(85_000)));
        Assert.Null(StanleyChangeRules.Deliver(over, ChangeMemory.Empty, "home", "off", [], false).Suggestion);
        var affects = StanleyChangeRules.Deliver(over, ChangeMemory.Empty, "home", "affects", [], false);
        Assert.Null(affects.Suggestion);
        Assert.Contains(affects.Held, h => h.Id == "spend:pace" && h.Reason == "level");
        Assert.Equal("spend:pace", StanleyChangeRules.Deliver(over, ChangeMemory.Empty, "home", "suggest", [], false).Suggestion!.Id);
        Assert.Contains(StanleyChangeRules.Deliver(over, ChangeMemory.Empty, "home", "suggest", [], true).Held, h => h.Reason == "quiet");
        Assert.Contains(StanleyChangeRules.Deliver(over, ChangeMemory.Empty, "plan", "suggest", [], false).Held, h => h.Reason == "screen");

        var near = StanleyChangeRules.Cards(Facts(4, Pace(100_000)));
        Assert.Null(StanleyChangeRules.Deliver(near, ChangeMemory.Empty, "home", "suggest", [], false).Suggestion);
        Assert.NotNull(StanleyChangeRules.Deliver(near, ChangeMemory.Empty, "home", "guide", [], false).Suggestion);

        var dismissed = StanleyChangeRules.Dismiss(ChangeMemory.Empty, over[0]);
        Assert.Contains(StanleyChangeRules.Deliver(over, dismissed, "home", "suggest", [], false).Held, h => h.Reason == "dismissed");
    }

    [Fact]
    public void ADismissedPaceCardReturnsOnlyWhenTheProjectionMovesByMoreThanFiftyDollars()
    {
        PaceResult At(long onboard) => StanleyMoneyRules.Pace(new(onboard, 0, 4, 7, 20_000, 85_000));
        var a = StanleyChangeRules.Cards(Facts(4, At(40_000)))[0];
        var drift = StanleyChangeRules.Cards(Facts(4, At(40_020)))[0];
        var more = StanleyChangeRules.Cards(Facts(4, At(46_000)))[0];
        Assert.Equal(a.Fingerprint, drift.Fingerprint);
        Assert.NotEqual(a.Fingerprint, more.Fingerprint);
    }

    [Fact]
    public void TheBudgetSurvivesTheChangeMemoryBeingUpdated()
    {
        var memory = new ChangeMemory([], null, 150_000);
        var cards = StanleyChangeRules.Cards(Facts(4, Pace(85_000)));
        Assert.Equal(150_000, StanleyChangeRules.Observe(memory, cards, 1000).BudgetCents);
        Assert.Equal(150_000, StanleyChangeRules.CaughtUp(memory, 5).BudgetCents);
        Assert.Equal(150_000, StanleyChangeRules.Dismiss(memory, cards[0]).BudgetCents);
        Assert.True(StanleyMoneyRules.ValidBudget(null));
        Assert.True(StanleyMoneyRules.ValidBudget(1));
        Assert.False(StanleyMoneyRules.ValidBudget(0));
        Assert.False(StanleyMoneyRules.ValidBudget(-5));
        Assert.False(StanleyMoneyRules.ValidBudget(StanleyMoneyRules.MaxBudgetCents + 1));
    }

    // ---- the folio explainer ----

    private static readonly Guid Anna = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly IReadOnlyDictionary<Guid, string> Names = new Dictionary<Guid, string> { [Anna] = "Anna" };

    private static FolioLine L(string id, long cents, string state = FolioStates.Posted, string category = "drinks", long? value = null, string? coveredBy = null, int day = 2, long at = 1000) =>
        new(id, day, at, category, $"Item {id}", Anna, cents, value, coveredBy, state);

    private static FolioExplainDto Explain(IReadOnlyList<FolioLine> lines, int throughDay = 4, IReadOnlyDictionary<string, string>? questioned = null, PaceResult? pace = null) =>
        StanleyMoneyRules.ExplainFolio(lines, Names, questioned ?? new Dictionary<string, string>(), throughDay, 7, 123, pace);

    [Fact]
    public void PostedPendingAndCreditAmountsAreKeptApart()
    {
        var f = Explain([L("a", 1400), L("b", 600), L("c", 2000, FolioStates.Pending), L("d", -5000, category: "credit")]);
        Assert.Equal(2000, f.PostedCents);
        Assert.Equal(2000, f.PendingCents);
        Assert.Equal(5000, f.CreditsCents);
        Assert.Equal(2000, f.Groups.Single(g => g.State == FolioStates.Posted).Cents);
        Assert.Equal(2000, f.Groups.Single(g => g.State == FolioStates.Pending).Cents);
        Assert.Contains("Not final", f.Groups.Single(g => g.State == FolioStates.Pending).Meaning);
        Assert.Contains("Final", f.Groups.Single(g => g.State == FolioStates.Posted).Meaning);
    }

    [Fact]
    public void AQuestionedLineMovesToItsOwnGroupWithItsCaseAndIsNeverShownAsSettled()
    {
        var line = L("a", 1400);
        var f = Explain([line, L("b", 600)], questioned: new Dictionary<string, string> { [StanleyMoneyRules.LineCode("a")] = "GS-ABC234" });
        var group = Assert.Single(f.Groups, g => g.State == FolioStates.Disputed);
        var q = Assert.Single(group.Lines);
        Assert.Equal("GS-ABC234", q.CaseReference);
        Assert.Equal(FolioStates.Disputed, q.State);
        Assert.Equal(600, f.PostedCents);
        Assert.Contains(f.Lines, x => x.Contains("questioned") && x.Contains("cannot say they are settled"));
        Assert.DoesNotContain(f.Lines, x => x.Contains("resolved", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void AnEstimateStaysApartFromPostedAndPendingAndIsLabelledIllustrative()
    {
        var pace = StanleyMoneyRules.Pace(new(30_000, 0, 3, 7, 0, null));
        var f = Explain([L("a", 30_000)], 3, pace: pace);
        Assert.Equal(40_000, f.Estimate!.Cents);
        Assert.True(f.Estimate.Illustrative);
        Assert.Equal(30_000, f.PostedCents);
        Assert.Contains("estimate", f.Estimate.Text);
        Assert.Null(Explain([L("a", 30_000)], 3).Estimate);
    }

    [Fact]
    public void TheFinalExplainerCarriesNoEstimateAndNeverSaysThingsAreSettled()
    {
        var pace = StanleyMoneyRules.Pace(new(60_000, 0, 7, 7, 0, null));
        var f = Explain([L("a", 60_000), L("b", 900, FolioStates.Pending)], 8, pace: pace);
        Assert.True(f.Final);
        Assert.Null(f.Estimate);
        Assert.Contains(f.Lines, x => x.Contains("The cruise is over"));
        Assert.False(Explain([L("a", 1)], 4).Final);
    }

    [Fact]
    public void EachLineSaysWhyItIsThereAndWhatThePackagePaid()
    {
        Assert.Contains("covered by your package", StanleyMoneyRules.Why(L("a", 0, value: 1400, coveredBy: "package")), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("$14", StanleyMoneyRules.Why(L("a", 0, value: 1400, coveredBy: "package")));
        Assert.Contains("you paid $4", StanleyMoneyRules.Why(L("a", 400, value: 1900, coveredBy: "package")));
        Assert.Contains("credit", StanleyMoneyRules.Why(L("a", -5000)), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("18%", StanleyMoneyRules.Why(L("a", 72, category: "tips")));
        Assert.Contains("gratuity", StanleyMoneyRules.Why(L("a", 1800, category: "gratuities")), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ALineCodeIsShortStableAndFitsTheHandoffReferenceField()
    {
        var long_ = $"x-{Anna}-3-1";
        var code = StanleyMoneyRules.LineCode(long_);
        Assert.StartsWith("L-", code);
        Assert.True(code.Length <= 40);
        Assert.Equal(code, StanleyMoneyRules.LineCode(long_));
        Assert.NotEqual(code, StanleyMoneyRules.LineCode(long_ + "x"));
    }

    [Fact]
    public void ADisputeNeedsAConsentAndALineAndItsIssueIsBuiltFromTheAccountNotTheRequest()
    {
        Assert.Equal("line", StanleyMoneyRules.DisputeProblem(null));
        Assert.Equal("line", StanleyMoneyRules.DisputeProblem(new(" ", null, true, null)));
        Assert.Equal("consent", StanleyMoneyRules.DisputeProblem(new("a", null, false, null)));
        Assert.Equal("tooLong", StanleyMoneyRules.DisputeProblem(new("a", new string('x', 301), true, null)));
        Assert.Null(StanleyMoneyRules.DisputeProblem(new("a", "Looks wrong", true, null)));

        var line = Explain([L("a", 1900)]).Groups.SelectMany(g => g.Lines).Single();
        var text = StanleyMoneyRules.DisputeIssue(line, "I did not order this");
        Assert.Contains("Item a", text);
        Assert.Contains("$19", text);
        Assert.Contains("Anna", text);
        Assert.Contains(line.Short, text);
        Assert.EndsWith("I did not order this", text);
        Assert.True(text.Length <= StanleyHandoffRules.IssueMax);
        Assert.Contains("billing", StanleyHandoffRules.Topics);
    }

    // ---- package value ----

    [Fact]
    public void ThePackageComparisonUsesTheChosenUseAndLeavesOutPeopleWhoAreAlreadyCovered()
    {
        var people = new[] { ("Anna", 40, None), ("Ben", 38, None), ("Cleo", 12, None), ("Dan", 40, Plus) };
        var rows = StanleyMoneyRules.PackageValue(people, 40, 7, 4, 0, 0);
        var drinks = Assert.Single(rows);
        Assert.Equal("drinks", drinks.Id);
        Assert.Equal(2, drinks.People);
        var unit = PackageRules.AddOnPrice(PackageRules.AddOn("drinks")!, 40);
        Assert.Equal(unit * 7 * 2, drinks.PackageCents);
        var each = (long)Math.Round(PackageRules.AvgDrink * (1 + PackageRules.ServiceCharge) * 4 * 7, MidpointRounding.AwayFromZero);
        Assert.Equal(each * 2, drinks.PayAsYouGoCents);
        Assert.Equal(drinks.PayAsYouGoCents - drinks.PackageCents, drinks.DifferenceCents);
    }

    [Fact]
    public void ALightUserIsToldThePackageCostsMoreAndAHeavyUserThatItSaves()
    {
        var people = new[] { ("Anna", 40, None) };
        Assert.Equal("notWorth", StanleyMoneyRules.PackageValue(people, 40, 7, 1, 0, 0).Single().Verdict);
        Assert.Equal("worth", StanleyMoneyRules.PackageValue(people, 40, 7, 8, 0, 0).Single().Verdict);
        Assert.Empty(StanleyMoneyRules.PackageValue(people, 40, 7, 0, 0, 0));
        Assert.Contains("Nothing to compare", StanleyMoneyRules.PackageValueLines([])[0]);
        var lines = StanleyMoneyRules.PackageValueLines(StanleyMoneyRules.PackageValue(people, 40, 7, 8, 0, 0));
        Assert.Contains(lines, x => x.Contains("not a prediction"));
    }

    [Fact]
    public void WifiAndSpecialtyAreComparedAtTheDayRateAndTheAverageCover()
    {
        var people = new[] { ("Anna", 40, None) };
        var rows = StanleyMoneyRules.PackageValue(people, 40, 7, 0, 7, 3);
        var wifi = rows.Single(r => r.Id == "wifi");
        Assert.Equal(FolioRules.WifiDayCents * 7, wifi.PayAsYouGoCents);
        var pass = rows.Single(r => r.Id == "specialtyPass");
        Assert.Equal(PackageRules.AvgCover * 3, pass.PayAsYouGoCents);
        Assert.Equal("Specialty dining pass", pass.Name);
    }

    [Fact]
    public void ThePackageUseIsRangeChecked()
    {
        Assert.Equal("use", StanleyMoneyRules.PackageUseProblem(null));
        Assert.Equal("drinks", StanleyMoneyRules.PackageUseProblem(new(13, 0, 0, null, null)));
        Assert.Equal("wifiDays", StanleyMoneyRules.PackageUseProblem(new(0, 31, 0, null, null)));
        Assert.Equal("dinners", StanleyMoneyRules.PackageUseProblem(new(0, 0, 11, null, null)));
        Assert.Null(StanleyMoneyRules.PackageUseProblem(new(12, 30, 10, null, null)));
    }

    // ---- Captain's Circle ----

    private static LoyaltyInput Loyal(bool counted, string before = "ruby", int daysBefore = 28, int nights = 7, IReadOnlyList<(string, long, DateOnly)>? credits = null)
    {
        var status = PostCruiseRules.Loyalty(before, daysBefore, nights, counted);
        return new(status.Before, status.After, status.DaysBefore, status.DaysAfter, status.Next, status.DaysToNext, status.Promoted, counted, nights, credits ?? [], []);
    }

    [Fact]
    public void LoyaltyShowsTheRecordAndWhatWouldFollowAsAnIfNeverAPromise()
    {
        var l = StanleyMoneyRules.Loyalty(Loyal(false), Departure, 1);
        Assert.False(l.Counted);
        Assert.Equal(28, l.Days);
        Assert.Contains(l.Lines, x => x.Contains("28") && x.Contains("Ruby"));
        var ifLine = Assert.Single(l.Lines, x => x.Contains("If Princess counts"));
        Assert.Contains("35", ifLine);
        Assert.Contains("I cannot promise", ifLine);
        Assert.DoesNotContain(l.Lines, x => x.Contains("you will reach", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void LoyaltyCountsTheCruiseOnlyOncePrincessHasCountedIt()
    {
        var l = StanleyMoneyRules.Loyalty(Loyal(true), Departure, 1);
        Assert.True(l.Counted);
        Assert.Equal(35, l.Days);
        Assert.DoesNotContain(l.Lines, x => x.Contains("If Princess counts"));
        Assert.Contains(l.Lines, x => x.Contains("more day") && x.Contains("Platinum"));
    }

    [Fact]
    public void CreditsShowTheirExpiryAndSayWhenOneIsCloseOrGone()
    {
        var credits = new (string, long, DateOnly)[] { ("Refund credit", 25_000, Departure.AddDays(30)), ("Offer", 10_000, Departure.AddDays(200)), ("Old", 5_000, Departure.AddDays(-2)) };
        var l = StanleyMoneyRules.Loyalty(Loyal(true, credits: credits), Departure, 1);
        Assert.Equal(35_000, l.UsableCreditCents);
        Assert.True(l.Credits.Single(c => c.Source == "Refund credit").ExpiresSoon);
        Assert.False(l.Credits.Single(c => c.Source == "Offer").ExpiresSoon);
        Assert.True(l.Credits.Single(c => c.Source == "Old").Expired);
        Assert.Contains(l.Lines, x => x.Contains("$250") && x.Contains("in 30 days"));
        Assert.Contains(l.Lines, x => x.Contains("$50") && x.Contains("expired"));
        Assert.Contains(l.Lines, x => x.Contains("Nothing on the record changes"));
    }

    // ---- what the chat takes ----

    [Theory]
    [InlineData("Is a $19 cocktail included for me?", "entitlement")]
    [InlineData("is my wifi covered", "entitlement")]
    [InlineData("Is dinner at Crown Grill included for Anna?", "entitlement")]
    [InlineData("do we get free laundry", "entitlement")]
    [InlineData("explain my bill", "bill")]
    [InlineData("how much do we owe", "bill")]
    [InlineData("what's pending on our account", "bill")]
    [InlineData("I want to dispute a charge", "bill")]
    [InlineData("am I over my budget", "pace")]
    [InlineData("are we on track with spending for our budget", "pace")]
    [InlineData("what is my Captain's Circle status", "loyalty")]
    [InlineData("when do my future cruise credits expire", "loyalty")]
    [InlineData("is the drinks package worth it", "packages")]
    [InlineData("what will the family total be if we book it", "spend")]
    public void MoneyQuestionsAreRecognised(string message, string kind) => Assert.Equal(kind, StanleyMoneyRules.Classify(message));

    [Theory]
    [InlineData("Does the tour include dinner?")]
    [InlineData("what is a good budget for excursions in Cozumel")]
    [InlineData("do I need a visa for Mexico")]
    [InlineData("Is travel insurance included in the fare?")]
    [InlineData("when is all aboard")]
    [InlineData("what time does the show start")]
    [InlineData("")]
    public void OtherQuestionsAreLeftToTheOtherRoutes(string message) => Assert.Null(StanleyMoneyRules.Classify(message));

    [Fact]
    public void TheQuestionNamesTheItemThePriceThePersonAndWhetherItIsAlcohol()
    {
        Assert.Equal(MoneyItems.Drink, StanleyMoneyRules.ItemOf("is a cocktail included"));
        Assert.Equal(MoneyItems.Wifi, StanleyMoneyRules.ItemOf("is wi-fi free"));
        Assert.Equal(MoneyItems.Specialty, StanleyMoneyRules.ItemOf("is Sabatini's dinner covered"));
        Assert.Equal(MoneyItems.Excursion, StanleyMoneyRules.ItemOf("is my excursion credit enough"));
        Assert.Null(StanleyMoneyRules.ItemOf("is it free"));
        Assert.Equal(1900, StanleyMoneyRules.PriceOf("is a $19 cocktail included"));
        Assert.Equal(1950, StanleyMoneyRules.PriceOf("is a $19.50 cocktail included"));
        Assert.Null(StanleyMoneyRules.PriceOf("is a cocktail included"));
        Assert.Null(StanleyMoneyRules.PriceOf("is a $0 cocktail included"));
        Assert.True(StanleyMoneyRules.MeansAlcohol("is wine included"));
        Assert.False(StanleyMoneyRules.MeansAlcohol("is coffee included"));
        Assert.True(StanleyMoneyRules.MeansEveryone("is wifi included for the kids"));
        Assert.Equal("Ben", StanleyMoneyRules.NameIn("is wifi included for ben", ["Anna", "Ben"]));
        Assert.Null(StanleyMoneyRules.NameIn("is wifi included for me", ["Anna", "Ben"]));
    }

    [Fact]
    public void MoneyIsShownWithItsSignAndOnlyShowsCentsWhenThereAreSome()
    {
        Assert.Equal("$45", StanleyMoneyRules.Money(4500));
        Assert.Equal("$4.72", StanleyMoneyRules.Money(472));
        Assert.Equal("$1,078", StanleyMoneyRules.Money(107_800));
        Assert.Equal("-$20", StanleyMoneyRules.Money(-2000));
        Assert.Equal("$0", StanleyMoneyRules.Money(0));
    }

    // ---- acceptance: all numbers come from services, so no model can change a figure ----

    private static readonly Regex Amount = new(@"-?\$[\d,]+(?:\.\d{2})?", RegexOptions.CultureInvariant);

    private static IEnumerable<long> Amounts(IEnumerable<string> lines) =>
        lines.SelectMany(l => Amount.Matches(l).Select(m => (long)Math.Round(decimal.Parse(m.Value.Replace("$", "").Replace(",", ""), CultureInfo.InvariantCulture) * 100m)));

    [Fact]
    public void EveryAmountOnAScenarioCardIsOneTheRulesWorkedOut()
    {
        MoneyCommitted now = new(10_000, 20_000, 5_000);
        var r = StanleyMoneyRules.Scenario(now, [Line(36_400, 2)], 120_000);
        var allowed = new HashSet<long> { now.Packages, now.Tours, now.Dining, now.Total, 36_400, 72_800, r.NewTotalCents, r.LeftCents!.Value, 120_000 };
        foreach (var a in Amounts(StanleyMoneyRules.ScenarioCard(r, DateTime.UtcNow).Lines)) Assert.Contains(Math.Abs(a), allowed.Select(x => Math.Abs(x)));
    }

    [Fact]
    public void EveryAmountOnAPaceCardIsOneTheRulesWorkedOut()
    {
        var p = StanleyMoneyRules.Pace(new(30_000, 5_000, 3, 7, 20_000, 85_000));
        var allowed = new HashSet<long> { 30_000, 5_000, 20_000, 85_000, p.ProjectedTotalCents!.Value, p.OverCents!.Value };
        foreach (var a in Amounts(StanleyMoneyRules.PaceCard(p, DateTime.UtcNow).Lines)) Assert.Contains(a, allowed);
    }

    [Fact]
    public void EveryAmountOnABillCardIsOneTheAccountOrTheRulesProduced()
    {
        var lines = new[] { L("a", 1400), L("b", 600, FolioStates.Pending), L("c", -5000, category: "credit"), L("d", 0, value: 1900, coveredBy: "package") };
        var f = Explain(lines, 3, pace: StanleyMoneyRules.Pace(new(2000, 600, 3, 7, 0, null)));
        var allowed = new HashSet<long> { 1400, 600, 5000, 1900, f.PostedCents, f.PendingCents, f.CreditsCents, f.CoveredCents, f.Estimate!.Cents, 0 };
        foreach (var g in f.Groups) allowed.Add(g.Cents);
        foreach (var a in Amounts(StanleyMoneyRules.BillCard(f, DateTime.UtcNow).Lines)) Assert.Contains(Math.Abs(a), allowed);
        Assert.Equal(1900, f.CoveredCents);
    }

    [Fact]
    public void EveryAmountOnAnEntitlementAndALoyaltyCardComesFromTheEntitlementsAndTheRecord()
    {
        var a = Ask(MoneyItems.Drink, Plus, price: 1900);
        var allowed = new HashSet<long> { 1900, 1500, 400, 472 };
        foreach (var x in Amounts(StanleyMoneyRules.EntitlementCard([a], DateTime.UtcNow).Lines)) Assert.Contains(x, allowed);

        var credits = new (string, long, DateOnly)[] { ("Offer", 10_000, Departure.AddDays(30)) };
        var l = StanleyMoneyRules.Loyalty(Loyal(true, credits: credits), Departure, 1);
        foreach (var x in Amounts(StanleyMoneyRules.LoyaltyCard(l, DateTime.UtcNow).Lines)) Assert.Equal(10_000, x);
    }

    [Fact]
    public void AMoneyCardIsAlwaysAResolverCardWithProvenanceAndAnIllustrationSaysSo()
    {
        var now = DateTime.UtcNow;
        var cards = new[]
        {
            StanleyMoneyRules.EntitlementCard([Ask(MoneyItems.Wifi, Plus)], now),
            StanleyMoneyRules.ScenarioCard(StanleyMoneyRules.Scenario(new(0, 0, 0), [Line(1000)], null), now),
            StanleyMoneyRules.PaceCard(StanleyMoneyRules.Pace(new(30_000, 0, 3, 7, 0, 90_000)), now),
            StanleyMoneyRules.PackagesCard([], StanleyMoneyRules.PackageValueLines([]), now),
            StanleyMoneyRules.UnreadCard(now),
        };
        foreach (var c in cards)
        {
            Assert.Equal("money", c.Id);
            Assert.NotEmpty(c.Provenance.Owner);
            Assert.NotNull(c.Links);
        }
        Assert.Contains(StanleyChips.Estimated, cards[1].Provenance.Chips);
        Assert.Contains(StanleyChips.Estimated, cards[2].Provenance.Chips);
        Assert.Equal("estimated", cards[2].Provenance.Freshness);
        Assert.True(cards[4].Abstained);
        Assert.Empty(Amount.Matches(string.Join(" ", cards[4].Lines)));
    }
}
