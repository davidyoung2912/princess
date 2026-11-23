using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>docs/chat-bundles-plan.md, B10 and B11: the "I did it" tally on a bundle, "Done, how was it?" on a decided poll, and the name a forward carries.</summary>
public class ChatOutcomeTallyTests
{
    private static readonly DateTime Now = new(2026, 11, 23, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Dictionary<long, ChatPeerRow> People = new()
    {
        [1] = new() { UserId = 1, FirstName = "Ann", LastName = "Lee" },
        [2] = new() { UserId = 2, FirstName = "Bo", LastName = "Chan" },
        [3] = new() { UserId = 3, FirstName = "Cy", LastName = "Diaz" },
    };

    private static ChatMessageRow Bundle() => new() { Id = 10, Kind = ChatBundleRules.Kind, FromUserId = 1, At = Now };

    [Fact]
    public void TakingItBackIsNotCountedAsDone()
    {
        // Taking "I did it" back stores choice 0, which is Going for a plan: it must not count as done.
        var rows = new[] { new ChatResponseRow(10, 1, ChatBundleRules.DoneChoice, false), new ChatResponseRow(10, 2, 0, false) };
        var tally = ChatPlanningService.TallyOf(Bundle(), rows, 1, Now, false, People, new HashSet<long>())!;
        Assert.Equal([1], tally.Counts);
        Assert.Equal(ChatBundleRules.DoneChoice, tally.Mine);
        Assert.Empty(tally.Going!);
    }

    [Fact]
    public void DoneByOthersAreNamedAndABlockedPersonIsLeftOut()
    {
        var rows = new[] { new ChatResponseRow(10, 2, ChatBundleRules.DoneChoice, false), new ChatResponseRow(10, 3, ChatBundleRules.DoneChoice, false) };
        var tally = ChatPlanningService.TallyOf(Bundle(), rows, 1, Now, false, People, new HashSet<long> { 3 })!;
        Assert.Equal([1], tally.Counts);
        Assert.Null(tally.Mine);
        Assert.Single(tally.Going!);
        Assert.StartsWith("Bo", tally.Going![0]);
    }

    [Fact]
    public void AnUndecidedPollHasNoHowCounts()
    {
        var poll = new ChatMessageRow { Id = 11, Kind = ChatPlanningRules.Poll, FromUserId = 1, At = Now, Payload = ChatPlanningRules.Serialise(new ChatPoll("Where?", ["A", "B"])) };
        var tally = ChatPlanningService.TallyOf(poll, [], 1, Now, false, People, new HashSet<long>(), ChatConversationRules.Group, [new ChatOutcomeRow(11, 2, 1)])!;
        Assert.Null(tally.How);
        Assert.Null(tally.MyHow);
    }

    [Fact]
    public void ADecidedPollCountsHowItWentAndShowsMyOwn()
    {
        var poll = new ChatMessageRow { Id = 11, Kind = ChatPlanningRules.Poll, FromUserId = 1, At = Now, DecidedOption = 0, Payload = ChatPlanningRules.Serialise(new ChatPoll("Where?", ["A", "B"])) };
        var outcomes = new[] { new ChatOutcomeRow(11, 1, ChatPlanningRules.HowLoved), new ChatOutcomeRow(11, 2, ChatPlanningRules.HowLoved), new ChatOutcomeRow(11, 3, ChatPlanningRules.HowNot) };
        var tally = ChatPlanningService.TallyOf(poll, [], 1, Now, false, People, new HashSet<long> { 3 }, ChatConversationRules.Group, outcomes)!;
        Assert.Equal([2, 0, 0], tally.How);   // the blocked person's rating is not counted for the reader
        Assert.Equal(ChatPlanningRules.HowLoved, tally.MyHow);
    }

    [Fact]
    public void OnlyThreeRatingsAreKnown()
    {
        Assert.Equal(2, ChatPlanningRules.ParseHow(2));
        foreach (int? bad in new int?[] { null, 0, 4, -1 }) Assert.Null(ChatPlanningRules.ParseHow(bad));
        Assert.Equal([1, 2, 1], ChatPlanningRules.HowCounts([1, 2, 2, 3, 0, 9]));
    }

    [Fact]
    public void AForwardNamesTheFirstSenderAndNeverTheForwarder()
    {
        Assert.Equal("Alex B.", ChatBundleRules.ForwardName(null, false, "Alex B."));
        Assert.Equal("First P.", ChatBundleRules.ForwardName("First P.", false, "Alex B."));   // a forward of a forward keeps the first name
        Assert.Equal("First P.", ChatBundleRules.ForwardName("First P.", true, null));
        Assert.Null(ChatBundleRules.ForwardName(null, true, "Me M."));   // forwarding your own: no name
        Assert.Null(ChatBundleRules.ForwardName(null, false, null));     // the sender is gone from the chat
        Assert.Null(ChatBundleRules.ForwardName("", false, ""));
    }
}
