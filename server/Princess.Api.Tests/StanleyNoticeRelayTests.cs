using Microsoft.Extensions.Logging.Abstractions;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Endpoints;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

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
    public void EveryBuiltNoticeThatBypassesIsOfAKindUnderChangeControl()
    {
        var now = new DateTime(2027, 3, 24, 15, 0, 0, DateTimeKind.Utc);
        var left = now.AddMinutes(10);
        var day = new PortDayWithState(4, "cozumel", "2027-03-24", "4:30 pm", "3:30 pm", new DateTimeOffset(left).ToUnixTimeMilliseconds(), 0, 0, "America/New_York", "America/Cancun", false, AboardRules.StateOf(left, now));
        var inputs = new[]
        {
            new PushInput(now, "ok", "2027-03-01", day, true, 45, true, [], [], 4, []),
            new PushInput(now, "overdue", "2027-03-01", null, false, 45, false, [], [], 4, []),
            new PushInput(now, "dueSoon", "2027-03-01", null, false, 45, false, [], [], 4, []),
        };
        var built = inputs.SelectMany(PushRules.Build).ToList();
        Assert.Contains(built, n => n.Bypass);
        Assert.All(built.Where(n => n.Bypass), n => Assert.Contains(n.Kind, StanleyNoticeRules.BypassKinds));
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

    private static (InMemoryChatStore Store, StanleyNoticeRelay Relay, UserRecord Child, UserRecord Guardian) Family(StanleySwitches? switches = null)
    {
        var users = new InMemoryUserStore();
        var store = new InMemoryChatStore(users);
        var guardian = users.Add("g@example.com", "pw", first: "Pat");
        var child = users.Add(null, null, supervised: true, booker: guardian, first: "Alex");
        var options = Microsoft.Extensions.Options.Options.Create(new StanleyOptions { Switches = switches ?? new() });
        return (store, new StanleyNoticeRelay(store, NullLogger<StanleyNoticeRelay>.Instance, options), child, guardian);
    }

    [Fact]
    public async Task ASupervisedAccountGetsOnlyTheScriptedChildNotices()
    {
        var (store, relay, child, _) = Family();
        // Muster and check-in are for a child; a payment, a reminder and an offer are not.
        var added = await relay.RelayAsync(child, [Notice("m", "muster", true), Notice("c", "checkin"), Notice("p", "payment"), Notice("r", "reminder"), Notice("o", "offer")], Now, default, offersOptedIn: true);
        Assert.Equal(2, added);
        Assert.Equal(["c", "m"], (await Thread(store, child)).Where(m => m.NoticeKey is not null).Select(m => m.NoticeKey!).Order());
    }

    [Fact]
    public async Task TheGuardianReceivesTheChildsCriticalNoticeLabelledWithTheirName()
    {
        var (store, relay, child, guardian) = Family();
        await relay.RelayAsync(child, [Notice("muster:1", "muster", true) with { Title = "Muster", Body = "Station B, deck 5." }, Notice("c", "checkin")], Now, default);
        var copies = (await Thread(store, guardian)).Where(m => m.NoticeKey is not null).ToList();
        var copy = Assert.Single(copies);
        Assert.Equal($"child:{child.Id}:muster:1", copy.NoticeKey);
        Assert.StartsWith("For Alex: ", copy.Text);
        Assert.Equal("critical", copy.Lane);
        Assert.Empty(StanleyNoticeRules.ActionsFor(copy.NoticeKind ?? "", copy.NoticeSubject, false, false));   // the guardian cannot confirm the child's muster
        // A repeat adds nothing.
        await relay.RelayAsync(child, [Notice("muster:1", "muster", true)], Now.AddMinutes(15), default);
        Assert.Single(await Thread(store, guardian), m => m.NoticeKey is not null);
    }

    [Fact]
    public void OnlyTheCriticalLaneIsCopiedToAGuardian()
    {
        var important = StanleyNoticeRules.Build(Notice("p", "payment"), Now);
        Assert.Null(StanleyNoticeRules.ForGuardian(important, "Alex", 3));
        Assert.NotNull(StanleyNoticeRules.ForGuardian(StanleyNoticeRules.Build(Notice("m", "muster", true), Now), "Alex", 3));
    }

    [Fact]
    public void AnOfferIsNeverCriticalNeverBypassesAndNeedsOptInAndNoOpenCase()
    {
        var offer = Notice("o", "offer", bypass: true);
        Assert.Equal("info", StanleyNoticeRules.LaneOf(offer));
        Assert.False(StanleyNoticeRules.OfferAllowed(offer, true, false, false));                          // it may not bypass
        var plain = Notice("o", "offer");
        Assert.False(StanleyNoticeRules.OfferAllowed(plain, false, false, false));                         // no opt-in
        Assert.False(StanleyNoticeRules.OfferAllowed(plain, true, true, false));                           // a serious case is open
        Assert.False(StanleyNoticeRules.OfferAllowed(plain, true, false, true));                           // a supervised account
        Assert.True(StanleyNoticeRules.OfferAllowed(plain, true, false, false));
        Assert.True(StanleyNoticeRules.OfferAllowed(Notice("p", "payment"), false, true, false));          // a required notice is never held by the gate
    }

    [Fact]
    public async Task AnOfferIsNotWrittenWithoutOptInAndIsPausedWhileACaseIsOpen()
    {
        var (store, relay, user) = Setup();
        Assert.Equal(0, await relay.RelayAsync(user, [Notice("o", "offer")], Now, default));
        Assert.Equal(0, await relay.RelayAsync(user, [Notice("o", "offer")], Now, default, offersOptedIn: true, seriousCaseOpen: true));
        Assert.Equal(1, await relay.RelayAsync(user, [Notice("o", "offer")], Now, default, offersOptedIn: true));
        Assert.Equal("info", (await Thread(store, user)).Single(m => m.NoticeKey == "o").Lane);
    }

    [Fact]
    public async Task AKilledLaneIsNotWrittenToTheThreadButOtherLanesAre()
    {
        var users = new InMemoryUserStore();
        var store = new InMemoryChatStore(users);
        var user = new UserRecord { Id = 7, PublicId = Guid.NewGuid(), FirstName = "Sam" };
        var options = Microsoft.Extensions.Options.Options.Create(new StanleyOptions { Switches = new() { ThreadCritical = false } });
        var relay = new StanleyNoticeRelay(store, NullLogger<StanleyNoticeRelay>.Instance, options);
        Assert.Equal(1, await relay.RelayAsync(user, [Notice("m", "muster", true), Notice("r")], Now, default));
        Assert.DoesNotContain(await Thread(store, user), m => m.NoticeKey == "m");
    }

    [Fact]
    public void TheThreadSwitchesAreOnByDefaultAndTheRelayNeverControlsThePush()
    {
        var sw = new StanleySwitches();
        Assert.All(StanleyNoticeRules.Lanes, lane => Assert.True(StanleyNoticeRules.LaneOn(lane, sw.ThreadCritical, sw.ThreadImportant, sw.ThreadReminder, sw.ThreadInfo)));
        Assert.DoesNotContain("thread", sw.Off());   // a thread switch is not a Stanley route and never turns off the direct push
    }

    [Fact]
    public async Task AFailedWriteIsSwallowedSoThePushStillGoes()
    {
        var relay = new StanleyNoticeRelay(new ThrowingChat(new InMemoryUserStore()), NullLogger<StanleyNoticeRelay>.Instance);
        Assert.Equal(0, await relay.RelayAsync(new UserRecord { Id = 1 }, [Notice("a", "allAboard", true)], Now, default));
    }

    [Fact]
    public async Task AFailedWriteIsCountedAsTheFailOpenPath()
    {
        var chat = new ThrowingChat(new InMemoryUserStore());
        var relay = new StanleyNoticeRelay(chat, NullLogger<StanleyNoticeRelay>.Instance);
        await relay.RelayAsync(new UserRecord { Id = 1 }, [Notice("a", "allAboard", true)], Now, default);
        Assert.Equal(StanleyNoticeRules.EventFailOpen, chat.Deliveries.Single().Event);
    }

    private sealed class ThrowingChat(InMemoryUserStore users) : InMemoryChatStore(users)
    {
        public override Task<bool> AddStanleyNoticeAsync(long userId, StanleyNotice n, string voice, string subtitle, DateTime at, CancellationToken ct) => throw new InvalidOperationException("store down");
    }

    // ---- Thread-only notices (the ones that lived only on screen) ----

    private static StanleyNoticeRules.ScreenInput Screen(DateTime? drill = null, bool musterDone = false, int docs = 0, int passports = 0, string checkin = "done", params Guid[] tickets) =>
        new(Now, drill, musterDone, docs, passports, checkin, "2027-03-10", tickets);

    [Fact]
    public void TheMusterPromptIsCriticalInsideItsWindowAndGoneOnceConfirmed()
    {
        var drill = Now.AddMinutes(30);
        var prompt = Assert.Single(StanleyNoticeRules.ScreenNotices(Screen(drill)));
        Assert.Equal("critical", StanleyNoticeRules.LaneOf(prompt));
        Assert.Equal("/ship/muster", prompt.Path);
        Assert.Empty(StanleyNoticeRules.ScreenNotices(Screen(drill, musterDone: true)));
        Assert.Empty(StanleyNoticeRules.ScreenNotices(Screen(Now.AddMinutes(61))));            // not open yet
        Assert.Empty(StanleyNoticeRules.ScreenNotices(Screen(Now.AddHours(-19))));             // window closed
    }

    [Fact]
    public void DocumentsCheckInAndAnsweredRequestsEachGetOneStableNotice()
    {
        var id = Guid.NewGuid();
        var notices = StanleyNoticeRules.ScreenNotices(Screen(docs: 2, passports: 1, checkin: "open", tickets: id));
        Assert.Equal(["passportProblem:1", "documentsMissing:2", "checkinOpen:2027-03-10", $"ticket:{id:N}"], notices.Select(n => n.Key).ToArray());
        Assert.All(notices, n => Assert.Equal("important", StanleyNoticeRules.LaneOf(n)));
        Assert.Equal(notices.Select(n => n.Key), StanleyNoticeRules.ScreenNotices(Screen(docs: 2, passports: 1, checkin: "open", tickets: id)).Select(n => n.Key));
    }

    [Fact]
    public void CheckInBeforeItOpensIsInformationAndNothingIsSaidOnceDone()
    {
        Assert.Equal("info", StanleyNoticeRules.LaneOf(Assert.Single(StanleyNoticeRules.ScreenNotices(Screen(checkin: "notYet")))));
        Assert.Empty(StanleyNoticeRules.ScreenNotices(Screen(checkin: "done")));
    }

    [Fact]
    public void TheThreadDropsTheStanleyPrefixThePhoneNeeds()
    {
        var n = StanleyNoticeRules.Build(Notice("p", "payment") with { Title = "Stanley: your payment is due soon", Body = "Pay by Friday." }, Now);
        Assert.Equal("Your payment is due soon\nPay by Friday.", n.Text);
    }

    // ---- Phase 0c ----

    [Fact]
    public void CriticalNoticesAreNeverPutOffAndInformationOnlyExplainsItself()
    {
        Assert.DoesNotContain(StanleyNoticeRules.ReplyLater, StanleyNoticeRules.RepliesOf(StanleyNoticeRules.Critical));
        Assert.Equal([StanleyNoticeRules.ReplyWhy], StanleyNoticeRules.RepliesOf(StanleyNoticeRules.Info));
        Assert.Contains(StanleyNoticeRules.ReplyLater, StanleyNoticeRules.RepliesOf(StanleyNoticeRules.Important));
    }

    [Fact]
    public void AnExpiredOrReplacedNoticeOffersNoAction()
    {
        Assert.Equal(["confirmMuster"], StanleyNoticeRules.ActionsFor("muster", null, false, false));
        Assert.Empty(StanleyNoticeRules.ActionsFor("muster", null, true, false));
        Assert.Empty(StanleyNoticeRules.ActionsFor("muster", null, false, true));
        Assert.Empty(StanleyNoticeRules.ActionsFor("reminder", null, false, false));
    }

    [Theory]
    [InlineData("why", false, false)]
    [InlineData("what", false, false)]
    public void WhyAndWhatAreAnsweredFromTheNoticeKind(string reply, bool expired, bool superseded)
    {
        foreach (var kind in PushRules.Kinds) Assert.False(string.IsNullOrWhiteSpace(StanleyNoticeRules.AnswerTo(reply, kind, expired, superseded)));
    }

    [Fact]
    public void ARepliedNoticeThatNoLongerAppliesSaysSoAndLaterIsNotAnAnswer()
    {
        Assert.Contains("newer", StanleyNoticeRules.AnswerTo("what", "muster", false, true));
        Assert.Contains("no longer", StanleyNoticeRules.AnswerTo("what", "muster", true, false));
        Assert.Null(StanleyNoticeRules.AnswerTo(StanleyNoticeRules.ReplyLater, "payment", false, false));
        Assert.Null(StanleyNoticeRules.AnswerTo("nonsense", "payment", false, false));
    }

    [Fact]
    public void AReservationOrChangeNoticeOffersItsCardOnlyWhenItNamesOne()
    {
        Assert.Equal([StanleyNoticeRules.ReviewChange], StanleyNoticeRules.ActionsFor("reservation", "dinner:2", false, false));
        Assert.Equal([StanleyNoticeRules.ReviewChange], StanleyNoticeRules.ActionsFor("change", "dinner:2", false, false));
        Assert.Empty(StanleyNoticeRules.ActionsFor("reservation", null, false, false));
        Assert.Empty(StanleyNoticeRules.ActionsFor("change", "dinner:2", true, false));
        Assert.Empty(StanleyNoticeRules.ActionsFor("case", "x", false, false));
    }

    [Fact]
    public async Task TheThreadKeepsTheCardAThisNoticeIsAbout()
    {
        var (store, relay, user) = Setup();
        var n = new PushNotice("change:dinner-2:abc", "reservation", "reminders", false, 85, "/plan/dining", "Stanley: dinner lost", "Your table is gone.", new() { ["card"] = "dinner-2" });
        await relay.RelayAsync(user, [n], Now, default);
        Assert.Equal("dinner-2", (await Thread(store, user)).Single(m => m.NoticeKey == "change:dinner-2:abc").NoticeSubject);
    }

    [Fact]
    public void TheStatsWindowIsClamped()
    {
        Assert.Equal(24, StanleyNoticeRules.StatsWindowHours(null));
        Assert.Equal(1, StanleyNoticeRules.StatsWindowHours(0));
        Assert.Equal(720, StanleyNoticeRules.StatsWindowHours(100000));
        Assert.Equal(48, StanleyNoticeRules.StatsWindowHours(48));
    }

    [Fact]
    public async Task EachPostedNoticeIsLoggedOnceWithKindAndLaneButNoText()
    {
        var (store, relay, user) = Setup();
        await relay.RelayAsync(user, [Notice("k1", "payment", true), Notice("k2")], Now, default);
        await relay.RelayAsync(user, [Notice("k1", "payment", true)], Now, default);
        Assert.Equal(2, store.Deliveries.Count);
        Assert.Contains(store.Deliveries, d => d.Key == "k1" && d.Kind == "payment" && d.Lane == StanleyNoticeRules.Critical && d.Event == StanleyNoticeRules.EventPosted);
        Assert.All(store.Deliveries, d => Assert.DoesNotContain("Title", d.Key + d.Kind + d.Lane + d.Event));
    }

    [Fact]
    public async Task TheSummaryCountsByEventAndGivesTheFailOpenShare()
    {
        var (store, relay, user) = Setup();
        await relay.RelayAsync(user, [Notice("k1"), Notice("k2"), Notice("k3")], Now, default);
        await store.LogNoticeDeliveryAsync(user.Id, "k4", "payment", "critical", StanleyNoticeRules.EventFailOpen, Now, default);
        var s = StanleyNoticeStatsEndpoints.Summarise(0, await store.NoticeDeliverySummaryAsync(Now.AddHours(-1), default));
        Assert.Equal(3, s.Posted);
        Assert.Equal(1, s.FailOpen);
        Assert.Equal(0.25, s.FailOpenShare, 3);
    }
}
