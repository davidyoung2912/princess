using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Human handoff (docs/stanley-gap-analysis-and-plan.md, phase 6). A case exists only with a reference and the guest's consent; a child account cannot send one; an emergency is not a topic;
/// the audit trail never holds the guest's words; the case's progress, owner and overdue escalation come from the clock; the kill switch turns it off.
/// </summary>
public class StanleyHandoffTests
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

    private sealed record World(StanleyHandoffService Svc, FakeClock Clock, FakeAudit Audit);

    private static World Build(Action<StanleyOptions>? tweak = null)
    {
        var o = new StanleyOptions();
        tweak?.Invoke(o);
        var clock = new FakeClock(T0);
        var audit = new FakeAudit();
        return new World(new StanleyHandoffService(new MemoryStanleyHandoffStore(), clock, audit, Options.Create(o)), clock, audit);
    }

    private static StanleyHandoffRequest Ask(string topic = "cabin", bool consent = true, string issue = "The air conditioning in my cabin is not working.") =>
        new(topic, issue, "Fix it today", "B12345", "Called the cabin steward", "", "guest", consent);

    [Fact]
    public async Task ACaseHasAReferenceAnOwnerAndAStatus()
    {
        var w = Build();
        var h = await w.Svc.CreateAsync(Me, Ask(), default);
        Assert.Matches("^GS-[A-Z2-9]{6}$", h.Reference);
        Assert.Equal(("cabin", "Housekeeping and Guest Services", "submitted"), (h.Topic, h.Owner, h.Status));
        Assert.False(h.Overdue);
        Assert.Equal([h.Id], (await w.Svc.ListAsync(Me, default)).Select(x => x.Id));
    }

    [Fact]
    public async Task NothingIsSentWithoutConsent() =>
        Assert.Equal("consent", (await Assert.ThrowsAsync<ApiException>(() => Build().Svc.CreateAsync(Me, Ask(consent: false), default))).Message);

    [Theory]
    [InlineData("emergency")]
    [InlineData("")]
    [InlineData("pay")]
    public async Task AnEmergencyOrAnUnknownTopicIsNotAHandoff(string topic) =>
        Assert.Equal("topic", (await Assert.ThrowsAsync<ApiException>(() => Build().Svc.CreateAsync(Me, Ask(topic), default))).Message);

    [Fact]
    public async Task AnEmptyOrLongIssueIsRefused()
    {
        var w = Build();
        Assert.Equal("issue", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.CreateAsync(Me, Ask(issue: "  "), default))).Message);
        Assert.Equal("tooLong", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.CreateAsync(Me, Ask(issue: new string('x', 1001)), default))).Message);
    }

    [Fact]
    public async Task AChildAccountCannotSendOne() =>
        await Assert.ThrowsAsync<ApiException>(() => Build().Svc.CreateAsync(Child, Ask(), default));

    [Fact]
    public async Task TheSwitchTurnsTheCaseOffSoNoClaimIsPossible()
    {
        var w = Build(o => o.Switches.Handoff = false);
        Assert.Equal("off", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.CreateAsync(Me, Ask(), default))).Message);
        Assert.Empty(await w.Svc.ListAsync(Me, default));
        Assert.Contains("handoff", new StanleySwitches { Handoff = false }.Off());
    }

    [Fact]
    public async Task OneGuestCannotReadAnothersCase()
    {
        var w = Build();
        var h = await w.Svc.CreateAsync(Me, Ask(), default);
        await Assert.ThrowsAsync<ApiException>(() => w.Svc.GetAsync(Other, h.Id, default));
        Assert.Empty(await w.Svc.ListAsync(Other, default));
        Assert.Equal(h.Reference, (await w.Svc.GetAsync(Me, h.Id, default)).Reference);
    }

    [Fact]
    public async Task TheAuditTrailHoldsTheTopicAndReferenceNeverTheWords()
    {
        var w = Build();
        var h = await w.Svc.CreateAsync(Me, Ask(issue: "My secret allergy to shellfish"), default);
        var row = Assert.Single(w.Audit.Rows);
        Assert.Equal(("stanley.handoff", h.Reference, "cabin"), (row.Action, row.Target, row.Detail));
        Assert.DoesNotContain("shellfish", row.Detail + row.Target);
    }

    [Fact]
    public async Task AtMostTenACaseADay()
    {
        var w = Build();
        for (var i = 0; i < StanleyHandoffRules.MaxOpen; i++) await w.Svc.CreateAsync(Me, Ask(), default);
        Assert.Equal("tooManyCases", (await Assert.ThrowsAsync<ApiException>(() => w.Svc.CreateAsync(Me, Ask(), default))).Message);
        w.Clock.UtcNow = T0.AddHours(25);
        await w.Svc.CreateAsync(Me, Ask(), default);
    }

    [Fact]
    public async Task ReferencesDoNotRepeat()
    {
        var w = Build();
        var refs = new HashSet<string>();
        for (var i = 0; i < 8; i++) refs.Add((await w.Svc.CreateAsync(Me, Ask(), default)).Reference);
        Assert.Equal(8, refs.Count);
    }

    // ---- progress ------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public void ACaseIsAcknowledgedThenOverdueThenEscalatedAndNeverSolvedByTheClockAlone()
    {
        var (s0, _, o0, e0) = StanleyHandoffRules.StatusOf("cabin", T0, T0.AddMinutes(5));
        Assert.Equal(("submitted", false, false), (s0, o0, e0));
        var (s1, next, o1, e1) = StanleyHandoffRules.StatusOf("cabin", T0, T0.AddHours(1));
        Assert.Equal(("acknowledged", false, false), (s1, o1, e1));
        Assert.Equal(T0.AddHours(4), next);
        var (s2, _, o2, e2) = StanleyHandoffRules.StatusOf("cabin", T0, T0.AddHours(5));
        Assert.Equal(("acknowledged", true, false), (s2, o2, e2));
        var (s3, _, o3, e3) = StanleyHandoffRules.StatusOf("cabin", T0, T0.AddHours(9));
        Assert.Equal(("acknowledged", true, true), (s3, o3, e3));
    }

    [Fact]
    public void OnlyASpecialRequestEverShowsFulfilled()
    {
        Assert.Equal("fulfilled", StanleyHandoffRules.StatusOf("special", T0, T0.AddHours(25)).Status);
        foreach (var topic in StanleyHandoffRules.Topics.Where(t => t != "special"))
            Assert.NotEqual("fulfilled", StanleyHandoffRules.StatusOf(topic, T0, T0.AddDays(30)).Status);
    }

    [Fact]
    public void EveryTopicHasAnOwnerAndTimes()
    {
        foreach (var topic in StanleyHandoffRules.Topics)
        {
            Assert.False(string.IsNullOrWhiteSpace(StanleyHandoffRules.Owner(topic)));
            var (ack, update, escalate) = StanleyHandoffRules.Times(topic);
            Assert.True(ack > 0 && update > 0 && escalate >= update);
        }
    }
}
