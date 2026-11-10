using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>
/// The kill switches (docs/stanley-gap-analysis-and-plan.md, phase 14; docs/runbook.md, Stanley incident playbook). Each of the eight routes can be turned off alone, is then named in the status,
/// and turning one off never turns another off. The behaviour of each route when off is in its own test file; this is the list the playbook relies on.
/// </summary>
public class StanleySwitchTests
{
    private static readonly string[] Names = ["library", "resolver", "model", "tools", "actions", "handoff", "changes", "money"];

    private static void TurnOff(StanleySwitches s, string name)
    {
        switch (name)
        {
            case "library": s.Library = false; break;
            case "resolver": s.Resolver = false; break;
            case "model": s.Model = false; break;
            case "tools": s.Tools = false; break;
            case "actions": s.Actions = false; break;
            case "handoff": s.Handoff = false; break;
            case "changes": s.Changes = false; break;
            case "money": s.Money = false; break;
            default: throw new ArgumentOutOfRangeException(nameof(name));
        }
    }

    [Fact]
    public void EverythingIsOnByDefault() => Assert.Empty(new StanleySwitches().Off());

    [Theory]
    [InlineData("library")]
    [InlineData("resolver")]
    [InlineData("model")]
    [InlineData("tools")]
    [InlineData("actions")]
    [InlineData("handoff")]
    [InlineData("changes")]
    [InlineData("money")]
    public void EachSwitchTurnsOffAloneAndIsNamedInTheStatus(string name)
    {
        var s = new StanleySwitches();
        TurnOff(s, name);
        Assert.Equal([name], s.Off());
    }

    [Fact]
    public void AllEightAreNamedWhenAllAreOff()
    {
        var s = new StanleySwitches();
        foreach (var n in Names) TurnOff(s, n);
        Assert.Equal(Names.OrderBy(x => x), s.Off().OrderBy(x => x));
    }
}

/// <summary>Operations counts added after phase 14: the tier log's card counts and the handoff outcomes. Pure, so exact.</summary>
public class StanleyOpsCountTests
{
    private static StanleyTierEntry E(string card, bool abstained = false) => new() { At = new DateTime(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc), Tier = "trip", CardId = card, Abstained = abstained };

    [Fact]
    public void CardIdsAreKeptOnlyWhenTheyLookLikeIds()
    {
        Assert.Equal("plan.today", StanleyTierEntry.CleanCardId("plan.today"));
        Assert.Equal("", StanleyTierEntry.CleanCardId("what is my cabin number?"));
        Assert.Equal("", StanleyTierEntry.CleanCardId(new string('a', 41)));
        Assert.Equal("", StanleyTierEntry.CleanCardId(null));
    }

    [Fact]
    public void TopCardsListsOnlyCardsAnsweredTwiceOrMoreWithTheirAbstentions()
    {
        var top = StanleyTierSummary.TopCards([E("a"), E("a", true), E("a"), E("b"), E("b", true), E("c"), E("")]);
        Assert.Equal(["a", "b"], top.Select(c => c.CardId));
        Assert.Equal(3, top[0].Replies);
        Assert.Equal(1, top[0].Abstained);
        Assert.Equal(1, top[1].Abstained);
    }

    [Fact]
    public async Task TheMemoryLogSummarisesCardsInThePeriodOnly()
    {
        var log = new MemoryStanleyTierLog();
        await log.RecordAsync(E("a"), default);
        await log.RecordAsync(E("a"), default);
        await log.RecordAsync(new StanleyTierEntry { At = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc), Tier = "trip", CardId = "old" }, default);
        var s = await log.SummaryAsync(new DateTime(2027, 2, 1, 0, 0, 0, DateTimeKind.Utc), default);
        Assert.Equal(2, s.Replies);
        Assert.Equal(["a"], s.Cards!.Select(c => c.CardId));
    }

    [Fact]
    public void HandoffOutcomesCountOverdueAndEscalatedByTopicAndGiveTheOnTimeShare()
    {
        var now = new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);
        var since = now.AddDays(-7);
        var fresh = StanleyHandoffRules.Outcomes([("billing", now.AddMinutes(-1))], since, now);
        Assert.Equal(1, fresh.Opened);
        Assert.Equal(0, fresh.Overdue);
        Assert.Equal(100, fresh.OnTimePercent);
        var old = StanleyHandoffRules.Outcomes([("billing", now.AddDays(-5)), ("billing", now.AddMinutes(-1)), ("cabin", now.AddMinutes(-1))], since, now);
        Assert.Equal(3, old.Opened);
        Assert.Equal(1, old.Overdue);
        Assert.Equal(1, old.Escalated);
        Assert.Equal(67, old.OnTimePercent);
        Assert.Equal("billing", old.Topics[0].Topic);
        Assert.Equal(2, old.Topics[0].Opened);
    }

    [Fact]
    public void NoCasesGivesNoShare() => Assert.Null(StanleyHandoffRules.Outcomes([], DateTime.UtcNow.AddDays(-7), DateTime.UtcNow).OnTimePercent);
}

/// <summary>The operator alert hook: an urgent handoff pages whoever is on duty with the topic, desk and reference only, and a failing hook never fails the guest.</summary>
public class StanleyOperatorAlertTests
{
    private static readonly DateTime T0 = new(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly UserRecord Me = new() { Id = 1, PublicId = Guid.NewGuid() };
    private const string Words = "My daughter has a nut allergy and her name is Maria Lopez";

    private sealed class Audit : IAuditLog { public Task RecordAsync(AuditEntry entry, CancellationToken ct = default) => Task.CompletedTask; }
    private sealed class Recorder(bool fail = false) : IOperatorAlerts
    {
        public List<OperatorAlert> Sent { get; } = [];
        public Task<bool> NotifyAsync(OperatorAlert alert, CancellationToken ct) { Sent.Add(alert); return fail ? throw new InvalidOperationException("down") : Task.FromResult(true); }
    }

    private static StanleyHandoffService Svc(IOperatorAlerts? alerts) => new(new MemoryStanleyHandoffStore(), new FakeClock(T0), new Audit(), Options.Create(new StanleyOptions()), alerts);
    private static StanleyHandoffRequest Ask(string topic) => new(topic, Words, "", "", "", "", "guest", true);

    [Theory]
    [InlineData("missedShip", true)]
    [InlineData("allergy", true)]
    [InlineData("disruption", true)]
    [InlineData("cabin", false)]
    [InlineData("billing", false)]
    [InlineData("lostProperty", false)]
    public void OnlyUrgentTopicsPageAnOperator(string topic, bool urgent) => Assert.Equal(urgent, StanleyHandoffRules.IsUrgent(topic));

    [Fact]
    public async Task AnUrgentCasePagesWithTheTopicDeskAndReferenceButNeverTheGuestsWords()
    {
        var rec = new Recorder();
        var dto = await Svc(rec).CreateAsync(Me, Ask("allergy"), default);
        var alert = Assert.Single(rec.Sent);
        Assert.Equal(dto.Reference, alert.Reference);
        Assert.Contains("allergy", alert.Summary);
        Assert.DoesNotContain("Maria", alert.Summary + alert.Reference);
        Assert.DoesNotContain("nut", alert.Summary + alert.Reference);
    }

    [Fact]
    public async Task AnOrdinaryCasePagesNoOne()
    {
        var rec = new Recorder();
        await Svc(rec).CreateAsync(Me, Ask("cabin"), default);
        Assert.Empty(rec.Sent);
    }

    [Fact]
    public async Task AFailingHookDoesNotFailTheGuestsRequest()
    {
        var dto = await Svc(new Recorder(fail: true)).CreateAsync(Me, Ask("missedShip"), default);
        Assert.StartsWith("GS-", dto.Reference);
    }

    [Fact]
    public async Task WithNoHookConfiguredTheCaseIsStillMade() => Assert.StartsWith("GS-", (await Svc(null).CreateAsync(Me, Ask("allergy"), default)).Reference);

    [Theory]
    [InlineData("https://hooks.example/abc", true)]
    [InlineData("http://hooks.example/abc", false)]
    [InlineData("not a url", false)]
    [InlineData(null, false)]
    public void TheWebhookNeedsAnHttpsAddress(string? url, bool usable) => Assert.Equal(usable, OperatorAlertOptions.IsUsable(url));
}
