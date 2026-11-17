using Princess.Api.Domain;
using Princess.Api.Services;
using Xunit;

namespace Princess.Api.Tests;

public class StanleyOpsTests
{
    private static readonly DateTime Now = new(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid A = Guid.NewGuid(), B = Guid.NewGuid();

    [Theory]
    [InlineData("CHK-01", true)]
    [InlineData("reminder.due", true)]
    [InlineData("", false)]
    [InlineData("has space", false)]
    [InlineData("x'; DROP", false)]
    public void Class_ids_are_a_closed_shape(string id, bool ok) => Assert.Equal(ok, StanleyOpsRules.ValidClass(id));

    [Theory]
    [InlineData("  ", false)]
    [InlineData("no", false)]
    [InlineData("noisy after the update", true)]
    public void A_change_must_say_why(string reason, bool ok) => Assert.Equal(ok, StanleyOpsRules.ValidReason(reason, out _));

    [Fact]
    public void Pausing_needs_two_different_people()
    {
        var first = StanleyOpsRules.Global(false, null, true, "storm of cards", A, Now);
        Assert.Equal(StanleyOpsRules.Proposed, first.Outcome);
        var same = StanleyOpsRules.Global(false, first.Proposal, true, "storm of cards", A, Now.AddMinutes(1));
        Assert.Equal(StanleyOpsRules.NeedsSecondPerson, same.Outcome);
        var second = StanleyOpsRules.Global(false, first.Proposal, true, "agreed", B, Now.AddMinutes(2));
        Assert.Equal(StanleyOpsRules.Applied, second.Outcome);
    }

    [Fact]
    public void A_proposal_lapses_after_an_hour()
    {
        var first = StanleyOpsRules.Global(false, null, true, "storm of cards", A, Now);
        var late = StanleyOpsRules.Global(false, first.Proposal, true, "too late", B, Now.AddMinutes(61));
        Assert.Equal(StanleyOpsRules.Proposed, late.Outcome);
    }

    [Fact]
    public void Releasing_needs_one_person()
    {
        Assert.Equal(StanleyOpsRules.Released, StanleyOpsRules.Global(true, null, false, "all clear", A, Now).Outcome);
    }

    [Fact]
    public async Task A_class_switched_off_is_dropped_and_a_global_pause_holds_non_critical_items()
    {
        var ops = new MemoryStanleyOpsStore();
        await ops.SetAsync(new(StanleyOpsRules.ScopeClass, "CHK-01", true, "noisy after the update", A, Now), default);
        var rows = await ops.ListAsync(default);
        Assert.Equal(["CHK-01"], StanleyOpsRules.OffClasses(rows));
        Assert.False(StanleyOpsRules.GlobalPaused(rows));
        await ops.SetAsync(new(StanleyOpsRules.ScopeGlobal, StanleyOpsRules.GlobalName, true, "two people agreed", B, Now), default);
        Assert.True(StanleyOpsRules.GlobalPaused(await ops.ListAsync(default)));
    }
}
