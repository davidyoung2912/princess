using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>
/// The Stanley ledger (docs/stanley-actions-and-proactive-plan.md, phase P1): every receipt carries the six fields, only the seven server kinds can be undone from the ledger and only inside the window,
/// and the wording never uses "AI" as a word. Nothing here reads guest-typed text.
/// </summary>
public class StanleyActivityTests
{
    private static readonly DateTime Now = new(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc);

    private static StanleyReceiptDto Make(string kind, string status = StanleyActionStatus.Done, DateTime? until = null, string? by = null, string[]? who = null) =>
        StanleyActivityRules.Receipt("id", "STN-ABCD1234", kind, status, Now.AddMinutes(-5), "A title", who ?? ["You"], by, until ?? Now.AddMinutes(60), Now);

    [Fact]
    public void EveryKindHasAllSixFieldsFilled()
    {
        foreach (var kind in StanleyActionKinds.All)
        {
            var r = Make(kind);
            foreach (var field in new[] { r.What, r.Why, r.Facts, r.Affects, r.Undo, r.Stop }) Assert.False(string.IsNullOrWhiteSpace(field), kind);
        }
    }

    [Fact]
    public void OnlyServerKindsInsideTheWindowCanBeUndone()
    {
        Assert.True(Make(StanleyActionKinds.ReserveDinner).CanUndo);
        Assert.False(Make(StanleyActionKinds.PlanChange).CanUndo);
        Assert.False(Make(StanleyActionKinds.RemindMe).CanUndo);
        Assert.False(Make(StanleyActionKinds.ReserveDinner, until: Now.AddSeconds(-1)).CanUndo);
        Assert.False(Make(StanleyActionKinds.ReserveDinner, StanleyActionStatus.Undone).CanUndo);
        Assert.False(Make(StanleyActionKinds.ReserveDinner, StanleyActionStatus.Failed).CanUndo);
    }

    [Fact]
    public void ADeviceKindSaysWhereToUndoIt()
    {
        Assert.Contains("device", Make(StanleyActionKinds.PlanChange).Undo);
        Assert.Contains("closed", Make(StanleyActionKinds.OrderItem, until: Now.AddMinutes(-1)).Undo);
    }

    [Fact]
    public void WhoItAffectsAndWhoPrepared()
    {
        Assert.Equal("Only you.", Make(StanleyActionKinds.CreatePoll).Affects);
        Assert.Equal("You, Sam.", Make(StanleyActionKinds.CreatePoll, who: ["You", "Sam"]).Affects);
        Assert.Contains("Pat prepared", Make(StanleyActionKinds.AddExcursion, by: "Pat").Why);
        Assert.StartsWith("You asked", Make(StanleyActionKinds.AddExcursion).Why);
    }

    [Fact]
    public void OnlyActsAreInTheLedger()
    {
        Assert.True(StanleyActivityRules.InLedger(StanleyActionStatus.Done));
        Assert.True(StanleyActivityRules.InLedger(StanleyActionStatus.Undone));
        Assert.False(StanleyActivityRules.InLedger(StanleyActionStatus.Prepared));
        Assert.False(StanleyActivityRules.InLedger(StanleyActionStatus.Expired));
    }

    [Fact]
    public void TheWordsNeverSayAi()
    {
        foreach (var kind in StanleyActionKinds.All)
        {
            var r = Make(kind);
            foreach (var s in new[] { r.Why, r.Facts, r.Undo, r.Stop }) Assert.DoesNotMatch(@"\bAI\b", s);
        }
    }
}
