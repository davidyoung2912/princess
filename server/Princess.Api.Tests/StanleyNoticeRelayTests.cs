using Microsoft.Extensions.Logging.Abstractions;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, section 15.4 and phase 0b: lanes, once per key, supersede, expiry, and the relay never blocking the push. Written, not run here: the owner runs the server tests.</summary>
public class StanleyNoticeRelayTests
{
    private static readonly DateTime Now = new(2027, 3, 24, 15, 0, 0, DateTimeKind.Utc);
    private static PushNotice Notice(string key, string kind = "reminder", bool bypass = false, string? tag = null) =>
        new(key, kind, "reminders", bypass, 50, "/home", "Title", "Body", [], tag);

    private static (InMemoryChatStore Store, StanleyNoticeRelay Relay, UserRecord User) Setup()
    {
        var users = new InMemoryUserStore();
        var store = new InMemoryChatStore(users);
        var user = new UserRecord { Id = 7, PublicId = Guid.NewGuid(), FirstName = "Sam" };
        return (store, new StanleyNoticeRelay(store, NullLogger<StanleyNoticeRelay>.Instance), user);
    }

    private static async Task<List<ChatMessageRow>> Thread(InMemoryChatStore store, UserRecord user)
    {
        var conversation = (await store.ListConversationsAsync(user.Id, default)).Single(c => c.Kind == "stanley");
        return await store.ListMessagesAsync(conversation.GroupId, user.Id, null, 100, default);
    }

    [Theory]
    [InlineData("allAboard", true, "critical")]
    [InlineData("payment", false, "important")]
    [InlineData("reservation", false, "important")]
    [InlineData("reminder", false, "reminder")]
    [InlineData("change", false, "info")]
    [InlineData("scheduleChange", false, "info")]
    public void EveryNoticeHasOneLane(string kind, bool bypass, string lane) => Assert.Equal(lane, StanleyNoticeRules.LaneOf(Notice("k", kind, bypass)));

    [Fact]
    public void OnlyTheCriticalLaneBypassesAndOnlyForKindsUnderChangeControl()
    {
        Assert.All(PushRules.Kinds, kind => Assert.Equal(StanleyNoticeRules.Critical, StanleyNoticeRules.LaneOf(Notice("k", kind, true))));
        // The gate: a notice that bypasses with a kind outside the list fails here, so a new bypass needs a reviewed change to the list.
        Assert.Subset(PushRules.Kinds.ToHashSet(), StanleyNoticeRules.BypassKinds.ToHashSet());   // every bypass kind is a real push kind
        Assert.DoesNotContain("reminder", StanleyNoticeRules.BypassKinds);
        Assert.DoesNotContain("change", StanleyNoticeRules.BypassKinds);
    }

    [Fact]
    public void CriticalAndImportantAskForGotItAndTheRestDoNot()
    {
        Assert.Equal("urgent", StanleyNoticeRules.UrgencyOf("critical"));
        Assert.Equal("important", StanleyNoticeRules.UrgencyOf("important"));
        Assert.Equal("normal", StanleyNoticeRules.UrgencyOf("reminder"));
        Assert.Equal("normal", StanleyNoticeRules.UrgencyOf("info"));
        Assert.True(ChatUrgencyRules.CanAck("important", false, false, isNotice: true));
        Assert.False(ChatUrgencyRules.CanAck("important", false, false));   // a person's important message still has no Got it
    }

    [Fact]
    public void ExpiryFollowsTheLaneAndInformationNeverExpires()
    {
        Assert.Equal(Now.AddHours(6), StanleyNoticeRules.ExpiryOf("critical", Now));
        Assert.Equal(Now.AddHours(48), StanleyNoticeRules.ExpiryOf("important", Now));
        Assert.Null(StanleyNoticeRules.ExpiryOf("info", Now));
        Assert.False(StanleyNoticeRules.Active(Now.AddHours(6), false, Now.AddHours(7)));
        Assert.False(StanleyNoticeRules.Active(null, true, Now));
        Assert.True(StanleyNoticeRules.Active(null, false, Now));
    }

    [Fact]
    public async Task EachKeyIsPostedOnceAndARepeatAddsNothing()
    {
        var (store, relay, user) = Setup();
        var notices = new[] { Notice("a"), Notice("b") };
        Assert.Equal(2, await relay.RelayAsync(user, notices, Now, default));
        Assert.Equal(0, await relay.RelayAsync(user, notices, Now.AddMinutes(15), default));
        Assert.Equal(2, (await Thread(store, user)).Count(m => m.NoticeKey is not null));
    }

    [Fact]
    public async Task ANewerNoticeOfTheSameOccasionReplacesTheOlder()
    {
        var (store, relay, user) = Setup();
        await relay.RelayAsync(user, [Notice("allAboard:d:60", "allAboard", true, "d")], Now, default);
        await relay.RelayAsync(user, [Notice("allAboard:d:30", "allAboard", true, "d")], Now.AddMinutes(30), default);
        var messages = (await Thread(store, user)).Where(m => m.NoticeKey is not null).ToList();
        Assert.NotNull(messages.Single(m => m.NoticeKey == "allAboard:d:60").SupersededAt);
        Assert.Null(messages.Single(m => m.NoticeKey == "allAboard:d:30").SupersededAt);
    }

    [Fact]
    public async Task TheThreadKeepsTheFullTextAndTheLaneAndLink()
    {
        var (store, relay, user) = Setup();
        await relay.RelayAsync(user, [Notice("p", "payment") with { Title = "Payment due", Body = "Final payment is due Friday." }], Now, default);
        var m = (await Thread(store, user)).Single(x => x.NoticeKey == "p");
        Assert.Equal("Payment due\nFinal payment is due Friday.", m.Text);
        Assert.Equal("important", m.Lane);
        Assert.Equal("/home", m.NoticePath);
        Assert.True(m.FromStanley);
    }

    [Fact]
    public async Task ASupervisedAccountGetsNothingFromTheRelay()
    {
        var (_, relay, user) = Setup();
        user.IsSupervised = true;
        Assert.Equal(0, await relay.RelayAsync(user, [Notice("a")], Now, default));
    }

    [Fact]
    public async Task AFailedWriteIsSwallowedSoThePushStillGoes()
    {
        var relay = new StanleyNoticeRelay(new ThrowingChat(new InMemoryUserStore()), NullLogger<StanleyNoticeRelay>.Instance);
        Assert.Equal(0, await relay.RelayAsync(new UserRecord { Id = 1 }, [Notice("a", "allAboard", true)], Now, default));
    }

    private sealed class ThrowingChat(InMemoryUserStore users) : InMemoryChatStore(users)
    {
        public override Task<bool> AddStanleyNoticeAsync(long userId, StanleyNotice n, string voice, string subtitle, DateTime at, CancellationToken ct) => throw new InvalidOperationException("store down");
    }
}
