using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-plan.md, phase 5: group size, names, who an invitation waits for, and the thread lines.</summary>
public class ChatGroupRulesTests
{
    [Theory]
    [InlineData("Dinner crew", "Dinner crew")]
    [InlineData("  Dinner   crew ", "Dinner crew")]
    [InlineData("A", "A")]
    public void ANameIsTidied(string name, string expected) => Assert.Equal(expected, ChatGroupRules.CleanName(name));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("tab\there")]
    public void AnEmptyOrOddNameIsRefused(string? name) => Assert.Null(ChatGroupRules.CleanName(name));

    [Fact]
    public void ANameOverTheLimitIsRefused()
    {
        Assert.NotNull(ChatGroupRules.CleanName(new string('a', ChatGroupRules.MaxName)));
        Assert.Null(ChatGroupRules.CleanName(new string('a', ChatGroupRules.MaxName + 1)));
    }

    [Theory]
    [InlineData(1, 0, 24, true)]       // the creator and 24 invited make 25
    [InlineData(1, 0, 25, false)]
    [InlineData(20, 4, 1, true)]       // waiting invitations count, so they cannot be over-filled by accepting
    [InlineData(20, 5, 1, false)]
    [InlineData(25, 0, 0, true)]
    public void AGroupHoldsTwentyFivePeopleIncludingWaitingInvitations(int members, int waiting, int adding, bool fits) =>
        Assert.Equal(fits, ChatGroupRules.Fits(members, waiting, adding));

    [Fact]
    public void AChildsInvitationWaitsForTheirGuardian()
    {
        Assert.Equal(ChatGroupRules.AwaitingGuardian, ChatGroupRules.StatusFor(true));
        Assert.Equal(ChatGroupRules.Pending, ChatGroupRules.StatusFor(false));
    }

    [Theory]
    [InlineData("awaitingGuardian", true)]
    [InlineData("pending", true)]
    [InlineData("accepted", false)]
    [InlineData("declined", false)]
    [InlineData(null, false)]
    public void OnlyTwoStatusesAreWaiting(string? status, bool waiting) => Assert.Equal(waiting, ChatGroupRules.IsWaiting(status));

    [Fact]
    public void TheThreadLinesAndNoticesNameOnlyTheShortName()
    {
        Assert.Equal("Sam R. left the group", ChatGroupRules.LeftLine("Sam R."));
        Assert.Equal("Sam R. joined the group", ChatGroupRules.JoinedLine("Sam R."));
        Assert.Equal("Sam R. was removed from the group", ChatGroupRules.RemovedLine("Sam R."));
        Assert.Equal("The group is now called Crew", ChatGroupRules.RenamedLine("Crew"));
        var (title, body) = ChatGroupRules.InviteNotice("Sam R.", "Crew");
        Assert.Equal("Sam R. invited you to a group", title);
        Assert.Equal("Open Princess to join Crew.", body);
        Assert.Contains("Alex", ChatGroupRules.ApprovalNotice("Alex").Body);
    }

    [Fact]
    public void AMemberWhoJoinedLaterNeverReadsEarlierMessages()
    {
        var joined = new DateTime(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(ChatConversationRules.CanRead("group", joined.AddMinutes(-5), joined, null));
        Assert.True(ChatConversationRules.CanRead("group", joined, joined, null));   // their own "joined" line
    }
}
