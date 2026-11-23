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

    [Fact]
    public void ATimePollTakesSlotsOnDaysOfTheSailingAndBuildsItsOwnWords()
    {
        var poll = ChatPlanningRules.CleanSlotPoll("When for wine?", ["2@17:00", "3@19:30", "2@17:00"], 7);
        Assert.NotNull(poll);
        Assert.Equal(["2@17:00", "3@19:30"], poll!.Slots);
        Assert.Equal(["Day 2, 17:00", "Day 3, 19:30"], poll.Options);
        Assert.Null(ChatPlanningRules.CleanSlotPoll("When?", ["2@17:00", "9@10:00"], 7));   // off the sailing
        Assert.Null(ChatPlanningRules.CleanSlotPoll("When?", ["2@17:00", "2@25:00"], 7));   // not a time
        Assert.Null(ChatPlanningRules.CleanSlotPoll("When?", ["2@17:00"], 7));              // one slot is not a choice
        Assert.Null(ChatPlanningRules.CleanSlotPoll("", ["2@17:00", "3@17:00"], 7));
    }

    [Fact]
    public void ASlotClashesOnlyWithSomethingOfTheVotersOnTheSameDay()
    {
        (int, string, int)[] busy = [(2, "17:30", 45)];
        Assert.True(ChatPlanningRules.SlotClashes("2@17:00", busy));    // 17:00 to 18:00 overlaps 17:30 to 18:15
        Assert.False(ChatPlanningRules.SlotClashes("2@18:15", busy));   // starts as it ends
        Assert.False(ChatPlanningRules.SlotClashes("3@17:30", busy));   // another day
        Assert.False(ChatPlanningRules.SlotClashes("junk", busy));
    }

    [Fact]
    public void PortPlaceAndDishRefsAreKnownAndStrict()
    {
        Assert.Equal("port", ChatBundleRules.TypeOfRef("port:cozumel"));
        Assert.Equal("cozumel", ChatBundleRules.IdOf("port:cozumel", ChatBundleRules.Port));
        Assert.Null(ChatBundleRules.IdOf("port:../x", ChatBundleRules.Port));
        Assert.Null(ChatBundleRules.IdOf("place:", ChatBundleRules.Place));
        Assert.Equal(("crown-grill", "filet-mignon"), ChatBundleRules.ParseDishRef("dish:crown-grill:filet-mignon"));
        Assert.Null(ChatBundleRules.ParseDishRef("dish:crown-grill"));
        Assert.Null(ChatBundleRules.ParseDishRef("dish:a:b:c"));
        Assert.False(ChatBundleRules.IsPlannable(ChatBundleRules.Port));
    }

    private static string Clues(int n = 81) => "d=hard;p=" + new string('0', n);

    [Fact]
    public void AGameBundleIsBuiltFromAFixedTableAndKeepsThePuzzleText()
    {
        var b = ChatBundleRules.BuildGame("game:sudoku:start", Clues(), "  try this  ")!;
        Assert.Equal("game.sudoku", b.Type);
        Assert.Equal("Sudoku", b.Title);
        Assert.Equal("Hard, starting position", b.Subtitle);
        Assert.Equal("/games-explorer/sudoku", b.Path);
        Assert.Equal(Clues(), b.Data);
        Assert.Equal("Hard, board so far", ChatBundleRules.BuildGame("game:binairo:current", Clues(36), null)!.Subtitle);
        Assert.Equal("Hard, solved in 9:12", ChatBundleRules.BuildGame("game:sudoku:result", Clues() + ";tm=552", null)!.Subtitle);
        Assert.Null(ChatBundleRules.BuildGame("game:sudoku:result", Clues(), null));                 // a result needs a time
        Assert.Null(ChatBundleRules.BuildGame("game:sudoku:result", Clues() + ";tm=0", null));
        Assert.Null(ChatBundleRules.BuildGame("game:sudoku:result", Clues() + ";tm=360000", null));
        Assert.Null(ChatBundleRules.BuildGame("game:sudoku:start", Clues() + ";tm=552", null));      // a time belongs only to a result
        Assert.Null(ChatBundleRules.TypeOfRef("game:sudoku:start"));   // no poll, board or code can name a game
    }

    [Theory]
    [InlineData("game:sudoku", "d=easy;p=0")]
    [InlineData("game:sudoku:later", "d=easy")]
    [InlineData("game:chess:start", "d=easy")]
    [InlineData("venue:x:start", "d=easy")]
    [InlineData("game:sudoku:start", "")]
    [InlineData("game:sudoku:start", "d=nope;p=0")]
    [InlineData("game:sudoku:start", "d=easy;d=easy;p=0")]
    public void ABadGameRefOrPayloadIsRefused(string shareRef, string data) => Assert.Null(ChatBundleRules.BuildGame(shareRef, data, null));

    [Fact]
    public void GamePuzzleTextIsHeldToItsAllowListAndSize()
    {
        Assert.False(ChatBundleRules.GameDataOk("sudoku", Clues() + "<b>"));
        Assert.False(ChatBundleRules.GameDataOk("sudoku", Clues(80)));
        Assert.False(ChatBundleRules.GameDataOk("binairo", Clues(81)));
        Assert.True(ChatBundleRules.GameDataOk("binairo", Clues(144)));
        Assert.True(ChatBundleRules.GameDataOk("kenken", Clues(49)));
        Assert.True(ChatBundleRules.GameDataOk("futoshiki", Clues(16)));
        Assert.True(ChatBundleRules.GameDataOk("hitori", Clues(100)));
        Assert.False(ChatBundleRules.GameDataOk("hitori", Clues(49)));
        Assert.True(ChatBundleRules.GameDataOk("kakuro", Clues(81)));
        Assert.True(ChatBundleRules.GameDataOk("slitherlink", Clues(49)));
        Assert.False(ChatBundleRules.GameDataOk("slitherlink", Clues(81)));
        Assert.True(ChatBundleRules.GameDataOk("hashi", Clues(4)));
        Assert.True(ChatBundleRules.GameDataOk("crossmath", "d=easy;p=0711;k=vnoe"));
        Assert.False(ChatBundleRules.GameDataOk("nurikabe", Clues(5)));
        Assert.True(ChatBundleRules.GameDataOk("nonogram", "d=easy;p=10;r=1,2;c=1,2"));
        Assert.False(ChatBundleRules.GameDataOk("nonogram", "d=easy;p=7;r=1;c=1"));
        Assert.True(ChatBundleRules.GameDataOk("cruise-wordle", "d=easy;p=7;g=CRANE,BEACH"));
        Assert.False(ChatBundleRules.GameDataOk("cruise-wordle", "d=easy;p=12345"));
        Assert.True(ChatBundleRules.GameDataOk("word-search", "d=easy;p=6;l=ABC"));
        Assert.False(ChatBundleRules.GameDataOk("word-search", "d=easy;p=7;l=ABC"));
        Assert.True(ChatBundleRules.GameDataOk("codeword", "d=easy;p=9;w=1"));
        Assert.True(ChatBundleRules.GameDataOk("minesweeper", "d=easy;p=1214;s=5;i=1,2"));
        Assert.False(ChatBundleRules.GameDataOk("minesweeper", "d=easy;p=0909;s=5;i=1,2"));
        Assert.False(ChatBundleRules.GameDataOk("sudoku", Clues() + ";x=" + new string('a', ChatBundleRules.GameDataMax)));
        Assert.False(ChatBundleRules.GameDataOk("sudoku", null));
        Assert.False(ChatBundleRules.GameDataOk("sudoku", "d=easy;p=" + new string('0', 80) + "x"));
    }
}
