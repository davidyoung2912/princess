using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-plan.md, phase 7: who may read a child's chat, when the notice shows, and how a report is decided.</summary>
public class ChatSafetyRulesTests
{
    [Theory]
    [InlineData(1, false, true, 1L, true)]     // the booker of a supervised child
    [InlineData(2, false, true, 1L, false)]    // another adult
    [InlineData(1, true, true, 1L, false)]     // a child, even with the booker's id, or a booker acting as a child
    [InlineData(1, false, false, 1L, false)]   // the "child" is an adult account
    [InlineData(1, false, true, null, false)]  // a supervised account with no booker
    public void OnlyTheBookerOfASupervisedChildMayRead(long actor, bool actorSupervised, bool childSupervised, long? booker, bool allowed) =>
        Assert.Equal(allowed, ChatSafetyRules.MayReadAsGuardian(actor, actorSupervised, childSupervised, booker));

    [Fact]
    public void TheNoticeShowsOnlyWhileASupervisedChildIsIn()
    {
        Assert.True(ChatSafetyRules.GuardianCanRead([("active", false), ("active", true)]));
        Assert.False(ChatSafetyRules.GuardianCanRead([("active", false), ("active", false)]));
        Assert.False(ChatSafetyRules.GuardianCanRead([("active", false), ("left", true)]));   // the child has left: nobody is read any more
        Assert.False(ChatSafetyRules.GuardianCanRead([]));
    }

    [Theory]
    [InlineData("dismiss", "dismissed")]
    [InlineData("remove", "removed")]
    [InlineData("ban", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void ADecisionGivesAStatus(string? decision, string? status) => Assert.Equal(status, ChatSafetyRules.StatusFor(decision));

    [Fact]
    public void OnlyAnOpenReportCanBeDecided()
    {
        Assert.True(ChatSafetyRules.CanResolve(ChatSafetyRules.Open));
        Assert.False(ChatSafetyRules.CanResolve(ChatSafetyRules.Dismissed));
        Assert.False(ChatSafetyRules.CanResolve(ChatSafetyRules.Removed));
    }

    [Theory]
    [InlineData(null, "open")]
    [InlineData("open", "open")]
    [InlineData("dismissed", "dismissed")]
    [InlineData("removed", "removed")]
    [InlineData("'; drop table", "open")]
    public void AListAsksForAKnownStatusOnly(string? asked, string used) => Assert.Equal(used, ChatSafetyRules.ListStatus(asked));
}
