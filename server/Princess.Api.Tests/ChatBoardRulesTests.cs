using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-bundles-plan.md, phase B6: the day board, its items and the "I'm in" bits.</summary>
public class ChatBoardRulesTests
{
    [Fact]
    public void ABoardKeepsThingsWithATimeOnItsOwnDay()
    {
        var board = ChatBoardRules.Clean(3, ["event:trivia~1:3", "", "event:trivia~1:3", "event:yoga~2:3"], 7);
        Assert.NotNull(board);
        Assert.Equal(3, board!.Day);
        Assert.Equal(["event:trivia~1:3", "event:yoga~2:3"], board.Refs);
    }

    [Fact]
    public void ABoardIsRefusedForABadDayOrItem()
    {
        Assert.Null(ChatBoardRules.Clean(0, ["event:a~1:0"], 7));
        Assert.Null(ChatBoardRules.Clean(8, ["event:a~1:8"], 7));
        Assert.Null(ChatBoardRules.Clean(3, [], 7));
        Assert.Null(ChatBoardRules.Clean(3, ["event:a~1:4"], 7));   // another day
        Assert.Null(ChatBoardRules.Clean(3, ["venue:crown-grill"], 7));   // no time
        Assert.Null(ChatBoardRules.Clean(3, Enumerable.Range(0, 9).Select(i => $"event:e{i}~1:3"), 7));
    }

    [Fact]
    public void ABoardRoundTripsAndGarbageParsesToNull()
    {
        var board = ChatBoardRules.Clean(2, ["event:a~1:2"], 7)!;
        Assert.Equal(board.Refs, ChatBoardRules.Parse(ChatBoardRules.Serialise(board))!.Refs);
        foreach (var bad in new[] { null, "", "{", "{\"day\":1,\"refs\":[]}" }) Assert.Null(ChatBoardRules.Parse(bad));
    }

    [Fact]
    public void ImInIsOneBitPerItemAndCountsAddUp()
    {
        var mine = ChatBoardRules.With(ChatBoardRules.With(0, 0, true), 2, true);
        Assert.True(ChatBoardRules.IsIn(mine, 0));
        Assert.False(ChatBoardRules.IsIn(mine, 1));
        Assert.Equal(1, ChatBoardRules.With(mine, 2, false));
        Assert.Equal(mine, ChatBoardRules.With(mine, 9, true));   // not on the board
        Assert.Equal([2, 0, 1], ChatBoardRules.Counts([mine, 1, 0], 3));
        Assert.True(ChatBoardRules.ValidItem(2, 3));
        Assert.False(ChatBoardRules.ValidItem(3, 3));
        Assert.False(ChatBoardRules.ValidItem(-1, 3));
    }
}
