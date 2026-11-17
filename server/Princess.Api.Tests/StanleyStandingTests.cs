using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Standing rules, the availability watch, practice mode and plain-words control (phase P9a).</summary>
public class StanleyStandingTests
{
    private static readonly string[] AllRows = ["CL-02", "CL-05", "CL-07"];

    private static StandingFacts Facts(int day = 3, IReadOnlyList<StandingChange>? changes = null, Func<string, int>? tour = null, Func<string, int, string, int>? tables = null, IEnumerable<string>? rows = null) =>
        new(day, new DateOnly(2027, 3, 23), new DateTime(2027, 3, 23, 12, 0, 0, DateTimeKind.Utc), null!, [], [new StanleyItem(3, "Crown Grill", "20:00")], "notOpen", DateTime.MaxValue,
            changes ?? [], tour ?? (_ => 0), tables ?? ((_, _, _) => 0), new HashSet<string>(rows ?? AllRows));

    private static StandingDoc Doc(params StandingRule[] r) => new([.. r]);

    [Fact]
    public void ARuleNeedsAKnownTemplateAndItsOwnParameters()
    {
        Assert.Equal("template", Problem(new(null, null, null, null, null)));
        Assert.Equal("time", Problem(new("RUL-02", null, null, "03:00", null)));
        Assert.Equal("day", Problem(new("RUL-06", null, 99, null, null)));
        Assert.Equal("target", Problem(new("RUL-05", "eclipse", 2, null, null)));
        Assert.Equal("target", Problem(new("VAL-03", "nowhere", null, null, null)));
        Assert.NotNull(StanleyStandingRules.Make(new(), new("RUL-02", null, null, "20:00", null), 7, "a", out _));
    }

    [Fact]
    public void TenRulesIsTheLimitAndTheSameRuleCannotBeMadeTwice()
    {
        var doc = Doc([.. Enumerable.Range(1, 10).Select(i => new StandingRule($"r{i}", "RUL-03", false))]);
        StanleyStandingRules.Make(doc, new("RUL-03", null, null, null, null), 7, "x", out var problem);
        Assert.Equal("full", problem);
        StanleyStandingRules.Make(Doc(new StandingRule("a", "RUL-03", false)), new("RUL-03", null, null, null, null), 7, "b", out problem);
        Assert.Equal("duplicate", problem);
    }

    private static string? Problem(StandingRequest r) { StanleyStandingRules.Make(new(), r, 7, "x", out var p); return p; }

    [Fact]
    public void AWatchSpeaksOnlyWhenPlacesGoFromNoneToSome()
    {
        var rule = new StandingRule("w", "VAL-03", false, "rtb-zip", 0, "", -1);
        var (none, afterFirst, _) = StanleyStandingRules.Evaluate(Doc(rule), Facts(tour: _ => 0));
        Assert.Empty(none);
        Assert.Equal(0, afterFirst.Single().Seen);
        var (opened, afterOpen, _) = StanleyStandingRules.Evaluate(Doc(afterFirst.Single()), Facts(tour: _ => 4));
        Assert.Equal("prepared", opened.Single().Kind);
        Assert.Contains("not holding it", opened.Single().Detail);
        Assert.Equal(-2, afterOpen.Single().Seen);
        Assert.Single(StanleyStandingRules.Evaluate(Doc(afterOpen.Single()), Facts(tour: _ => 4)).Items);
        Assert.Empty(StanleyStandingRules.Evaluate(Doc(rule with { Seen = -1 }), Facts(tour: _ => 4)).Items);
    }

    [Fact]
    public void ARuleInPracticeListsWhatItWouldHaveOfferedAndOffersNothing()
    {
        var rule = new StandingRule("w", "VAL-03", true, "rtb-zip", 0, "", 0);
        var (items, _, _) = StanleyStandingRules.Evaluate(Doc(rule), Facts(tour: _ => 4));
        var (shown, practice, _) = StanleyStandingRules.Limit(items);
        Assert.Empty(shown);
        Assert.Equal("would", practice.Single().Kind);
    }

    [Fact]
    public void ARuleWhosePermissionIsOffDoesNothing()
    {
        var rule = new StandingRule("w", "VAL-03", false, "rtb-zip", 0, "", 0);
        Assert.Empty(StanleyStandingRules.Evaluate(Doc(rule), Facts(tour: _ => 4, rows: ["CL-02"])).Items);
        Assert.Equal("needsPermission", StanleyStandingRules.View(Doc(rule), new HashSet<string> { "CL-02" }).Single().State);
    }

    [Fact]
    public void ADinnerRuleSaysWhetherTheDinnerStillMatchesAndNeverMovesIt()
    {
        var change = new StandingChange("c1", ChangeKinds.Itinerary, 3, "The show moved", ChangeConsequence.Conflict, false, []);
        var keep = new StandingRule("d", "RUL-02", false, "", 0, "20:00");
        Assert.Equal("notice", StanleyStandingRules.Evaluate(Doc(keep), Facts(changes: [change])).Items.Single().Kind);
        var cannot = StanleyStandingRules.Evaluate(Doc(keep with { Time = "19:00" }), Facts(changes: [change])).Items.Single();
        Assert.Equal("prepared", cannot.Kind);
        Assert.Contains("cannot keep", cannot.Title);
    }

    [Fact]
    public void FormalNightReminderComesTheNightBefore()
    {
        var rule = new StandingRule("f", "RUL-06", false, "", 4);
        Assert.Single(StanleyStandingRules.Evaluate(Doc(rule), Facts(day: 3)).Items);
        Assert.Empty(StanleyStandingRules.Evaluate(Doc(rule), Facts(day: 2)).Items);
    }

    [Fact]
    public void OnlyFivePreparedItemsAreShownAndTheRestAreCounted()
    {
        var items = Enumerable.Range(1, 7).Select(i => new StandingItem($"i{i}", "r", "VAL-03", "prepared", false, "t", "d", "/x")).ToList();
        var (shown, _, rolled) = StanleyStandingRules.Limit(items);
        Assert.Equal((5, 2), (shown.Count, rolled));
    }

    [Theory]
    [InlineData("Stop booking dinners", "stop-dinners")]
    [InlineData("be more careful!", "more-careful")]
    [InlineData("Do more", "do-more")]
    [InlineData("Pause everything for today", "pause-today")]
    [InlineData("Undo everything you did today", "undo-today")]
    [InlineData("Why did you do that?", "why-last")]
    public void SixSentencesMapToSixControls(string text, string id) => Assert.Equal(id, StanleyControlRules.Read(text));

    [Theory]
    [InlineData("book me a dinner")]
    [InlineData("")]
    public void AnythingElseIsNotUnderstoodAndListsWhatIsUnderstood(string text)
    {
        var p = StanleyControlRules.Propose(text, 2);
        Assert.False(p.Understood);
        Assert.Equal(6, p.Examples.Count);
    }

    [Fact]
    public void ControlsThatChangeSomethingNeedAConfirmAndDoMoreNeverSwitchesAnythingOn()
    {
        Assert.True(StanleyControlRules.Propose("pause everything", 2).NeedsConfirm);
        Assert.False(StanleyControlRules.Propose("do more", 2).NeedsConfirm);
        Assert.False(StanleyControlRules.Propose("be more careful", 1).NeedsConfirm);
    }

    [Fact]
    public void ThePaceAnswerMovesSuggestionsButNeverALevel()
    {
        var two = new[] { new LedgerTally("reserve_dinner", false), new LedgerTally("reserve_dinner", false) };
        Assert.Empty(StanleyTripSoFarRules.Suggestions(two));
        Assert.Single(StanleyTripSoFarRules.Suggestions(two, "more"));
        var three = two.Append(new LedgerTally("reserve_dinner", false)).ToList();
        Assert.Empty(StanleyTripSoFarRules.Suggestions(three, "less"));
        Assert.Single(StanleyTripSoFarRules.Suggestions(three, "same"));
    }
}
