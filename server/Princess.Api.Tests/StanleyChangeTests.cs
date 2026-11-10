using System.Text.Json.Nodes;
using Princess.Api.Domain;
using Princess.Api.Services;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>
/// Voyage Autopilot v2 and Explain this change (docs/stanley-gap-analysis-and-plan.md, phase 11). The replay scenarios at the top feed the engine fixed facts and expect exact cards, and also expect nothing for changes
/// that do not touch the guest. The rest hold the rules that must never move: a forecast is never an alert, nothing is done without a preview and a confirm, a dismissed card stays dismissed until its facts change.
/// </summary>
public class StanleyChangeTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static readonly Excursion Tour = ExcursionRules.Catalogue.First(e => e.Port == "cozumel");

    private static StanleyTrip Trip(int day, StanleyItem[]? tours = null, StanleyItem[]? meals = null) =>
        new(Departure.AddDays(day - 1), Departure, 7, "Sun Princess", "Balcony", "Anytime", [40, 38], tours ?? [], meals ?? [], []);

    private static DateTime At(int day) => Departure.AddDays(day - 1).ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);

    private static ChangeFacts F(
        int day = 3, StanleyItem[]? tours = null, StanleyItem[]? meals = null, PlanChange[]? program = null, string[]? saved = null, string[]? scenarios = null, TenderSignal[]? tenders = null,
        TravelFlightDto? flight = null, SkySignal[]? skies = null, SeaSignal? sea = null, CaseSignal[]? cases = null, OrderSignal[]? orders = null) =>
        new(At(day), Trip(day, tours, meals), program ?? [], new HashSet<string>(saved ?? []), new HashSet<string>(scenarios ?? []), tenders ?? [], flight, skies ?? [], sea, cases ?? [], orders ?? []);

    private static StanleyItem CozumelTour(int day = 3) => new(day, Tour.Name, Tour.Start);

    private static TravelFlightDto Flight(string status, int delay, string verdict, string confidence = "provider") =>
        new("ok", "AA123", status, delay, "Provider", 0, confidence, "09:00", "10:15", "airport time", verdict, 90, "07:00", "06:00", [], "msg", []);

    private static string[] Ids(IEnumerable<ChangeCard> cards) => [.. cards.Select(c => c.Id)];

    private static readonly PlanChange[] Feed =
    [
        new("stage-show", 2, "moved", "21:15", "The ship is running behind the weather. The show starts 45 minutes later."),
        new("trivia", 2, "cancelled", null, "The host is unwell."),
    ];

    // ---- replay: scenario fixtures and the cards they must produce ----

    public sealed record Scenario(string Name, ChangeFacts Facts, string[] Expect, string? Top = null, string? TopConsequence = null);

    public static IEnumerable<object[]> Scenarios()
    {
        yield return [new Scenario("quiet trip", F(), [])];
        yield return [new Scenario("programme changes the guest did not save", F(day: 2, program: Feed), [])];
        yield return [new Scenario("programme changes on days already gone", F(day: 4, program: Feed, saved: ["stage-show", "trivia"]), [])];
        yield return [new Scenario("saved show cancelled", F(day: 2, program: Feed, saved: ["trivia"]), ["venue:trivia:cancelled"], "venue:trivia:cancelled", "conflict")];
        yield return [new Scenario("port skipped, tour booked", F(scenarios: ["portSkipped"], tours: [CozumelTour()]), ["portCall:cozumel:3:skipped"], "portCall:cozumel:3:skipped", "lostReservation")];
        yield return [new Scenario("port skipped, nothing booked", F(scenarios: ["portSkipped"]), ["portCall:cozumel:3:skipped"], "portCall:cozumel:3:skipped", "conflict")];
        yield return [new Scenario("a tour on another day is untouched by a skipped port", F(scenarios: ["portSkipped"], day: 3, tours: [new StanleyItem(5, "Zip line", "09:00")]), ["portCall:cozumel:3:skipped"], "portCall:cozumel:3:skipped", "conflict")];
        yield return [new Scenario("tender delay today", F(day: 4, scenarios: ["belizeTender"]), ["tender:belize:4:delay"], "tender:belize:4:delay", "safety")];
        yield return [new Scenario("tender delay tomorrow, tour booked", F(day: 3, scenarios: ["belizeTender"], tours: [new StanleyItem(4, "Cave tubing adventure", "08:30")]), ["tender:belize:4:delay"], "tender:belize:4:delay", "conflict")];
        yield return [new Scenario("tender forecast and a ship notice for the same boats say it once", F(day: 4, scenarios: ["belizeTender"], tenders: [new TenderSignal("belize", "2027-03-24", "rough", 20)]), ["tender:belize:4:delay"], "tender:belize:4:delay", "safety")];
        yield return [new Scenario("tender forecast alone is never an alert", F(day: 4, tenders: [new TenderSignal("belize", "2027-03-24", "rough", 20)], tours: [new StanleyItem(4, "Cave tubing adventure", "08:30")]), ["tender:belize:4:outlook"], "tender:belize:4:outlook", "conflict")];
        yield return [new Scenario("a good tender outlook says nothing", F(day: 4, tenders: [new TenderSignal("belize", "2027-03-24", "good", 5)]), [])];
        yield return [new Scenario("flight cancelled", F(day: 8, flight: Flight("cancelled", 0, "cancelled")), ["flight:AA123:20270328:cancelled"], "flight:AA123:20270328:cancelled", "safety")];
        yield return [new Scenario("flight late and now tight", F(day: 8, flight: Flight("delayed", 75, "tight")), ["flight:AA123:20270328:delayed:75"], null, "safety")];
        yield return [new Scenario("flight late with room to spare", F(day: 8, flight: Flight("delayed", 20, "ok")), ["flight:AA123:20270328:delayed:20"], null, "optional")];
        yield return [new Scenario("flight on time", F(day: 8, flight: Flight("onTime", 0, "ok")), [])];
        yield return [new Scenario("a flight far off is not news yet", F(day: 3, flight: Flight("cancelled", 0, "cancelled")), [])];
        yield return [new Scenario("rain over a booked tour", F(day: 3, tours: [CozumelTour()], skies: [new SkySignal(3, "cozumel", "08:45", "11:00")]), ["weather:rain:3"], "weather:rain:3", "conflict")];
        yield return [new Scenario("rain with no tour is no business of ours", F(day: 3, skies: [new SkySignal(3, "cozumel", "08:45", "11:00")]), [])];
        yield return [new Scenario("rain after the tour is over", F(day: 3, tours: [CozumelTour()], skies: [new SkySignal(3, "cozumel", "22:00", "23:00")]), [])];
        yield return [new Scenario("rougher sea while sailing", F(day: 2, sea: new SeaSignal(1.4, 2.0)), ["weather:seas:2"], "weather:seas:2", "optional")];
        yield return [new Scenario("a calm sea says nothing", F(day: 2, sea: new SeaSignal(0.4, 0.6)), [])];
        yield return [new Scenario("a rough sea before the cruise starts says nothing", F(day: 0, sea: new SeaSignal(3.0, 3.0)), [])];
        yield return [new Scenario("part of an order unavailable", F(orders: [new OrderSignal("abcd1234", "preparing", 1)]), ["order:abcd1234:unavailable"], null, "conflict")];
        yield return [new Scenario("a delivered order is finished business", F(orders: [new OrderSignal("abcd1234", "delivered", 1)]), [])];
        yield return [new Scenario("case answered", F(cases: [new CaseSignal("PC-LF-10001", "lostItem", "resolved", "found", 0, ToMs(At(3)) - 1000)]), ["case:PC-LF-10001:resolved"], null, "optional")];
        yield return [new Scenario("case past its reply time", F(cases: [new CaseSignal("PC-CP-10002", "complaint", "inReview", null, 0, ToMs(At(3)) - 1000)]), ["case:PC-CP-10002:late"], null, "conflict")];
        yield return [new Scenario("case still inside its time", F(cases: [new CaseSignal("PC-CP-10002", "complaint", "inReview", null, 0, ToMs(At(3)) + 3_600_000)]), [])];
        yield return [new Scenario("an old answered case", F(cases: [new CaseSignal("PC-LF-10001", "lostItem", "resolved", "found", 0, ToMs(At(3)) - (long)TimeSpan.FromDays(30).TotalMilliseconds)]), [])];
    }

    private static long ToMs(DateTime utc) => new DateTimeOffset(utc).ToUnixTimeMilliseconds();

    [Theory]
    [MemberData(nameof(Scenarios))]
    public void EachScenarioGivesExactlyTheExpectedCardsAndNoFalsePositives(Scenario s)
    {
        var cards = StanleyChangeRules.Cards(s.Facts);
        Assert.Equal(s.Expect.OrderBy(x => x, StringComparer.Ordinal), Ids(cards).OrderBy(x => x, StringComparer.Ordinal));
        if (s.Top is not null) Assert.Equal(s.Top, cards[0].Id);
        if (s.TopConsequence is not null) Assert.Equal(s.TopConsequence, cards[0].Consequence);
        Invariants(s.Facts.Trip, cards);
    }

    /// <summary>What must hold for every card the engine ever makes.</summary>
    private static void Invariants(StanleyTrip trip, IReadOnlyList<ChangeCard> cards)
    {
        Assert.Equal(cards.Select(c => c.Id).Distinct().Count(), cards.Count);
        for (var i = 1; i < cards.Count; i++) Assert.True(ChangeConsequence.Rank(cards[i - 1].Consequence) <= ChangeConsequence.Rank(cards[i].Consequence), "ranked by consequence");
        foreach (var c in cards)
        {
            Assert.Contains(c.Kind, ChangeKinds.All);
            Assert.Contains(c.Status, ChangeStatus.All);
            Assert.Contains(c.Consequence, ChangeConsequence.All);
            Assert.Equal(ChangeConsequence.IsAlert(c.Consequence), c.Critical);
            // Nobody is told to act now on a guess.
            if (c.Status == ChangeStatus.Forecast) Assert.False(c.Critical);
            Assert.False(string.IsNullOrWhiteSpace(c.Source));
            Assert.Contains("ship time", c.SourceAtText);
            Assert.NotEmpty(c.Title);
            Assert.NotEmpty(c.What);
            Assert.NotEmpty(c.Why);
            Assert.NotEmpty(c.IfNothing);
            Assert.Equal("person", c.Others[^1].Id);
            Assert.Equal(8, c.Fingerprint.Length);
            foreach (var screen in c.Where) Assert.Contains(screen, StanleyChangeRules.Screens);
            foreach (var o in c.Others.Append(c.Recommended)) AssertSafeOption(o, trip);
        }
    }

    /// <summary>An option changes something only through a phase 5 action: one of the closed kinds, which the action rules accept as written. Never a payment, a cancellation or a rebooking.</summary>
    private static void AssertSafeOption(ChangeOption o, StanleyTrip trip)
    {
        Assert.False(string.IsNullOrWhiteSpace(o.Label));
        Assert.False(o.Action is not null && o.Route is not null);
        if (o.Action is not { } a) return;
        Assert.Contains(a.Kind, StanleyActionKinds.All);
        Assert.DoesNotContain(a.Kind, new[] { "pay", "cancel", "rebook", "refund" });
        var input = new JsonObject { ["kind"] = a.Kind };
        foreach (var (k, v) in a.Args) input[k] = v;
        var plan = a.Args.TryGetValue("itemId", out var id) ? new List<StanleyPlanEntry> { new(id, "Item", "09:00", int.Parse(a.Args["day"]), true) } : new List<StanleyPlanEntry>();
        var read = StanleyIntents.Validate(input, new StanleyActionContext(plan));
        Assert.NotNull(read.Intent);
    }

    // ---- the details of the cards that need them ----

    [Fact]
    public void ACancelledSavedShowOffersToTakeItOffThePlanOnly()
    {
        var card = StanleyChangeRules.Cards(F(day: 2, program: Feed, saved: ["trivia"])).Single();
        Assert.Equal(StanleyActionKinds.PlanChange, card.Recommended.Action!.Kind);
        Assert.Equal("drop", card.Recommended.Action.Args["op"]);
        Assert.Equal("trivia", card.Recommended.Action.Args["itemId"]);
        Assert.Equal(ChangeStatus.Verified, card.Status);
    }

    [Fact]
    public void AMovedShowThatClashesWithDinnerRecommendsAnEarlierDinnerThatReallyFits()
    {
        var card = StanleyChangeRules.Cards(F(day: 2, program: Feed, saved: ["stage-show"], meals: [new StanleyItem(2, "Main dining", "20:30")])).Single();
        Assert.Equal(StanleyActionKinds.MoveDinner, card.Recommended.Action!.Kind);
        var time = card.Recommended.Action.Args["time"];
        Assert.Contains(time, DiningRules.DinnerTimes);
        // Dinner takes an hour and a half and the walk fifteen minutes: it must be over before the new start of 21:15.
        Assert.True(int.Parse(time[..2]) * 60 + int.Parse(time[3..]) + 105 <= 21 * 60 + 15);
        Assert.Contains(card.Affects, a => a.Kind == "dinner");
        Assert.Contains(card.Others, o => o.Action?.Args["op"] == "move");
    }

    [Fact]
    public void AMovedShowWithNoClashJustUpdatesThePlan()
    {
        var card = StanleyChangeRules.Cards(F(day: 2, program: Feed, saved: ["stage-show"], meals: [new StanleyItem(2, "Main dining", "18:00")])).Single();
        Assert.Equal(StanleyActionKinds.PlanChange, card.Recommended.Action!.Kind);
        Assert.Equal("21:15", card.Recommended.Action.Args["to"]);
        Assert.DoesNotContain(card.Affects, a => a.Kind == "dinner");
    }

    [Fact]
    public void ASkippedPortNamesTheTourAndNeverRefundsOrCancelsItself()
    {
        var card = StanleyChangeRules.Cards(F(scenarios: ["portSkipped"], tours: [CozumelTour()])).Single();
        Assert.True(card.Critical);
        Assert.Contains(card.Affects, a => a.Kind == "tour" && a.Name == Tour.Name);
        Assert.Equal("/home/disruption", card.Recommended.Route);
        Assert.Contains("Princess to confirm", card.IfNothing);
        Assert.Contains(card.Others, o => o.Action?.Kind == StanleyActionKinds.PlanChange && o.Action.Args["itemId"] == Tour.Id && o.Action.Args["day"] == "3");
    }

    [Fact]
    public void ATenderDelayOnTheDayOffersAReminderNinetyMinutesBeforeAllAboard()
    {
        var card = StanleyChangeRules.Cards(F(day: 4, scenarios: ["belizeTender"])).Single();
        Assert.True(card.Critical);
        Assert.Equal(StanleyActionKinds.RemindMe, card.Recommended.Action!.Kind);
        // Belize on the older route: all aboard 16:00.
        Assert.Equal("14:30", card.Recommended.Action.Args["at"]);
        Assert.Contains("ship time", card.Recommended.Detail);
    }

    [Fact]
    public void ACancelledFlightIsOnlyEverAdviceToCallTheAirline()
    {
        var card = StanleyChangeRules.Cards(F(day: 8, flight: Flight("cancelled", 0, "cancelled"))).Single();
        Assert.Null(card.Recommended.Action);
        Assert.Equal("/home/disembark/onward", card.Recommended.Route);
        Assert.Contains("cannot rebook", card.Recommended.Detail);
        Assert.Equal(ChangeStatus.Verified, card.Status);
    }

    [Fact]
    public void AFlightWithNoProviderConfidenceIsOnlyProvisional()
    {
        var card = StanleyChangeRules.Cards(F(day: 8, flight: Flight("cancelled", 0, "cancelled", confidence: "none"))).Single();
        Assert.Equal(ChangeStatus.Provisional, card.Status);
    }

    [Fact]
    public void TheRoughSeasTipIsQuietNonMedicalAndLinksToTheReviewedPage()
    {
        var card = StanleyChangeRules.Cards(F(day: 2, sea: new SeaSignal(1.4, 2.0))).Single();
        Assert.True(card.Tip);
        Assert.False(card.Critical);
        Assert.Equal("/ship/seasick", card.Recommended.Route);
        Assert.Contains("not medical advice", card.Why);
        Assert.Equal(["home", "ship"], card.Where);
        Assert.False(StanleyChangeRules.PushWorthy(card));
    }

    [Fact]
    public void TheSeaTipChangesFingerprintWhenTheSeaGetsRougher()
    {
        var moderate = StanleyChangeRules.Cards(F(day: 2, sea: new SeaSignal(1.2, 1.8))).Single();
        var same = StanleyChangeRules.Cards(F(day: 2, sea: new SeaSignal(1.3, 1.9))).Single();
        var rough = StanleyChangeRules.Cards(F(day: 2, sea: new SeaSignal(2.4, 3.0))).Single();
        Assert.Equal(moderate.Fingerprint, same.Fingerprint);
        Assert.NotEqual(moderate.Fingerprint, rough.Fingerprint);
    }

    [Fact]
    public void TheSameFactsAlwaysGiveTheSameCards()
    {
        var f = F(day: 4, scenarios: ["belizeTender"], tours: [new StanleyItem(4, "Cave tubing adventure", "08:30")], sea: new SeaSignal(1.4, 2.0));
        Assert.Equal(StanleyChangeRules.Cards(f), StanleyChangeRules.Cards(f), new CardComparer());
    }

    private sealed class CardComparer : IEqualityComparer<IReadOnlyList<ChangeCard>>
    {
        public bool Equals(IReadOnlyList<ChangeCard>? x, IReadOnlyList<ChangeCard>? y) => x!.Select(c => (c.Id, c.Fingerprint)).SequenceEqual(y!.Select(c => (c.Id, c.Fingerprint)));
        public int GetHashCode(IReadOnlyList<ChangeCard> o) => o.Count;
    }

    [Fact]
    public void ManyChangesAreRankedBySeriousnessThenByDay()
    {
        var cards = StanleyChangeRules.Cards(F(
            day: 2, program: Feed, saved: ["trivia"], scenarios: ["portSkipped"], tours: [CozumelTour()], sea: new SeaSignal(1.4, 2.0),
            orders: [new OrderSignal("abcd1234", "preparing", 2)]));
        // Same consequence: the sooner day first, and a change with no day after those that have one.
        Assert.Equal(["portCall:cozumel:3:skipped", "venue:trivia:cancelled", "order:abcd1234:unavailable", "weather:seas:2"], Ids(cards));
        Assert.Equal("lostReservation", cards[0].Consequence);
        Assert.Equal("optional", cards[^1].Consequence);
    }

    // ---- explain this change ----

    [Fact]
    public void ExplainAnswersTheSixQuestionsFromTheCardAlone()
    {
        var card = StanleyChangeRules.Cards(F(scenarios: ["portSkipped"], tours: [CozumelTour()])).Single();
        var e = StanleyChangeRules.Explain(card);
        Assert.Equal(["what", "sure", "affects", "recommend", "others", "nothing"], e.Questions.Select(q => q.Key));
        Assert.All(e.Questions, q => Assert.False(string.IsNullOrWhiteSpace(q.Answer)));
        Assert.Contains(card.Source, e.Questions[1].Answer);
        Assert.Contains(card.SourceAtText, e.Questions[1].Answer);
        Assert.Contains("confirmed", e.Questions[1].Answer);
        Assert.Contains(Tour.Name, e.Questions[2].Answer);
        Assert.Contains("I have not changed anything", e.Questions[5].Answer);
        // Same card, same words: nothing about a conversation goes in.
        Assert.Equal(e, StanleyChangeRules.Explain(card));
    }

    [Fact]
    public void ExplainSaysWhenAChangeIsOnlyAForecastAndWhenAnActionNeedsAConfirm()
    {
        var forecast = StanleyChangeRules.Cards(F(day: 4, tenders: [new TenderSignal("belize", "2027-03-24", "rough", 20)], tours: [new StanleyItem(4, "Cave tubing adventure", "08:30")])).Single();
        Assert.Contains("forecast, not a fact", StanleyChangeRules.Explain(forecast).Questions[1].Answer);
        var act = StanleyChangeRules.Cards(F(day: 2, program: Feed, saved: ["trivia"])).Single();
        Assert.Contains("Nothing happens until you confirm", StanleyChangeRules.Explain(act).Questions[3].Answer);
    }

    // ---- delivery rules ----

    private static ChangeCard Card(string id, string consequence, string status = ChangeStatus.Verified, string[]? where = null, string fp = "aaaaaaaa", bool tip = false)
    {
        var critical = ChangeConsequence.IsAlert(consequence);
        return new ChangeCard(id, fp, ChangeKinds.Venue, status, "Source", 0, "10:00 ship time", consequence, critical, 3, id, "what", "why",
            new ChangeOption("r", "Do it", "detail", null, null), [new ChangeOption("person", "Ask a person", "d", null, "/me/cases")], [], "nothing", tip, critical ? ["home", "ship", "port", "plan", "travel"] : where ?? ["home"]);
    }

    private static ChangeDelivery Deliver(IReadOnlyList<ChangeCard> cards, string level = "guide", string screen = "home", string[]? shown = null, bool quiet = false, ChangeMemory? memory = null) =>
        StanleyChangeRules.Deliver(cards, memory ?? ChangeMemory.Empty, screen, level, shown ?? [], quiet);

    [Fact]
    public void AlertsAreKeptApartFromSuggestionsAndIgnoreQuietHoursAndTheSessionCount()
    {
        var cards = new[] { Card("a", "safety"), Card("b", "lostReservation"), Card("c", "conflict"), Card("d", "improvement") };
        var d = Deliver(cards, shown: ["x", "y", "z"], quiet: true);
        Assert.Equal(["a", "b"], Ids(d.Alerts));
        Assert.Null(d.Suggestion);
        Assert.Contains(new ChangeHeld("c", "sessionCap"), d.Held);
    }

    [Fact]
    public void OnlyOneSuggestionIsShownOnAScreenAndTheMostSeriousWins()
    {
        var d = Deliver([Card("c", "conflict"), Card("d", "improvement"), Card("e", "optional")]);
        Assert.Equal("c", d.Suggestion!.Id);
        Assert.Equal(2, d.Held.Count(h => h.Reason == "oneOnScreen"));
    }

    [Fact]
    public void AtMostThreeSuggestionsAreShownInASession()
    {
        Assert.NotNull(Deliver([Card("c", "conflict")], shown: ["x", "y"]).Suggestion);
        Assert.Null(Deliver([Card("c", "conflict")], shown: ["x", "y", "z"]).Suggestion);
        // One already shown is not shown again.
        Assert.Null(Deliver([Card("c", "conflict")], shown: ["c"]).Suggestion);
    }

    [Theory]
    [InlineData("affects", "conflict", true)]
    [InlineData("affects", "improvement", false)]
    [InlineData("affects", "optional", false)]
    [InlineData("suggest", "improvement", true)]
    [InlineData("suggest", "optional", false)]
    [InlineData("guide", "optional", true)]
    [InlineData("off", "conflict", false)]
    public void TheGuestsLevelDecidesWhatIsSaidUnprompted(string level, string consequence, bool shown)
    {
        Assert.Equal(shown, Deliver([Card("c", consequence)], level: level).Suggestion is not null);
    }

    [Fact]
    public void StanleyOffSaysNothingAtAll()
    {
        var d = Deliver([Card("a", "safety"), Card("c", "conflict")], level: "off");
        Assert.Empty(d.Alerts);
        Assert.Null(d.Suggestion);
    }

    [Fact]
    public void QuietHoursHoldSuggestionsAndAScreenOnlyShowsCardsThatSuitIt()
    {
        Assert.Null(Deliver([Card("c", "conflict")], quiet: true).Suggestion);
        Assert.Contains(Deliver([Card("c", "conflict")], quiet: true).Held, h => h.Reason == "quiet");
        Assert.Null(Deliver([Card("c", "conflict", where: ["port"])], screen: "home").Suggestion);
        Assert.NotNull(Deliver([Card("c", "conflict", where: ["port"])], screen: "port").Suggestion);
    }

    [Fact]
    public void ADismissedCardStaysDismissedUntilItsFactsChange()
    {
        var card = Card("c", "conflict");
        var memory = StanleyChangeRules.Dismiss(ChangeMemory.Empty, card);
        Assert.Null(Deliver([card], memory: memory).Suggestion);
        Assert.Contains(Deliver([card], memory: memory).Held, h => h.Reason == "dismissed");
        // Same thing, different facts: it comes back.
        Assert.NotNull(Deliver([Card("c", "conflict", fp: "bbbbbbbb")], memory: memory).Suggestion);
        // A dismissed alert is acknowledged and is not shown again either.
        var alert = Card("a", "safety");
        Assert.Empty(Deliver([alert], memory: StanleyChangeRules.Dismiss(ChangeMemory.Empty, alert)).Alerts);
    }

    // ---- what did I miss ----

    [Fact]
    public void TwoNewSuggestionsOnHomeBecomeOneDigestInPlaceOfTheSingleSuggestion()
    {
        var memory = StanleyChangeRules.Observe(ChangeMemory.Empty, [], 1_000);
        var cards = new[] { Card("a", "safety"), Card("b", "conflict"), Card("c", "improvement"), Card("d", "optional") };
        memory = StanleyChangeRules.Observe(memory, cards, 5_000);
        var noticed = StanleyChangeRules.Noticed(cards, memory);
        var missed = StanleyChangeRules.Missed(noticed, memory);
        var d = StanleyChangeRules.Deliver(noticed, memory, "home", "suggest", [], false, missed);
        Assert.Equal(["a"], Ids(d.Alerts));
        Assert.Null(d.Suggestion);
        Assert.Equal(["b", "c"], Ids(d.Digest!.Cards));
        Assert.Contains(new ChangeHeld("b", "digest"), d.Held);
        Assert.Contains(new ChangeHeld("c", "oneOnScreen"), d.Held);
        // Not on other screens, not in quiet hours, not twice in a session, and one new thing is just a suggestion.
        Assert.Null(StanleyChangeRules.Deliver(noticed, memory, "ship", "suggest", [], false, missed).Digest);
        Assert.Null(StanleyChangeRules.Deliver(noticed, memory, "home", "suggest", [], true, missed).Digest);
        Assert.Null(StanleyChangeRules.Deliver(noticed, memory, "home", "suggest", [StanleyChangeRules.DigestId], false, missed).Digest);
        var one = StanleyChangeRules.Deliver([Card("b", "conflict")], memory, "home", "affects", [], false, new ChangeMissed(1_000, [Card("b", "conflict")], 1));
        Assert.Null(one.Digest);
        Assert.Equal("b", one.Suggestion!.Id);
    }

    [Fact]
    public void FirstTimeThereIsNothingToCompareSoNothingIsClaimedAsMissed()
    {
        var card = Card("c", "conflict");
        var memory = StanleyChangeRules.Observe(ChangeMemory.Empty, [card], 1_000);
        Assert.Equal(1_000, memory.LastOpenAt);
        var missed = StanleyChangeRules.Missed(StanleyChangeRules.Noticed([card], memory), memory);
        Assert.Empty(missed.Cards);
        Assert.Null(StanleyChangeRules.Missed([card], ChangeMemory.Empty).Since);
    }

    [Fact]
    public void WhatWasNoticedSinceTheGuestLastCaughtUpIsMissedAndRankedByConsequence()
    {
        var memory = StanleyChangeRules.Observe(ChangeMemory.Empty, [Card("old", "conflict")], 1_000);
        var cards = new[] { Card("old", "conflict"), Card("new-opt", "optional"), Card("new-alert", "lostReservation"), Card("new-conf", "conflict") };
        memory = StanleyChangeRules.Observe(memory, cards, 5_000);
        var missed = StanleyChangeRules.Missed(StanleyChangeRules.Noticed(cards.OrderBy(c => ChangeConsequence.Rank(c.Consequence)).ToList(), memory), memory);
        Assert.Equal(1_000, missed.Since);
        Assert.Equal(["new-alert", "new-conf", "new-opt"], Ids(missed.Cards));
        Assert.Equal(3, missed.Total);
        // Catching up clears it.
        var caught = StanleyChangeRules.CaughtUp(memory, 6_000);
        Assert.Empty(StanleyChangeRules.Missed(StanleyChangeRules.Noticed(cards, caught), caught).Cards);
    }

    [Fact]
    public void AChangeWhoseFactsMovedCountsAsNoticedAgainAndADismissedOneIsLeftOut()
    {
        var memory = StanleyChangeRules.Observe(ChangeMemory.Empty, [Card("c", "conflict", fp: "aaaaaaaa")], 1_000);
        var moved = Card("c", "conflict", fp: "bbbbbbbb");
        memory = StanleyChangeRules.Observe(memory, [moved], 4_000);
        Assert.Equal(4_000, StanleyChangeRules.Noticed([moved], memory)[0].NoticedAt);
        Assert.Single(StanleyChangeRules.Missed(StanleyChangeRules.Noticed([moved], memory), memory).Cards);
        var dismissed = StanleyChangeRules.Dismiss(memory, moved);
        Assert.Empty(StanleyChangeRules.Missed(StanleyChangeRules.Noticed([moved], dismissed), dismissed).Cards);
    }

    [Fact]
    public void GoneChangesAreForgottenAfterThirtyDaysAndTheMemoryHasALimit()
    {
        var memory = StanleyChangeRules.Observe(ChangeMemory.Empty, [Card("gone", "conflict")], 1_000);
        var later = 1_000 + (long)TimeSpan.FromDays(31).TotalMilliseconds;
        Assert.False(StanleyChangeRules.Observe(memory, [], later).Seen.ContainsKey("gone"));
        Assert.True(StanleyChangeRules.Observe(memory, [], 2_000).Seen.ContainsKey("gone"));
        var many = Enumerable.Range(0, StanleyChangeRules.MaxSeen + 30).Select(i => Card($"c{i}", "optional")).ToList();
        Assert.True(StanleyChangeRules.Observe(ChangeMemory.Empty, many, 1).Seen.Count <= StanleyChangeRules.MaxSeen + 30);
        var trimmed = StanleyChangeRules.Observe(StanleyChangeRules.Observe(ChangeMemory.Empty, many, 1), [], 2);
        Assert.True(trimmed.Seen.Count <= StanleyChangeRules.MaxSeen);
    }

    // ---- push ----

    private static PushInput Input(params ChangeCard[] cards) => new(new DateTime(2027, 3, 24, 12, 0, 0, DateTimeKind.Utc), "ok", "", null, false, 45, false, [], [], 0, [], StanleyCards: cards);

    [Fact]
    public void ALostReservationAndADeadlineRiskReachThePhoneButAForecastAndATipNeverDo()
    {
        var lost = StanleyChangeRules.Cards(F(scenarios: ["portSkipped"], tours: [CozumelTour()])).Single();
        var safety = StanleyChangeRules.Cards(F(day: 4, scenarios: ["belizeTender"])).Single();
        var forecast = StanleyChangeRules.Cards(F(day: 4, tenders: [new TenderSignal("belize", "2027-03-24", "rough", 20)], tours: [new StanleyItem(4, "Cave tubing adventure", "08:30")])).Single();
        var tip = StanleyChangeRules.Cards(F(day: 2, sea: new SeaSignal(1.4, 2.0))).Single();
        var notices = PushRules.Build(Input(lost, safety, forecast, tip));
        Assert.Equal(2, notices.Count(n => n.Key.StartsWith("change:", StringComparison.Ordinal)));
        var res = notices.Single(n => n.Kind == "reservation");
        Assert.Equal("critical", res.Category);
        Assert.False(res.Bypass);
        Assert.Contains(lost.Fingerprint, res.Key);
        Assert.Equal($"tour-3", res.Params["reservation"]);
        var deadline = notices.Single(n => n.Kind == "change");
        Assert.True(deadline.Bypass);
        Assert.Contains(PushRules.Kinds, k => k == "reservation");
    }

    [Fact]
    public void ACaseAnswerIsAPhoneAlertUnderTheCheckInCategoryAndItsPreviewIsPlain()
    {
        var card = StanleyChangeRules.Cards(F(cases: [new CaseSignal("PC-LF-10001", "lostItem", "resolved", "found", 0, ToMs(At(3)) - 1000)])).Single();
        var n = PushRules.Build(Input(card)).Single(x => x.Kind == "case");
        Assert.Equal("checkin", n.Category);
        Assert.Equal("PC-LF-10001", n.Params["case"]);
        var redacted = PushRules.Redact(n);
        Assert.DoesNotContain("PC-LF", redacted.Body);
        Assert.Contains("case=PC-LF-10001", PushRules.WithLink(n, "ABC123").Path);
    }

    [Fact]
    public void AFlightChangeIsPlainOnALockScreenAndAFixedChangeIsNotSentTwice()
    {
        var flight = StanleyChangeRules.Cards(F(day: 8, flight: Flight("cancelled", 0, "cancelled"))).Single();
        var n = PushRules.Build(Input(flight)).Single();
        Assert.DoesNotContain("AA123", PushRules.Redact(n).Body);
        Assert.Equal(n.Key, PushRules.Build(Input(flight)).Single().Key);
        var late = StanleyChangeRules.Cards(F(day: 8, flight: Flight("delayed", 75, "tight"))).Single();
        Assert.NotEqual(n.Key, PushRules.Build(Input(late)).Single().Key);
    }

    // ---- chat and requests ----

    [Fact]
    public void TheChatAnswerNamesSourceAndCertaintyAndSaysSoWhenNothingIsOnRecord()
    {
        var cards = StanleyChangeRules.Cards(F(scenarios: ["portSkipped"], tours: [CozumelTour()]));
        var card = StanleyChangeRules.ChatCard(cards, [], At(3));
        Assert.Equal("changed", card.Id);
        Assert.Contains("verified", card.Lines[0]);
        Assert.Contains("Ship notice", card.Lines[0]);
        Assert.True(card.Provenance.CheckWithPerson);
        var none = StanleyChangeRules.ChatCard([], [], At(3));
        Assert.Contains("no change on record", none.Lines[0]);
        Assert.False(none.Abstained);
        var partial = StanleyChangeRules.ChatCard([], ["the flight status"], At(3));
        Assert.Contains("may be incomplete", partial.Lines.Last());
        Assert.Equal("provisional", partial.Provenance.Freshness);
    }

    [Fact]
    public void ExplainQuestionsAreRecognisedAndWhatChangedQuestionsAreNot()
    {
        Assert.True(StanleyChangeRules.IsExplainQuestion("Can you explain this change?"));
        Assert.True(StanleyChangeRules.IsExplainQuestion("explain the change to my tour"));
        Assert.True(StanleyChangeRules.IsExplainQuestion("why did that change"));
        Assert.False(StanleyChangeRules.IsExplainQuestion("What has changed?"));
        Assert.False(StanleyChangeRules.IsExplainQuestion("How do I change my dinner time?"));
        var card = StanleyChangeRules.ExplainChatCard(StanleyChangeRules.Cards(F(scenarios: ["portSkipped"], tours: [CozumelTour()])), At(3));
        Assert.Equal(6, card.Lines.Count);
        Assert.Contains("What changed?", card.Lines[0]);
        Assert.Contains("nothing to explain", StanleyChangeRules.ExplainChatCard([], At(3)).Lines[0]);
    }

    [Fact]
    public void RequestsAreChecked()
    {
        Assert.True(StanleyChangeRules.ValidSaved(null));
        Assert.True(StanleyChangeRules.ValidSaved(["stage-show", "trivia_2"]));
        Assert.False(StanleyChangeRules.ValidSaved(Enumerable.Range(0, 31).Select(i => $"e{i}")));
        Assert.False(StanleyChangeRules.ValidSaved(["bad id"]));
        Assert.False(StanleyChangeRules.ValidSaved(["<script>"]));
        Assert.True(StanleyChangeRules.ValidShown(["portCall:cozumel:3:skipped"]));
        Assert.False(StanleyChangeRules.ValidShown(Enumerable.Range(0, 21).Select(i => $"e{i}")));
        Assert.False(StanleyChangeRules.ValidShown(["has space"]));
    }

    [Fact]
    public async Task TheMemoryStoreKeepsEachGuestsOwnAndNeverAnothers()
    {
        var store = new MemoryStanleyChangeStore();
        await store.PutAsync(1, "{\"a\":1}", DateTime.UtcNow, default);
        Assert.Equal("{\"a\":1}", await store.GetAsync(1, default));
        Assert.Null(await store.GetAsync(2, default));
    }
}
