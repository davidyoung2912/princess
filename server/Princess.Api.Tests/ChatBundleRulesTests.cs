using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-bundles-plan.md, phase B1: the bundle message, built from a venue or menu ref.</summary>
public class ChatBundleRulesTests
{
    [Fact]
    public void OnlyVenueAndMenuRefsHaveAKnownType()
    {
        Assert.Equal(ChatBundleRules.Venue, ChatBundleRules.TypeOfRef("venue:crown-grill"));
        Assert.Equal(ChatBundleRules.Menu, ChatBundleRules.TypeOfRef("menu:crown-grill:dinner"));
        foreach (var bad in new[] { null, "", "  ", "excursion:abc", "booking", "game.sudoku:1" }) Assert.Null(ChatBundleRules.TypeOfRef(bad));
    }

    [Fact]
    public void ABundleCarriesNoMoneyOrIdentityAndRoundTrips()
    {
        var card = new ChatCard(ChatCardRules.Venue, "Crown Grill", "Steakhouse", Place: "Deck 7", Path: "/dining-today/crown-grill");
        var bundle = ChatBundleRules.FromCard(ChatBundleRules.Venue, "venue:crown-grill", card, "  join\r\nus? ");
        var json = ChatBundleRules.Serialise(bundle);
        Assert.False(ChatCardRules.HasForbiddenKey(json));
        Assert.Equal(bundle, ChatBundleRules.Parse(json));
        Assert.Equal("join us?", bundle.Note);
        Assert.Equal(ChatBundleRules.Version, bundle.V);
        Assert.DoesNotContain("day", json);
    }

    [Fact]
    public void EveryFieldOfTheBundleRecordIsOnTheAllowedList()
    {
        foreach (var p in typeof(ChatBundle).GetProperties()) Assert.DoesNotContain(p.Name.ToLowerInvariant(), ChatCardRules.ForbiddenKeys);
    }

    [Fact]
    public void AnUnknownTypeStillParsesSoAnOlderReaderCanShowItsTitle()
    {
        var parsed = ChatBundleRules.Parse("{\"type\":\"game.sudoku\",\"v\":3,\"title\":\"Sudoku\",\"subtitle\":\"Hard\",\"data\":{\"x\":1}}");
        Assert.NotNull(parsed);
        Assert.Equal("game.sudoku", parsed!.Type);
        Assert.Equal("Sudoku: Hard", ChatBundleRules.Preview(parsed));
    }

    [Fact]
    public void GarbageIsNotABundle()
    {
        foreach (var bad in new[] { null, "", "{bad", "{}", "{\"type\":\"venue\"}", "{\"title\":\"x\"}" }) Assert.Null(ChatBundleRules.Parse(bad));
        Assert.Equal("Shared from the app", ChatBundleRules.Preview(null));
    }

    [Fact]
    public void ABundleIsDeletedAndSentAgainNeverRewordedAndOtherKindsKeepTheirRule()
    {
        Assert.True(ChatCardRules.CannotEdit(ChatBundleRules.Kind));
        Assert.True(ChatCardRules.CannotEdit(ChatCardRules.Card));
        Assert.False(ChatCardRules.CannotEdit(ChatCardRules.Text));
        Assert.False(ChatCardRules.IsTyped(ChatBundleRules.Kind));   // the old card kinds are untouched
    }
}
