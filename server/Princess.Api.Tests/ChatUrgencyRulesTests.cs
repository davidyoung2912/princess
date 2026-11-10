using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class ChatUrgencyRulesTests
{
    [Theory]
    [InlineData(null, "normal")]
    [InlineData("", "normal")]
    [InlineData("  ", "normal")]
    [InlineData("normal", "normal")]
    [InlineData("Important", "important")]
    [InlineData(" URGENT ", "urgent")]
    [InlineData("critical", null)]
    [InlineData("high", null)]
    public void ALevelIsParsedOrRefused(string? asked, string? level) => Assert.Equal(level, ChatUrgencyRules.Parse(asked));

    [Theory]
    [InlineData("normal", false, false, true)]
    [InlineData("important", false, false, true)]
    [InlineData("urgent", false, false, false)]   // an ordinary guest
    [InlineData("urgent", true, false, true)]     // staff
    [InlineData("urgent", false, true, true)]     // a guardian with their child in the conversation
    public void OnlyStaffAndGuardiansMaySendUrgent(string level, bool staff, bool guardian, bool allowed) =>
        Assert.Equal(allowed, ChatUrgencyRules.MaySend(level, staff, guardian));

    [Fact]
    public void AGuardianIsTheBookerOfASupervisedChildWhoIsInThisConversation()
    {
        (string, bool, long?)[] members = [("active", false, null), ("active", true, 7L)];
        Assert.True(ChatUrgencyRules.IsGuardianHere(7, false, members));
        Assert.False(ChatUrgencyRules.IsGuardianHere(8, false, members));   // another adult
        Assert.False(ChatUrgencyRules.IsGuardianHere(7, true, members));    // a supervised account never counts
        Assert.False(ChatUrgencyRules.IsGuardianHere(7, false, [("left", true, 7L)]));   // the child has left
        Assert.False(ChatUrgencyRules.IsGuardianHere(7, false, [("active", false, 7L)])); // not a supervised child
    }

    [Fact]
    public void OnlyUrgentBreaksThroughDoNotDisturb()
    {
        Assert.True(ChatUrgencyRules.BreaksThrough("urgent"));
        Assert.False(ChatUrgencyRules.BreaksThrough("important"));
        Assert.False(ChatUrgencyRules.BreaksThrough("normal"));
    }

    [Theory]
    [InlineData("urgent", false, false, true)]
    [InlineData("urgent", true, false, false)]    // a system line
    [InlineData("urgent", false, true, false)]    // the sender's own message
    [InlineData("important", false, false, false)]
    [InlineData("normal", false, false, false)]
    public void OnlySomeoneElsesUrgentMessageCanBeAcknowledged(string level, bool system, bool own, bool allowed) =>
        Assert.Equal(allowed, ChatUrgencyRules.CanAck(level, system, own));

    [Fact]
    public void TextsAndPhotosAreAlwaysNormal()
    {
        Assert.Equal("normal", ChatUrgencyRules.ForChannel(true, "urgent"));
        Assert.Equal("urgent", ChatUrgencyRules.ForChannel(false, "urgent"));
    }

    [Fact]
    public void ThePhoneNoticeNamesTheLevelAndStillHidesTheTextUnlessOptedIn()
    {
        Assert.Equal(("Urgent message from Sam R.", "Open Princess to read it."), ChatConversationRules.MessageNotice("Sam R.", "go to deck 5", false, "urgent"));
        Assert.Equal(("Important message from Sam R.", "lunch?"), ChatConversationRules.MessageNotice("Sam R.", "lunch?", true, "important"));
        Assert.Equal("New message from Sam R.", ChatConversationRules.MessageNotice("Sam R.", "hi", false).Title);
    }
}
