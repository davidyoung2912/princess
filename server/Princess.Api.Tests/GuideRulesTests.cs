using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class GuideRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);

    private static GuideTrip Trip(DateOnly today, bool paid = false, bool docs = false, string checkin = "notOpen", bool muster = false, bool agent = false, Dictionary<string, GuideCheck>? list = null) =>
        new("PR123", Departure, agent, paid, Departure.AddDays(-75), docs, checkin, Departure.AddDays(-3), muster, list ?? []);

    private static GuideView At(string stage, DateOnly today, GuideTrip? trip = null, int saved = 0, GuideDraft? draft = null, bool lastFull = false, bool feedback = false, GuideChoices? choices = null, GuideFit? fit = null) =>
        GuideRules.Build(new GuideFacts(stage, today, saved, draft, trip, lastFull, feedback, choices, fit));

    private static GuideChoices Skip(params string[] ids) => new(new HashSet<string>(ids), new Dictionary<string, DateOnly>());

    [Fact]
    public void EveryStageHasTasksAndEveryTaskHasADestination()
    {
        foreach (var stage in StageRules.All)
        {
            var today = Departure.AddDays(-20);
            var g = At(stage, today, stage is StageRules.Dream or StageRules.Discover ? null : Trip(today), draft: new("d1", false));
            Assert.NotEmpty(g.Tasks);
            Assert.All(g.Tasks, t => Assert.StartsWith("/", t.To));
        }
    }

    [Fact]
    public void ADreamingGuestIsToldToTakeTheQuizAndASavedSailingIsDoneFromData()
    {
        var g = At(StageRules.Dream, Departure.AddDays(-200), saved: 1);
        Assert.Equal("dream.quiz", g.PrimaryId);
        Assert.Equal("done", g.Tasks.Single(t => t.Id == "dream.save").State);
        Assert.Equal("data", g.Tasks.Single(t => t.Id == "dream.save").DoneBy);
    }

    [Fact]
    public void AnUnpaidBalanceNearItsDateIsUrgentAndFirst()
    {
        var today = Departure.AddDays(-80);
        var g = At(StageRules.Manage, today, Trip(today));
        var first = g.Tasks[0];
        Assert.Equal("manage.pay", first.Id);
        Assert.Equal(("now", "payment"), (first.Urgency, first.UrgencyReason));
        Assert.Equal("/book/pay/PR123", first.To);
        Assert.True(first.Hard);
    }

    [Fact]
    public void ADistantBalanceIsNotUrgent()
    {
        var today = Departure.AddDays(-150);
        Assert.NotEqual("now", At(StageRules.Manage, today, Trip(today)).Tasks.Single(t => t.Id == "manage.pay").Urgency);
    }

    [Fact]
    public void AnAgentTripPaysAndHasNoDocumentUrgencyHere()
    {
        var today = Departure.AddDays(-20);
        var g = At(StageRules.Manage, today, Trip(today, agent: true));
        Assert.Equal("/me/payments", g.Tasks.Single(t => t.Id == "manage.pay").To);
        Assert.Null(g.Tasks.Single(t => t.Id == "manage.documents").UrgencyReason);
    }

    [Fact]
    public void OptionalTasksNeverLeadWhileARequiredOneIsOpen()
    {
        var today = Departure.AddDays(-100);
        var g = At(StageRules.Manage, today, Trip(today, paid: true, docs: true));
        Assert.Equal("manage.readiness", g.PrimaryId);
    }

    [Fact]
    public void UnpaidAndUndocumentedTasksAreCarriedIntoPrebook()
    {
        var today = Departure.AddDays(-10);
        var g = At(StageRules.Prebook, today, Trip(today));
        var pay = g.Tasks.Single(t => t.Id == "manage.pay");
        Assert.Equal("manage", pay.CarriedFrom);
        Assert.Equal("manage.pay", g.PrimaryId);
        Assert.DoesNotContain(g.Tasks.Where(t => t.CarriedFrom is null), t => t.Stage != "prebook");
        Assert.Equal(5, g.Counts.Total);
    }

    [Fact]
    public void ChecklistFactsMarkPrebookTasksDoneAndGiveTheirDates()
    {
        var today = Departure.AddDays(-10);
        var list = new Dictionary<string, GuideCheck> { ["tours"] = new(true, Departure.AddDays(-60)), ["dining"] = new(false, Departure.AddDays(-30)) };
        var g = At(StageRules.Prebook, today, Trip(today, paid: true, docs: true, list: list));
        Assert.Equal("done", g.Tasks.Single(t => t.Id == "prebook.tours").State);
        var dining = g.Tasks.Single(t => t.Id == "prebook.dining");
        Assert.Equal(("todo", "soon", "2027-02-19"), (dining.State, dining.Urgency, dining.Due));
    }

    [Fact]
    public void CheckinWaitsUntilItOpensThenBlocksThePassUntilDone()
    {
        var early = Departure.AddDays(-10);
        var g = At(StageRules.GetToShip, early, Trip(early, paid: true, docs: true));
        var checkin = g.Tasks.Single(t => t.Id == "getToShip.checkin");
        Assert.Equal(("waiting", "2027-03-18"), (checkin.State, checkin.OpensAt));
        Assert.Equal("blocked", g.Tasks.Single(t => t.Id == "getToShip.pass").State);

        var open = Departure.AddDays(-2);
        var g2 = At(StageRules.GetToShip, open, Trip(open, paid: true, docs: true, checkin: "open"));
        Assert.Equal("getToShip.checkin", g2.PrimaryId);
        Assert.Equal("checkin", g2.Tasks[0].UrgencyReason);

        var done = At(StageRules.GetToShip, open, Trip(open, paid: true, docs: true, checkin: "done"));
        Assert.Equal("todo", done.Tasks.Single(t => t.Id == "getToShip.pass").State);
    }

    [Fact]
    public void MusterIsUrgentUntilDoneAndBagsAppearOnlyOnTheLastFullDay()
    {
        var today = Departure;
        Assert.Equal("embark.muster", At(StageRules.Embark, today, Trip(today, paid: true)).PrimaryId);
        Assert.Equal("done", At(StageRules.Embark, today, Trip(today, paid: true, muster: true)).Tasks.Single(t => t.Id == "embark.muster").State);
        Assert.DoesNotContain(At(StageRules.Sea, today, Trip(today, paid: true)).Tasks, t => t.Id == "sea.bags");
        var last = At(StageRules.Sea, today, Trip(today, paid: true), lastFull: true);
        Assert.Equal(("sea.bags", "bags"), (last.PrimaryId, last.Tasks[0].UrgencyReason));
    }

    [Fact]
    public void FeedbackIsDoneFromDataAndTheMoveOnDateIsTheRealOne()
    {
        Assert.Equal("done", At(StageRules.Remember, Departure, Trip(Departure), feedback: true).Tasks.Single(t => t.Id == "remember.feedback").State);
        Assert.Equal("2027-03-07", At(StageRules.Manage, Departure.AddDays(-30), Trip(Departure)).MoveOn.Date);
        Assert.Equal("2027-03-18", At(StageRules.Prebook, Departure.AddDays(-10), Trip(Departure)).MoveOn.Date);
        Assert.Null(At(StageRules.Sea, Departure, Trip(Departure)).MoveOn.Date);
    }

    [Fact]
    public void AFinishedStageHasNoPrimaryAndCountsEverythingDone()
    {
        var g = At(StageRules.Dream, Departure.AddDays(-200), saved: 1);
        Assert.NotNull(g.PrimaryId);
        var d = At(StageRules.Discover, Departure.AddDays(-200), draft: new("d1", true));
        Assert.Equal(1, d.Counts.Done);
        Assert.Equal(3, d.Counts.Open);
    }

    [Fact]
    public void ManageOffersPhoneAndFamilyAndTheDelayedPageAppearsOnlyInTheLastTwoDays()
    {
        var today = Departure.AddDays(-120);
        var m = At(StageRules.Manage, today, Trip(today)).Tasks;
        Assert.Contains(m, t => t.Id == "manage.phone" && t.Optional);
        Assert.Contains(m, t => t.Id == "manage.family" && t.Optional);
        var early = Departure.AddDays(-5);
        Assert.DoesNotContain(At(StageRules.GetToShip, early, Trip(early, paid: true, docs: true)).Tasks, t => t.Id == "getToShip.delayed");
        var near = Departure.AddDays(-1);
        Assert.Contains(At(StageRules.GetToShip, near, Trip(near, paid: true, docs: true)).Tasks, t => t.Id == "getToShip.delayed" && t.Optional);
    }

    [Fact]
    public void LaterStagesOfferOptionalTasksAndFamilyOnlyWithChildren()
    {
        var today = Departure;
        Assert.Contains(At(StageRules.Embark, today, Trip(today, paid: true)).Tasks, t => t.Id == "embark.key" && t.Optional);
        Assert.Equal("embark.muster", At(StageRules.Embark, today, Trip(today, paid: true)).PrimaryId);
        Assert.Contains(At(StageRules.Sea, today, Trip(today, paid: true)).Tasks, t => t.Id == "sea.help" && t.Optional);
        Assert.DoesNotContain(At(StageRules.Sea, today, Trip(today, paid: true)).Tasks, t => t.Id == "sea.family");
        Assert.Contains(At(StageRules.Port, today, Trip(today, paid: true)).Tasks, t => t.Id == "port.late" && t.Optional);
        var d = At(StageRules.Disembark, today, Trip(today, paid: true)).Tasks;
        Assert.Contains(d, t => t.Id == "disembark.customs" && !t.Optional);
        Assert.Contains(d, t => t.Id == "disembark.lost" && t.Optional);
        Assert.Contains(At(StageRules.Remember, today, Trip(today, paid: true)).Tasks, t => t.Id == "remember.memories" && t.Optional);
    }

    [Fact]
    public void ComparingSailingsIsOfferedOnlyWithTwoSavedAndBookingNamesComeBeforeThePayment()
    {
        Assert.DoesNotContain(At(StageRules.Discover, Departure.AddDays(-200), saved: 1).Tasks, t => t.Id == "discover.compare");
        Assert.Contains(At(StageRules.Discover, Departure.AddDays(-200), saved: 2).Tasks, t => t.Id == "discover.compare" && t.Optional);
        var ids = At(StageRules.Book, Departure.AddDays(-200), draft: new("d1", true)).Tasks.Select(t => t.Id).ToList();
        Assert.True(ids.IndexOf("book.names") < ids.IndexOf("book.deposit"));
        Assert.True(ids.IndexOf("book.policy") < ids.IndexOf("book.deposit"));
    }

    [Fact]
    public void ATaskTheGuestSkippedIsHiddenAndCounted()
    {
        var today = Departure.AddDays(-40);
        var g = At(StageRules.Prebook, today, Trip(today), choices: Skip("prebook.packages"));
        Assert.DoesNotContain(g.Tasks, t => t.Id == "prebook.packages");
        Assert.Equal(new[] { "prebook.packages" }, g.Hidden);
    }

    [Fact]
    public void ATaskWithARealDeadlineCannotBeHidden()
    {
        var today = Departure.AddDays(-40);
        var g = At(StageRules.Prebook, today, Trip(today), choices: Skip("manage.pay", "manage.documents"));
        Assert.Contains(g.Tasks, t => t.Id == "manage.pay");
        Assert.Contains(g.Tasks, t => t.Id == "manage.documents");
        Assert.Empty(g.Hidden);
    }

    [Fact]
    public void ATaskPutOffReturnsOnItsDay()
    {
        var today = Departure.AddDays(-40);
        var later = new GuideChoices(new HashSet<string>(), new Dictionary<string, DateOnly> { ["prebook.dining"] = today.AddDays(1) });
        var before = At(StageRules.Prebook, today, Trip(today), choices: later);
        Assert.DoesNotContain(before.Tasks, t => t.Id == "prebook.dining");
        Assert.Equal(new[] { new GuideDeferred("prebook.dining", today.AddDays(1).ToString("yyyy-MM-dd")) }, before.Deferred);
        var back = At(StageRules.Prebook, today.AddDays(1), Trip(today), choices: later);
        Assert.Contains(back.Tasks, t => t.Id == "prebook.dining");
        Assert.Empty(back.Deferred);
    }

    [Fact]
    public void DocumentsCountTheTravellersWhoAreReady()
    {
        var today = Departure.AddDays(-40);
        var trip = Trip(today) with { Guests = 4, Ready = 2 };
        var docs = At(StageRules.Manage, today, trip).Tasks.Single(t => t.Id == "manage.documents");
        Assert.Equal(new GuideWho(2, 4), docs.Who);
        Assert.Null(At(StageRules.Manage, today, Trip(today) with { Guests = 1, Ready = 0 }).Tasks.Single(t => t.Id == "manage.documents").Who);
    }

    [Fact]
    public void ChildrenInThePartyAddTheClubsTask()
    {
        var today = Departure.AddDays(-40);
        Assert.DoesNotContain(At(StageRules.Prebook, today, Trip(today)).Tasks, t => t.Id == "prebook.clubs");
        var clubs = At(StageRules.Prebook, today, Trip(today) with { Guests = 3, Children = 1 }).Tasks.Single(t => t.Id == "prebook.clubs");
        Assert.True(clubs.Optional);
        Assert.Equal("/plan/clubs", clubs.To);
    }

    [Fact]
    public void ReadChoicesKeepsOnlyReadableEntries()
    {
        var json = "{\"skipped\":{\"a.b\":1},\"later\":{\"c.d\":\"2027-01-02\",\"e.f\":\"soon\"}}";
        var c = GuideRules.ReadChoices(System.Text.Json.Nodes.JsonNode.Parse(json) as System.Text.Json.Nodes.JsonObject);
        Assert.Contains("a.b", c.Skipped);
        Assert.Equal(new DateOnly(2027, 1, 2), c.Later["c.d"]);
        Assert.False(c.Later.ContainsKey("e.f"));
    }

    [Fact]
    public void AFirstCruiseAddsTheStarterTask()
    {
        var today = Departure.AddDays(-40);
        Assert.DoesNotContain(At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }).Tasks, t => t.Id == "prebook.firstTime");
        var first = At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }, fit: new GuideFit(true, false, false)).Tasks.Single(t => t.Id == "prebook.firstTime");
        Assert.Equal("/plan/starter", first.To);
        Assert.False(first.Optional);
    }

    [Fact]
    public void QuietOffersDropThePackagesTask()
    {
        var today = Departure.AddDays(-40);
        Assert.Contains(At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }).Tasks, t => t.Id == "prebook.packages");
        Assert.DoesNotContain(At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }, fit: new GuideFit(false, false, true)).Tasks, t => t.Id == "prebook.packages");
    }

    [Fact]
    public void SoloIsFromTheAnswerOrAPartyOfOne()
    {
        var today = Departure.AddDays(-40);
        Assert.DoesNotContain(At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }).Tasks, t => t.Id == "prebook.solo");
        Assert.Contains(At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }, fit: new GuideFit(false, true, false)).Tasks, t => t.Id == "prebook.solo");
        Assert.Contains(At(StageRules.Prebook, today, Trip(today) with { Guests = 1 }).Tasks, t => t.Id == "prebook.solo");
        Assert.Contains(At(StageRules.Prebook, today, Trip(today) with { Guests = 1 }).Tasks, t => t.Id == "prebook.meet");
        Assert.DoesNotContain(At(StageRules.Prebook, today, Trip(today) with { Guests = 2 }).Tasks, t => t.Id == "prebook.meet");
    }

    [Fact]
    public void ReadFitIgnoresAnythingElse()
    {
        var f = GuideRules.ReadFit(System.Text.Json.Nodes.JsonNode.Parse("{\"firstCruise\":true,\"solo\":\"yes\",\"quiet\":false}") as System.Text.Json.Nodes.JsonObject);
        Assert.Equal(new GuideFit(true, false, false), f);
    }
}
