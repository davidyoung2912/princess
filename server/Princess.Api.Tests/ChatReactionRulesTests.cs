using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 1: the six reactions, one per person, the reply quote and the delivery states.</summary>
public class ChatReactionRulesTests
{
    [Fact]
    public void ThereAreSixReactionsAndNothingElseIsAllowed()
    {
        Assert.Equal(6, ChatReactionRules.Allowed.Count);
        Assert.All(ChatReactionRules.Allowed, e => Assert.True(ChatReactionRules.IsAllowed(e)));
        Assert.False(ChatReactionRules.IsAllowed("🔥"));
        Assert.False(ChatReactionRules.IsAllowed(""));
        Assert.False(ChatReactionRules.IsAllowed(null));
    }

    [Fact]
    public void PickingTheHeldReactionTakesItAwayAndAnyOtherReplacesIt()
    {
        Assert.Equal("👍", ChatReactionRules.Toggle(null, "👍"));
        Assert.Null(ChatReactionRules.Toggle("👍", "👍"));
        Assert.Equal("❤️", ChatReactionRules.Toggle("👍", "❤️"));
    }

    [Fact]
    public void ChipsAreCountedInPickerOrderAndTheReadersOwnIsMarkedButNotNamed()
    {
        var rows = new (long, string, string)[] { (1, "❤️", "Sam R."), (2, "👍", "Ana K."), (3, "👍", "Lee P."), (9, "👍", "Me M.") };
        var chips = ChatReactionRules.Summarise(rows, reader: 9);
        Assert.Equal(["👍", "❤️"], chips.Select(c => c.Emoji).ToArray());
        Assert.Equal(3, chips[0].Count);
        Assert.True(chips[0].Mine);
        Assert.Equal(["Ana K.", "Lee P."], chips[0].Names);
        Assert.False(chips[1].Mine);
    }

    [Fact]
    public void AReactionFromSomeoneTheReaderBlockedIsLeftOut()
    {
        var chips = ChatReactionRules.Summarise([(1, "👍", "Sam R."), (2, "👍", "Ana K.")], reader: 9, blocked: new HashSet<long> { 1 });
        Assert.Equal(1, Assert.Single(chips).Count);
        Assert.Equal(["Ana K."], chips[0].Names);
        Assert.Empty(ChatReactionRules.Summarise([(1, "👍", "Sam R.")], 9, new HashSet<long> { 1 }));
    }

    [Fact]
    public void AnUnknownEmojiInTheStoreIsNeverShown() => Assert.Empty(ChatReactionRules.Summarise([(1, "🔥", "Sam R.")], 9));

    [Theory]
    [InlineData("See you at the pool", false, "See you at the pool")]
    [InlineData("", true, "Photo")]
    [InlineData("  ", false, "")]
    public void AQuoteShowsTheTextAPhotoOrNothing(string text, bool photo, string expected) => Assert.Equal(expected, ChatReactionRules.QuoteText(text, photo));

    [Fact]
    public void AQuoteIsCutAtItsLimit() => Assert.Equal(ChatReactionRules.QuoteLength, ChatReactionRules.QuoteText(new string('x', 400), false).Length);

    [Theory]
    [InlineData(false, false, true)]
    [InlineData(true, false, false)]    // a line about the group
    [InlineData(false, true, false)]    // a notice from Stanley
    public void OnlyAPersonsMessageCanBeRepliedToOrReactedTo(bool system, bool stanley, bool expected) => Assert.Equal(expected, ChatReactionRules.CanTarget(system, stanley));

    [Theory]
    [InlineData(false, false, "sent")]
    [InlineData(false, true, "delivered")]
    [InlineData(true, false, "read")]
    [InlineData(true, true, "read")]
    public void ReadBeatsDeliveredAndDeliveredBeatsSent(bool read, bool delivered, string expected) => Assert.Equal(expected, ChatReactionRules.StateOf(read, delivered));
}
