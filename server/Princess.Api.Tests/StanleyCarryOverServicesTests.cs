using System.Text.Json.Nodes;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>
/// The services added after the Stanley phases (docs/stanley-gap-analysis-and-plan.md, the carry-over list): the group poll, the dining plan, the plan snapshot, the corridor route, the helper grant,
/// reminders and handoff photos. These are the rules and stores that need no database or sign-in; the screens' own services are covered by their API tests.
/// </summary>
public class StanleyPollAndSeatingTests
{
    private static readonly StanleyActionContext NoPlan = new();

    // ---- the poll ----

    [Fact]
    public void APollNeedsAQuestionAndTwoToSixDistinctShortChoicesAndAKnownLength()
    {
        var ok = StanleyPollRules.Clean(new StanleyPollRequest("  Where next?  ", ["Snorkel", "Beach club"], null));
        Assert.Null(ok.Problem);
        Assert.Equal(("Where next?", 3), (ok.Question, ok.Days));
        Assert.Equal(["o1", "o2"], ok.Options.Select(o => o.Id));
        Assert.Equal("question", StanleyPollRules.Clean(new StanleyPollRequest("", ["a", "b"], null)).Problem);
        Assert.Equal("question", StanleyPollRules.Clean(new StanleyPollRequest(new string('x', 121), ["a", "b"], null)).Problem);
        Assert.Equal("options", StanleyPollRules.Clean(new StanleyPollRequest("q", ["only one"], null)).Problem);
        Assert.Equal("options", StanleyPollRules.Clean(new StanleyPollRequest("q", ["a", "A"], null)).Problem);
        Assert.Equal("options", StanleyPollRules.Clean(new StanleyPollRequest("q", ["a", ""], null)).Problem);
        Assert.Equal("options", StanleyPollRules.Clean(new StanleyPollRequest("q", ["a", new string('x', 41)], null)).Problem);
        Assert.Equal("options", StanleyPollRules.Clean(new StanleyPollRequest("q", ["1", "2", "3", "4", "5", "6", "7"], null)).Problem);
        Assert.Equal("days", StanleyPollRules.Clean(new StanleyPollRequest("q", ["a", "b"], 5)).Problem);
    }

    [Fact]
    public void OnlyAnswersGivenAreCountedAndSilenceIsNeverAYes()
    {
        var doc = new StanleyPollDoc { Question = "Where?", Options = [new("o1", "Snorkel"), new("o2", "Beach")] };
        doc.Answers[1] = new() { ["o1"] = "yes" };
        var voters = new List<(long, string)> { (1, "Ana"), (2, "Ben"), (3, "Cy") };
        var made = new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);
        long Ms(DateTime d) => new DateTimeOffset(d).ToUnixTimeMilliseconds();
        var status = StanleyPollRules.StatusOf(doc, voters, made, made.AddDays(3), false, true, Ms(made.AddHours(1)));
        Assert.Equal((1, 2, "open"), (status.Answered, status.Silent, status.State));
        Assert.Equal("leading", status.Suggestion.Kind);
        Assert.DoesNotContain(status.Tally, t => t.Yes > 1);
        // Past the closing time the poll is expired and takes no more answers.
        Assert.Equal("expired", StanleyPollRules.StatusOf(doc, voters, made, made.AddDays(3), false, false, Ms(made.AddDays(4))).State);
        Assert.Equal("closed", StanleyPollRules.StatusOf(doc, voters, made, made.AddDays(3), true, false, Ms(made.AddHours(1))).State);
    }

    [Fact]
    public void AnAnswerMustBeAKnownChoiceAndYesMaybeOrNo()
    {
        var doc = new StanleyPollDoc { Options = [new("o1", "A"), new("o2", "B")] };
        Assert.True(StanleyPollRules.AnswerOk(doc, "o2", "maybe"));
        Assert.False(StanleyPollRules.AnswerOk(doc, "o3", "yes"));
        Assert.False(StanleyPollRules.AnswerOk(doc, "o1", "because I said so"));
        Assert.False(StanleyPollRules.AnswerOk(doc, null, null));
    }

    [Fact]
    public async Task APollStoreScopesEveryReadToItsBookingAndOnlyTheMakerRemovesIt()
    {
        var store = new MemoryStanleyPollStore();
        var mine = new StanleyPollRow { PublicId = Guid.NewGuid(), BookingId = 10, OwnerUserId = 1, CreatedAt = new DateTime(2027, 3, 5), Json = "{}" };
        await store.AddAsync(mine, default);
        await store.AddAsync(new StanleyPollRow { PublicId = Guid.NewGuid(), BookingId = 11, OwnerUserId = 2, CreatedAt = new DateTime(2027, 3, 5), Json = "{}" }, default);
        Assert.Single(await store.ListAsync(10, 20, default));
        Assert.Null(await store.GetAsync(mine.PublicId, 11, default));
        Assert.False(await store.DeleteAsync(mine.PublicId, 10, 2, default));
        Assert.False(await store.DeleteAsync(mine.PublicId, 11, 1, default));
        Assert.True(await store.DeleteAsync(mine.PublicId, 10, 1, default));
        Assert.Equal(1, await store.DeleteOlderThanAsync(new DateTime(2027, 4, 1), default));
    }

    [Theory]
    [InlineData("Poll the group: snorkel or beach club?", "snorkel or beach club?", 2)]
    [InlineData("Create a poll: pasta, pizza or steak", "pasta, pizza or steak?", 3)]
    [InlineData("ask everyone: formal night or casual", "formal night or casual?", 2)]
    public void TheWordsForAPollGiveItsQuestionAndChoices(string text, string question, int count)
    {
        var read = StanleyPollRules.FromWords(text)!;
        Assert.Equal(question, read.Question);
        Assert.Equal(count, read.Options!.Count);
        var intent = StanleyIntents.Parse(text, NoPlan)!;
        Assert.Equal(StanleyActionKinds.CreatePoll, intent.Intent!.Kind);
    }

    [Fact]
    public void APollWithNoChoicesIsAQuestionBackAndAnOrdinaryQuestionIsNotAPoll()
    {
        Assert.NotNull(StanleyIntents.Parse("Poll the group", NoPlan)!.Clarify);
        Assert.Null(StanleyPollRules.FromWords("What is the group rate for the snorkel tour?"));
        Assert.Null(StanleyIntents.Parse("Is there a vote at the end of the show?", NoPlan));
    }

    [Fact]
    public void TheModelsPollInputIsCheckedLikeTheWords()
    {
        var good = StanleyIntents.Validate(new JsonObject { ["kind"] = "create_poll", ["question"] = "Where?", ["options"] = new JsonArray("Snorkel", "Beach") }, NoPlan);
        Assert.Equal("Snorkel|Beach", good.Intent!.Arg("options"));
        Assert.Equal("3", good.Intent.Arg("days"));
        Assert.NotNull(StanleyIntents.Validate(new JsonObject { ["kind"] = "create_poll", ["question"] = "Where?", ["options"] = new JsonArray("Only") }, NoPlan).Clarify);
        // The prepare endpoint sends plain strings: choices joined with a bar.
        Assert.Equal("A|B", StanleyIntents.Validate(new JsonObject { ["kind"] = "create_poll", ["question"] = "Q?", ["options"] = "A|B" }, NoPlan).Intent!.Arg("options"));
    }

    // ---- the dining plan ----

    private static readonly DateOnly Departure = new(2027, 3, 20);

    [Fact]
    public void ThePlanChangesOnlyBeforeTheFreezeDateAndOnlyToAKnownPlanWithPlacesLeft()
    {
        var early = Departure.AddDays(-10);
        var sailing = Enumerable.Range(0, 200).Select(i => "S" + i).First(s => DiningPlanRules.Left("late", s) > 0 && DiningPlanRules.Left("early", s) > 0);
        Assert.Null(DiningPlanRules.Problem("late", "anytime", early, Departure, sailing, 0));
        Assert.Equal("plan", DiningPlanRules.Problem("dawn", "anytime", early, Departure, sailing, 0));
        Assert.Equal("plan", DiningPlanRules.Problem(null, "anytime", early, Departure, sailing, 0));
        Assert.Equal("unchanged", DiningPlanRules.Problem("late", "late", early, Departure, sailing, 0));
        Assert.Equal("started", DiningPlanRules.Problem("late", "anytime", Departure.AddDays(-2), Departure, sailing, 0));
        Assert.Null(DiningPlanRules.Problem("late", "anytime", Departure.AddDays(-DiningPlanRules.FreezeDays), Departure, sailing, 0));
        Assert.Equal("hasTables", DiningPlanRules.Problem("early", "anytime", early, Departure, sailing, 2));
        Assert.Null(DiningPlanRules.Problem("anytime", "late", early, Departure, sailing, 2));
    }

    [Fact]
    public void AFullSeatingIsRefusedAndTheSameSailingAlwaysAnswersTheSame()
    {
        var full = Enumerable.Range(0, 400).Select(i => "S" + i).First(s => DiningPlanRules.Left("early", s) == 0);
        Assert.Equal("full", DiningPlanRules.Problem("early", "anytime", Departure.AddDays(-10), Departure, full, 0));
        Assert.Equal(DiningPlanRules.Left("early", "SUN-1"), DiningPlanRules.Left("early", "SUN-1"));
        Assert.Equal(int.MaxValue, DiningPlanRules.Left("anytime", full));
    }

    [Theory]
    [InlineData("Change my dining time to late seating", "late")]
    [InlineData("Switch me to early seating", "early")]
    [InlineData("I want to change to anytime dining", "anytime")]
    [InlineData("please put us on the late sitting", "late")]
    public void TheWordsForASeatingChangeGiveThePlan(string text, string plan)
    {
        var intent = StanleyIntents.Parse(text, NoPlan)!.Intent!;
        Assert.Equal((StanleyActionKinds.ChangeSeating, plan), (intent.Kind, intent.Arg("plan")));
    }

    [Fact]
    public void ADinnerTimeIsStillADinnerMoveAndAnUnknownSeatingIsAQuestion()
    {
        Assert.Equal(StanleyActionKinds.MoveDinner, StanleyIntents.Parse("Move dinner to 8pm", NoPlan)!.Intent!.Kind);
        Assert.NotNull(StanleyIntents.Validate(new JsonObject { ["kind"] = "change_seating", ["plan"] = "dawn" }, NoPlan).Clarify);
        Assert.Equal("late", StanleyIntents.Validate(new JsonObject { ["kind"] = "change_seating", ["plan"] = "late" }, NoPlan).Intent!.Arg("plan"));
        Assert.Equal("anytime", DiningPlanRules.FromWords("Flexible"));
        Assert.Null(DiningPlanRules.FromWords("whenever"));
    }
}

public class StanleyPlanSnapshotTests
{
    private static readonly DateTime Now = new(2027, 3, 22, 12, 0, 0, DateTimeKind.Utc);
    private static StanleyPlanEntry Entry(string id, string start = "10:00") => new(id, "Bingo", start, 3, true);

    [Fact]
    public async Task APlanTheDeviceSendsIsKeptAndUsedAndNoPlanFallsBackToTheSavedOne()
    {
        var store = new MemoryStanleyPlanSnapshotStore();
        var sent = new StanleyActionContext([Entry("bingo")], null, "S1");
        var merged = await StanleyPlanSnapshots.MergeAsync(store, 1, sent, Now, default);
        Assert.Equal(["bingo"], merged.Plan!.Select(p => p.Id));
        // Another request, with no plan, is checked against the same one.
        var later = await StanleyPlanSnapshots.MergeAsync(store, 1, new StanleyActionContext(null, null, "S1"), Now.AddHours(2), default);
        Assert.Equal(["bingo"], later.Plan!.Select(p => p.Id));
        // A newer plan replaces the older one.
        await StanleyPlanSnapshots.MergeAsync(store, 1, new StanleyActionContext([Entry("trivia", "11:00")], null, "S1"), Now.AddHours(3), default);
        Assert.Equal(["trivia"], (await StanleyPlanSnapshots.MergeAsync(store, 1, new StanleyActionContext(null, null, "S1"), Now.AddHours(4), default)).Plan!.Select(p => p.Id));
    }

    [Fact]
    public async Task ASnapshotIsOnlyTheGuestsOwnForTheSailingAndIsNotUsedOnceADayOld()
    {
        var store = new MemoryStanleyPlanSnapshotStore();
        await StanleyPlanSnapshots.MergeAsync(store, 1, new StanleyActionContext([Entry("bingo")], null, "S1"), Now, default);
        Assert.Empty((await StanleyPlanSnapshots.MergeAsync(store, 2, new StanleyActionContext(null, null, "S1"), Now, default)).Plan ?? []);
        Assert.Empty((await StanleyPlanSnapshots.MergeAsync(store, 1, new StanleyActionContext(null, null, "S2"), Now, default)).Plan ?? []);
        Assert.Empty((await StanleyPlanSnapshots.MergeAsync(store, 1, new StanleyActionContext(null, null, "S1"), Now.AddHours(25), default)).Plan ?? []);
        Assert.Equal(1, await store.DeleteOlderThanAsync(Now.AddHours(1), default));
        Assert.Null(await store.GetAsync(1, "S1", default));
    }

    [Fact]
    public async Task WithNoStoreTheRequestIsUsedAsItIs()
    {
        var ctx = new StanleyActionContext(null, null, "S1");
        Assert.Same(ctx, await StanleyPlanSnapshots.MergeAsync(null, 1, ctx, Now, default));
    }

    [Fact]
    public void AMoveIsReadAgainstTheSavedPlanWhenTheRequestCarriesNone()
    {
        var saved = new StanleyActionContext([Entry("bingo")], null, "S1");
        var intent = StanleyIntents.Parse("Move bingo to 4pm", saved)!.Intent!;
        Assert.Equal(("move", "bingo", "16:00"), (intent.Arg("op"), intent.Arg("itemId"), intent.Arg("to")));
        Assert.Null(StanleyIntents.Parse("Move bingo to 4pm", new StanleyActionContext(null, null, "S1")));
    }
}

public class ShipRouteTests
{
    private static readonly AboardPlanDto Plan = AboardPlans.For("sun-princess")!;
    private static RouteDto Go(string from, string to, bool stepFree = false, params string[] closed) => ShipRoute.Between(ShipRoute.Locate(from, Plan), ShipRoute.Locate(to, Plan), Plan, stepFree, closed.ToHashSet());

    [Fact]
    public void APlaceIsFoundByIdNameCabinOrDeckAndNothingElse()
    {
        Assert.Equal("Guest Services", ShipRoute.Locate("guest-services", Plan)!.Name);
        Assert.Equal("guest-services", ShipRoute.Locate("GUEST SERVICES", Plan)!.Id);
        Assert.Equal((8, "forward"), (ShipRoute.Locate("cabin 8123", Plan)!.Deck, ShipRoute.Locate("8123", Plan)!.Section));
        Assert.Equal((12, "aft"), (ShipRoute.Locate("12045", Plan)!.Deck, "aft"));
        Assert.Equal("aft", ShipRoute.Locate("12545", Plan)!.Section);
        Assert.Equal(("Deck 9", "midship"), (ShipRoute.Locate("deck 9", Plan)!.Name, ShipRoute.Locate("deck 9", Plan)!.Section));
        Assert.Equal("forward", ShipRoute.Locate("Deck 9 forward", Plan)!.Section);
        Assert.Null(ShipRoute.Locate("nowhere", Plan));
        Assert.Null(ShipRoute.Locate("cabin 1234567", Plan));
        Assert.Null(ShipRoute.Locate("cabin 1123", Plan));
        Assert.Null(ShipRoute.Locate(null, Plan));
    }

    [Fact]
    public void ADeckAlongWalkNamesTheDirectionAndADeckChangeTakesTheLifts()
    {
        var along = Go("guest-services", "soleil");
        Assert.Null(along.Problem);
        Assert.Contains(along.Steps, s => s.StartsWith("Walk aft"));
        Assert.DoesNotContain(along.Steps, s => s.Contains("lifts"));
        var up = Go("landing", "lido");
        Assert.Contains(up.Steps, s => s.StartsWith("Take the") && s.Contains("from deck 4 to deck 17"));
        Assert.EndsWith(".", up.Steps[^1]);
        Assert.True(up.Minutes > along.Minutes);
        Assert.True(up.StepFree);
    }

    [Fact]
    public void ASamePlaceAnUnknownPlaceAndANonStepFreePlaceEachSayWhy()
    {
        Assert.Equal("same", Go("lido", "lido").Problem);
        Assert.Equal("unknown", ShipRoute.Between(null, ShipRoute.Locate("lido", Plan), Plan, false).Problem);
        var blocked = Go("lido", "sun-bar", stepFree: true);
        Assert.Equal("notStepFree", blocked.Problem);
        Assert.Equal("Sea View Bar", blocked.Instead);
        Assert.Null(Go("lido", "sun-bar", stepFree: false).Problem);
    }

    [Fact]
    public void AClosedBankIsAvoidedAndTheWayIsSaidToHaveChanged()
    {
        var usual = Go("medical", "sea-view");
        Assert.False(usual.Rerouted);
        var forwardBanks = Plan.Elevators.Where(e => e.Section == "forward").Select(e => e.Bank).ToArray();
        var round = Go("medical", "sea-view", false, forwardBanks);
        Assert.Null(round.Problem);
        Assert.True(round.Rerouted);
        Assert.DoesNotContain(round.Steps, s => forwardBanks.Any(b => s.StartsWith($"Take the {b} lifts")));
        Assert.Contains(round.Steps, s => s.StartsWith("Walk aft"));
        // With every bank closed there is no way between decks.
        Assert.Equal("noWay", Go("medical", "sea-view", false, Plan.Elevators.Select(e => e.Bank).ToArray()).Problem);
    }

    [Fact]
    public void TheSameQuestionAlwaysGivesTheSameWay()
    {
        Assert.Equal(Go("catch", "dome").Steps, Go("catch", "dome").Steps);
        Assert.Equal(Go("catch", "dome").Minutes, Go("catch", "dome").Minutes);
    }
}

public class StanleyReminderTests
{
    private const string Zone = "America/New_York";

    [Fact]
    public void ATimeOfDayIsTheNextTimeThatHappensOnTheShipsClockWithinADay()
    {
        // 14:00 in New York in March (EDT, UTC-4) is 18:00 UTC.
        var now = new DateTime(2027, 3, 22, 18, 0, 0, DateTimeKind.Utc);
        Assert.Equal(new DateTime(2027, 3, 22, 20, 15, 0), StanleyReminderRules.NextDue(now, "16:15", Zone));
        Assert.Equal(new DateTime(2027, 3, 23, 17, 0, 0), StanleyReminderRules.NextDue(now, "13:00", Zone));
        // Exactly now is not "next": it is tomorrow.
        Assert.Equal(new DateTime(2027, 3, 23, 18, 0, 0), StanleyReminderRules.NextDue(now, "14:00", Zone));
        Assert.All(new[] { "00:00", "09:30", "14:01", "23:59" }, t => Assert.InRange(StanleyReminderRules.NextDue(now, t, Zone) - now, TimeSpan.FromSeconds(1), TimeSpan.FromHours(24)));
    }

    [Fact]
    public void AReminderIsSentOnceItIsDueAndNotAtAllWhenItIsLongLate()
    {
        var id = Guid.NewGuid();
        var due = new DateTime(2027, 3, 22, 20, 15, 0, DateTimeKind.Utc);
        var pending = new[] { new StanleyReminderDue(id, "Be back", TripRules.ToMs(due)) };
        Assert.Empty(StanleyReminderRules.Sendable(pending, TripRules.ToMs(due.AddMinutes(-1))));
        Assert.Single(StanleyReminderRules.Sendable(pending, TripRules.ToMs(due)));
        Assert.Single(StanleyReminderRules.Sendable(pending, TripRules.ToMs(due.AddHours(StanleyReminderRules.LateHours))));
        Assert.Empty(StanleyReminderRules.Sendable(pending, TripRules.ToMs(due.AddHours(StanleyReminderRules.LateHours).AddMinutes(1))));
    }

    [Fact]
    public void TheWordsAreTidiedAndTheTimeMustBeAClockTime()
    {
        Assert.Equal("Be back on board", StanleyReminderRules.Clean("  Be   back\n on board "));
        Assert.Equal("Reminder", StanleyReminderRules.Clean("   "));
        Assert.Equal(StanleyReminderRules.TextMax, StanleyReminderRules.Clean(new string('x', 500)).Length);
        Assert.True(StanleyReminderRules.TimeOk("07:05"));
        Assert.All(new[] { "7:05", "24:00", "12:60", "noon", "", null }, t => Assert.False(StanleyReminderRules.TimeOk(t)));
    }

    [Fact]
    public async Task APushReminderIsTheGuestsOwnAndWaitsNoMoreThanTenAndCancelsOnlyForThem()
    {
        var clock = new Support.FakeClock(new DateTime(2027, 3, 22, 18, 0, 0, DateTimeKind.Utc));
        var svc = new StanleyReminderService(new MemoryStanleyReminderStore(), clock);
        var me = new UserRecord { Id = 1, PublicId = Guid.NewGuid() };
        var other = new UserRecord { Id = 2, PublicId = Guid.NewGuid() };
        var id = await svc.SetAsync(me, "16:15", "Be back", Zone, default);
        Assert.True(await svc.ExistsAsync(me, "Be back", default));
        Assert.False(await svc.ExistsAsync(other, "Be back", default));
        Assert.Empty(await svc.DueAsync(me.Id, clock.UtcNow, default));
        clock.UtcNow = new DateTime(2027, 3, 22, 20, 16, 0, DateTimeKind.Utc);
        Assert.Equal(["Be back"], (await svc.DueAsync(me.Id, clock.UtcNow, default)).Select(r => r.Text));
        Assert.Empty(await svc.DueAsync(other.Id, clock.UtcNow, default));
        Assert.False(await svc.CancelAsync(other, id, default));
        Assert.True(await svc.CancelAsync(me, id, default));
        Assert.Empty(await svc.DueAsync(me.Id, clock.UtcNow, default));
        for (var i = 0; i < StanleyReminderRules.MaxPending; i++) await svc.SetAsync(me, "23:00", "r" + i, Zone, default);
        Assert.Equal("tooMany", (await Assert.ThrowsAsync<ApiException>(() => svc.SetAsync(me, "23:30", "one more", Zone, default))).Title);
        await Assert.ThrowsAsync<ApiException>(() => svc.SetAsync(me, "noon", "x", Zone, default));
        await Assert.ThrowsAsync<ApiException>(() => svc.SetAsync(new UserRecord { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true }, "16:00", "x", Zone, default));
    }

    [Fact]
    public void ADueReminderBecomesAPhoneAlertThatIsNotHeldForBudgetCalmOrQuietHours()
    {
        var now = new DateTime(2027, 3, 22, 3, 0, 0, DateTimeKind.Utc);   // the middle of the night
        var id = Guid.NewGuid();
        var input = new PushInput(now, "ok", "", null, false, 45, false, [], [], 0, [], Reminders: [new StanleyReminderDue(id, "Be back on board", TripRules.ToMs(now.AddMinutes(-2)))]);
        var notice = Assert.Single(PushRules.Build(input).Where(n => n.Key == $"stanleyReminder:{id}"));
        Assert.Equal(("reminder", "Be back on board", false), (notice.Kind, notice.Body, notice.Bypass));
        var prefs = NotificationRules.NormalizePrefs(null);
        Assert.True(PushRules.Decide(notice, prefs, new PushSettings(0, true, []), new TimeOnly(3, 0), 99).Send);
        // The guest turning push off for its category still stops it.
        var off = NotificationRules.NormalizePrefs(System.Text.Json.Nodes.JsonNode.Parse("""{"channels":{"checkin":{"push":false}}}"""));
        Assert.Equal("channelOff", PushRules.Decide(notice, off, new PushSettings(3, false, []), new TimeOnly(12, 0), 0).Reason);
        // Nothing late, nothing early, nothing twice (the key is the reminder's id).
        Assert.DoesNotContain(PushRules.Build(input with { Now = now.AddHours(StanleyReminderRules.LateHours + 1) }), n => n.Key == $"stanleyReminder:{id}");
        Assert.DoesNotContain(PushRules.Build(input with { Now = now.AddMinutes(-10) }), n => n.Key == $"stanleyReminder:{id}");
    }
}

public class StanleyHandoffPhotoTests
{
    [Fact]
    public void OnlyThirtyTwoHexDigitsAreAPhotoId()
    {
        var id = Guid.NewGuid();
        Assert.Equal(id, StanleyHandoffPhotoRules.Parse(StanleyHandoffPhotoRules.IdOf(id)));
        Assert.Null(StanleyHandoffPhotoRules.Parse("../../etc/passwd"));
        Assert.Null(StanleyHandoffPhotoRules.Parse(id.ToString()));
        Assert.Null(StanleyHandoffPhotoRules.Parse(null));
    }

    [Fact]
    public void EmptyOversizeAndNonImageBytesAreRefused()
    {
        Assert.Equal("empty", StanleyHandoffPhotoRules.Check([], out _, out _));
        Assert.Equal("size", StanleyHandoffPhotoRules.Check(new byte[StanleyHandoffPhotoRules.MaxBytes + 1], out _, out _));
        Assert.Equal("type", StanleyHandoffPhotoRules.Check("not a picture"u8.ToArray(), out _, out _));
    }

    [Fact]
    public async Task APhotoIsOnlyEverOpenedByItsOwner()
    {
        var store = new MemoryHandoffPhotoStore(new Support.FakeClock());
        var id = Guid.NewGuid();
        await store.SaveAsync(1, id, [1, 2, 3], default);
        Assert.NotNull(await store.OpenAsync(1, id, default));
        Assert.Null(await store.OpenAsync(2, id, default));
        Assert.Equal(1, await store.CountAsync(1, default));
        Assert.True(await store.DeleteAsync(1, id, default));
        Assert.Null(await store.OpenAsync(1, id, default));
    }

    [Fact]
    public async Task TheLocalStoreKeepsFilesUnderTheGuestAndDeletesThem()
    {
        var dir = Path.Combine(Path.GetTempPath(), "princess-photos-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new LocalHandoffPhotoStore(dir);
            var id = Guid.NewGuid();
            await store.SaveAsync(7, id, [9, 9], default);
            Assert.Equal([9, 9], await store.OpenAsync(7, id, default));
            Assert.Null(await store.OpenAsync(8, id, default));
            Assert.Single(await store.ListOlderThanAsync(DateTime.UtcNow.AddDays(1), default));
            Assert.True(await store.DeleteAsync(7, id, default));
            Assert.Empty(Directory.GetFiles(dir));
        }
        finally { if (Directory.Exists(dir)) Directory.Delete(dir, true); }
    }
}
