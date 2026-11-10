using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 6: when Stanley may put a suggestion card in the guest's permanent chat.</summary>
public class ChatProactiveRulesTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 15, 0, 0, DateTimeKind.Utc);

    private static MomentFacts Facts(string stage = StageRules.Prebook, int days = 10, bool owing = false, DateOnly? due = null) => new(Now, stage, days, owing, due);
    private static MomentContext Ctx(string mode = ChatProactiveRules.ModeGuide, bool held = false, bool supervised = false, params string[] off) => new(mode, off, held, supervised);
    private static Moment M(string key, string topic, string cls = ChatProactiveRules.ClassSuggestion, string facts = "f", DateTime? expires = null) =>
        new(key, topic, cls, "Text", "/home", expires ?? Now.AddDays(1), ChatProactiveRules.Hash(facts));

    [Theory]
    [InlineData(null, ChatProactiveRules.ModeTrip)]
    [InlineData("asked", ChatProactiveRules.ModeTrip)]
    [InlineData("helpful", ChatProactiveRules.ModeSuggest)]
    [InlineData("chatty", ChatProactiveRules.ModeGuide)]
    [InlineData("off", ChatProactiveRules.ModeOff)]
    public void TheStanleyLevelGivesTheMode(string? level, string mode) => Assert.Equal(mode, ChatProactiveRules.ModeOf(level));

    [Fact]
    public void AModeAllowsOnlyItsClasses()
    {
        Assert.True(ChatProactiveRules.ModeAllows(ChatProactiveRules.ModeTrip, ChatProactiveRules.ClassDue));
        Assert.False(ChatProactiveRules.ModeAllows(ChatProactiveRules.ModeTrip, ChatProactiveRules.ClassSuggestion));
        Assert.True(ChatProactiveRules.ModeAllows(ChatProactiveRules.ModeSuggest, ChatProactiveRules.ClassSuggestion));
        Assert.False(ChatProactiveRules.ModeAllows(ChatProactiveRules.ModeSuggest, ChatProactiveRules.ClassGuide));
        Assert.True(ChatProactiveRules.ModeAllows(ChatProactiveRules.ModeGuide, ChatProactiveRules.ClassGuide));
        Assert.False(ChatProactiveRules.ModeAllows(ChatProactiveRules.ModeOff, ChatProactiveRules.ClassDue));
    }

    [Fact]
    public void TheFinalPaymentIsOfferedOnlyInTheLastFortnightAndWhenSomethingIsOwed()
    {
        var due = DateOnly.FromDateTime(Now).AddDays(5);
        var m = Assert.Single(ChatProactiveRules.Candidates(Facts(owing: true, due: due)), c => c.Key == "finalPayment");
        Assert.Contains("due in 5 days", m.Text);
        Assert.Equal(ChatProactiveRules.ClassDue, m.Class);
        Assert.DoesNotContain(ChatProactiveRules.Candidates(Facts(owing: false, due: due)), c => c.Key == "finalPayment");
        Assert.DoesNotContain(ChatProactiveRules.Candidates(Facts(owing: true, due: DateOnly.FromDateTime(Now).AddDays(30))), c => c.Key == "finalPayment");
        Assert.DoesNotContain(ChatProactiveRules.Candidates(Facts(owing: true, due: DateOnly.FromDateTime(Now).AddDays(-1))), c => c.Key == "finalPayment");
    }

    [Fact]
    public void NoCardCarriesAPriceACabinOrAnAmountAndThePushSaysOnlyThatThereIsASuggestion()
    {
        var all = ChatProactiveRules.Candidates(Facts(owing: true, due: DateOnly.FromDateTime(Now).AddDays(2)));
        Assert.NotEmpty(all);
        foreach (var m in all)
        {
            Assert.DoesNotContain("$", m.Text);
            Assert.DoesNotContain("cabin", m.Text, StringComparison.OrdinalIgnoreCase);
        }
        Assert.Equal("Stanley has a suggestion", ChatProactiveRules.PushText);
    }

    [Fact]
    public void OffAndSupervisedAndHeldPostNothing()
    {
        var c = new[] { M("a", "planning") };
        Assert.Null(ChatProactiveRules.Choose(c, [], Ctx(ChatProactiveRules.ModeOff), Now));
        Assert.Null(ChatProactiveRules.Choose(c, [], Ctx(supervised: true), Now));
        Assert.Null(ChatProactiveRules.Choose(c, [], Ctx(held: true), Now));   // quiet hours or do-not-disturb
        Assert.NotNull(ChatProactiveRules.Choose(c, [], Ctx(), Now));
    }

    [Fact]
    public void TheModeAndTheTopicFilterTheChoice()
    {
        var c = new[] { M("a", "planning"), M("b", "steps", ChatProactiveRules.ClassGuide) };
        Assert.Equal("a", ChatProactiveRules.Choose(c, [], Ctx(ChatProactiveRules.ModeSuggest), Now)?.Key);
        Assert.Null(ChatProactiveRules.Choose(c, [], Ctx(ChatProactiveRules.ModeTrip), Now));
        Assert.Equal("b", ChatProactiveRules.Choose(c, [], Ctx(off: "planning"), Now)?.Key);
        Assert.Null(ChatProactiveRules.Choose(c, [], Ctx(off: ["planning", "steps"]), Now));
    }

    [Fact]
    public void DueComesBeforeAGuideStepBeforeASuggestion()
    {
        var c = new[] { M("s", "planning"), M("g", "steps", ChatProactiveRules.ClassGuide), M("d", "payment", ChatProactiveRules.ClassDue) };
        Assert.Equal("d", ChatProactiveRules.Choose(c, [], Ctx(), Now)?.Key);
        Assert.Equal("g", ChatProactiveRules.Choose([c[0], c[1]], [], Ctx(), Now)?.Key);
    }

    [Fact]
    public void OnlyOneCardIsOnScreenAtATime()
    {
        var open = new MomentHistory("a", "planning", Now.AddHours(-1), Now.AddDays(1), null, null, ChatProactiveRules.Hash("f"));
        Assert.Null(ChatProactiveRules.Choose([M("b", "packing")], [open], Ctx(), Now));
        // Put away, snoozed or expired, it no longer holds the place.
        Assert.NotNull(ChatProactiveRules.Choose([M("b", "packing")], [open with { DismissedAt = Now }], Ctx(), Now));
        Assert.NotNull(ChatProactiveRules.Choose([M("b", "packing")], [open with { SnoozedUntil = Now.AddHours(20) }], Ctx(), Now));
        Assert.NotNull(ChatProactiveRules.Choose([M("b", "packing")], [open with { ExpiresAt = Now.AddMinutes(-1) }], Ctx(), Now));
    }

    [Fact]
    public void ThreeNewSuggestionsADayAndADueCardIsOutsideTheCap()
    {
        MomentHistory Posted(string k, string topic) => new(k, topic, Now.AddHours(-2), Now.AddHours(-1), null, null, ChatProactiveRules.Hash("x"));
        var today = new[] { Posted("a", "planning"), Posted("b", "packing"), Posted("c", "steps") };
        Assert.Null(ChatProactiveRules.Choose([M("d", "planning")], today, Ctx(), Now));
        Assert.Equal("p", ChatProactiveRules.Choose([M("d", "planning"), M("p", "payment", ChatProactiveRules.ClassDue)], today, Ctx(), Now)?.Key);
        // Yesterday's cards do not count.
        Assert.NotNull(ChatProactiveRules.Choose([M("d", "planning")], [.. today.Select(h => h with { PostedAt = Now.AddDays(-1) })], Ctx(), Now));
    }

    [Fact]
    public void DontShowAgainHoldsUntilTheFactsChange()
    {
        var gone = new MomentHistory("finalPayment", "payment", Now.AddDays(-2), Now.AddDays(-1), Now.AddDays(-1), null, ChatProactiveRules.Hash("2026-11-20"));
        Assert.Null(ChatProactiveRules.Choose([M("finalPayment", "payment", ChatProactiveRules.ClassDue, "2026-11-20")], [gone], Ctx(), Now));
        Assert.Equal("finalPayment", ChatProactiveRules.Choose([M("finalPayment", "payment", ChatProactiveRules.ClassDue, "2026-11-25")], [gone], Ctx(), Now)?.Key);   // a new due date
    }

    [Fact]
    public void NotNowReturnsAfterTheSnoozeAndNotBefore()
    {
        var snoozed = new MomentHistory("a", "planning", Now.AddDays(-1), Now.AddDays(1), null, Now.AddHours(3), ChatProactiveRules.Hash("f"));
        Assert.Null(ChatProactiveRules.Choose([M("a", "planning")], [snoozed], Ctx(), Now));
        Assert.Equal("a", ChatProactiveRules.Choose([M("a", "planning")], [snoozed with { SnoozedUntil = Now.AddMinutes(-1) }], Ctx(), Now)?.Key);
    }

    [Fact]
    public void AMomentNeverRepeatsWhileItsCardIsStillOpenOrExpiredWithUnchangedFacts()
    {
        var posted = new MomentHistory("a", "planning", Now.AddDays(-5), Now.AddDays(-2), null, null, ChatProactiveRules.Hash("f"));
        Assert.Null(ChatProactiveRules.Choose([M("a", "planning", facts: "f")], [posted], Ctx(), Now));
        Assert.Equal("a", ChatProactiveRules.Choose([M("a", "planning", facts: "g")], [posted], Ctx(), Now)?.Key);
    }

    [Fact]
    public void AnExpiredMomentIsNeverPosted() =>
        Assert.Null(ChatProactiveRules.Choose([M("a", "planning", expires: Now.AddMinutes(-1))], [], Ctx(), Now));

    [Fact]
    public void ACardIsOnePerMomentAndDayAndItsKeyComesBack()
    {
        var n = ChatProactiveRules.ToNotice(M("planAhead", "planning"), Now);
        Assert.Equal("moment:planAhead:20261110", n.Key);
        Assert.Equal(ChatProactiveRules.Lane, n.Lane);
        Assert.Equal("moment:planAhead", n.SupersedeKey);
        Assert.Equal("planAhead", ChatProactiveRules.KeyOf(n.Key));
        Assert.Null(ChatProactiveRules.KeyOf("muster:20261110"));
        Assert.Null(ChatProactiveRules.KeyOf(null));
    }

    [Fact]
    public void ASuggestionOffersNoRepliesAndNoGotIt()
    {
        Assert.Empty(StanleyNoticeRules.RepliesOf(ChatProactiveRules.Lane));
        Assert.Equal(ChatUrgencyRules.Normal, ChatProactiveRules.ToNotice(M("a", "planning"), Now).Urgency);
    }

    [Fact]
    public void OnlyKnownTopicsAndActionsAreAccepted()
    {
        Assert.True(ChatProactiveRules.ValidTopics(["payment", "packing"]));
        Assert.False(ChatProactiveRules.ValidTopics(["payment", "nonsense"]));
        Assert.True(ChatProactiveRules.ValidAction("snooze"));
        Assert.True(ChatProactiveRules.ValidAction("dismiss"));
        Assert.False(ChatProactiveRules.ValidAction("delete"));
        Assert.False(ChatProactiveRules.ValidAction(null));
    }
}
