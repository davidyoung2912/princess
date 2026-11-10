using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Bounded action orchestration (docs/stanley-gap-analysis-and-plan.md, phase 5). The acceptance matrix: expired preview, changed availability, duplicate confirm, wrong party, child account and a pending
/// outcome, and the rule that no mutating call runs without a valid preview. The effects are faked, so the lifecycle is tested without the stores; the typed intent and the never list are pure.
/// </summary>
public class StanleyActionTests
{
    private static readonly DateTime T0 = new(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly UserRecord Me = new() { Id = 1, PublicId = Guid.NewGuid() };
    private static readonly UserRecord Other = new() { Id = 2, PublicId = Guid.NewGuid() };
    private static readonly UserRecord Child = new() { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true };

    // ---- the never list ---------------------------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("pay my bill", "pay")]
    [InlineData("Please pay the balance now", "pay")]
    [InlineData("settle my account", "pay")]
    [InlineData("cancel my booking", "cancelBooking")]
    [InlineData("I want to cancel the cruise", "cancelBooking")]
    [InlineData("Can you change my cabin", "cabin")]
    [InlineData("upgrade my stateroom", "cabin")]
    [InlineData("share my passport with my sister", "share")]
    [InlineData("send my details to the agent", "share")]
    public void WhatStanleyNeverDoesIsRefused(string text, string reason) => Assert.Equal(reason, StanleyIntents.Refusal(text));

    [Theory]
    [InlineData("Can I pay with a card?")]
    [InlineData("How do I cancel my booking?")]
    [InlineData("When is the final payment due?")]
    [InlineData("cancel my dinner")]
    [InlineData("move dinner to 8pm")]
    [InlineData("what is the cabin like on deck 9")]
    [InlineData("is my passport safe")]
    public void AQuestionOrAnOrdinaryChangeIsNotOnTheNeverList(string text) => Assert.Null(StanleyIntents.Refusal(text));

    // ---- the typed intent, from the words ----------------------------------------------------------------------------------------------

    private static readonly StanleyActionContext WithPlan = new(
        [new("quiz", "Pub quiz", "15:00", 3, true), new("yoga", "Sunrise yoga", "07:00", 3, true), new("trivia", "Deck trivia", "16:30", 3, false)], new StanleyAllAboard("16:30", "ship time"));

    [Fact]
    public void WordsBecomeATypedIntentOrAQuestionOrNothing()
    {
        var towels = StanleyIntents.Parse("I need two more towels please", WithPlan)!.Intent!;
        Assert.Equal((StanleyActionKinds.OrderItem, "towels", "2"), (towels.Kind, towels.Arg("item"), towels.Arg("qty")));
        Assert.Equal("4", StanleyIntents.Parse("send ten pillows please, I want four", WithPlan)!.Intent!.Arg("qty"));

        var tour = StanleyIntents.Parse("Add the zip-line canopy tour to my cart", WithPlan)!.Intent!;
        Assert.Equal((StanleyActionKinds.AddExcursion, "rtb-zip"), (tour.Kind, tour.Arg("excursionId")));
        // Two tours match "reef snorkel" equally, so Stanley asks which; it does not pick.
        Assert.NotNull(StanleyIntents.Parse("Add the reef snorkel to my cart", WithPlan)!.Clarify);

        var dinner = StanleyIntents.Parse("Move dinner to 8pm", WithPlan)!.Intent!;
        Assert.Equal((StanleyActionKinds.MoveDinner, "20:00"), (dinner.Kind, dinner.Arg("time")));

        var remind = StanleyIntents.Parse("remind me at 4:15 to be back on board", WithPlan)!.Intent!;
        Assert.Equal((StanleyActionKinds.RemindMe, "16:15"), (remind.Kind, remind.Arg("at")));   // a bare 4:15 is the afternoon, as a bare 8 is the evening
        Assert.Equal("be back on board", remind.Arg("text"));

        var drop = StanleyIntents.Parse("skip the pub quiz", WithPlan)!.Intent!;
        Assert.Equal((StanleyActionKinds.PlanChange, "drop", "quiz"), (drop.Kind, drop.Arg("op"), drop.Arg("itemId")));
        var move = StanleyIntents.Parse("move sunrise yoga to 9am", WithPlan)!.Intent!;
        Assert.Equal(("move", "yoga", "09:00"), (move.Arg("op"), move.Arg("itemId"), move.Arg("to")));
        var add = StanleyIntents.Parse("add deck trivia", WithPlan)!.Intent!;
        Assert.Equal(("add", "trivia"), (add.Arg("op"), add.Arg("itemId")));

        // A request with a detail missing is a question, not a guess.
        Assert.NotNull(StanleyIntents.Parse("move dinner", WithPlan)!.Clarify);
        Assert.NotNull(StanleyIntents.Parse("move dinner to 3am", WithPlan)!.Clarify);
        Assert.NotNull(StanleyIntents.Parse("remind me to stretch", WithPlan)!.Clarify);
        Assert.NotNull(StanleyIntents.Parse("move sunrise yoga", WithPlan)!.Clarify);
        // Words that are not a request are left to the answer routes, and so is "add" with nothing it matches.
        Assert.Null(StanleyIntents.Parse("what time is dinner", WithPlan));
        Assert.Null(StanleyIntents.Parse("skip the line at the buffet", WithPlan));
    }

    [Fact]
    public void ThePhraseAddToPackingListIsNotARequestToChangeThePlan()
    {
        // It used to be taken as an action by a word list. With no plan item it names, it is nothing.
        Assert.Null(StanleyIntents.Parse("should I add sunscreen to the packing list", WithPlan));
        Assert.Null(StanleyIntents.Parse("should I add sunscreen to the packing list", new StanleyActionContext()));
    }

    // ---- the model's typed intent -------------------------------------------------------------------------------------------------------

    private static JsonObject Input(string json) => (JsonObject)JsonNode.Parse(json)!;

    [Fact]
    public void TheModelsIntentIsCheckedAgainstTheClosedLists()
    {
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"pay_bill"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"order_item","item":"champagne"}"""), WithPlan).Clarify);
        Assert.Equal("4", StanleyIntents.Validate(Input("""{"kind":"order_item","item":"towels","qty":99}"""), WithPlan).Intent!.Arg("qty"));
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"add_excursion","excursionId":"nope"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"move_dinner","time":"21:45"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"draft_case","caseKind":"billing","summary":"I was charged twice for the spa"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"draft_case","caseKind":"lostItem","summary":"My blue jacket is missing"}"""), WithPlan).Clarify);   // no place
        Assert.Equal("lostItem", StanleyIntents.Validate(Input("""{"kind":"draft_case","caseKind":"lostItem","summary":"My blue jacket is missing","place":"Crown Grill"}"""), WithPlan).Intent!.Arg("caseKind"));
        // A plan item that is not in the plan the device sent, or an add of one already listed, is refused.
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"plan_change","op":"drop","itemId":"nothing"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"plan_change","op":"add","itemId":"quiz"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"plan_change","op":"move","itemId":"quiz"}"""), WithPlan).Clarify);
        Assert.Equal("move", StanleyIntents.Validate(Input("""{"kind":"plan_change","op":"move","itemId":"quiz","to":"17:00"}"""), WithPlan).Intent!.Arg("op"));
    }

    [Fact]
    public void ReservingATableNeedsTheNightAndATimeFromTheDinnerList()
    {
        var ok = StanleyIntents.Parse("Book dinner on night 3 at 7pm", WithPlan)!.Intent!;
        Assert.Equal(StanleyActionKinds.ReserveDinner, ok.Kind);
        Assert.Equal(("19:00", "3", "all"), (ok.Arg("time"), ok.Arg("day"), ok.Arg("who")));
        Assert.Contains("Which night", StanleyIntents.Parse("book dinner at 7pm", WithPlan)!.Clarify);
        Assert.Contains("What time", StanleyIntents.Parse("reserve a table on night 2", WithPlan)!.Clarify);
        Assert.Contains("What time", StanleyIntents.Parse("book dinner on night 3 at 9:45pm", WithPlan)!.Clarify);
        Assert.Equal(StanleyActionKinds.MoveDinner, StanleyIntents.Parse("Move dinner to 8pm", WithPlan)!.Intent!.Kind);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"reserve_dinner","time":"19:00"}"""), WithPlan).Clarify);
        Assert.NotNull(StanleyIntents.Validate(Input("""{"kind":"reserve_dinner","day":3,"time":"21:45"}"""), WithPlan).Clarify);
        var model = StanleyIntents.Validate(Input("""{"kind":"reserve_dinner","day":3,"time":"19:00"}"""), WithPlan).Intent!;
        Assert.Equal(("3", "all"), (model.Arg("day"), model.Arg("who")));
        Assert.Contains("fixed seating", StanleyActionText.Problem("fixedSeating"));
        Assert.Contains("already has a table", StanleyActionText.Problem("clash"));
    }

    [Fact]
    public void ThereIsNoToolOrKindForPayingCancellingOrSharing()
    {
        var tool = JsonNode.Parse(StanleyIntents.ToolJson)!;
        var kinds = tool["input_schema"]!["properties"]!["kind"]!["enum"]!.AsArray().Select(k => k!.GetValue<string>()).ToList();
        Assert.Equal(StanleyActionKinds.All.OrderBy(k => k), kinds.OrderBy(k => k));
        Assert.DoesNotContain(kinds, k => k.Contains("pay") || k.Contains("cancel") || k.Contains("cabin") || k.Contains("share"));
        Assert.Contains("propose_action", StanleyIntents.WithTool("[]"));
    }

    [Fact]
    public void WhatTheDeviceSendsIsTrimmedToWhatTheRulesAccept()
    {
        var big = Enumerable.Range(0, 200).Select(i => new StanleyPlanEntry("e" + i, "Thing " + i, "10:00", 2, true)).ToList();
        big.Add(new StanleyPlanEntry("", "no id", "10:00", 2, true));
        big.Add(new StanleyPlanEntry("bad", "bad time", "25:99", 2, true));
        var clean = new StanleyActionContext(big, new StanleyAllAboard("not a time", "ship")).Clean("S1");
        Assert.Equal(StanleyActionContext.MaxPlan, clean.Plan!.Count);
        Assert.DoesNotContain(clean.Plan, p => p.Id.Length == 0 || p.Id == "bad");
        Assert.Null(clean.AllAboard);
        Assert.Equal("S1", clean.SailingId);
    }

    [Fact]
    public void OnlyTheBookerOrTheTravellerThemselvesMayBeActedFor()
    {
        Assert.True(StanleyActionRules.MayActFor(1, 9, 1));
        Assert.True(StanleyActionRules.MayActFor(9, 9, 1));
        Assert.False(StanleyActionRules.MayActFor(2, 9, 1));
        Assert.True(StanleyActionRules.KeyOk("abc12345"));
        Assert.False(StanleyActionRules.KeyOk("short"));
        Assert.False(StanleyActionRules.KeyOk("has spaces here"));
    }

    // ---- the lifecycle ------------------------------------------------------------------------------------------------------------------

    private sealed class FakeEffects : IStanleyEffects
    {
        public string Facts { get; set; } = "price 100";
        public int Executed { get; private set; }
        public int Undone { get; private set; }
        public Exception? Throw { get; set; }
        public bool Exists { get; set; }
        public Task<StanleyPreviewFacts> PreviewAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct)
        {
            if (user.IsSupervised) throw ApiException.Forbidden();
            return Task.FromResult(new StanleyPreviewFacts("Send 2 × towels", ["2 × Towels"], ["Your stateroom"], null, "No charge.", Facts));
        }
        public Task<StanleyEffectResult> ExecuteAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct)
        {
            if (Throw is not null) throw Throw;
            Executed++;
            return Task.FromResult(new StanleyEffectResult("ref-1"));
        }
        public Task<bool> ExistsAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct) => Task.FromResult(Exists);
        public Task UndoAsync(UserRecord user, StanleyIntent intent, string effectRef, StanleyActionContext ctx, CancellationToken ct) { Undone++; return Task.CompletedTask; }
    }

    private sealed class FakeAudit : IAuditLog
    {
        public List<AuditEntry> Rows { get; } = [];
        public Task RecordAsync(AuditEntry entry, CancellationToken ct = default) { Rows.Add(entry); return Task.CompletedTask; }
    }

    private sealed record World(StanleyActionService Svc, FakeEffects Effects, MemoryStanleyActionStore Store, FakeClock Clock, FakeAudit Audit);

    private static World Build(Action<StanleyOptions>? tweak = null)
    {
        var o = new StanleyOptions();
        tweak?.Invoke(o);
        var effects = new FakeEffects();
        var store = new MemoryStanleyActionStore();
        var clock = new FakeClock(T0);
        var audit = new FakeAudit();
        return new World(new StanleyActionService(store, effects, clock, audit, Options.Create(o), NullLogger<StanleyActionService>.Instance), effects, store, clock, audit);
    }

    private static readonly StanleyIntent Towels = new(StanleyActionKinds.OrderItem, new() { ["item"] = "towels", ["qty"] = "2" });
    private static readonly StanleyIntent Remind = new(StanleyActionKinds.RemindMe, new() { ["at"] = "16:15", ["text"] = "Be back" });

    [Fact]
    public async Task PreparingShowsAPreviewAndChangesNothing()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        Assert.Equal((StanleyActionStatus.Prepared, "Send 2 × towels"), (p.Status, p.Title));
        Assert.Equal(T0.AddMinutes(StanleyActionRules.PreviewMinutes), p.ExpiresAt);
        Assert.Equal(0, w.Effects.Executed);
        Assert.Null(p.Receipt);
        Assert.Contains(w.Audit.Rows, a => a.Action == "stanley.action.prepare");
    }

    [Fact]
    public async Task ConfirmingCarriesItOutOnceAndReturnsAReceipt()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var done = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default);
        Assert.Equal(StanleyActionStatus.Done, done.Status);
        Assert.StartsWith("STN-", done.Receipt);
        Assert.Equal(T0.AddMinutes(StanleyActionRules.UndoMinutes), done.UndoUntil);
        Assert.Equal(1, w.Effects.Executed);
        Assert.Contains(w.Audit.Rows, a => a is { Action: "stanley.action.confirm", Outcome: AuditOutcome.Success });
        Assert.Single(await w.Svc.ReceiptsAsync(Me, default));
    }

    [Fact]
    public async Task ADuplicateConfirmGivesTheSameReceiptAndDoesItOnlyOnce()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var a = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default);
        var again = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default);
        var otherKey = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0002-abc", null, default);
        Assert.Equal(a.Receipt, again.Receipt);
        Assert.Equal(a.Receipt, otherKey.Receipt);
        Assert.Equal(1, w.Effects.Executed);
    }

    [Fact]
    public async Task AKeyUsedForAnotherPreviewIsRefused()
    {
        var w = Build();
        var p1 = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var p2 = await w.Svc.PrepareAsync(Me, Towels, null, default);
        await w.Svc.ConfirmAsync(Me, Guid.Parse(p1.Id), "key-0001-abc", null, default);
        var e = await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Me, Guid.Parse(p2.Id), "key-0001-abc", null, default));
        Assert.Equal("keyUsed", e.Title);
        Assert.Equal(1, w.Effects.Executed);
    }

    [Fact]
    public async Task AnExpiredPreviewIsRefusedAndNothingRuns()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        w.Clock.UtcNow = T0.AddMinutes(StanleyActionRules.PreviewMinutes + 1);
        var e = await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default));
        Assert.Equal("expired", e.Title);
        Assert.Equal(0, w.Effects.Executed);
        Assert.Equal(StanleyActionStatus.Expired, w.Store.Rows.Single().Status);
        // It stays expired: a second try is the same answer, and a new preview is needed.
        var again = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0002-abc", null, default);
        Assert.Equal(StanleyActionStatus.Expired, again.Status);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task APriceOrAvailabilityThatMovedVoidsThePreview()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        w.Effects.Facts = "price 120";
        var e = await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default));
        Assert.Equal("changed", e.Title);
        Assert.Equal(0, w.Effects.Executed);
        Assert.Equal(StanleyActionStatus.Changed, w.Store.Rows.Single().Status);
        Assert.Contains(w.Audit.Rows, a => a is { Action: "stanley.action.changed", Outcome: AuditOutcome.Denied });
    }

    [Fact]
    public async Task AnotherGuestsPreviewCannotBeConfirmedOrReadOrUndone()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var id = Guid.Parse(p.Id);
        Assert.Equal("notFound", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Other, id, "key-0001-abc", null, default))).Title);
        Assert.Equal("notFound", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.GetAsync(Other, id, null, default))).Title);
        Assert.Equal("notFound", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.UndoAsync(Other, id, null, default))).Title);
        Assert.Empty(await w.Svc.ReceiptsAsync(Other, default));
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task NoMutatingCallRunsWithoutAValidPreviewToken()
    {
        var w = Build();
        var e = await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Me, Guid.NewGuid(), "key-0001-abc", null, default));
        Assert.Equal("notFound", e.Title);
        Assert.Equal("badKey", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Me, Guid.NewGuid(), null, null, default))).Title);
        Assert.Equal("badAction", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.PrepareAsync(Me, new StanleyIntent("pay_bill", new Dictionary<string, string>()), null, default))).Title);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task AChildAccountCannotPrepareConfirmOrUndo()
    {
        var w = Build();
        Assert.Equal("forbidden", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.PrepareAsync(Child, Towels, null, default))).Title);
        Assert.Equal("forbidden", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Child, Guid.NewGuid(), "key-0001-abc", null, default))).Title);
        Assert.Equal("forbidden", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.UndoAsync(Child, Guid.NewGuid(), null, default))).Title);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task ThePermissionIsCheckedAgainAtConfirm()
    {
        // The preview was made while the guest could act; at confirm the check refuses (a grant revoked, an account made supervised), and nothing runs.
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var became = new UserRecord { Id = Me.Id, PublicId = Me.PublicId, IsSupervised = true };
        Assert.Equal("forbidden", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(became, Guid.Parse(p.Id), "key-0001-abc", null, default))).Title);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task AServiceThatRefusesLeavesAFailedReceiptWithTheReason()
    {
        var w = Build();
        w.Effects.Throw = ApiException.Conflict("full");
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var r = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default);
        Assert.Equal((StanleyActionStatus.Failed, "full"), (r.Status, r.Reason));
        Assert.Null(r.Receipt);
        Assert.Contains(w.Audit.Rows, a => a is { Action: "stanley.action.confirm", Outcome: AuditOutcome.Failure });
        // Repeating the confirm does not run it again.
        w.Effects.Throw = null;
        Assert.Equal(StanleyActionStatus.Failed, (await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default)).Status);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task AnUnknownOutcomeIsSettledAgainstWhatExistsBeforeAnyRetry()
    {
        var w = Build();
        w.Effects.Throw = new InvalidOperationException("the connection dropped");
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var id = Guid.Parse(p.Id);
        var pending = await w.Svc.ConfirmAsync(Me, id, "key-0001-abc", null, default);
        Assert.Equal(StanleyActionStatus.Pending, pending.Status);

        // It is not there yet and the attempt is fresh: still pending, and not run again.
        w.Effects.Throw = null;
        Assert.Equal(StanleyActionStatus.Pending, (await w.Svc.ConfirmAsync(Me, id, "key-0001-abc", null, default)).Status);
        Assert.Equal(0, w.Effects.Executed);

        // It turns out the effect did happen: it is done, with a receipt, and never run a second time.
        w.Effects.Exists = true;
        var settled = await w.Svc.GetAsync(Me, id, null, default);
        Assert.Equal(StanleyActionStatus.Done, settled.Status);
        Assert.NotNull(settled.Receipt);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task AnOutcomeThatNeverHappenedGoesBackToPreparedOnlyAfterItIsOldEnough()
    {
        var w = Build();
        w.Effects.Throw = new InvalidOperationException("the connection dropped");
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var id = Guid.Parse(p.Id);
        await w.Svc.ConfirmAsync(Me, id, "key-0001-abc", null, default);
        w.Effects.Throw = null;
        w.Clock.UtcNow = T0.AddSeconds(StanleyActionRules.StaleSeconds + 1);
        Assert.Equal(StanleyActionStatus.Prepared, (await w.Svc.GetAsync(Me, id, null, default)).Status);
        var done = await w.Svc.ConfirmAsync(Me, id, "key-0002-abc", null, default);
        Assert.Equal(StanleyActionStatus.Done, done.Status);
        Assert.Equal(1, w.Effects.Executed);
    }

    [Fact]
    public async Task UndoWorksForTwoHoursAndOnlyOnce()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Towels, null, default);
        var id = Guid.Parse(p.Id);
        Assert.Equal("tooLate", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.UndoAsync(Me, id, null, default))).Title);   // not done yet
        await w.Svc.ConfirmAsync(Me, id, "key-0001-abc", null, default);
        w.Clock.UtcNow = T0.AddMinutes(119);
        var undone = await w.Svc.UndoAsync(Me, id, null, default);
        Assert.Equal(StanleyActionStatus.Undone, undone.Status);
        Assert.Equal(1, w.Effects.Undone);
        Assert.Equal(StanleyActionStatus.Undone, (await w.Svc.UndoAsync(Me, id, null, default)).Status);
        Assert.Equal(1, w.Effects.Undone);

        var q = await w.Svc.PrepareAsync(Me, Towels, null, default);
        await w.Svc.ConfirmAsync(Me, Guid.Parse(q.Id), "key-0003-abc", null, default);
        w.Clock.UtcNow = T0.AddMinutes(119 + StanleyActionRules.UndoMinutes + 1);
        Assert.Equal("tooLate", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.UndoAsync(Me, Guid.Parse(q.Id), null, default))).Title);
    }

    [Fact]
    public async Task ADeviceActionIsConfirmedAndReceiptedButTheServerChangesNothing()
    {
        var w = Build();
        var p = await w.Svc.PrepareAsync(Me, Remind, null, default);
        Assert.True(p.OnDevice);
        var done = await w.Svc.ConfirmAsync(Me, Guid.Parse(p.Id), "key-0001-abc", null, default);
        Assert.Equal((StanleyActionStatus.Done, true), (done.Status, done.OnDevice));
        Assert.Equal("16:15", done.Params["at"]);
        Assert.Equal(0, w.Effects.Executed);
        var undone = await w.Svc.UndoAsync(Me, Guid.Parse(p.Id), null, default);
        Assert.Equal(StanleyActionStatus.Undone, undone.Status);
        Assert.Equal(0, w.Effects.Undone);
    }

    [Fact]
    public async Task TheKillSwitchStopsEveryStep()
    {
        var w = Build(o => o.Switches.Actions = false);
        Assert.Equal("off", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.PrepareAsync(Me, Towels, null, default))).Title);
        Assert.Equal("off", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.ConfirmAsync(Me, Guid.NewGuid(), "key-0001-abc", null, default))).Title);
        Assert.Equal("off", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.UndoAsync(Me, Guid.NewGuid(), null, default))).Title);
    }

    [Fact]
    public async Task TheStoredPreviewHoldsTheIntentAndNeverTheChatMessage()
    {
        var w = Build();
        await w.Svc.PrepareAsync(Me, Towels, null, default);
        var data = w.Store.Rows.Single().Data;
        Assert.Contains("towels", data);
        Assert.DoesNotContain("I need", data);
    }

    // ---- through the gateway ------------------------------------------------------------------------------------------------------------

    private sealed class NeverModel : IConciergeModel
    {
        public bool Available => false;
        public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct) => throw new InvalidOperationException("A model was called.");
    }

    private sealed class OneTrip : IStanleyTrips
    {
        public Task<StanleyTrip?> LoadAsync(UserRecord user, CancellationToken ct) =>
            Task.FromResult<StanleyTrip?>(new StanleyTrip(new DateOnly(2027, 3, 5), new DateOnly(2027, 3, 20), 7, "Sun Princess", "Balcony", "late", [41], [], [], [], "S1", T0));
    }

    private sealed class NoTools : IStanleyTools
    {
        public Task<ConciergeContext> ContextAsync(UserRecord user, string? mobility, List<string>? likes, CancellationToken ct) =>
            Task.FromResult(new ConciergeContext(T0, "S1", new DateOnly(2027, 3, 20), "Sun Princess", "Balcony", "Daniel", [new PartyMember("Daniel", 41)], [], mobility ?? "any", likes ?? []));
        public Task<ConciergeReplyDto> AskModelAsync(List<ConciergeMessageDto> history, ConciergeContext ctx, ModelMeter meter, ModelTier tier, CancellationToken ct) => throw new InvalidOperationException("The tools route was used.");
    }

    private static (StanleyService Gateway, World World) Gateway(Action<StanleyOptions>? tweak = null)
    {
        var w = Build(tweak);
        var o = new StanleyOptions();
        tweak?.Invoke(o);
        var gateway = new StanleyService(new NeverModel(), new MemoryConciergeLimiter(), new FakeClock(T0), new OneTrip(), new NoTools(), new MemoryStanleyTierLog(), Options.Create(o),
            NullLogger<StanleyService>.Instance, null, w.Svc);
        return (gateway, w);
    }

    private static StanleyRequestDto Say(string text, StanleyActionContext? plan = null) => new([new("user", text, 1)], new StanleyContextDto("sea"), null, null, plan);

    [Fact]
    public async Task ARequestToChangeSomethingComesBackAsAPreviewWithNoModelAndNothingDone()
    {
        var (g, w) = Gateway();
        var r = await g.AskAsync(Me, Say("I need two more towels please"), default);
        Assert.Equal(("answer", "action"), (r.Kind, r.Tier));
        Assert.Equal(StanleyActionStatus.Prepared, r.Action!.Status);
        Assert.Equal(0, w.Effects.Executed);
    }

    [Fact]
    public async Task AMissingDetailComesBackAsAQuestion()
    {
        var (g, w) = Gateway();
        var r = await g.AskAsync(Me, Say("Move dinner to 3am"), default);
        Assert.Equal(("answer", "action"), (r.Kind, r.Tier));
        Assert.Null(r.Action);
        Assert.Contains("What time", r.Text);
        Assert.Empty(w.Store.Rows);
    }

    [Theory]
    [InlineData("pay my bill")]
    [InlineData("please cancel my booking")]
    [InlineData("change my cabin to a suite")]
    [InlineData("share my passport with my agent")]
    public async Task WhatStanleyNeverDoesIsRefusedWithAPlaceToDoItAndNothingIsPrepared(string text)
    {
        var (g, w) = Gateway();
        var r = await g.AskAsync(Me, Say(text), default);
        Assert.Equal(("answer", "action"), (r.Kind, r.Tier));
        Assert.Null(r.Action);
        Assert.Contains("can't", r.Text);
        Assert.NotEmpty(r.Sources!);
        Assert.Empty(w.Store.Rows);
    }

    [Fact]
    public async Task APlanChangeUsesThePlanTheDeviceSent()
    {
        var (g, w) = Gateway();
        var r = await g.AskAsync(Me, Say("skip the pub quiz", WithPlan), default);
        Assert.Equal("action", r.Tier);
        Assert.Equal("drop", r.Action!.Params["op"]);
        Assert.True(r.Action.OnDevice);
    }

    [Fact]
    public async Task WithTheSwitchOffARequestIsNotPreparedAndANeverRequestIsStillRefused()
    {
        var (g, w) = Gateway(o => o.Switches.Actions = false);
        var r = await g.AskAsync(Me, Say("I need two more towels please"), default);
        Assert.Null(r.Action);
        Assert.Empty(w.Store.Rows);
        Assert.Equal("action", (await g.AskAsync(Me, Say("pay my bill"), default)).Tier);
    }
}
