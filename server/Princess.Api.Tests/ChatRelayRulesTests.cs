using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 13: relay to a person and the group recap.</summary>
public class ChatRelayRulesTests
{
    [Theory]
    [InlineData("direct", true)]
    [InlineData("group", true)]
    [InlineData("party", true)]
    [InlineData("stanley", false)]
    [InlineData("channel", false)]
    [InlineData("room", false)]
    public void OnlyPeopleChatsCanBeHandedOver(string kind, bool expected) => Assert.Equal(expected, ChatRelayRules.Handable(kind));

    [Theory]
    [InlineData("text", false, false, false, "hello", true)]
    [InlineData("text", true, false, false, "Sam left", false)]
    [InlineData("text", false, true, false, "Stanley says", false)]
    [InlineData("text", false, false, true, "gone", false)]
    [InlineData("plan", false, false, false, "Dinner", false)]
    [InlineData("text", false, false, false, "  ", false)]
    public void OnlyWordsAPersonTypedAreCarried(string kind, bool system, bool stanley, bool deleted, string text, bool expected) =>
        Assert.Equal(expected, ChatRelayRules.Carriable(kind, system, stanley, deleted, text));

    [Fact]
    public void TheDraftHoldsOnlyTheChosenLinesInOrder()
    {
        var text = ChatRelayRules.Draft([("", "My cabin key stopped working"), ("Alex R.", "Mine too")]);
        Assert.Equal("From my chat:\nYou: My cabin key stopped working\nAlex R.: Mine too", text);
    }

    [Fact]
    public void ALongDraftStopsAtTheHandoffLimitWithoutCuttingALine()
    {
        var lines = Enumerable.Range(0, 10).Select(_ => ("Sam K.", new string('a', 250)));
        var text = ChatRelayRules.Draft(lines);
        Assert.True(text.Length <= StanleyHandoffRules.IssueMax);
        Assert.All(text.Split('\n').Skip(1), l => Assert.EndsWith(new string('a', 250), l));
    }

    [Fact]
    public void ALongLineIsCutWithAnEllipsis() =>
        Assert.EndsWith("…", ChatRelayRules.Draft([("", new string('b', 500))]));

    [Fact]
    public void TheDraftIsAcceptedByTheHandoffRules()
    {
        var text = ChatRelayRules.Draft([("", "Please help")]);
        Assert.Null(StanleyHandoffRules.Problem(new StanleyHandoffRequest("person", text, null, null, null, null, null, true)));
    }

    [Theory]
    [InlineData(true, false, 3, null)]
    [InlineData(false, false, 3, "notGroup")]
    [InlineData(true, true, 3, "child")]
    [InlineData(true, false, 1, "small")]
    public void ARecapNeedsAMadeGroupOfTwoWithNoChild(bool group, bool child, int members, string? expected) =>
        Assert.Equal(expected, ChatRelayRules.StartRefusal(group, child, members));

    [Fact]
    public void OnlyTheOwnerDecidesAPart()
    {
        Assert.True(ChatRelayRules.MayDecide(5, 5, "approved"));
        Assert.True(ChatRelayRules.MayDecide(5, 5, "declined"));
        Assert.False(ChatRelayRules.MayDecide(5, 6, "approved"));
        Assert.False(ChatRelayRules.MayDecide(5, 5, "pending"));
    }

    [Fact]
    public void ARecapIsSharedOnlyWhenEveryPartIsDecidedAndOneIsApproved()
    {
        Assert.Equal("waiting", ChatRelayRules.ShareRefusal(false, ["approved", "pending"]));
        Assert.Equal("empty", ChatRelayRules.ShareRefusal(false, ["declined"]));
        Assert.Equal("empty", ChatRelayRules.ShareRefusal(false, []));
        Assert.Equal("shared", ChatRelayRules.ShareRefusal(true, ["approved"]));
        Assert.Null(ChatRelayRules.ShareRefusal(false, ["approved", "declined"]));
    }

    [Fact]
    public void TheShareLineGivesCountsAndNamesNoPart()
    {
        Assert.Equal("Alex R. shared the trip recap: 1 plan and 2 photos that members chose to add.", ChatRelayRules.ShareLine("Alex R.", 1, 2));
        Assert.Equal("3 of 5 parts decided.", ChatRelayRules.Progress(3, 5));
    }
}
