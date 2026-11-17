using Princess.Api.Audit;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-stanley-plan.md, phase 7: staff counts for Stanley in chat. Counts only, and a share that is not shown until there is enough to say.</summary>
public class ChatStanleyUseRulesTests
{
    private static readonly DateTime Now = new(2026, 11, 16, 12, 0, 0, DateTimeKind.Utc);

    private static AuditEntry Row(string action, string? detail = null, int daysAgo = 0) => new() { Action = action, Detail = detail, At = Now.AddDays(-daysAgo) };

    [Fact]
    public void CallsAreCountedPerDayAndByKind_AndDaysWithNoCallsAreZero()
    {
        var s = ChatStanleyUseRules.Summarise([Row("chat.reword", "reword:ok"), Row("chat.check"), Row("chat.check", daysAgo: 2), Row("chat.askStanley", "model", 6)], Now, 3, false);
        Assert.Equal(3, s.PerDay.Count);
        Assert.Equal(1, s.PerDay[0].Calls);
        Assert.Equal(0, s.PerDay[1].Calls);
        Assert.Equal(2, s.PerDay[2].Calls);
        Assert.Equal(2, s.ByKind.Single(k => k.Action == "chat.check").Calls);
        Assert.Equal(0, s.ByKind.Single(k => k.Action == "chat.askStanley").Calls);   // outside the window
    }

    [Theory]
    [InlineData("chat.reword", "reword:ok", true)]
    [InlineData("chat.reword", "reword:none", false)]
    [InlineData("chat.reword", "friendlier:safety", false)]
    [InlineData("chat.icebreakers", "scripted", true)]
    [InlineData("chat.icebreakers", "more:ok", true)]
    [InlineData("chat.icebreakers", "more:failed", false)]
    [InlineData("chat.check", null, true)]
    [InlineData("chat.catchUp", "9 messages, quoted", false)]
    public void OnlyACallThatGaveSomethingToUseCountsAsASuggestion(string action, string? detail, bool expected) => Assert.Equal(expected, ChatStanleyUseRules.Suggested(action, detail));

    [Fact]
    public void TheShareIsAbsentUntilThereAreEnoughSuggestions_ThenUsedOverGiven()
    {
        var few = Enumerable.Range(0, 5).Select(_ => Row("chat.check")).Append(Row(ChatStanleyUseRules.UsedAction, "reply"));
        Assert.Null(ChatStanleyUseRules.Summarise(few, Now, 7, false).UsedShare);
        var many = Enumerable.Range(0, 20).Select(_ => Row("chat.check")).Concat(Enumerable.Range(0, 5).Select(_ => Row(ChatStanleyUseRules.UsedAction, "reply")));
        var s = ChatStanleyUseRules.Summarise(many, Now, 7, false);
        Assert.Equal(20, s.Suggestions);
        Assert.Equal(5, s.Used);
        Assert.Equal(0.25, s.UsedShare);
    }

    [Fact]
    public void TheShareNeverPassesOne_AndTruncationIsPassedOn()
    {
        var rows = Enumerable.Range(0, 20).Select(_ => Row("chat.check")).Concat(Enumerable.Range(0, 40).Select(_ => Row(ChatStanleyUseRules.UsedAction, "reply")));
        var s = ChatStanleyUseRules.Summarise(rows, Now, 7, true);
        Assert.Equal(1.0, s.UsedShare);
        Assert.True(s.Truncated);
    }

    [Theory]
    [InlineData("reword", "reword")]
    [InlineData("icebreakers", "icebreakers")]
    [InlineData("reply", "reply")]
    [InlineData("anything else", null)]
    [InlineData(null, null)]
    public void OnlyKnownKindsAreRecorded(string? kind, string? expected) => Assert.Equal(expected, ChatStanleyUseRules.ParseUsed(kind));
}
