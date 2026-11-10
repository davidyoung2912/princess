using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// What Stanley remembers (docs/stanley-gap-analysis-and-plan.md, phase 7). Items have a fixed kind, a reason and a scope; carry-forward moves a trip item to future trips; forgetting removes it from the next
/// answer; one guest's items never reach another's packet; sensitive items need the guest's switch; memory off means nothing is told; a child account keeps none; the audit trail never holds the value.
/// </summary>
public class StanleyMemoryTests
{
    private static readonly DateTime T0 = new(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly UserRecord Me = new() { Id = 1, PublicId = Guid.NewGuid() };
    private static readonly UserRecord Other = new() { Id = 2, PublicId = Guid.NewGuid() };
    private static readonly UserRecord Child = new() { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true };

    private sealed class FakeAudit : IAuditLog
    {
        public List<AuditEntry> Rows { get; } = [];
        public Task RecordAsync(AuditEntry entry, CancellationToken ct = default) { Rows.Add(entry); return Task.CompletedTask; }
    }

    private static (StanleyMemoryService Svc, FakeAudit Audit) Build()
    {
        var audit = new FakeAudit();
        return (new StanleyMemoryService(new MemoryStanleyMemoryStore(), new FakeClock(T0), audit), audit);
    }

    private static StanleyMemoryItemRequest Trip(string kind = "pace", string value = "relaxed", string sailing = "S1") => new(kind, value, "trip", sailing, "told", null);
    private static StanleyMemoryItemRequest Future(string kind = "pace", string value = "relaxed") => new(kind, value, "future", null, "told", null);

    [Fact]
    public async Task AnItemHasWordsAReasonAndAScope()
    {
        var (svc, _) = Build();
        var item = await svc.RememberAsync(Me, Trip(), default);
        Assert.Equal(("pace", "relaxed", "You like a relaxed pace", "trip", "S1"), (item.Kind, item.Value, item.Text, item.Scope, item.SailingId));
        Assert.Equal("You asked Stanley to remember this.", item.Reason);
        var all = await svc.GetAsync(Me, default);
        Assert.True(all.Enabled);
        Assert.Equal([item.Id], all.Items.Select(i => i.Id));
        Assert.Contains(all.Kinds, k => k.Kind == "mobility" && k.Sensitive);
    }

    [Theory]
    [InlineData("colour", "blue", "trip", "S1", "kind")]
    [InlineData("pace", "sprint", "trip", "S1", "value")]
    [InlineData("pace", "relaxed", "always", "S1", "scope")]
    [InlineData("pace", "relaxed", "trip", "", "sailing")]
    [InlineData("pace", "relaxed", "future", "S1", "sailing")]
    public async Task ABadRequestIsRefusedWithACode(string kind, string value, string scope, string sailing, string code) =>
        Assert.Equal(code, (await Assert.ThrowsAsync<ApiException>(() => Build().Svc.RememberAsync(Me, new(kind, value, scope, sailing, "told", null), default))).Message);

    [Fact]
    public async Task ASingleValuedKindIsReplacedAndAMultiValuedOneGrows()
    {
        var (svc, _) = Build();
        await svc.RememberAsync(Me, Future("pace", "relaxed"), default);
        await svc.RememberAsync(Me, Future("pace", "full"), default);
        await svc.RememberAsync(Me, Future("interest", "water"), default);
        await svc.RememberAsync(Me, Future("interest", "culture"), default);
        await svc.RememberAsync(Me, Future("interest", "water"), default);
        var items = (await svc.GetAsync(Me, default)).Items;
        Assert.Equal(["interest:culture", "interest:water", "pace:full"], items.Select(i => i.Kind + ":" + i.Value).OrderBy(x => x));
    }

    [Fact]
    public async Task CarryForwardMovesATripItemToFutureTripsAndReplacesAnOlderOne()
    {
        var (svc, _) = Build();
        await svc.RememberAsync(Me, Future("pace", "full"), default);
        var trip = await svc.RememberAsync(Me, Trip("pace", "relaxed"), default);
        var moved = await svc.UpdateAsync(Me, trip.Id, new("future", null), default);
        Assert.Equal(("future", null), (moved.Scope, moved.SailingId));
        var items = (await svc.GetAsync(Me, default)).Items;
        Assert.Equal([("pace", "relaxed", "future")], items.Select(i => (i.Kind, i.Value, i.Scope)));
        // There is no way to turn a future item into a trip item without naming a sailing.
        Assert.Equal("sailing", (await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(Me, trip.Id, new("trip", null), default))).Message);
    }

    [Fact]
    public async Task AForgottenItemIsNotToldToTheModelAndAForgetAllEmptiesIt()
    {
        var (svc, _) = Build();
        var a = await svc.RememberAsync(Me, Future("pace", "relaxed"), default);
        await svc.RememberAsync(Me, Future("wake", "late"), default);
        Assert.Equal(["pace: relaxed", "wake: late"], await svc.ForAnswersAsync(Me, "S1", default));
        await svc.ForgetAsync(Me, a.Id, default);
        Assert.Equal(["wake: late"], await svc.ForAnswersAsync(Me, "S1", default));
        Assert.DoesNotContain("relaxed", StanleyMemoryRules.Block(await svc.ForAnswersAsync(Me, "S1", default)));
        await svc.ForgetAllAsync(Me, default);
        Assert.Empty((await svc.GetAsync(Me, default)).Items);
        Assert.Empty(await svc.ForAnswersAsync(Me, "S1", default));
        Assert.Equal("", StanleyMemoryRules.Block([]));
    }

    [Fact]
    public async Task ATripItemIsToldOnlyForItsOwnVoyage()
    {
        var (svc, _) = Build();
        await svc.RememberAsync(Me, Trip("pace", "relaxed", "S1"), default);
        await svc.RememberAsync(Me, Future("wake", "early"), default);
        Assert.Equal(["pace: relaxed", "wake: early"], await svc.ForAnswersAsync(Me, "S1", default));
        Assert.Equal(["wake: early"], await svc.ForAnswersAsync(Me, "S2", default));
        Assert.Equal(["wake: early"], await svc.ForAnswersAsync(Me, null, default));
    }

    [Fact]
    public async Task OneGuestsItemsNeverReachAnotherGuestOrTheirPacket()
    {
        var (svc, _) = Build();
        var mine = await svc.RememberAsync(Me, Future("pace", "relaxed"), default);
        Assert.Empty((await svc.GetAsync(Other, default)).Items);
        Assert.Empty(await svc.ForAnswersAsync(Other, "S1", default));
        await Assert.ThrowsAsync<ApiException>(() => svc.ForgetAsync(Other, mine.Id, default));
        await Assert.ThrowsAsync<ApiException>(() => svc.UpdateAsync(Other, mine.Id, new("future", null), default));
        Assert.Single((await svc.GetAsync(Me, default)).Items);
    }

    [Fact]
    public async Task ASensitiveItemIsToldOnlyWhenTheGuestSwitchedItOn()
    {
        var (svc, _) = Build();
        var m = await svc.RememberAsync(Me, Future("mobility", "easy"), default);
        Assert.False(m.Shared);
        Assert.Empty(await svc.ForAnswersAsync(Me, "S1", default));
        await svc.UpdateAsync(Me, m.Id, new(null, true), default);
        Assert.Equal(["mobility: easy"], await svc.ForAnswersAsync(Me, "S1", default));
        await svc.UpdateAsync(Me, m.Id, new(null, false), default);
        Assert.Empty(await svc.ForAnswersAsync(Me, "S1", default));
    }

    [Fact]
    public async Task MemoryOffMeansNothingIsToldAndOnBringsTheItemsBack()
    {
        var (svc, _) = Build();
        await svc.RememberAsync(Me, Future(), default);
        await svc.SetEnabledAsync(Me, false, default);
        Assert.False((await svc.GetAsync(Me, default)).Enabled);
        Assert.Empty(await svc.ForAnswersAsync(Me, "S1", default));
        Assert.Single((await svc.GetAsync(Me, default)).Items);
        Assert.True((await svc.GetAsync(Other, default)).Enabled);
        await svc.SetEnabledAsync(Me, true, default);
        Assert.Single(await svc.ForAnswersAsync(Me, "S1", default));
    }

    [Fact]
    public async Task HowMuchStanleySpeaksUpIsKeptPerGuestAndSurvivesMemoryBeingSwitched()
    {
        var (svc, audit) = Build();
        Assert.Null((await svc.GetAsync(Me, default)).Level);
        await svc.SetSettingsAsync(Me, new StanleyMemorySettingsRequest(null, "asked"), default);
        Assert.Equal("asked", (await svc.GetAsync(Me, default)).Level);
        Assert.Null((await svc.GetAsync(Other, default)).Level);
        // Switching memory off or on leaves the level alone, and the level leaves memory on.
        await svc.SetSettingsAsync(Me, new StanleyMemorySettingsRequest(false, null), default);
        var after = await svc.GetAsync(Me, default);
        Assert.Equal(("asked", false), (after.Level, after.Enabled));
        await svc.SetSettingsAsync(Me, new StanleyMemorySettingsRequest(true, "chatty"), default);
        after = await svc.GetAsync(Me, default);
        Assert.Equal(("chatty", true), (after.Level, after.Enabled));
        // Forgetting everything is about what is remembered, not how loud Stanley is.
        await svc.ForgetAllAsync(Me, default);
        Assert.Equal("chatty", (await svc.GetAsync(Me, default)).Level);
        Assert.Contains(audit.Rows, r => r.Action == "stanley.memory.level");
    }

    [Fact]
    public async Task ALevelThatIsNotOneOfTheFourOrAnEmptyChangeIsRefusedAndAChildKeepsNone()
    {
        var (svc, _) = Build();
        foreach (var bad in new[] { "loud", "", "ASKED", "chatty; drop" })
            await Assert.ThrowsAsync<ApiException>(() => svc.SetSettingsAsync(Me, new StanleyMemorySettingsRequest(null, bad), default));
        await Assert.ThrowsAsync<ApiException>(() => svc.SetSettingsAsync(Me, new StanleyMemorySettingsRequest(null, null), default));
        await Assert.ThrowsAsync<ApiException>(() => svc.SetSettingsAsync(Me, null, default));
        await Assert.ThrowsAsync<ApiException>(() => svc.SetSettingsAsync(Child, new StanleyMemorySettingsRequest(null, "off"), default));
        Assert.Null((await svc.GetAsync(Me, default)).Level);
    }

    [Fact]
    public async Task AChildAccountKeepsNoMemoryAndIsToldNone()
    {
        var (svc, _) = Build();
        await Assert.ThrowsAsync<ApiException>(() => svc.RememberAsync(Child, Future(), default));
        Assert.Empty(await svc.ForAnswersAsync(Child, "S1", default));
    }

    [Fact]
    public async Task TheLimitIsForty()
    {
        var (svc, _) = Build();
        for (var i = 0; i < StanleyMemoryRules.MaxItems; i++) await svc.RememberAsync(Me, Trip("pace", "relaxed", "S" + i), default);
        Assert.Equal("tooMany", (await Assert.ThrowsAsync<ApiException>(() => svc.RememberAsync(Me, Trip("pace", "relaxed", "S99"), default))).Message);
        await svc.RememberAsync(Me, Trip("pace", "relaxed", "S0"), default);   // saying the same again is not a new item
    }

    [Fact]
    public async Task TheAuditTrailHoldsTheKindAndTheActionNeverTheValue()
    {
        var (svc, audit) = Build();
        var m = await svc.RememberAsync(Me, Future("diet", "vegan"), default);
        await svc.ForgetAsync(Me, m.Id, default);
        Assert.Equal(["stanley.memory.remember", "stanley.memory.forget"], audit.Rows.Select(r => r.Action));
        Assert.All(audit.Rows, r => Assert.DoesNotContain("vegan", (r.Detail ?? "") + (r.Target ?? "")));
    }

    [Fact]
    public void ThePacketBlockCarriesThePreferencesAndNothingElseAboutThem()
    {
        var voyage = new StanleyVoyage("S1", new DateOnly(2027, 4, 1), "Sun Princess", 7);
        var p = new StanleyPacket("gabc", "guest", voyage, "sea", "", [], [], [new StanleyTraveller("t1", "Ana", 40, false, true, TravellerAccess.Self)], false, ["pace: relaxed"]);
        Assert.Contains("pace: relaxed", p.Block());
        Assert.DoesNotContain("Preferences the guest", (p with { Preferences = null }).Block());
    }

    [Fact]
    public async Task AGuestWithNoVoyageIsToldOnlyFutureTripPreferences()
    {
        var (svc, _) = Build();
        await svc.RememberAsync(Me, Trip("pace", "full", "S1"), default);
        await svc.RememberAsync(Me, Future("wake", "late"), default);
        // No voyage means no sailing id: a trip's own item stays out.
        var told = await svc.ForAnswersAsync(Me, null, default);
        Assert.Equal(["wake: late"], told);
        var ctx = new ConciergeContext(T0, null, null, null, null, null, [], [], "any", [], told);
        Assert.Contains("wake: late", StanleyMemoryRules.Block(ctx.Preferences!));
        Assert.DoesNotContain("full", StanleyMemoryRules.Block(ctx.Preferences!));
    }
}
