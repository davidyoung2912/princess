using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// What the guest lets Stanley do (docs/stanley-actions-and-proactive-plan.md, phase P0a): a new guest is at level 2, level 1 and a pause stop his own unprompted steps, voice off and a child account cap the level at 1,
/// raising to 3 or 4 needs the emailed code once, the unbuilt rows claim nothing, and the consent history keeps no text.
/// </summary>
public class StanleyPermissionTests
{
    private static readonly DateTime T0 = new(2027, 3, 5, 15, 0, 0, DateTimeKind.Utc);
    private static readonly UserRecord Me = new() { Id = 1, PublicId = Guid.NewGuid(), Email = "ann@example.com" };
    private static readonly UserRecord Other = new() { Id = 2, PublicId = Guid.NewGuid(), Email = "bob@example.com" };
    private static readonly UserRecord Child = new() { Id = 3, PublicId = Guid.NewGuid(), IsSupervised = true };

    private sealed class FixedClock(DateTime now) : IUserClock { public DateTime Now { get; set; } = now; public Task<DateTime> NowAsync(UserRecord user, CancellationToken ct) => Task.FromResult(Now); }
    private sealed class FakeAudit : IAuditLog
    {
        public List<AuditEntry> Rows { get; } = [];
        public Task RecordAsync(AuditEntry entry, CancellationToken ct = default) { Rows.Add(entry); return Task.CompletedTask; }
    }

    private sealed record World(StanleyPermissionService Svc, FixedClock Clock, SimEmailSender Email, MemoryStanleyMemoryStore Memory, FakeAudit Audit, InMemoryStateStore State);

    private static World Build(bool authority = false)
    {
        var clock = new FixedClock(T0);
        var email = new SimEmailSender();
        var memory = new MemoryStanleyMemoryStore();
        var audit = new FakeAudit();
        var state = new InMemoryStateStore();
        var options = Options.Create(new StanleyOptions { Switches = new() { Authority = authority } });
        return new(new StanleyPermissionService(state, memory, clock, email, Options.Create(new JwtOptions { SigningKey = "test-signing-key-test-signing-key-123456" }), options, audit), clock, email, memory, audit, state);
    }

    private static StanleyLevelRequest Lvl(int level, string? stepUp = null) => new(level, "settings", stepUp);
    private static StanleyRowRequest Row(bool on, string? stepUp = null) => new(on, "settings", stepUp);

    private static async Task<string> TokenAsync(World w, UserRecord user = null!)
    {
        user ??= Me;
        await w.Svc.SendStepUpAsync(user, default);
        var code = Regex.Match(w.Email.Sent.Last().Body, @"\b\d{6}\b").Value;
        return (await w.Svc.VerifyStepUpAsync(user, new(code), default)).Token!;
    }

    // ---- Rules --------------------------------------------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public void ANewGuestIsAtLevelFourWithTheBuiltWatchingRowsOn()
    {
        var v = StanleyPermissionRules.View(new(), false, false, true, 0);
        Assert.Equal((4, 4), (v.Level, v.EffectiveLevel));
        Assert.Equal("on", v.Rows.Single(r => r.Id == "CL-02").State);
        Assert.Equal("on", v.Rows.Single(r => r.Id == "CL-03").State);
    }

    [Fact]
    public void ARowWhoseAbilityIsNotBuiltClaimsNothing()
    {
        var doc = new StanleyPermissionDoc(4, new() { ["CL-01"] = true });
        var v = StanleyPermissionRules.View(doc, false, false, true, 0);
        Assert.Equal("soon", v.Rows.Single(r => r.Id == "CL-01").State);
        Assert.All(StanleyPermissionRules.Rows.Where(r => !r.Built), r => Assert.False(StanleyPermissionRules.IsOn(doc, r, 4, false)));
    }

    [Fact]
    public void TheBriefIsNeverOnUntilTheGuestTurnsItOn()
    {
        var brief = StanleyPermissionRules.Row("CL-04")!;
        Assert.True(brief.NeverPreTicked);
        Assert.False(StanleyPermissionRules.IsOn(new(), brief, 2, false));
    }

    [Fact]
    public void LevelOneVoiceOffAChildAndAPauseTakeEveryUnpromptedRowOff()
    {
        var row = StanleyPermissionRules.Row("CL-02")!;
        Assert.False(StanleyPermissionRules.IsOn(new(1), row, 1, false));
        Assert.Equal(1, StanleyPermissionRules.EffectiveLevel(new(4), false, true));
        Assert.Equal(1, StanleyPermissionRules.EffectiveLevel(new(4), true, false));
        Assert.False(StanleyPermissionRules.IsOn(new(2), row, 2, true));
        Assert.True(StanleyPermissionRules.IsPaused(new(2, null, long.MaxValue), 5));
        Assert.False(StanleyPermissionRules.IsPaused(new(2, null, 100), 100));
    }

    [Fact]
    public void LoweringTheLevelDropsTheRowsAboveIt()
    {
        var doc = new StanleyPermissionDoc(4, new() { ["CL-02"] = false, ["CL-08"] = true });
        var lower = StanleyPermissionRules.WithLevel(doc, 2);
        Assert.Equal(2, lower.Level);
        Assert.False(lower.RowMap.ContainsKey("CL-08"));
        Assert.False(lower.RowMap["CL-02"]);
    }

    [Fact]
    public void OnlyRaisingToThreeOrFourOrSwitchingOnAHandlingRowNeedsStepUp()
    {
        Assert.True(StanleyPermissionRules.NeedsStepUp(2, 3));
        Assert.True(StanleyPermissionRules.NeedsStepUp(1, 4));
        Assert.False(StanleyPermissionRules.NeedsStepUp(4, 2));
        Assert.False(StanleyPermissionRules.NeedsStepUp(1, 2));
        Assert.True(StanleyPermissionRules.RowNeedsStepUp(StanleyPermissionRules.Row("CL-10")!, true));
        Assert.False(StanleyPermissionRules.RowNeedsStepUp(StanleyPermissionRules.Row("CL-10")!, false));
        Assert.False(StanleyPermissionRules.RowNeedsStepUp(StanleyPermissionRules.Row("CL-02")!, true));
    }

    [Fact]
    public void PauseTodayEndsAtTheNextMidnightAndForeverNeverEnds()
    {
        var until = StanleyPermissionRules.PauseUntil("today", T0)!.Value;
        Assert.Equal(new DateTimeOffset(new DateTime(2027, 3, 6, 0, 0, 0, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), until);
        Assert.Equal(long.MaxValue, StanleyPermissionRules.PauseUntil("forever", T0));
        Assert.Null(StanleyPermissionRules.PauseUntil("week", T0));
    }

    [Fact]
    public void AGarbledDocumentBecomesTheDefault()
    {
        Assert.Equal(4, StanleyPermissionRules.Parse("not json").Level);
        Assert.Equal(4, StanleyPermissionRules.Parse("{\"level\":9}").Level);
        Assert.Empty(StanleyPermissionRules.Parse("{\"level\":3,\"rows\":{\"CL-99\":true}}").RowMap);
    }

    [Fact]
    public void TheWordsNeverSayAIAndEveryRowSaysWhatItNeverDoes()
    {
        var words = StanleyPermissionRules.Rows.SelectMany(r => new[] { r.Wording, r.Example, r.Never }).Concat(StanleyPermissionRules.Levels(true).SelectMany(l => new[] { l.Name, l.Line }));
        Assert.All(words, w => Assert.DoesNotMatch(@"\bAI\b", w));
        Assert.All(StanleyPermissionRules.Rows, r => Assert.NotEmpty(r.Never));
        Assert.Equal(12, StanleyPermissionRules.Rows.Count);
    }

    [Fact]
    public void TheConsentHistoryKeepsTheLastTwoHundred()
    {
        var log = new List<StanleyConsentDto>();
        for (var i = 0; i < 250; i++) log = StanleyPermissionRules.AppendConsent(log, new("level", "2", 1, "welcome", i));
        Assert.Equal(200, log.Count);
        Assert.Equal(249, log[^1].At);
    }

    // ---- Service ------------------------------------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ANewGuestMayBeToldWhatChangedAndLevelOneStopsIt()
    {
        var w = Build();
        Assert.True(await w.Svc.MayAsync(Me, "CL-02", default));
        await w.Svc.SetLevelAsync(Me, Lvl(1), default);
        Assert.False(await w.Svc.MayAsync(Me, "CL-02", default));
        Assert.False(await w.Svc.MayAsync(Me, "CL-03", default));
        await w.Svc.SetLevelAsync(Me, Lvl(2), default);
        Assert.True(await w.Svc.MayAsync(Me, "CL-02", default));
    }

    [Fact]
    public async Task AnUnknownOrUnbuiltRowIsNeverAllowed()
    {
        var w = Build();
        Assert.False(await w.Svc.MayAsync(Me, "CL-99", default));
        Assert.False(await w.Svc.MayAsync(Me, "CL-01", default));
    }

    [Fact]
    public async Task OneRowCanBeSwitchedOffAndOnAndTheOthersStay()
    {
        var w = Build();
        await w.Svc.SetRowAsync(Me, "CL-02", Row(false), default);
        Assert.False(await w.Svc.MayAsync(Me, "CL-02", default));
        Assert.True(await w.Svc.MayAsync(Me, "CL-03", default));
        await w.Svc.SetRowAsync(Me, "CL-02", Row(true), default);
        Assert.True(await w.Svc.MayAsync(Me, "CL-02", default));
    }

    [Fact]
    public async Task PauseStopsEverythingUntilResumedAndTodayEndsAtMidnight()
    {
        var w = Build();
        var paused = await w.Svc.PauseAsync(Me, new("today"), default);
        Assert.True(paused.Paused);
        Assert.False(await w.Svc.MayAsync(Me, "CL-02", default));
        w.Clock.Now = T0.AddDays(1);
        Assert.True(await w.Svc.MayAsync(Me, "CL-02", default));
        await w.Svc.PauseAsync(Me, new("forever"), default);
        w.Clock.Now = T0.AddDays(30);
        Assert.False(await w.Svc.MayAsync(Me, "CL-02", default));
        Assert.False((await w.Svc.ResumeAsync(Me, default)).Paused);
        Assert.True(await w.Svc.MayAsync(Me, "CL-02", default));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.PauseAsync(Me, new("week"), default));
    }

    [Fact]
    public async Task VoiceOffCapsTheLevelAtOne()
    {
        var w = Build();
        await w.Memory.SetLevelAsync(Me.Id, "off", default);
        var v = await w.Svc.GetAsync(Me, default);
        Assert.Equal((4, 1, true), (v.Level, v.EffectiveLevel, v.VoiceLimited));
        Assert.False(await w.Svc.MayAsync(Me, "CL-02", default));
        await w.Memory.SetLevelAsync(Me.Id, "helpful", default);
        Assert.True(await w.Svc.MayAsync(Me, "CL-02", default));
    }

    [Fact]
    public async Task AChildAccountIsAtLevelOneAndCannotChangeAnything()
    {
        var w = Build();
        Assert.False(await w.Svc.MayAsync(Child, "CL-02", default));
        var v = await w.Svc.GetAsync(Child, default);
        Assert.Equal((1, true), (v.EffectiveLevel, v.ChildLimited));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Child, Lvl(2), default));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetRowAsync(Child, "CL-02", Row(true), default));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.PauseAsync(Child, new("today"), default));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SendStepUpAsync(Child, default));
    }

    [Fact]
    public async Task OneGuestsChoicesNeverReachAnother()
    {
        var w = Build();
        await w.Svc.SetLevelAsync(Me, Lvl(1), default);
        Assert.True(await w.Svc.MayAsync(Other, "CL-02", default));
        Assert.Equal(4, (await w.Svc.GetAsync(Other, default)).Level);
        Assert.Empty(await w.Svc.HistoryAsync(Other, default));
    }

    [Fact]
    public async Task LevelsThreeAndFourAreRefusedWhileTheAuthoritySwitchIsOff()
    {
        var w = Build(authority: false);
        var e = await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, Lvl(3), default));
        Assert.Equal("notYet", e.Title);
        Assert.False((await w.Svc.GetAsync(Me, default)).Levels.Single(l => l.Id == 3).Available);
    }

    [Fact]
    public async Task RaisingToLevelThreeNeedsTheEmailedCodeOnce()
    {
        var w = Build(authority: true);
        var refused = await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, Lvl(3), default));
        Assert.Equal("stepUp", refused.Title);
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, Lvl(3, "made-up"), default));
        var token = await TokenAsync(w);
        Assert.Equal(3, (await w.Svc.SetLevelAsync(Me, Lvl(3, token), default)).Level);
        // The token works once: raising again with it is refused.
        await w.Svc.SetLevelAsync(Me, Lvl(2), default);
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, Lvl(3, token), default));
    }

    [Fact]
    public async Task LoweringNeedsNoCodeAndSwitchesTheRowsAboveOffAtOnce()
    {
        var w = Build(authority: true);
        await w.Svc.SetLevelAsync(Me, Lvl(4, await TokenAsync(w)), default);
        var lower = await w.Svc.SetLevelAsync(Me, Lvl(2), default);
        Assert.Equal(2, lower.Level);
        Assert.All(lower.Rows.Where(r => r.NeedsLevel > 2), r => Assert.Contains(r.State, new[] { "soon", "needsLevel" }));
    }

    [Fact]
    public async Task ARowThatIsNotBuiltCannotBeSwitchedOnAndOneAboveTheLevelNeedsTheLevel()
    {
        var w = Build(authority: true);
        Assert.Equal("notYet", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetRowAsync(Me, "CL-01", Row(true), default))).Title);
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetRowAsync(Me, "CL-77", Row(true), default));
        await w.Svc.SetRowAsync(Me, "CL-01", Row(false), default);
    }

    [Fact]
    public async Task AWrongCodeIsRefusedAndFiveWrongTriesLockIt()
    {
        var w = Build(authority: true);
        await w.Svc.SendStepUpAsync(Me, default);
        for (var i = 0; i < PhoneRules.MaxAttempts; i++) Assert.Equal("wrongCode", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.VerifyStepUpAsync(Me, new("000000"), default))).Title);
        Assert.Equal("tooManyTries", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.VerifyStepUpAsync(Me, new("000000"), default))).Title);
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SendStepUpAsync(Me, default));   // a minute between codes
    }

    [Fact]
    public async Task ACodeSentToOneGuestDoesNotWorkForAnother()
    {
        var w = Build(authority: true);
        await w.Svc.SendStepUpAsync(Me, default);
        var code = Regex.Match(w.Email.Sent.Last().Body, @"\b\d{6}\b").Value;
        Assert.Equal("noCode", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.VerifyStepUpAsync(Other, new(code), default))).Title);
    }

    [Fact]
    public async Task AnOldCodeAndAnOldTokenAreRefused()
    {
        var w = Build(authority: true);
        await w.Svc.SendStepUpAsync(Me, default);
        var code = Regex.Match(w.Email.Sent.Last().Body, @"\b\d{6}\b").Value;
        w.Clock.Now = T0.AddMinutes(PhoneRules.CodeMinutes + 1);
        Assert.Equal("expiredCode", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.VerifyStepUpAsync(Me, new(code), default))).Title);
        w.Clock.Now = T0.AddMinutes(30);
        var token = await TokenAsync(w);
        w.Clock.Now = T0.AddMinutes(30 + StanleyPermissionRules.StepUpTokenMinutes + 1);
        Assert.Equal("stepUp", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, Lvl(3, token), default))).Title);
    }

    [Fact]
    public async Task EveryChangeWritesOneConsentLineWithNoText()
    {
        var w = Build();
        await w.Svc.SetLevelAsync(Me, Lvl(1), default);
        await w.Svc.SetLevelAsync(Me, Lvl(2), default);
        await w.Svc.SetRowAsync(Me, "CL-02", Row(false), default);
        await w.Svc.PauseAsync(Me, new("today"), default);
        await w.Svc.ResumeAsync(Me, default);
        var h = await w.Svc.HistoryAsync(Me, default);
        Assert.Equal(new[] { "pause", "pause", "CL-02", "level", "level" }, h.Select(x => x.Ability));
        Assert.All(h, x => Assert.Equal(StanleyPermissionRules.WordingVersion, x.WordingVersion));
        Assert.Equal("off", h[0].State);
        Assert.Equal("settings", h[0].Source);
        Assert.All(w.Audit.Rows, a => Assert.StartsWith("stanley.permission.", a.Action));
    }

    [Fact]
    public async Task ASameChoiceTwiceWritesOneLineAndABadSourceIsRefused()
    {
        var w = Build();
        await w.Svc.SetLevelAsync(Me, Lvl(1), default);
        await w.Svc.SetLevelAsync(Me, Lvl(1), default);
        Assert.Single(await w.Svc.HistoryAsync(Me, default));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, new(2, "hack", null), default));
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.SetLevelAsync(Me, new(9, "settings", null), default));
    }
}
