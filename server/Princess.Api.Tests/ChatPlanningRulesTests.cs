using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, phase 4: polls, plans with an answer, and admins.</summary>
public class ChatPlanningRulesTests
{
    private static readonly DateTime Sent = new(2027, 3, 22, 16, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void APollNeedsAQuestionAndTwoToFiveDifferentOptions()
    {
        Assert.NotNull(ChatPlanningRules.CleanPoll("Where?", ["Pasta", "Pizza"]));
        Assert.Null(ChatPlanningRules.CleanPoll("Where?", ["Pasta"]));
        Assert.Null(ChatPlanningRules.CleanPoll("Where?", ["Pasta", "pasta"]));   // the same words in another case count once
        Assert.Null(ChatPlanningRules.CleanPoll("Where?", ["a", "b", "c", "d", "e", "f"]));
        Assert.NotNull(ChatPlanningRules.CleanPoll("Where?", ["a", "b", "c", "d", "e"]));
        Assert.Null(ChatPlanningRules.CleanPoll("", ["a", "b"]));
        Assert.Null(ChatPlanningRules.CleanPoll(new string('q', ChatPlanningRules.MaxQuestion + 1), ["a", "b"]));
        Assert.Null(ChatPlanningRules.CleanPoll("Where?", ["a", new string('o', ChatPlanningRules.MaxOption + 1)]));
        var poll = ChatPlanningRules.CleanPoll("  Where   to eat? ", ["  Pasta ", "", "Pizza"])!;
        Assert.Equal("Where to eat?", poll.Question);
        Assert.Equal(["Pasta", "Pizza"], poll.Options);   // an empty row is left out
    }

    [Fact]
    public void ThePollPayloadRoundTripsAndCarriesNothingElse()
    {
        var poll = new ChatPoll("Where?", ["Pasta", "Pizza"]);
        var json = ChatPlanningRules.Serialise(poll);
        Assert.False(ChatCardRules.HasForbiddenKey(json));
        Assert.Equal(poll.Options, ChatPlanningRules.ParsePoll(json)!.Options);
        Assert.Null(ChatPlanningRules.ParsePoll("{bad"));
        Assert.Null(ChatPlanningRules.ParsePoll(null));
        Assert.Equal("Poll: Where?", ChatPlanningRules.PollPreview("Where?"));
    }

    [Fact]
    public void APollClosesOnDemandOrAfter24Hours()
    {
        Assert.False(ChatPlanningRules.IsClosed(null, Sent, Sent.AddHours(23).AddMinutes(59)));
        Assert.True(ChatPlanningRules.IsClosed(null, Sent, Sent.AddHours(24)));
        Assert.True(ChatPlanningRules.IsClosed(Sent.AddMinutes(5), Sent, Sent.AddMinutes(6)));
        Assert.True(ChatPlanningRules.MayClose(isSender: true, isAdmin: false));
        Assert.True(ChatPlanningRules.MayClose(isSender: false, isAdmin: true));
        Assert.False(ChatPlanningRules.MayClose(isSender: false, isAdmin: false));
    }

    [Fact]
    public void TheTallyCountsEachOptionAndIgnoresAChoiceOutsideTheOptions()
    {
        Assert.Equal([2, 1, 0], ChatPlanningRules.Tally([0, 0, 1, 7, -1], 3));
        Assert.True(ChatPlanningRules.ValidOption(0, 2));
        Assert.False(ChatPlanningRules.ValidOption(2, 2));
        Assert.False(ChatPlanningRules.ValidOption(-1, 2));
    }

    [Fact]
    public void APlanRefIsTheEventAndTheDayAndNothingElseParses()
    {
        Assert.Equal("show-1:3", ChatPlanningRules.PlanRef("show-1", 3));
        Assert.Equal(("show-1", 3), ChatPlanningRules.ParsePlanRef("show-1:3"));
        Assert.Null(ChatPlanningRules.ParsePlanRef("show-1"));
        Assert.Null(ChatPlanningRules.ParsePlanRef("show-1:x"));
        Assert.Null(ChatPlanningRules.ParsePlanRef("show-1:0"));
        Assert.Null(ChatPlanningRules.ParsePlanRef(null));
        Assert.Equal("Plan: Trivia", ChatCardRules.Preview(ChatCardRules.Plan, new ChatCard(ChatCardRules.Plan, "Trivia")));
        Assert.Equal(ChatPlanningRules.Going, ChatPlanningRules.ParseRsvp("going"));
        Assert.Null(ChatPlanningRules.ParseRsvp("yes"));
    }

    [Fact]
    public void GoingPutsTheEventOnTheProgrammeAndAnotherAnswerTakesItOffOnlyIfThePlanPutItThere()
    {
        // Going, not yet on the programme: add it and remember the plan did.
        Assert.Equal(new ChatPlanningRules.ProgrammeEffect(true, false, true), ChatPlanningRules.Effect(null, false, ChatPlanningRules.Going, inProgramme: false, mayChange: true));
        // Going again changes nothing and keeps the memory.
        Assert.Equal(new ChatPlanningRules.ProgrammeEffect(false, false, true), ChatPlanningRules.Effect(ChatPlanningRules.Going, true, ChatPlanningRules.Going, inProgramme: true, mayChange: true));
        // Changing to No undoes what the plan did.
        Assert.Equal(new ChatPlanningRules.ProgrammeEffect(false, true, false), ChatPlanningRules.Effect(ChatPlanningRules.Going, true, ChatPlanningRules.No, inProgramme: true, mayChange: true));
        // An event the guest had saved themselves stays when they change to Maybe.
        Assert.Equal(new ChatPlanningRules.ProgrammeEffect(false, false, false), ChatPlanningRules.Effect(null, false, ChatPlanningRules.Going, inProgramme: true, mayChange: true));
        Assert.Equal(new ChatPlanningRules.ProgrammeEffect(false, false, false), ChatPlanningRules.Effect(ChatPlanningRules.Going, false, ChatPlanningRules.Maybe, inProgramme: true, mayChange: true));
        // Nothing changes when the programme may not change (a child, or an event their sailing does not run).
        Assert.Equal(new ChatPlanningRules.ProgrammeEffect(false, false, false), ChatPlanningRules.Effect(null, false, ChatPlanningRules.Going, inProgramme: false, mayChange: false));
        Assert.False(ChatPlanningRules.MayChangeProgramme(supervised: true));
        Assert.True(ChatPlanningRules.MayChangeProgramme(supervised: false));
    }

    [Fact]
    public void ThereIsOneAdminBesideTheCreatorAndAChildIsNeverOne()
    {
        Assert.True(ChatPlanningRules.IsAdmin(isCreator: true, flagged: false));
        Assert.True(ChatPlanningRules.IsAdmin(isCreator: false, flagged: true));
        Assert.False(ChatPlanningRules.IsAdmin(isCreator: false, flagged: false));
        Assert.True(ChatPlanningRules.CanAddAdmin(0));
        Assert.False(ChatPlanningRules.CanAddAdmin(1));
        Assert.False(ChatPlanningRules.MayBeAdmin(supervised: true));
        Assert.True(ChatCardRules.MayPin("group", isAdmin: true));
        Assert.False(ChatCardRules.MayPin("group", isAdmin: false));
    }

    [Fact]
    public void OnlyAdminsPostInAnAnnouncementOnlyGroup()
    {
        Assert.False(ChatPlanningRules.MayPost("group", announcementOnly: true, isAdmin: false));
        Assert.True(ChatPlanningRules.MayPost("group", announcementOnly: true, isAdmin: true));
        Assert.True(ChatPlanningRules.MayPost("group", announcementOnly: false, isAdmin: false));
        Assert.True(ChatPlanningRules.MayPost("direct", announcementOnly: true, isAdmin: false));   // only a made group can be announcement-only
        Assert.True(ChatCardRules.CannotEdit("poll"));
        Assert.True(ChatCardRules.CannotEdit("plan"));
        Assert.False(ChatCardRules.CannotEdit("text"));
    }
}
