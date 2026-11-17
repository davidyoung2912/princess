using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, 13.6 "Measures": the staff stage view never shows a missing figure as good news.</summary>
public class ChatStageMeasureRulesTests
{
    private static readonly StageCounts Empty = new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    private static StageMeasure Of(StageCounts c, string name) => ChatStageMeasureRules.Measures(c).Single(m => m.Name == name);

    [Fact]
    public void AShareWithNothingToDivideByHasNoRate()
    {
        foreach (var m in ChatStageMeasureRules.Measures(Empty)) Assert.Null(m.Rate);
    }

    [Fact]
    public void SharesAreRoundedPartsOfTheirWhole()
    {
        var c = Empty with { PartyChats = 8, PartyChatsUsed48h = 6, Messages = 2000, Reports = 3 };
        Assert.Equal(0.75, Of(c, "partyChatUsedWithin48Hours").Rate);
        Assert.Equal(1.5, Of(c, "reportsPer1000Messages").Rate);
    }

    [Fact]
    public void TheMuteSignalNeedsEnoughPeopleThenUsesTheRolloutLines()
    {
        Assert.Equal(ChatRolloutRules.NotEnough, Of(Empty with { ReminderPairs = 49, ReminderPairsMuted = 40 }, "remindedAndMuted").Verdict);
        Assert.Equal(ChatRolloutRules.Ok, Of(Empty with { ReminderPairs = 100, ReminderPairsMuted = 10 }, "remindedAndMuted").Verdict);
        Assert.Equal(ChatRolloutRules.Rewrite, Of(Empty with { ReminderPairs = 100, ReminderPairsMuted = 15 }, "remindedAndMuted").Verdict);
        Assert.Equal(ChatRolloutRules.Pause, Of(Empty with { ReminderPairs = 100, ReminderPairsMuted = 21 }, "remindedAndMuted").Verdict);
    }

    [Fact]
    public void WhatTheDataCannotGiveIsListedNotZeroed()
    {
        Assert.Contains("lateReturnRate", ChatStageMeasureRules.Unmeasured);
        var measured = ChatStageMeasureRules.Measures(Empty).Select(m => m.Name);
        Assert.DoesNotContain("lateReturnRate", measured);
    }
}
