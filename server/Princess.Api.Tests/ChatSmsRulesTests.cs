using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-plan.md, 4.9 and phase 6: reading replies, wording texts, the caps, and who counts as ashore.</summary>
public class ChatSmsRulesTests
{
    [Theory]
    [InlineData("STOP", SmsCommand.Stop)]
    [InlineData(" stop. ", SmsCommand.Stop)]
    [InlineData("help", SmsCommand.Help)]
    [InlineData("?", SmsCommand.Help)]
    [InlineData("Back", SmsCommand.Back)]
    [InlineData("LIST", SmsCommand.List)]
    public void ACommandStandsAlone(string body, SmsCommand expected) => Assert.Equal(expected, ChatSmsRules.Parse(body).Command);

    [Theory]
    [InlineData("2 on my way", 2, "on my way")]
    [InlineData("[3] see you", 3, "see you")]
    [InlineData("12: lunch?", 12, "lunch?")]
    public void ALeadingNumberPicksAConversation(string body, int code, string text)
    {
        var p = ChatSmsRules.Parse(body);
        Assert.Equal(SmsCommand.Message, p.Command);
        Assert.Equal(code, p.Code);
        Assert.Equal(text, p.Text);
    }

    [Theory]
    [InlineData("on my way")]
    [InlineData("2")]
    [InlineData("2pm is fine")]
    [InlineData("back at 2")]
    public void AnythingElseIsAMessageForTheLastChat(string body)
    {
        var p = ChatSmsRules.Parse(body);
        Assert.Equal(SmsCommand.Message, p.Command);
        Assert.Null(p.Code);
        Assert.Equal(body, p.Text);
    }

    [Fact]
    public void ANumberShowsOnlyWhenThereIsMoreThanOneChat()
    {
        Assert.Equal("Sam R.: lunch?", ChatSmsRules.Outbound(null, "Sam R.", "lunch?", false));
        Assert.Equal("[2] Sam R.: lunch?", ChatSmsRules.Outbound(2, "Sam R.", "lunch?", false));
        Assert.Equal("Sam R. sent a photo. Open the app to see it.", ChatSmsRules.Outbound(null, "Sam R.", "", true));
    }

    [Fact]
    public void ALongMessageIsShortened() =>
        Assert.True(ChatSmsRules.Outbound(1, "Sam R.", new string('a', 1000), false).Length <= ChatSmsRules.MaxLine + 6);

    [Theory]
    [InlineData(0, 0, SmsSendVerdict.Send)]
    [InlineData(10, 4, SmsSendVerdict.Send)]
    [InlineData(10, 5, SmsSendVerdict.Digest)]
    [InlineData(10, 6, SmsSendVerdict.Skip)]
    [InlineData(30, 0, SmsSendVerdict.Capped)]
    public void TheCapsApplyInOrder(int today, int hour, SmsSendVerdict expected) => Assert.Equal(expected, ChatSmsRules.Verdict(today, hour));

    [Fact]
    public void AnOpenAppIsNeverAshore()
    {
        var now = new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(ChatSmsRules.IsAshore(true, 1, true, true, now.AddHours(-2), now, null));
    }

    [Fact]
    public void AwayFromShipCountsAtOnceWhenTheAppIsClosed()
    {
        var now = new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(ChatSmsRules.IsAshore(true, 1, false, false, null, now, null));
    }

    [Fact]
    public void IdleCountsOnlyWhenChosenAndAfterThirtyMinutes()
    {
        var now = new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(ChatSmsRules.IsAshore(false, null, false, false, now.AddHours(-2), now, null));
        Assert.False(ChatSmsRules.IsAshore(false, null, false, true, now.AddMinutes(-29), now, null));
        Assert.True(ChatSmsRules.IsAshore(false, null, false, true, now.AddMinutes(-30), now, null));
        Assert.False(ChatSmsRules.IsAshore(false, null, false, true, null, now, null));
    }

    [Fact]
    public void BackQuietsTheBridgeUntilTheGuestIsAwayAgain()
    {
        var now = new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc);
        var back = now.AddMinutes(-10);
        long ms(DateTime d) => new DateTimeOffset(d).ToUnixTimeMilliseconds();
        Assert.False(ChatSmsRules.IsAshore(true, ms(now.AddHours(-1)), false, false, null, now, back));
        Assert.True(ChatSmsRules.IsAshore(true, ms(now.AddMinutes(-5)), false, false, null, now, back));
        Assert.False(ChatSmsRules.IsAshore(false, null, false, true, now.AddHours(-1), now, back));
    }

    [Fact]
    public void TheSameCarrierIdGivesTheSameKey() =>
        Assert.Equal(ChatSmsRules.KeyFor("SM123", 7, "hi"), ChatSmsRules.KeyFor(" SM123 ", 7, "hello"));

    [Fact]
    public void ADifferentGuestGetsADifferentKey() =>
        Assert.NotEqual(ChatSmsRules.KeyFor("SM123", 7, "hi"), ChatSmsRules.KeyFor("SM123", 8, "hi"));

    [Fact]
    public void ConversationsAreNumberedFromOne()
    {
        Assert.Equal(1, ChatSmsRules.CodeOf([4, 9], 4));
        Assert.Equal(2, ChatSmsRules.CodeOf([4, 9], 9));
        Assert.Null(ChatSmsRules.CodeOf([4, 9], 5));
    }

    [Fact]
    public void TheListIsNumbered() =>
        Assert.Equal("Your chats: [1] My group, [2] Sam R.. Start a reply with a number to pick one.", ChatSmsRules.ListText([(1, "My group"), (2, "Sam R.")]));
}
