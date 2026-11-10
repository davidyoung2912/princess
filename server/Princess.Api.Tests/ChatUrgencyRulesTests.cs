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
    [InlineData("important", 19, false)]
    [InlineData("important", 20, true)]
    [InlineData("urgent", 9, false)]
    [InlineData("urgent", 10, true)]
    [InlineData("normal", 100000, false)]
    public void ImportantAndUrgentHaveAnHourlyLimit(string level, int sent, bool over) => Assert.Equal(over, ChatUrgencyRules.OverLimit(level, sent));

    [Fact]
    public void DoNotDisturbLengthsAreAnHourUntilMorningOrOff()
    {
        var evening = new DateTime(2027, 3, 1, 22, 30, 0);
        Assert.Equal(TimeSpan.FromHours(1), ChatUrgencyRules.DndLength("hour", evening, "07:00"));
        Assert.Equal(TimeSpan.FromHours(8.5), ChatUrgencyRules.DndLength("morning", evening, "07:00"));
        Assert.Equal(TimeSpan.FromHours(1), ChatUrgencyRules.DndLength("morning", new DateTime(2027, 3, 1, 6, 0, 0), "07:00"));
        Assert.Equal(TimeSpan.Zero, ChatUrgencyRules.DndLength("off", evening, "07:00"));
        Assert.Null(ChatUrgencyRules.DndLength("forever", evening, "07:00"));
        Assert.Null(ChatUrgencyRules.DndLength(null, evening, "07:00"));
    }

    [Fact]
    public void DoNotDisturbEndsByItself()
    {
        Assert.True(ChatUrgencyRules.DndOn(2000, 1000));
        Assert.False(ChatUrgencyRules.DndOn(1000, 1000));
        Assert.False(ChatUrgencyRules.DndOn(0, 1000));
    }

    [Theory]
    [InlineData("urgent", "URGENT: ")]
    [InlineData("important", "Important: ")]
    [InlineData("normal", "")]
    public void TextsOpenWithTheLevel(string level, string lead) => Assert.Equal(lead, ChatUrgencyRules.SmsLead(level));

    [Theory]
    [InlineData("normal", false)]
    [InlineData("important", false)]
    [InlineData("urgent", true)]
    public void OnlyUrgentBreaksThroughDoNotDisturbInTheDecision(string level, bool sent)
    {
        var prefs = Princess.Api.Domain.NotificationRules.NormalizePrefs(System.Text.Json.Nodes.JsonNode.Parse("{\"dnd\":{\"until\":5000}}"));
        var notice = new PushNotice("k", "chat", "chat", ChatUrgencyRules.BreaksThrough(level), 50, "/chat", "t", "b", []);
        var d = PushRules.Decide(notice, prefs, new PushSettings(5, false, []), new TimeOnly(12, 0), 0, 1000);
        Assert.Equal(sent, d.Send);
        if (!sent) Assert.Equal("dnd", d.Reason);
        // after the end time nothing is held for it
        Assert.True(PushRules.Decide(notice, prefs, new PushSettings(5, false, []), new TimeOnly(12, 0), 0, 6000).Send);
    }

    [Theory]
    [InlineData("normal", false)]
    [InlineData("important", false)]
    [InlineData("urgent", true)]
    public void AnUrgentTextIsNeverHeldByTheCaps(string level, bool alwaysSends) =>
        Assert.Equal(alwaysSends ? SmsSendVerdict.Send : SmsSendVerdict.Capped, ChatSmsRules.Verdict(ChatSmsRules.DailyCap, 99, level));

    [Fact]
    public void AnUnconfirmedUrgentTextIsRemindedOnceInsideItsWindow()
    {
        var sent = new DateTime(2027, 3, 1, 12, 0, 0);
        Assert.False(ChatSmsRules.RetryDue(sent, sent.AddMinutes(4)));
        Assert.True(ChatSmsRules.RetryDue(sent, sent.AddMinutes(5)));
        Assert.False(ChatSmsRules.RetryDue(sent, sent.AddHours(3)));
        Assert.DoesNotContain("hello", ChatSmsRules.UrgentReminder(2));
        Assert.StartsWith("[2] URGENT:", ChatSmsRules.UrgentReminder(2));
    }

    [Theory]
    [InlineData("normal", false)]
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
