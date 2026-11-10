using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 9: what a chat search may ask, how it matches and how a hit is shown.</summary>
public class ChatSearchRulesTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("a")]
    public void ATooShortQueryIsRefused(string? query) => Assert.Null(ChatSearchRules.CleanQuery(query));

    [Fact]
    public void ATooLongQueryIsRefused() => Assert.Null(ChatSearchRules.CleanQuery(new string('a', ChatSearchRules.MaxQuery + 1)));

    [Fact]
    public void SpacesAreFolded() => Assert.Equal("pool deck", ChatSearchRules.CleanQuery("  pool \t  deck "));

    [Fact]
    public void WildcardsAreTakenLiterally() => Assert.Equal("%50\\%\\_\\[x%", ChatSearchRules.LikePattern("50%_[x"));

    [Fact]
    public void AShortMessageIsShownWhole() => Assert.Equal("see you at the pool", ChatSearchRules.Snippet("see you at the pool", "pool"));

    [Fact]
    public void ALongMessageIsCutAroundTheMatch()
    {
        var text = new string('a', 200) + " pool " + new string('b', 200);
        var snippet = ChatSearchRules.Snippet(text, "pool");
        Assert.Contains("pool", snippet);
        Assert.StartsWith("…", snippet);
        Assert.EndsWith("…", snippet);
        Assert.True(snippet.Length <= ChatSearchRules.SnippetLength + 2);
    }

    [Fact]
    public void ALongMessageMatchingAtTheStartHasNoLeadingEllipsis() =>
        Assert.DoesNotContain("…", ChatSearchRules.Snippet("pool " + new string('b', 300), "pool")[..1]);

    [Theory]
    [InlineData("party", true)]
    [InlineData("direct", true)]
    [InlineData("group", true)]
    [InlineData("stanley", false)]
    [InlineData("channel", false)]
    [InlineData("room", false)]
    public void OnlyChatsBetweenPeopleAreSearched(string kind, bool expected) => Assert.Equal(expected, ChatSearchRules.Searchable(kind));

    [Theory]
    [InlineData(null, ChatSearchRules.PageSize)]
    [InlineData(0, ChatSearchRules.PageSize)]
    [InlineData(5, 5)]
    [InlineData(500, ChatSearchRules.MaxPage)]
    public void PageSizeIsClamped(int? asked, int expected) => Assert.Equal(expected, ChatSearchRules.ClampPage(asked));
}
