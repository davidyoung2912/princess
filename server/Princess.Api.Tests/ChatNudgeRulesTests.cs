using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-stanley-plan.md, phase 4: Ask Stanley about this message. Pattern checks only; he names what a message asks for and never says someone is a scammer.</summary>
public class ChatNudgeRulesTests
{
    [Theory]
    [InlineData("Could you send me $200 until we dock?", "money")]
    [InlineData("I will pay you back, just wire the money today", "money")]
    [InlineData("Can you buy me a gift card?", "giftCard")]
    [InlineData("Call me on +1 555 123 4567", "phone")]
    [InlineData("Let's talk on WhatsApp instead", "offApp")]
    [InlineData("Please do this right now, don't tell anyone", "pressure")]
    public void ItNamesWhatAMessageAsksFor(string text, string flag) => Assert.Contains(flag, ChatNudgeRules.Check(text));

    [Theory]
    [InlineData("Are you going to the show tonight?")]
    [InlineData("The signal is weak by the pool")]
    [InlineData("See you at dinner at 7")]
    [InlineData("")]
    [InlineData(null)]
    public void AnOrdinaryMessageHasNoFlags(string? text) => Assert.Empty(ChatNudgeRules.Check(text));

    [Fact]
    public void FlagsComeInAFixedOrderWithoutRepeats()
    {
        var flags = ChatNudgeRules.Check("Urgent: send money by gift card, then text me on whatsapp");
        Assert.Equal(flags.OrderBy(f => Array.IndexOf(ChatNudgeRules.Order, f)).ToList(), flags);
        Assert.Equal(flags.Count, flags.Distinct().Count());
    }

    [Fact]
    public void MoneyAndGiftCardsAreWorrying_AloneAPhoneNumberIsNot()
    {
        Assert.True(ChatNudgeRules.Looks(ChatNudgeRules.Check("send me money")));
        Assert.True(ChatNudgeRules.Looks(ChatNudgeRules.Check("buy gift cards")));
        Assert.False(ChatNudgeRules.Looks(ChatNudgeRules.Check("my number is 555 123 4567")));
        Assert.True(ChatNudgeRules.Looks(ChatNudgeRules.Check("text me on telegram right now")));
    }

    [Fact]
    public void RepliesAreFewPoliteAndPassTheOutputRules()
    {
        foreach (var text in new[] { "send me money now", "hello", "call me on 555 123 4567" })
        {
            var replies = ChatNudgeRules.Replies(ChatNudgeRules.Check(text));
            Assert.InRange(replies.Count, 1, 3);
            Assert.All(replies, r => Assert.Equal(r, ChatStanleyRules.Filter(r, 200)));
        }
    }

    [Fact]
    public void WordingNeverCallsAnyoneAScammerOrAI()
    {
        var all = ChatNudgeRules.Order.Select(ChatNudgeRules.Explain).Append(ChatNudgeRules.Headline([])).Append(ChatNudgeRules.Headline(ChatNudgeRules.Order)).Append(ChatNudgeRules.Calm);
        Assert.All(all, line =>
        {
            Assert.DoesNotContain("scammer", line, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("AI", line.Split(' '));
            Assert.NotEmpty(line);
        });
    }

    [Theory]
    [InlineData(true, false, "normal", "notMessage")]
    [InlineData(false, true, "normal", "child")]
    [InlineData(false, false, "urgent", "urgent")]
    [InlineData(false, false, "important", "urgent")]
    [InlineData(false, false, "normal", null)]
    public void OnlyAnotherPersonsOrdinaryMessageMayBeLookedAt(bool own, bool child, string urgency, string? expected) => Assert.Equal(expected, ChatNudgeRules.Refusal(own, child, urgency));
}
