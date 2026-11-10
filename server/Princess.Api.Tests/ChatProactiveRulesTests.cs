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

public class BeforeBookingMomentTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 15, 0, 0, DateTimeKind.Utc);
    private static MomentFacts F(string stage, int saved = 0, int cabins = 0, bool price = false, bool deposit = false) => new(Now, stage, 0, false, null, saved, cabins, price, deposit);
    private static string[] Keys(MomentFacts f) => [.. ChatProactiveRules.Candidates(f).Select(m => m.Key)];

    [Fact]
    public void ADreamerWithNothingSavedIsOfferedTheFirstLookAndNothingElse() => Assert.Equal(["dream.first-look"], Keys(F(StageRules.Dream)));

    [Fact]
    public void TwoSavedSailingsOfferACompareAndStopTheFirstLook()
    {
        Assert.Contains("dream.compare", Keys(F(StageRules.Discover, saved: 2)));
        Assert.DoesNotContain("dream.compare", Keys(F(StageRules.Discover, saved: 1)));
        Assert.DoesNotContain("dream.first-look", Keys(F(StageRules.Dream, saved: 2)));
    }

    [Fact]
    public void CabinHelpNeedsThreeCabinViewsAndTheCostCardNeedsAPriceView()
    {
        Assert.Contains("discover.cabin-help", Keys(F(StageRules.Discover, cabins: 3)));
        Assert.DoesNotContain("discover.cabin-help", Keys(F(StageRules.Discover, cabins: 2)));
        Assert.Contains("discover.true-cost", Keys(F(StageRules.Discover, price: true)));
        Assert.DoesNotContain("discover.true-cost", Keys(F(StageRules.Dream, price: true)));
    }

    [Fact]
    public void AnUnpaidDepositIsADueCardThatIsNotCountedInTheDailyCap()
    {
        var m = Assert.Single(ChatProactiveRules.Candidates(F(StageRules.Manage, deposit: true)), c => c.Key == "book.pay-deposit");
        Assert.Equal(ChatProactiveRules.ClassDue, m.Class);
        Assert.Equal(ChatProactiveRules.Payment, m.Topic);
        Assert.DoesNotContain(ChatProactiveRules.Candidates(F(StageRules.Manage)), c => c.Key == "book.pay-deposit");
    }

    [Fact]
    public void EveryNewCardHasAKnownTopicAnExpiryAnExistingScreenAndNoAmount()
    {
        var all = ChatProactiveRules.Candidates(F(StageRules.Discover, saved: 2, cabins: 3, price: true, deposit: true))
            .Concat(ChatProactiveRules.Candidates(F(StageRules.Dream)));
        foreach (var m in all)
        {
            Assert.Contains(m.Topic, ChatProactiveRules.Topics);
            Assert.NotNull(m.ExpiresAt);
            Assert.StartsWith("/", m.Path);
            Assert.DoesNotContain("$", m.Text);
        }
    }

    [Fact]
    public void ATripOnlyGuestSeesTheDepositButNotTheSuggestions()
    {
        var facts = F(StageRules.Discover, saved: 2, deposit: true);
        var ctx = new MomentContext(ChatProactiveRules.ModeTrip, [], false, false);
        Assert.Equal("book.pay-deposit", ChatProactiveRules.Choose(ChatProactiveRules.Candidates(facts), [], ctx, Now)?.Key);
        Assert.Null(ChatProactiveRules.Choose(ChatProactiveRules.Candidates(F(StageRules.Discover, saved: 2)), [], ctx, Now));
    }

    [Fact]
    public void TheDiscoveryTopicCanBeSwitchedOff()
    {
        Assert.True(ChatProactiveRules.ValidTopics(["discovery"]));
        var ctx = new MomentContext(ChatProactiveRules.ModeGuide, ["discovery"], false, false);
        Assert.Null(ChatProactiveRules.Choose(ChatProactiveRules.Candidates(F(StageRules.Dream)), [], ctx, Now));
    }

    [Fact]
    public void ACardKeyWithADotStillMapsBackToItsMoment() =>
        Assert.Equal("dream.first-look", ChatProactiveRules.KeyOf("moment:dream.first-look:20261110"));
}

public class ManageToBoardingMomentTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 15, 0, 0, DateTimeKind.Utc);
    private static string[] Keys(string stage, int docs = 0, bool open = false) =>
        [.. ChatProactiveRules.Candidates(new(Now, stage, 3, false, null, DocumentsMissing: docs, CheckinOpen: open)).Select(m => m.Key)];

    [Fact]
    public void MissingDocumentsAreOfferedOnlyBetweenManageAndBoarding()
    {
        Assert.Contains("manage.documents", Keys(StageRules.Manage, docs: 2));
        Assert.Contains("manage.documents", Keys(StageRules.GetToShip, docs: 1));
        Assert.DoesNotContain("manage.documents", Keys(StageRules.Manage));
        Assert.DoesNotContain("manage.documents", Keys(StageRules.Sea, docs: 2));
    }

    [Fact]
    public void CheckinOpenIsOfferedOnlyWhenOpenAndBeforeBoarding()
    {
        Assert.Contains("getship.checkin-open", Keys(StageRules.GetToShip, open: true));
        Assert.DoesNotContain("getship.checkin-open", Keys(StageRules.GetToShip));
        Assert.DoesNotContain("getship.checkin-open", Keys(StageRules.Embark, open: true));
    }

    [Fact]
    public void BothAreDueCardsOnTheTravelTopicWithNoNamesOrNumbers()
    {
        foreach (var m in ChatProactiveRules.Candidates(new(Now, StageRules.GetToShip, 3, false, null, DocumentsMissing: 3, CheckinOpen: true)).Where(c => c.Topic == ChatProactiveRules.Travel))
        {
            Assert.Equal(ChatProactiveRules.ClassDue, m.Class);
            Assert.DoesNotContain("3", m.Text);
            Assert.StartsWith("/", m.Path);
        }
        Assert.True(ChatProactiveRules.ValidTopics(["travel"]));
    }

    [Fact]
    public void TheTravelTopicCanBeSwitchedOff() =>
        Assert.Null(ChatProactiveRules.Choose([.. ChatProactiveRules.ManageToBoarding(new(Now, StageRules.Manage, 30, false, null, DocumentsMissing: 1))], [], new(ChatProactiveRules.ModeTrip, ["travel"], false, false), Now));

    private static List<string> AboardKeys(string stage, bool muster = false, bool lastDay = false) =>
        [.. ChatProactiveRules.Candidates(new(Now, stage, 0, false, null, MusterPending: muster, LastFullDay: lastDay)).Where(c => c.Topic == ChatProactiveRules.Onboard).Select(c => c.Key)];

    [Fact]
    public void EachAboardStageGetsItsOwnMoments()
    {
        Assert.Equal(["embark.find-friends", "embark.first-night"], AboardKeys(StageRules.Embark).Order().ToList());
        Assert.Equal(["sea.today"], AboardKeys(StageRules.Sea));
        Assert.Equal(["port.all-aboard"], AboardKeys(StageRules.Port));
        Assert.Equal(["leave.exit-time", "leave.swap-contacts"], AboardKeys(StageRules.Disembark).Order().ToList());
        Assert.Empty(AboardKeys(StageRules.Remember));
    }

    [Fact]
    public void MusterAndBagNightNeedTheirFacts()
    {
        Assert.Contains("embark.muster", AboardKeys(StageRules.Embark, muster: true));
        Assert.DoesNotContain("embark.muster", AboardKeys(StageRules.Embark));
        Assert.Contains("sea.bag-night", AboardKeys(StageRules.Sea, lastDay: true));
        Assert.DoesNotContain("sea.bag-night", AboardKeys(StageRules.Sea));
    }

    [Fact]
    public void AboardCardsCarryNoTimeOrNumberAndOpenAScreen()
    {
        foreach (var m in ChatProactiveRules.AboardToDisembark(new(Now, StageRules.Embark, 0, false, null, MusterPending: true)).Concat(ChatProactiveRules.AboardToDisembark(new(Now, StageRules.Port, 0, false, null))))
        {
            Assert.DoesNotContain(m.Text, c => char.IsDigit(c));
            Assert.StartsWith("/", m.Path);
            Assert.True(m.ExpiresAt > Now);
        }
        Assert.True(ChatProactiveRules.ValidTopics(["onboard"]));
    }

    [Fact]
    public void TheOnboardTopicCanBeSwitchedOff() =>
        Assert.Null(ChatProactiveRules.Choose([.. ChatProactiveRules.AboardToDisembark(new(Now, StageRules.Port, 0, false, null))], [], new(ChatProactiveRules.ModeTrip, ["onboard"], false, false), Now));
}

public class GroupMomentTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 15, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Group = Guid.Parse("11111111-2222-3333-4444-555555555555");

    [Fact]
    public void AGroupIsOfferedAPollOnlyWhenEveryConditionHolds()
    {
        Assert.True(ChatGroupMomentRules.Offer(true, true, 3, false, false));
        Assert.False(ChatGroupMomentRules.Offer(false, true, 3, false, false));   // not an admin
        Assert.False(ChatGroupMomentRules.Offer(true, false, 3, false, false));   // Stanley not switched on
        Assert.False(ChatGroupMomentRules.Offer(true, true, 2, false, false));    // fewer than three
        Assert.False(ChatGroupMomentRules.Offer(true, true, 3, true, false));     // a supervised child is in it
        Assert.False(ChatGroupMomentRules.Offer(true, true, 3, false, true));     // it already has a poll or plan
    }

    [Fact]
    public void ThePostRefusalsAreNamedAndCheckedInOrder()
    {
        Assert.Null(ChatGroupMomentRules.Refusal(true, true, true, false, false));
        Assert.Equal(ChatGroupMomentRules.NotGroup, ChatGroupMomentRules.Refusal(true, true, false, false, false));
        Assert.Equal(ChatGroupMomentRules.NotAdmin, ChatGroupMomentRules.Refusal(false, true, true, false, false));
        Assert.Equal(ChatGroupMomentRules.Off, ChatGroupMomentRules.Refusal(true, false, true, false, false));
        Assert.Equal(ChatGroupMomentRules.Child, ChatGroupMomentRules.Refusal(true, true, true, true, false));
        Assert.Equal(ChatGroupMomentRules.Already, ChatGroupMomentRules.Refusal(true, true, true, false, true));
    }

    [Fact]
    public void TheCardNamesItsGroupInItsSubjectAndOpensThatGroup()
    {
        var facts = new MomentFacts(Now, StageRules.Manage, 40, false, null, ShareGroup: Group);
        var m = Assert.Single(ChatProactiveRules.Candidates(facts), c => c.Key == ChatGroupMomentRules.GroupPollKey);
        Assert.Equal(Group.ToString(), m.Subject);
        Assert.Equal($"/chat?c={Group}", m.Path);
        Assert.Equal(ChatProactiveRules.Planning, m.Topic);
        Assert.Equal(Group.ToString(), ChatProactiveRules.ToNotice(m, Now).Subject);
        Assert.DoesNotContain(ChatProactiveRules.Candidates(facts with { ShareGroup = null }), c => c.Key == ChatGroupMomentRules.GroupPollKey);
        Assert.DoesNotContain(ChatProactiveRules.Candidates(facts with { Stage = StageRules.Sea }), c => c.Key == ChatGroupMomentRules.GroupPollKey);
    }

    [Fact]
    public void TheCardIsASuggestionSoATripOnlyGuestNeverSeesIt()
    {
        var cards = ChatProactiveRules.Candidates(new MomentFacts(Now, StageRules.Manage, 40, false, null, ShareGroup: Group));
        Assert.Null(ChatProactiveRules.Choose([.. cards.Where(c => c.Key == ChatGroupMomentRules.GroupPollKey)], [], new(ChatProactiveRules.ModeTrip, [], false, false), Now));
        Assert.NotNull(ChatProactiveRules.Choose([.. cards.Where(c => c.Key == ChatGroupMomentRules.GroupPollKey)], [], new(ChatProactiveRules.ModeSuggest, [], false, false), Now));
    }

    [Fact]
    public void TheLineNamesTheAdminNotStanleyAndThePollIsAValidPoll()
    {
        Assert.Equal("Alex T. asked Stanley to share this", ChatGroupMomentRules.ShareLine("Alex T."));
        Assert.NotNull(ChatPlanningRules.CleanPoll(ChatGroupMomentRules.PollQuestion, [.. ChatGroupMomentRules.PollOptions]));
        foreach (var line in ChatGroupMomentRules.PollOptions.Prepend(ChatGroupMomentRules.PollQuestion)) Assert.False(ProfanityFilter.IsBlocked(line));
    }
}

public class SuggestionCountsTests
{
    [Fact]
    public void SuggestionCardsAreCountedByLaneButStayOutOfTheNoticeTotals()
    {
        var rows = new List<Princess.Api.Data.NoticeDeliveryCount>
        {
            new("payment", "critical", StanleyNoticeRules.EventPosted, 9), new("payment", "critical", StanleyNoticeRules.EventFailOpen, 1),
            new("moment", "suggestion", StanleyNoticeRules.EventPosted, 40), new("moment", "suggestion", StanleyNoticeRules.EventSnooze, 5), new("moment", "suggestion", StanleyNoticeRules.EventDismiss, 3),
        };
        var s = Princess.Api.Endpoints.StanleyNoticeStatsEndpoints.Summarise(0, rows);
        Assert.Equal(9, s.Posted);
        Assert.Equal(0.1, s.FailOpenShare, 3);
        Assert.Equal(5, s.Counts.Count);
        Assert.Contains(s.Counts, c => c.Lane == "suggestion" && c.Event == "dismiss" && c.Count == 3);
    }

    [Fact]
    public void TheSnoozeAndDismissEventsFitTheColumn()
    {
        Assert.True(StanleyNoticeRules.EventSnooze.Length <= 8);
        Assert.True(StanleyNoticeRules.EventDismiss.Length <= 8);
        Assert.True(ChatProactiveRules.Lane.Length <= 10);
    }
}
