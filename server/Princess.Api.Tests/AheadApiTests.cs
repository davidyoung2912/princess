using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Waits, shows and the before-the-cruise services over the real pipeline. The Harpers (Balcony, Princess Plus) sail 21 March 2027 (day 1); "now" starts on 5 March.
/// Ship time on the first days is Eastern (UTC-4), so 17:00 UTC is 13:00 on board.
/// </summary>
public class AheadApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static readonly DateTime Mar5 = new(2027, 3, 5, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime SeaDay = new(2027, 3, 22, 17, 0, 0, DateTimeKind.Utc);          // day 2, 13:00 on board
    private static readonly DateTime EmbarkDay = new(2027, 3, 21, 20, 0, 0, DateTimeKind.Utc);       // day 1, 16:00 on board

    private Task<Reply> Put(string url, string token, object body) => Call(HttpMethod.Put, url, token, body);
    private Task<Reply> Post(string url, string token, object? body = null) => Call(HttpMethod.Post, url, token, body ?? new { });
    private Task<Reply> Delete(string url, string token) => Call(HttpMethod.Delete, url, token);

    private void Paid() => Harper.PaidCents = Harper.TotalCents;

    // ---- Access ----

    [Fact]
    public async Task AnyGuestMayReadAndStrangersGetNotFound()
    {
        foreach (var path in new[] { "waits", "shows?day=2", "shows/tickets", "upgrades", "clubs", "medallion", "bag-tags", "prep" })
        {
            Assert.Equal(HttpStatusCode.OK, (await Get($"{Base}/{path}", await SignIn(Priya))).Status);
            Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Base}/{path}", await SignIn(Stranger))).Status);
        }
    }

    [Fact]
    public async Task ASupervisedChildCanLookButNotChange()
    {
        var maya = MayaToken();
        Assert.Equal(HttpStatusCode.OK, (await Get($"{Base}/waits", maya)).Status);
        Assert.False((await Get($"{Base}/upgrades", maya)).Json.GetProperty("canEdit").GetBoolean());
        foreach (var (verb, url, body) in new (HttpMethod, string, object)[]
        {
            (HttpMethod.Post, "waits/queue", new { venueId = "alfredo" }),
            (HttpMethod.Post, "shows/tickets", new { eventId = "stage-show", day = 2, guests = new[] { Maya.PublicId } }),
            (HttpMethod.Post, "upgrades", new { category = "miniSuite", cents = 60_000 }),
            (HttpMethod.Post, "medallion/lost", new { }),
            (HttpMethod.Put, "bag-tags/way", new { way = "print" }),
            (HttpMethod.Put, "prep/motion-mid", new { done = true }),
        })
        {
            var r = await Call(verb, $"{Base}/{url}", maya, body);
            Assert.Equal(HttpStatusCode.Forbidden, r.Status);
            Assert.Equal("supervised", r.ProblemTitle);
        }
        foreach (var (url, body) in new (string, object)[] { ("/api/v1/me/advisor-requests", new { }), ("/api/v1/me/fix-cases", new { }), ("/api/v1/me/assist-cases", new { }) })
            Assert.Equal(HttpStatusCode.Forbidden, (await Post(url, maya, body)).Status);
    }

    // ---- Queues ----

    private static JsonElement Queue(Reply r) => r.Json.GetProperty("queues")[0];

    [Fact]
    public async Task JoinsAQueueMovesUpAndLetsGoOfAnExpiredPlace()
    {
        SetNow(SeaDay);
        var daniel = await SignIn(Daniel);
        var open = (await Get($"{Base}/waits", daniel)).Json.GetProperty("open").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("alfredo", open);
        Assert.DoesNotContain("crown", open);

        var joined = await Post($"{Base}/waits/queue", daniel, new { venueId = "alfredo" });
        Assert.Equal(HttpStatusCode.OK, joined.Status);
        var q = Queue(joined);
        var joinedAt = q.GetProperty("joinedAt").GetInt64();
        var start = WaitRules.StartingPosition("alfredo", joinedAt);                                       // worked out from when the server saw the join
        Assert.Equal(("waiting", start), (q.GetProperty("stage").GetString(), q.GetProperty("position").GetInt32()));
        Assert.Equal("duplicate", (await Post($"{Base}/waits/queue", daniel, new { venueId = "alfredo" })).ProblemTitle);

        var joinedUtc = DateTimeOffset.FromUnixTimeMilliseconds(joinedAt).UtcDateTime;
        SetNow(joinedUtc.AddMinutes((start * WaitRules.QueueStepMin) + 1));
        Assert.Equal("ready", Queue(await Get($"{Base}/waits", daniel)).GetProperty("stage").GetString());
        SetNow(joinedUtc.AddMinutes((start * WaitRules.QueueStepMin) + WaitRules.HoldMin + 1));
        var expired = await Get($"{Base}/waits", daniel);
        Assert.Equal("expired", Queue(expired).GetProperty("stage").GetString());

        var again = await Post($"{Base}/waits/queue", daniel, new { venueId = "alfredo" });      // an expired place is replaced, not a duplicate
        Assert.Equal(HttpStatusCode.OK, again.Status);
        Assert.Equal(1, again.Json.GetProperty("queues").GetArrayLength());
        Assert.Equal("waiting", Queue(again).GetProperty("stage").GetString());
    }

    [Fact]
    public async Task OnlyAWalkInPlaceThatIsOpenAndOnlyWhileAboardCanBeQueuedFor()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("closed", (await Post($"{Base}/waits/queue", daniel, new { venueId = "alfredo" })).ProblemTitle);                  // 5 March: not aboard
        Assert.Empty((await Get($"{Base}/waits", daniel)).Json.GetProperty("open").EnumerateArray());

        SetNow(new DateTime(2027, 3, 22, 14, 0, 0, DateTimeKind.Utc));                                                                   // 10:00 on a sea day: Alfredo's opens at 11:30
        Assert.Equal("closed", (await Post($"{Base}/waits/queue", daniel, new { venueId = "alfredo" })).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/waits/queue", daniel, new { venueId = "intl-cafe" })).Status);             // the café is always open

        SetNow(new DateTime(2027, 3, 23, 17, 0, 0, DateTimeKind.Utc));                                                                   // 13:00 in Cozumel: a port day opens Alfredo's at 16:00
        Assert.Equal("closed", (await Post($"{Base}/waits/queue", daniel, new { venueId = "alfredo" })).ProblemTitle);

        var no = await Post($"{Base}/waits/queue", daniel, new { venueId = "crown" });                                                   // a reservable room has a waitlist, not a queue
        Assert.Equal(("invalid", "venue"), (no.ProblemType, no.ProblemTitle));
    }

    [Fact]
    public async Task LeavesAQueueOnlyOnce()
    {
        SetNow(SeaDay);
        var daniel = await SignIn(Daniel);
        var id = Queue(await Post($"{Base}/waits/queue", daniel, new { venueId = "lido" })).GetProperty("id").GetString();
        Assert.Equal(0, (await Delete($"{Base}/waits/queue/{id}", daniel)).Json.GetProperty("queues").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"{Base}/waits/queue/{id}", daniel)).Status);
    }

    [Fact]
    public async Task QueuesAreSharedByTheBookingAndNotByTheSailing()
    {
        SetNow(SeaDay);
        await Post($"{Base}/waits/queue", await SignIn(Daniel), new { venueId = "lido" });
        Assert.Equal(1, (await Get($"{Base}/waits", await SignIn(Priya))).Json.GetProperty("queues").GetArrayLength());
        Assert.Equal(0, (await Get("/api/v1/bookings/PC179254/waits", await SignIn(Stranger))).Json.GetProperty("queues").GetArrayLength());
    }

    // ---- Waitlist ----

    /// <summary>A specialty room, night and time whose tables are all taken, found the way a guest would: from the slot grid.</summary>
    private async Task<(string Venue, int Day, string Time)> FullSlot(string token, int? notDay = null)
    {
        foreach (var venue in new[] { "crown", "sabatini", "catch", "love" })
            for (var day = 1; day <= 7; day++)
            {
                if (day == notDay) continue;
                var slots = await Get($"{Base}/dining/slots?venue={venue}&day={day}", token);
                var full = slots.Json.EnumerateArray().FirstOrDefault(s => s.GetProperty("tables").GetInt32() == 0);
                if (full.ValueKind == JsonValueKind.Object) return (venue, day, full.GetProperty("time").GetString()!);
            }
        throw new InvalidOperationException("no full slot in the grid");
    }

    private async Task<(string Venue, int Day, string Time)> FreeSlot(string token)
    {
        var slots = await Get($"{Base}/dining/slots?venue=crown&day=5", token);
        var free = slots.Json.EnumerateArray().First(s => s.GetProperty("tables").GetInt32() > 0);
        return ("crown", 5, free.GetProperty("time").GetString()!);
    }

    private static object Waitlist((string Venue, int Day, string Time) slot, bool auto, params UserRecord[] who) =>
        new { venueId = slot.Venue, day = slot.Day, time = slot.Time, guests = who.Select(u => u.PublicId).ToArray(), auto };

    [Fact]
    public async Task OnlyAFullTableCanBeWaitedFor()
    {
        var daniel = await SignIn(Daniel);
        var free = await FreeSlot(daniel);
        Assert.Equal("notFull", (await Post($"{Base}/waits/waitlist", daniel, Waitlist(free, false, Daniel))).ProblemTitle);

        var full = await FullSlot(daniel);
        var joined = await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, false, Daniel, Priya));
        Assert.Equal(HttpStatusCode.OK, joined.Status);
        var entry = joined.Json.GetProperty("waitlist")[0];
        Assert.Equal(full.Venue, entry.GetProperty("venueId").GetString());
        Assert.Equal("waiting", entry.GetProperty("stage").GetString());
        Assert.Equal(2, entry.GetProperty("guests").GetArrayLength());
        Assert.Equal("duplicate", (await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, false, Daniel))).ProblemTitle);
        Assert.Equal(("invalid", "guests"), (await Post($"{Base}/waits/waitlist", daniel, new { venueId = full.Venue, day = full.Day, time = full.Time, guests = new[] { Stranger.PublicId } })) is var bad ? (bad.ProblemType, bad.ProblemTitle) : default);
        Assert.Equal("venue", (await Post($"{Base}/waits/waitlist", daniel, new { venueId = "alfredo", day = 3, time = "18:00", guests = new[] { Daniel.PublicId } })).ProblemTitle);
    }

    [Fact]
    public async Task ATableIsRefusedWhenItIsTooCloseOrTheGuestIsAlreadyDiningThen()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var full = await FullSlot(daniel);
        var slotAt = Itinerary.LocalToUtc(new DateOnly(2027, 3, 21).AddDays(full.Day - 1), TimeOnly.ParseExact(full.Time, "HH:mm"), Itinerary.ShipZoneOnDate(new DateOnly(2027, 3, 21), new DateOnly(2027, 3, 21).AddDays(full.Day - 1)));
        SetNow(slotAt.AddMinutes(-WaitRules.WaitlistMinLeadMin + 2));
        Assert.Equal("tooLate", (await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, false, Daniel))).ProblemTitle);

        SetNow(Mar5);
        var other = await FullSlot(daniel, full.Day);                       // a table for Daniel on another night is fine, but not two places at once
        var free = await FreeSlot(daniel);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/dining/reservations", daniel, new { venueId = free.Venue, day = free.Day, time = free.Time, guests = new[] { Daniel.PublicId } })).Status);
        var sameNight = await Get($"{Base}/dining/slots?venue=sabatini&day={free.Day}", daniel);
        var fullSameNight = sameNight.Json.EnumerateArray().FirstOrDefault(s => s.GetProperty("tables").GetInt32() == 0);
        if (fullSameNight.ValueKind == JsonValueKind.Object && Math.Abs(Minutes(fullSameNight.GetProperty("time").GetString()!) - Minutes(free.Time)) < DiningRules.SittingMinutes)
            Assert.Equal("clash", (await Post($"{Base}/waits/waitlist", daniel, Waitlist((("sabatini"), free.Day, fullSameNight.GetProperty("time").GetString()!), false, Daniel))).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/waits/waitlist", daniel, Waitlist(other, false, Daniel))).Status);
    }

    private static int Minutes(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    [Fact]
    public async Task ATableIsOfferedAfterThreeHoursHeldForTwoAndTakenThroughTheDiningRules()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var full = await FullSlot(daniel);
        var id = (await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, false, Daniel, Priya))).Json.GetProperty("waitlist")[0].GetProperty("id").GetString();

        Assert.Equal("notOffered", (await Post($"{Base}/waits/waitlist/{id}/accept", daniel)).ProblemTitle);
        SetNow(Mar5.AddMinutes(WaitRules.WaitlistOfferAfterMin + 1));
        Assert.Equal("offered", (await Get($"{Base}/waits", daniel)).Json.GetProperty("waitlist")[0].GetProperty("stage").GetString());

        var taken = await Post($"{Base}/waits/waitlist/{id}/accept", daniel);
        Assert.Equal(HttpStatusCode.OK, taken.Status);
        var table = taken.Json.GetProperty("reservations")[0];
        Assert.Equal((full.Venue, full.Day, full.Time), (table.GetProperty("venueId").GetString(), table.GetProperty("day").GetInt32(), table.GetProperty("time").GetString()));
        Assert.Equal(2, table.GetProperty("guests").GetArrayLength());
        Assert.Equal("From the waitlist", table.GetProperty("note").GetString());
        Assert.Equal(0, (await Get($"{Base}/waits", daniel)).Json.GetProperty("waitlist").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"{Base}/waits/waitlist/{id}/accept", daniel)).Status);
    }

    [Fact]
    public async Task AnOfferThatIsNotTakenInTimeExpires()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var full = await FullSlot(daniel);
        var id = (await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, false, Daniel))).Json.GetProperty("waitlist")[0].GetProperty("id").GetString();
        SetNow(Mar5.AddMinutes(WaitRules.WaitlistOfferAfterMin + WaitRules.WaitlistOfferHoldMin + 1));
        Assert.Equal("expired", (await Get($"{Base}/waits", daniel)).Json.GetProperty("waitlist")[0].GetProperty("stage").GetString());
        Assert.Equal("expired", (await Post($"{Base}/waits/waitlist/{id}/accept", daniel)).ProblemTitle);
        Assert.Equal(0, (await Delete($"{Base}/waits/waitlist/{id}", daniel)).Json.GetProperty("waitlist").GetArrayLength());
    }

    [Fact]
    public async Task AWaitlistedTableObeysTheSameRulesAsAnyReservation()
    {
        var daniel = await SignIn(Daniel);                                  // not paid in full, so the dining window is shut
        var full = await FullSlot(daniel);
        var id = (await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, false, Daniel))).Json.GetProperty("waitlist")[0].GetProperty("id").GetString();
        SetNow(Mar5.AddMinutes(WaitRules.WaitlistOfferAfterMin + 1));
        var r = await Post($"{Base}/waits/waitlist/{id}/accept", daniel);
        Assert.Equal(HttpStatusCode.Conflict, r.Status);
        Assert.Equal("notOpen", r.ProblemTitle);                           // exactly what POST dining/reservations answers
        Assert.Equal(1, (await Get($"{Base}/waits", daniel)).Json.GetProperty("waitlist").GetArrayLength());     // the offer is kept
    }

    [Fact]
    public async Task ATableAskedToBeBookedIsBookedTheMomentItIsOffered()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var full = await FullSlot(daniel);
        await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, true, Daniel));
        Assert.Equal(0, (await Get($"{Base}/dining", daniel)).Json.GetProperty("reservations").GetArrayLength());

        SetNow(Mar5.AddMinutes(WaitRules.WaitlistOfferAfterMin + 1));
        var view = await Get($"{Base}/waits", daniel);
        Assert.Equal(0, view.Json.GetProperty("waitlist").GetArrayLength());
        var auto = view.Json.GetProperty("autoBooked")[0];
        Assert.Equal((full.Venue, full.Day, full.Time), (auto.GetProperty("venueId").GetString(), auto.GetProperty("day").GetInt32(), auto.GetProperty("time").GetString()));
        var dining = await Get($"{Base}/dining", daniel);
        Assert.Equal("Booked automatically from the waitlist", dining.Json.GetProperty("reservations")[0].GetProperty("note").GetString());
        Assert.Equal(1, (await Get($"{Base}/waits", daniel)).Json.GetProperty("autoBooked").GetArrayLength());       // still reported, and not booked a second time
        Assert.Equal(1, (await Get($"{Base}/dining", daniel)).Json.GetProperty("reservations").GetArrayLength());
    }

    [Fact]
    public async Task AnAutoBookingThatCannotBeMadeKeepsTheOfferForTheGuest()
    {
        var daniel = await SignIn(Daniel);                                  // the dining window is shut, so the automatic booking is refused
        var full = await FullSlot(daniel);
        await Post($"{Base}/waits/waitlist", daniel, Waitlist(full, true, Daniel));
        SetNow(Mar5.AddMinutes(WaitRules.WaitlistOfferAfterMin + 1));
        var view = await Get($"{Base}/waits", daniel);
        Assert.Equal("offered", view.Json.GetProperty("waitlist")[0].GetProperty("stage").GetString());
        Assert.Equal(0, view.Json.GetProperty("autoBooked").GetArrayLength());
    }

    // ---- Shows ----

    private async Task<int> Left(string token, string eventId, int day) =>
        (await Get($"{Base}/shows?day={day}", token)).Json.EnumerateArray().First(s => s.GetProperty("eventId").GetString() == eventId).GetProperty("left").GetInt32();

    [Fact]
    public async Task ListsSeatsLeftForEachTicketedShowOnADay()
    {
        var daniel = await SignIn(Daniel);
        var seats = await Get($"{Base}/shows?day=2", daniel);
        Assert.Equal(["cooking", "spa-tour", "art-talk", "wine", "stage-early", "stage-show", "dome-show"], seats.Json.EnumerateArray().Select(s => s.GetProperty("eventId").GetString()));
        Assert.Equal(ShowRules.SeatsLeft("stage-show", 2, 0), await Left(daniel, "stage-show", 2));
        Assert.Equal(0, await Left(daniel, "wine", 6));
        Assert.Equal("day", (await Get($"{Base}/shows?day=0", daniel)).ProblemTitle);
        Assert.Equal("day", (await Get($"{Base}/shows", daniel)).ProblemTitle);
    }

    private static object Seats(string eventId, int day, params UserRecord[] who) => new { eventId, day, guests = who.Select(u => u.PublicId).ToArray() };

    [Fact]
    public async Task ReservesSeatsForTheBookingAndGivesThemBack()
    {
        var daniel = await SignIn(Daniel);
        var before = await Left(daniel, "stage-show", 2);
        var r = await Post($"{Base}/shows/tickets", daniel, Seats("stage-show", 2, Daniel, Priya, Maya));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var t = r.Json[0];
        Assert.Equal(("stage-show", 2, "on", true), (t.GetProperty("eventId").GetString(), t.GetProperty("day").GetInt32(), t.GetProperty("status").GetString(), t.GetProperty("canReturn").GetBoolean()));
        Assert.Equal(3, t.GetProperty("guests").GetArrayLength());
        Assert.Equal(before - 3, await Left(await SignIn(Priya), "stage-show", 2));
        Assert.Equal("duplicate", (await Post($"{Base}/shows/tickets", daniel, Seats("stage-show", 2, Priya))).ProblemTitle);

        var back = await Delete($"{Base}/shows/tickets/{t.GetProperty("id").GetString()}", daniel);
        Assert.Equal(0, back.Json.GetArrayLength());
        Assert.Equal(before, await Left(daniel, "stage-show", 2));
    }

    [Fact]
    public async Task SeatsAreCountedAcrossEveryBookingOnTheSailing()
    {
        var daniel = await SignIn(Daniel);
        var before = await Left(daniel, "stage-show", 2);
        Assert.Equal(HttpStatusCode.OK, (await Post("/api/v1/bookings/PC179254/shows/tickets", await SignIn(Stranger), Seats("stage-show", 2, Stranger))).Status);
        Assert.Equal(before - 1, await Left(daniel, "stage-show", 2));
        Assert.Equal(0, (await Get($"{Base}/shows/tickets", daniel)).Json.GetArrayLength());
    }

    [Fact]
    public async Task RefusesASeatForTheRightReason()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("age", (await Post($"{Base}/shows/tickets", daniel, Seats("spa-tour", 2, Daniel, Maya))).ProblemTitle);                // adults only
        Assert.Equal("soldOut", (await Post($"{Base}/shows/tickets", daniel, Seats("wine", 6, Daniel))).ProblemTitle);
        Assert.Equal("show", (await Post($"{Base}/shows/tickets", daniel, Seats("trivia", 2, Daniel))).ProblemTitle);                         // not a ticketed event
        Assert.Equal("day", (await Post($"{Base}/shows/tickets", daniel, Seats("stage-show", 3, Daniel))).ProblemTitle);                      // not on that day
        Assert.Equal("guests", (await Post($"{Base}/shows/tickets", daniel, Seats("stage-show", 2, Stranger))).ProblemTitle);
        Assert.Equal("guests", (await Post($"{Base}/shows/tickets", daniel, new { eventId = "stage-show", day = 2, guests = Array.Empty<Guid>() })).ProblemTitle);
    }

    [Fact]
    public async Task AShowThatHasStartedCannotBeBookedOrReturned()
    {
        var daniel = await SignIn(Daniel);
        var id = (await Post($"{Base}/shows/tickets", daniel, Seats("stage-show", 2, Daniel))).Json[0].GetProperty("id").GetString();
        SetNow(new DateTime(2027, 3, 23, 0, 31, 0, DateTimeKind.Utc));                                                                         // a minute after the 20:30 start on board
        Assert.False((await Get($"{Base}/shows/tickets", daniel)).Json[0].GetProperty("canReturn").GetBoolean());
        Assert.Equal("started", (await Delete($"{Base}/shows/tickets/{id}", daniel)).ProblemTitle);
        Assert.Equal("started", (await Post($"{Base}/shows/tickets", daniel, Seats("stage-show", 2, Priya))).ProblemTitle);
    }

    [Fact]
    public async Task SeatsCloseOnceTheCruiseIsOver()
    {
        SetNow(new DateTime(2027, 3, 28, 11, 0, 0, DateTimeKind.Utc));
        Assert.Equal("closed", (await Post($"{Base}/shows/tickets", await SignIn(Daniel), Seats("stage-show", 7, Daniel))).ProblemTitle);
    }

    // ---- Advisors ----

    [Fact]
    public async Task AnAdvisorChatGetsAScriptedReplyAndACallbackGetsAPromise()
    {
        var daniel = await SignIn(Daniel);
        var chat = await Post("/api/v1/me/advisor-requests", daniel, new { advisorId = "adv-ocean", way = "chat", phone = "", question = "Which cabin is the quietest?" });
        Assert.Equal(HttpStatusCode.OK, chat.Status);
        Assert.Contains("Renata", chat.Json[0].GetProperty("reply").GetString());
        Assert.Equal(JsonValueKind.Null, chat.Json[0].GetProperty("callbackBy").ValueKind);

        SetNow(Mar5.AddMinutes(5));
        var call = await Post("/api/v1/me/advisor-requests", daniel, new { advisorId = "adv-harbor", way = "callback", phone = "555-010-0199", question = "Can you plan a family trip?" });
        Assert.Equal(2, call.Json.GetArrayLength());
        Assert.Equal("adv-harbor", call.Json[0].GetProperty("advisorId").GetString());                    // newest first
        Assert.Equal(JsonValueKind.Null, call.Json[0].GetProperty("reply").ValueKind);
        Assert.Equal(call.Json[0].GetProperty("at").GetInt64() + (24 * 3_600_000L), call.Json[0].GetProperty("callbackBy").GetInt64());
        Assert.Equal(0, (await Get("/api/v1/me/advisor-requests", await SignIn(Priya))).Json.GetArrayLength());   // each person sees only their own
    }

    [Fact]
    public async Task ChecksAnAdvisorRequest()
    {
        var daniel = await SignIn(Daniel);
        foreach (var (body, title) in new (object, string)[]
        {
            (new { advisorId = "nobody", way = "chat", phone = "", question = "Which cabin is the quietest?" }, "badAdvisor"),
            (new { advisorId = "adv-ocean", way = "fax", phone = "", question = "Which cabin is the quietest?" }, "badWay"),
            (new { advisorId = "adv-ocean", way = "callback", phone = "12", question = "Which cabin is the quietest?" }, "badPhone"),
            (new { advisorId = "adv-ocean", way = "chat", phone = "", question = "hi" }, "noQuestion"),
        })
        {
            var r = await Post("/api/v1/me/advisor-requests", daniel, body);
            Assert.Equal((HttpStatusCode.BadRequest, title), (r.Status, r.ProblemTitle));
        }
    }

    // ---- Marketing consent ----

    private static JsonElement Choice(Reply r, string channel) => r.Json.GetProperty("choices").EnumerateArray().First(c => c.GetProperty("channel").GetString() == channel);

    [Fact]
    public async Task InTheUkNothingIsSubscribedUntilTheCodeFromTheFirstMessageIsEntered()
    {
        SetNow(Mar5);
        var daniel = await SignIn(Daniel);
        var start = await Get("/api/v1/me/marketing", daniel);
        Assert.Equal("none", Choice(start, "email").GetProperty("state").GetString());
        Assert.True(start.Json.GetProperty("canEdit").GetBoolean());

        var asked = await Post("/api/v1/me/marketing/email/subscribe", daniel, new { contact = "daniel@demo.princess.example", region = "uk" });
        var email = Choice(asked, "email");
        Assert.Equal(("pending", true, "d***@demo.princess.example"), (email.GetProperty("state").GetString(), email.GetProperty("needsCode").GetBoolean(), email.GetProperty("contact").GetString()));
        var code = email.GetProperty("demoCode").GetString()!;
        Assert.Matches("^[0-9]{6}$", code);

        var wrong = await Post("/api/v1/me/marketing/email/confirm", daniel, new { code = code == "123456" ? "654321" : "123456" });
        Assert.Equal((HttpStatusCode.BadRequest, "wrongCode"), (wrong.Status, wrong.ProblemTitle));
        Assert.Equal("pending", Choice(await Get("/api/v1/me/marketing", daniel), "email").GetProperty("state").GetString());

        var done = await Post("/api/v1/me/marketing/email/confirm", daniel, new { code });
        Assert.Equal("confirmed", Choice(done, "email").GetProperty("state").GetString());
        Assert.False(Choice(done, "email").GetProperty("needsCode").GetBoolean());
        Assert.Equal(JsonValueKind.Null, Choice(done, "email").GetProperty("demoCode").ValueKind);
        Assert.Equal("nothingPending", (await Post("/api/v1/me/marketing/email/confirm", daniel, new { code })).ProblemTitle);
    }

    [Fact]
    public async Task ACodeThatIsNotUsedWithinADayExpires()
    {
        SetNow(Mar5);
        var daniel = await SignIn(Daniel);
        var code = Choice(await Post("/api/v1/me/marketing/sms/subscribe", daniel, new { contact = "555-010-0199", region = "eu" }), "sms").GetProperty("demoCode").GetString();
        SetNow(Mar5.AddHours(25));
        Assert.Equal("expired", Choice(await Get("/api/v1/me/marketing", daniel), "sms").GetProperty("state").GetString());
        Assert.Equal("expired", (await Post("/api/v1/me/marketing/sms/confirm", daniel, new { code })).ProblemTitle);
    }

    [Fact]
    public async Task WhereTheLawAsksForNoSecondStepTheChoiceIsMadeAtOnceAndCanBeWithdrawn()
    {
        SetNow(Mar5);
        var daniel = await SignIn(Daniel);
        var us = Choice(await Post("/api/v1/me/marketing/email/subscribe", daniel, new { contact = "daniel@demo.princess.example", region = "us" }), "email");
        Assert.Equal(("confirmed", false), (us.GetProperty("state").GetString(), us.GetProperty("needsCode").GetBoolean()));
        Assert.Equal("none", Choice(await Delete("/api/v1/me/marketing/email", daniel), "email").GetProperty("state").GetString());
    }

    [Fact]
    public async Task OnlyADemoUserIsShownTheCodeBecauseNothingIsReallySent()
    {
        Daniel.IsDemo = false;
        var asked = await Post("/api/v1/me/marketing/email/subscribe", await SignIn(Daniel), new { contact = "daniel@demo.princess.example", region = "ca" });
        var email = Choice(asked, "email");
        Assert.Equal("pending", email.GetProperty("state").GetString());
        Assert.Equal(JsonValueKind.Null, email.GetProperty("demoCode").ValueKind);
    }

    [Fact]
    public async Task ChecksTheContactChannelAndRegion()
    {
        var daniel = await SignIn(Daniel);
        foreach (var (channel, body, title) in new (string, object, string)[]
        {
            ("email", new { contact = "nope", region = "us" }, "badEmail"),
            ("sms", new { contact = "12", region = "us" }, "badPhone"),
            ("email", new { contact = "a@b.co", region = "xx" }, "badRegion"),
            ("fax", new { contact = "a@b.co", region = "us" }, "badChannel"),
        })
        {
            var r = await Post($"/api/v1/me/marketing/{channel}/subscribe", daniel, body);
            Assert.Equal((HttpStatusCode.BadRequest, title), (r.Status, r.ProblemTitle));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await Post("/api/v1/me/marketing/email/subscribe", MayaToken(), new { contact = "a@b.co", region = "us" })).Status);
    }

    // ---- Loyalty ----

    [Fact]
    public async Task ShowsThePersonsNumberLevelAndCredit()
    {
        F.Bookings.Loyalty[Daniel.Id] = new LoyaltyRecord { Number = "CC1234567", CreditLeftCents = 15_000 };
        Daniel.Tier = "ruby";
        var r = await Get("/api/v1/me/loyalty", await SignIn(Daniel));
        Assert.Equal(("CC1234567", "ruby", 15_000L), (r.Json.GetProperty("number").GetString(), r.Json.GetProperty("tier").GetString(), r.Json.GetProperty("creditLeft").GetInt64()));
        Assert.Equal("", (await Get("/api/v1/me/loyalty", await SignIn(Priya))).Json.GetProperty("number").GetString());
    }

    // ---- Upgrades ----

    private static JsonElement Offer(Reply r, string category) => r.Json.GetProperty("offers").EnumerateArray().First(o => o.GetProperty("category").GetString() == category);

    [Fact]
    public async Task OffersTheNextTwoRoomTypesWithTheBidRange()
    {
        var r = await Get($"{Base}/upgrades", await SignIn(Daniel));
        Assert.Equal("balcony", r.Json.GetProperty("current").GetString());
        Assert.Equal(["miniSuite", "sanctuaryMiniSuite"], r.Json.GetProperty("offers").EnumerateArray().Select(o => o.GetProperty("category").GetString()));
        var o = Offer(r, "miniSuite");
        Assert.Equal(Pricing.JsRound(o.GetProperty("difference").GetInt64() * 0.4 / 100) * 100, o.GetProperty("minBid").GetInt64());
        Assert.True(r.Json.GetProperty("open").GetBoolean());
        Assert.True(r.Json.GetProperty("canEdit").GetBoolean());
        Assert.Equal(new DateTimeOffset(new DateTime(2027, 3, 18, 16, 0, 0, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), r.Json.GetProperty("decidedAt").GetInt64());
    }

    [Fact]
    public async Task ABidIsCheckedPlacedAndWithdrawn()
    {
        var daniel = await SignIn(Daniel);
        var offer = Offer(await Get($"{Base}/upgrades", daniel), "miniSuite");
        long min = offer.GetProperty("minBid").GetInt64(), buy = offer.GetProperty("buyNow").GetInt64();
        var mid = (min + buy) / 2 / 100 * 100;

        foreach (var (cents, title) in new[] { (min - 100, "tooLow"), (buy + 100, "tooHigh"), (mid + 50, "notWhole") })
            Assert.Equal((HttpStatusCode.BadRequest, title), ((await Post($"{Base}/upgrades", daniel, new { category = "miniSuite", cents })) is var r ? (r.Status, r.ProblemTitle) : default));
        Assert.Equal("badCategory", (await Post($"{Base}/upgrades", daniel, new { category = "interior", cents = mid })).ProblemTitle);

        var placed = await Post($"{Base}/upgrades", daniel, new { category = "miniSuite", cents = mid });
        Assert.Equal(HttpStatusCode.OK, placed.Status);
        var bid = placed.Json.GetProperty("bids")[0];
        Assert.Equal(("open", false, mid), (bid.GetProperty("status").GetString(), bid.GetProperty("buyNow").GetBoolean(), bid.GetProperty("cents").GetInt64()));
        Assert.Equal("duplicate", (await Post($"{Base}/upgrades", daniel, new { category = "miniSuite", cents = mid })).ProblemTitle);

        var withdrawn = await Delete($"{Base}/upgrades/{bid.GetProperty("id").GetString()}", daniel);
        Assert.Equal("withdrawn", withdrawn.Json.GetProperty("bids")[0].GetProperty("status").GetString());
        Assert.Equal("closed", (await Delete($"{Base}/upgrades/{bid.GetProperty("id").GetString()}", daniel)).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/upgrades", daniel, new { category = "miniSuite", cents = mid })).Status);     // a withdrawn bid can be placed again
    }

    [Fact]
    public async Task ABidAtTheBuyNowPriceIsAcceptedAtOnce()
    {
        var daniel = await SignIn(Daniel);
        var buy = Offer(await Get($"{Base}/upgrades", daniel), "sanctuaryMiniSuite").GetProperty("buyNow").GetInt64();
        var r = await Post($"{Base}/upgrades", daniel, new { category = "sanctuaryMiniSuite", cents = buy });
        Assert.Equal(("accepted", true), (r.Json.GetProperty("bids")[0].GetProperty("status").GetString(), r.Json.GetProperty("bids")[0].GetProperty("buyNow").GetBoolean()));
    }

    [Fact]
    public async Task BidsAreDecidedThreeDaysBeforeSailingAndThenClose()
    {
        var daniel = await SignIn(Daniel);
        var offer = Offer(await Get($"{Base}/upgrades", daniel), "miniSuite");
        var min = offer.GetProperty("minBid").GetInt64();
        await Post($"{Base}/upgrades", daniel, new { category = "miniSuite", cents = min });
        SetNow(new DateTime(2027, 3, 18, 16, 1, 0, DateTimeKind.Utc));
        var after = await Get($"{Base}/upgrades", daniel);
        Assert.False(after.Json.GetProperty("open").GetBoolean());
        Assert.Contains(after.Json.GetProperty("bids")[0].GetProperty("status").GetString(), new[] { "accepted", "declined" });
        Assert.Equal("closed", (await Post($"{Base}/upgrades", daniel, new { category = "sanctuaryMiniSuite", cents = Offer(after, "sanctuaryMiniSuite").GetProperty("minBid").GetInt64() })).ProblemTitle);
        Assert.Equal("closed", (await Delete($"{Base}/upgrades/{after.Json.GetProperty("bids")[0].GetProperty("id").GetString()}", daniel)).ProblemTitle);
    }

    [Fact]
    public async Task ABidNeedsACardOnFile()
    {
        var priya = await SignIn(Priya);                                    // only Daniel has a card
        var min = Offer(await Get($"{Base}/upgrades", priya), "miniSuite").GetProperty("minBid").GetInt64();
        Assert.Equal("noCard", (await Post($"{Base}/upgrades", priya, new { category = "miniSuite", cents = min })).ProblemTitle);
    }

    // ---- Clubs ----

    private static object Club(string phone = "555-010-0199", bool confirmed = true, object[]? pickups = null) => new
    {
        allergies = "Peanuts", medical = "Asthma", medication = "Inhaler", photoConsent = true, selfSignOut = false, emergencyPhone = phone, confirmed,
        pickups = pickups ?? [new { name = "Priya Harper", relation = "Mother", phone = "555-010-0198" }],
    };

    [Fact]
    public async Task OnlyTheChildsBookerRegistersThemAndSeesTheHealthNotes()
    {
        var daniel = await SignIn(Daniel);
        var view = await Get($"{Base}/clubs", daniel);
        var maya = view.Json.GetProperty("children")[0];
        Assert.Equal(1, view.Json.GetProperty("children").GetArrayLength());
        Assert.Equal(("neon", false), (maya.GetProperty("club").GetString(), maya.GetProperty("registered").GetBoolean()));      // 8 on the sailing date

        var saved = await Put($"{Base}/clubs/{Maya.PublicId}", daniel, Club());
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        var reg = saved.Json.GetProperty("children")[0].GetProperty("registration");
        Assert.Equal(("Asthma", "Inhaler", true), (reg.GetProperty("medical").GetString(), reg.GetProperty("medication").GetString(), reg.GetProperty("confirmed").GetBoolean()));

        var priya = await SignIn(Priya);                                    // an adult guest sees that she is registered, but not the notes, and cannot change them
        var seen = (await Get($"{Base}/clubs", priya)).Json.GetProperty("children")[0];
        Assert.True(seen.GetProperty("registered").GetBoolean());
        Assert.Equal(JsonValueKind.Null, seen.GetProperty("registration").ValueKind);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put($"{Base}/clubs/{Maya.PublicId}", priya, Club())).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Delete($"{Base}/clubs/{Maya.PublicId}", priya)).Status);

        var asChild = (await Get($"{Base}/clubs", MayaToken())).Json.GetProperty("children")[0];
        Assert.Equal(JsonValueKind.Null, asChild.GetProperty("registration").ValueKind);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put($"{Base}/clubs/{Maya.PublicId}", MayaToken(), Club())).Status);
    }

    [Fact]
    public async Task ChecksTheRegistrationAndOnlyChildrenCanBeRegistered()
    {
        var daniel = await SignIn(Daniel);
        foreach (var (body, title) in new (object, string)[]
        {
            (Club(phone: "12"), "noEmergency"),
            (Club(pickups: []), "noPickup"),
            (Club(confirmed: false), "confirm"),
            (Club(pickups: [new { name = "A", relation = "Mother", phone = "555-010-0198" }]), "badPickup"),
        })
        {
            var r = await Put($"{Base}/clubs/{Maya.PublicId}", daniel, body);
            Assert.Equal((HttpStatusCode.BadRequest, title), (r.Status, r.ProblemTitle));
        }
        Assert.Equal("noClub", (await Put($"{Base}/clubs/{Priya.PublicId}", daniel, Club())).ProblemTitle);                    // an adult has no club
        Assert.Equal("noClub", (await Put($"{Base}/clubs/{Guid.NewGuid()}", daniel, Club())).ProblemTitle);
    }

    [Fact]
    public async Task ARegistrationCanBeWithdrawnAndClubsCloseAfterSailing()
    {
        var daniel = await SignIn(Daniel);
        await Put($"{Base}/clubs/{Maya.PublicId}", daniel, Club());
        Assert.False((await Delete($"{Base}/clubs/{Maya.PublicId}", daniel)).Json.GetProperty("children")[0].GetProperty("registered").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"{Base}/clubs/{Maya.PublicId}", daniel)).Status);

        SetNow(new DateTime(2027, 3, 28, 11, 0, 0, DateTimeKind.Utc));
        Assert.Equal("closed", (await Put($"{Base}/clubs/{Maya.PublicId}", daniel, Club())).ProblemTitle);
        Assert.False((await Get($"{Base}/clubs", daniel)).Json.GetProperty("open").GetBoolean());
    }

    // ---- Medallion ----

    [Fact]
    public async Task TheMedallionIsPostedThenDeliveredThenActivatedOnce()
    {
        var daniel = await SignIn(Daniel);
        var early = await Get($"{Base}/medallion", daniel);
        Assert.Equal(("preparing", false), (early.Json.GetProperty("stage").GetString(), early.Json.GetProperty("canActivate").GetBoolean()));
        Assert.Equal(3, early.Json.GetProperty("guests").GetArrayLength());
        Assert.Matches("^1Z[0-9]{9}$", early.Json.GetProperty("trackingNumber").GetString());
        Assert.Equal("notDelivered", (await Post($"{Base}/medallion/activate", daniel)).ProblemTitle);

        SetNow(new DateTime(2027, 3, 8, 17, 0, 0, DateTimeKind.Utc));
        Assert.Equal("shipped", (await Get($"{Base}/medallion", daniel)).Json.GetProperty("stage").GetString());

        SetNow(new DateTime(2027, 3, 14, 17, 0, 0, DateTimeKind.Utc));
        var delivered = await Get($"{Base}/medallion", daniel);
        Assert.Equal(["ordered", "shipped", "delivered"], delivered.Json.GetProperty("events").EnumerateArray().Select(e => e.GetProperty("id").GetString()));
        Assert.True(delivered.Json.GetProperty("canActivate").GetBoolean());

        var on = await Post($"{Base}/medallion/activate", daniel);
        Assert.Equal(HttpStatusCode.OK, on.Status);
        Assert.NotEqual(JsonValueKind.Null, on.Json.GetProperty("activatedAt").ValueKind);
        Assert.False(on.Json.GetProperty("canActivate").GetBoolean());
        Assert.Equal("already", (await Post($"{Base}/medallion/activate", daniel)).ProblemTitle);
    }

    [Fact]
    public async Task ALostMedallionIsSwitchedOffAndReplacedForCollection()
    {
        SetNow(new DateTime(2027, 3, 14, 17, 0, 0, DateTimeKind.Utc));
        var daniel = await SignIn(Daniel);
        await Post($"{Base}/medallion/activate", daniel);
        var lost = await Post($"{Base}/medallion/lost", daniel);
        Assert.Equal(HttpStatusCode.OK, lost.Status);
        Assert.True(lost.Json.GetProperty("replacement").GetBoolean());
        Assert.NotEqual(JsonValueKind.Null, lost.Json.GetProperty("lostAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, lost.Json.GetProperty("activatedAt").ValueKind);
        Assert.Equal("already", (await Post($"{Base}/medallion/lost", daniel)).ProblemTitle);
        Assert.Equal("lost", (await Post($"{Base}/medallion/activate", daniel)).ProblemTitle);
    }

    [Fact]
    public async Task ALateBookingCollectsTheMedallionAtTheTerminal()
    {
        Harper.ConfirmedAt = new DateTime(2027, 3, 10);
        var r = await Get($"{Base}/medallion", await SignIn(Daniel));
        Assert.Equal("collect", r.Json.GetProperty("stage").GetString());
    }

    // ---- Bag tags ----

    [Fact]
    public async Task TagsArePrintedForEachGuestAndAMailedSetNeedsTwoWeeksNotice()
    {
        var daniel = await SignIn(Daniel);
        var start = await Get($"{Base}/bag-tags", daniel);
        Assert.Equal(JsonValueKind.Null, start.Json.GetProperty("way").ValueKind);
        Assert.Equal("none", start.Json.GetProperty("stage").GetString());
        Assert.Equal(16, start.Json.GetProperty("daysToDeparture").GetInt32());
        Assert.Contains("HARPER/DANIEL", start.Json.GetProperty("guests").EnumerateArray().Select(g => g.GetProperty("printed").GetString()));

        var ordered = await Put($"{Base}/bag-tags/way", daniel, new { way = "order" });
        Assert.Equal(("order", "atHome"), (ordered.Json.GetProperty("way").GetString(), ordered.Json.GetProperty("stage").GetString()));
        Assert.NotEqual(JsonValueKind.Null, ordered.Json.GetProperty("orderedAt").ValueKind);

        SetNow(new DateTime(2027, 3, 12, 17, 0, 0, DateTimeKind.Utc));
        Assert.Equal((HttpStatusCode.Conflict, "tooLate"), ((await Put($"{Base}/bag-tags/way", daniel, new { way = "order" })) is var late ? (late.Status, late.ProblemTitle) : default));
        var print = await Put($"{Base}/bag-tags/way", daniel, new { way = "print" });
        Assert.Equal(("print", JsonValueKind.Null), (print.Json.GetProperty("way").GetString(), print.Json.GetProperty("orderedAt").ValueKind));
        Assert.Equal((HttpStatusCode.BadRequest, "badWay"), ((await Put($"{Base}/bag-tags/way", daniel, new { way = "post" })) is var bad ? (bad.Status, bad.ProblemTitle) : default));
    }

    [Fact]
    public async Task TheBagsJourneyIsEstimatedFromWhenTheyWereHandedOver()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("noTags", (await Put($"{Base}/bag-tags/handed-over", daniel, new { on = true })).ProblemTitle);
        await Put($"{Base}/bag-tags/way", daniel, new { way = "etag" });
        Assert.Equal("notYet", (await Put($"{Base}/bag-tags/handed-over", daniel, new { on = true })).ProblemTitle);       // only on embarkation day

        SetNow(EmbarkDay);
        var handed = await Put($"{Base}/bag-tags/handed-over", daniel, new { on = true });
        Assert.Equal("handedOver", handed.Json.GetProperty("stage").GetString());
        SetNow(EmbarkDay.AddHours(3));
        Assert.Equal("inCorridor", (await Get($"{Base}/bag-tags", daniel)).Json.GetProperty("stage").GetString());
        Assert.Equal("atHome", (await Put($"{Base}/bag-tags/handed-over", daniel, new { on = false })).Json.GetProperty("stage").GetString());
    }

    [Fact]
    public async Task TagsCanNoLongerBeChosenOnceTheFirstSeaDayHasBegun()
    {
        SetNow(SeaDay);
        Assert.Equal("closed", (await Put($"{Base}/bag-tags/way", await SignIn(Daniel), new { way = "print" })).ProblemTitle);
    }

    // ---- Preparation ----

    [Fact]
    public async Task TicksOffHealthAndComfortItemsForTheBooking()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal(0, (await Get($"{Base}/prep", daniel)).Json.GetArrayLength());
        Assert.Equal(["motion-mid"], (await Put($"{Base}/prep/motion-mid", daniel, new { done = true })).Json.EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(["ins-buy", "motion-mid"], (await Put($"{Base}/prep/ins-buy", await SignIn(Priya), new { done = true })).Json.EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(["ins-buy"], (await Put($"{Base}/prep/motion-mid", daniel, new { done = false })).Json.EnumerateArray().Select(e => e.GetString()));
        Assert.Equal("badItem", (await Put($"{Base}/prep/nonsense", daniel, new { done = true })).ProblemTitle);
    }

    // ---- Fix-it cases ----

    [Fact]
    public async Task AFixItCaseGetsAReferenceAndIsContactedWithinADay()
    {
        var daniel = await SignIn(Daniel);
        var r = await Post("/api/v1/me/fix-cases", daniel, new { flow = "noBooking", note = "I still cannot see it" });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(("noBooking", "FX-10001", "received"), (r.Json[0].GetProperty("flow").GetString(), r.Json[0].GetProperty("reference").GetString(), r.Json[0].GetProperty("stage").GetString()));
        Assert.Equal(r.Json[0].GetProperty("at").GetInt64() + (24 * 3_600_000L), r.Json[0].GetProperty("contactBy").GetInt64());
        Assert.Equal("duplicate", (await Post("/api/v1/me/fix-cases", daniel, new { flow = "noBooking", note = "Still nothing, please help" })).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Post("/api/v1/me/fix-cases", daniel, new { flow = "lostDocs", note = "Lost my passport" })).Status);

        SetNow(Mar5.AddHours(25));
        Assert.All((await Get("/api/v1/me/fix-cases", daniel)).Json.EnumerateArray(), c => Assert.Equal("contacted", c.GetProperty("stage").GetString()));
        Assert.Equal(HttpStatusCode.OK, (await Post("/api/v1/me/fix-cases", daniel, new { flow = "noBooking", note = "Contacted but unresolved" })).Status);       // a contacted case no longer blocks a new one
    }

    [Fact]
    public async Task ChecksAFixItCase()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal((HttpStatusCode.BadRequest, "badFlow"), ((await Post("/api/v1/me/fix-cases", daniel, new { flow = "x", note = "Some words here" })) is var a ? (a.Status, a.ProblemTitle) : default));
        Assert.Equal((HttpStatusCode.BadRequest, "noNote"), ((await Post("/api/v1/me/fix-cases", daniel, new { flow = "noBooking", note = "no" })) is var b ? (b.Status, b.ProblemTitle) : default));
        Assert.Equal(0, (await Get("/api/v1/me/fix-cases", await SignIn(Priya))).Json.GetArrayLength());
    }

    // ---- Assisted booking, bereavement and medical ----

    [Fact]
    public async Task ACompassionateCaseIsDecidedAfterTwoDaysAndThenOffersARefundOrCredit()
    {
        Harper.PaidCents = 245_300;
        var daniel = await SignIn(Daniel);
        var asked = await Post("/api/v1/me/assist-cases", daniel, new { kind = "medical", phone = "555-010-0199", note = "Surgery the week before we sail" });
        Assert.Equal(HttpStatusCode.OK, asked.Status);
        var c = asked.Json[0];
        Assert.Equal(("medical", "received", "PC243902", "***-0199"), (c.GetProperty("kind").GetString(), c.GetProperty("stage").GetString(), c.GetProperty("bookingNumber").GetString(), c.GetProperty("phone").GetString()));
        Assert.Matches("^SC-[0-9]{5}$", c.GetProperty("reference").GetString());
        Assert.Equal(JsonValueKind.Null, c.GetProperty("terms").ValueKind);
        var id = c.GetProperty("id").GetString();
        Assert.Equal("notDecided", (await Post($"/api/v1/me/assist-cases/{id}/choice", daniel, new { choice = "refund" })).ProblemTitle);

        SetNow(Mar5.AddHours(5));
        Assert.Equal("reviewing", (await Get("/api/v1/me/assist-cases", daniel)).Json[0].GetProperty("stage").GetString());
        SetNow(Mar5.AddHours(48).AddMinutes(1));
        var decided = (await Get("/api/v1/me/assist-cases", daniel)).Json[0];
        Assert.Equal("decided", decided.GetProperty("stage").GetString());
        Assert.Equal((0L, 245_300L, 269_800L), (decided.GetProperty("terms").GetProperty("fee").GetInt64(), decided.GetProperty("terms").GetProperty("refund").GetInt64(), decided.GetProperty("terms").GetProperty("credit").GetInt64()));

        Assert.Equal((HttpStatusCode.BadRequest, "badChoice"), ((await Post($"/api/v1/me/assist-cases/{id}/choice", daniel, new { choice = "cash" })) is var bad ? (bad.Status, bad.ProblemTitle) : default));
        Assert.Equal("credit", (await Post($"/api/v1/me/assist-cases/{id}/choice", daniel, new { choice = "credit" })).Json[0].GetProperty("choice").GetString());
        Assert.Equal("already", (await Post($"/api/v1/me/assist-cases/{id}/choice", daniel, new { choice = "refund" })).ProblemTitle);
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"/api/v1/me/assist-cases/{Guid.NewGuid()}/choice", daniel, new { choice = "refund" })).Status);
    }

    [Fact]
    public async Task AnAssistedBookingIsNotAboutABookingAndNeedsNoDecision()
    {
        var daniel = await SignIn(Daniel);
        var r = await Post("/api/v1/me/assist-cases", daniel, new { kind = "assistedBooking", phone = "555-010-0199", note = "Please help me book a cruise" });
        Assert.Equal(JsonValueKind.Null, r.Json[0].GetProperty("bookingNumber").ValueKind);
        SetNow(Mar5.AddHours(48).AddMinutes(1));
        var decided = (await Get("/api/v1/me/assist-cases", daniel)).Json[0];
        Assert.Equal(JsonValueKind.Null, decided.GetProperty("terms").ValueKind);
        Assert.Equal("notDecided", (await Post($"/api/v1/me/assist-cases/{decided.GetProperty("id").GetString()}/choice", daniel, new { choice = "credit" })).ProblemTitle);
    }

    [Fact]
    public async Task ABereavementCaseNeedsABookingThePersonMade()
    {
        var priya = await SignIn(Priya);                                    // a guest on the Harper booking, but Daniel made it
        var r = await Post("/api/v1/me/assist-cases", priya, new { kind = "bereavement", phone = "555-010-0199", note = "A death in the family" });
        Assert.Equal((HttpStatusCode.BadRequest, "noBooking"), (r.Status, r.ProblemTitle));
        Assert.Equal((HttpStatusCode.BadRequest, "badKind"), ((await Post("/api/v1/me/assist-cases", priya, new { kind = "other", phone = "555-010-0199", note = "Something else" })) is var k ? (k.Status, k.ProblemTitle) : default));
        Assert.Equal((HttpStatusCode.BadRequest, "badPhone"), ((await Post("/api/v1/me/assist-cases", await SignIn(Daniel), new { kind = "medical", phone = "1", note = "Surgery next week" })) is var p ? (p.Status, p.ProblemTitle) : default));
    }
}
