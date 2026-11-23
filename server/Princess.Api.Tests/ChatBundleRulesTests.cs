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
    public void AnEventRefNamesTheEventTypeAndTheBundleTypeFollowsTheEventId()
    {
        Assert.Equal(ChatBundleRules.Event, ChatBundleRules.TypeOfRef("event:trivia~1:3"));
        Assert.Equal("trivia~1:3", ChatBundleRules.PlanRefOf("event:trivia~1:3"));
        Assert.Null(ChatBundleRules.PlanRefOf("event:"));
        Assert.Null(ChatBundleRules.PlanRefOf("venue:x"));
        Assert.Equal(ChatBundleRules.Excursion, ChatBundleRules.TypeOfEvent(ChatPlanningRules.TourEventId("x1")));
        Assert.Equal(ChatBundleRules.Dinner, ChatBundleRules.TypeOfEvent(ChatPlanningRules.DinnerEventId("sabatini", "19:00")));
        Assert.Equal(ChatBundleRules.Event, ChatBundleRules.TypeOfEvent("trivia~1"));
        Assert.True(ChatBundleRules.IsPlannable(ChatBundleRules.Dinner));
        Assert.False(ChatBundleRules.IsPlannable(ChatBundleRules.Venue));
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

    [Fact]
    public void ABundlePollOptionTakesItsTitleAndSixAreAllowedOnlyWithABundle()
    {
        string? Title(string r) => r == "event:a:3" ? "Trivia: Ship Secrets, with a very long name indeed" : r == "event:b:3" ? "Karaoke" : null;
        var poll = ChatPlanningRules.CleanPoll("Which?", ["", "Pizza"], ["event:a:3", null], Title);
        Assert.NotNull(poll);
        Assert.Equal(2, poll!.Options.Count);
        Assert.True(poll.Options[0].Length <= ChatPlanningRules.MaxOption);
        Assert.Equal(["event:a:3", null], poll.Refs);
        Assert.Null(ChatPlanningRules.CleanPoll("Which?", ["", "Pizza"], ["event:zzz:3", null], Title));   // a ref that cannot be built
        Assert.Single(ChatPlanningRules.CleanPoll("Which?", ["", "", "x"], ["event:a:3", "event:a:3", null], Title)!.Refs!.Where(r => r == "event:a:3"));
        var six = new[] { "1", "2", "3", "4", "5", "6" };
        Assert.Null(ChatPlanningRules.CleanPoll("Which?", six));
        Assert.NotNull(ChatPlanningRules.CleanPoll("Which?", ["", "2", "3", "4", "5", "6"], ["event:b:3", null, null, null, null, null], Title));
        Assert.Null(ChatPlanningRules.CleanPoll("Which?", ["a", "b"])!.Refs);
    }

    [Fact]
    public void ThePersonWhoAskedAnAdminAndEitherPersonInADirectChatMayDecide()
    {
        Assert.True(ChatPlanningRules.MayDecide(ChatConversationRules.Group, true, false));
        Assert.True(ChatPlanningRules.MayDecide(ChatConversationRules.Group, false, true));
        Assert.False(ChatPlanningRules.MayDecide(ChatConversationRules.Group, false, false));
        Assert.True(ChatPlanningRules.MayDecide(ChatConversationRules.Direct, false, false));
    }
}
