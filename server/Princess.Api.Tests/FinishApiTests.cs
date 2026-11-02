using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Disembarkation, cases, the trip history, feedback, loyalty and rebooking over the real pipeline.
/// The Harpers (Balcony) sail 21 March 2027 and the ship ties up on the 28th; Eastern daylight time is UTC-4 by then. Maya is eight.
/// </summary>
public class FinishApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);

    private static readonly DateTime BeforeSailing = Utc(20, 16);
    private static readonly DateTime Morning = Utc(27, 10);          // 06:00 on day 7, before the final bill opens
    private static readonly DateTime LastDay = Utc(27, 16);          // 12:00 on day 7
    private static readonly DateTime AfterTip = Utc(28, 1);          // 21:00: the gratuity is fixed, bags can still go out
    private static readonly DateTime AfterBagsOut = Utc(28, 3);      // 23:00
    private static readonly DateTime Docked = Utc(28, 11);           // 07:00 on the last morning: off the ship
    private static readonly DateTime Home = Utc(31, 12);

    public FinishApiTests() => SetNow(LastDay);

    private Task<string> DanielToken() => SignIn(Daniel);

    private Task<Reply> Put(string path, string token, object? body = null) => Call(HttpMethod.Put, $"{Base}/{path}", token, body);
    private Task<Reply> Post(string path, string token, object? body = null) => Call(HttpMethod.Post, $"{Base}/{path}", token, body);
    private Task<Reply> Delete(string path, string token) => Call(HttpMethod.Delete, $"{Base}/{path}", token);
    private Task<Reply> Read(string path, string token) => Get($"{Base}/{path}", token);

    private static void Is(HttpStatusCode status, string? title, Reply r) => Assert.Equal((status, title), (r.Status, r.ProblemTitle));

    private async Task<JsonElement[]> FolioLines(string token) => (await Read("onboard/folio", token)).Json.GetProperty("lines").EnumerateArray().ToArray();

    private object Bags(int daniel, int priya = 0, int maya = 0) => new Dictionary<Guid, int> { [Daniel.PublicId] = daniel, [Priya.PublicId] = priya, [Maya.PublicId] = maya };

    // ---- Access ----

    private static readonly string[] ReadPaths = ["disembark", "disembark/customs", "disembark/onward", "disembark/night", "disembark/final-bill", "cases", "history", "post-feedback", "rebook"];

    [Fact]
    public async Task AnyGuestMayReadAndStrangersGetNotFound()
    {
        foreach (var path in ReadPaths)
        {
            Assert.Equal(HttpStatusCode.OK, (await Read(path, await SignIn(Priya))).Status);
            Assert.Equal(HttpStatusCode.NotFound, (await Read(path, await SignIn(Stranger))).Status);
        }
    }

    [Fact]
    public async Task ASupervisedChildCanLookButNotChangeAnything()
    {
        var maya = MayaToken();
        foreach (var path in ReadPaths) Assert.Equal(HttpStatusCode.OK, (await Read(path, maya)).Status);
        Assert.False((await Read("disembark", maya)).Json.GetProperty("canChoose").GetBoolean());
        Assert.False((await Read("cases", maya)).Json.GetProperty("canOpen").GetBoolean());
        Assert.False((await Read("rebook", maya)).Json.GetProperty("canHold").GetBoolean());
        var anId = Guid.NewGuid();
        foreach (var (verb, url, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Put, "disembark/choice", new { option = "selfAssist", bags = new Dictionary<Guid, int>() }),
            (HttpMethod.Put, "disembark/tags", new { on = true }),
            (HttpMethod.Put, "disembark/customs", new { food = false, cash = false, goodsUsd = 0, note = "" }),
            (HttpMethod.Put, "disembark/onward", new { mode = "rideshare", flightAt = "", flight = "", note = "" }),
            (HttpMethod.Put, "disembark/night/carryOn", new { done = true }),
            (HttpMethod.Put, "disembark/final-bill/tip", new { keepPercent = 50 }),
            (HttpMethod.Post, "disembark/final-bill/email", null),
            (HttpMethod.Post, "cases", new { kind = "complaint", summary = "The air conditioning never worked", place = "", lineId = "", cents = 0 }),
            (HttpMethod.Delete, $"cases/{anId}", null),
            (HttpMethod.Put, "post-feedback", new { overall = 4 }),
            (HttpMethod.Post, "rebook/holds", new { departureId = "sun-2027-11-07" }),
            (HttpMethod.Delete, $"rebook/holds/{anId}", null),
            (HttpMethod.Post, "rebook/convert-fcc", null),
            (HttpMethod.Post, "rebook/appointment", new { at = 1L }),
            (HttpMethod.Delete, "rebook/appointment", null),
        })
            Is(HttpStatusCode.Forbidden, "supervised", await Call(verb, $"{Base}/{url}", maya, body));
    }

    // ---- The choice ----

    [Fact]
    public async Task ChoosingTaggedBagsGivesTheGroupAndALabelPerGuestAndTheTagsCanBeMarkedOn()
    {
        var token = await DanielToken();
        var before = (await Read("disembark", token)).Json;
        Assert.True(before.GetProperty("option").ValueKind == JsonValueKind.Null);
        Assert.True(before.GetProperty("canChoose").GetBoolean());
        Assert.False(before.GetProperty("closed").GetBoolean());
        Assert.False(before.GetProperty("priority").GetBoolean());
        Assert.NotEqual("gold", before.GetProperty("group").GetProperty("color").GetString());

        var view = (await Put("disembark/choice", token, new { option = "tagged", bags = Bags(2, 1) })).Json;
        var group = view.GetProperty("group");
        var color = group.GetProperty("color").GetString()!.ToUpperInvariant();
        var guests = view.GetProperty("guests").EnumerateArray().ToDictionary(g => g.GetProperty("id").GetGuid());
        Assert.Equal(2, guests[Daniel.PublicId].GetProperty("bags").GetInt32());
        Assert.StartsWith($"{color} {group.GetProperty("number").GetInt32()} · ", guests[Daniel.PublicId].GetProperty("label").GetString());
        Assert.Contains("HARPER/DANIEL", guests[Daniel.PublicId].GetProperty("label").GetString());
        Assert.Equal(JsonValueKind.Null, guests[Maya.PublicId].GetProperty("label").ValueKind);        // no bags, no label
        Assert.False(view.GetProperty("tagsOn").GetBoolean());

        Assert.True((await Put("disembark/tags", token, new { on = true })).Json.GetProperty("tagsOn").GetBoolean());
        Assert.True((await Read("disembark", await SignIn(Priya))).Json.GetProperty("tagsOn").GetBoolean());       // the booking's choice

        // another way of getting off takes the tags back off
        var carried = (await Put("disembark/choice", token, new { option = "selfAssist", bags = Bags(2, 2) })).Json;
        Assert.Equal(("selfAssist", false), (carried.GetProperty("option").GetString(), carried.GetProperty("tagsOn").GetBoolean()));
        Assert.All(carried.GetProperty("guests").EnumerateArray(), g => Assert.Equal(JsonValueKind.Null, g.GetProperty("label").ValueKind));
    }

    [Fact]
    public async Task APriorityBookingIsGoldOneAndLeavesFirst()
    {
        GuestOf(Daniel).Tier = "platinum";
        var view = (await Read("disembark", await DanielToken())).Json;
        Assert.True(view.GetProperty("priority").GetBoolean());
        Assert.Equal(("gold", 1, "07:00"), (view.GetProperty("group").GetProperty("color").GetString(), view.GetProperty("group").GetProperty("number").GetInt32(), view.GetProperty("group").GetProperty("time").GetString()));
        var off = view.GetProperty("offAt");
        Assert.Equal(new DateTimeOffset(Utc(28, 11)).ToUnixTimeMilliseconds(), off.GetProperty("tagged").GetInt64());
        Assert.Equal(new DateTimeOffset(Utc(28, 11, 30)).ToUnixTimeMilliseconds(), off.GetProperty("selfAssist").GetInt64());
        Assert.Equal(new DateTimeOffset(Utc(28, 10, 30)).ToUnixTimeMilliseconds(), off.GetProperty("earlyWalkOff").GetInt64());
        Assert.Equal(new DateTimeOffset(Utc(28, 2)).ToUnixTimeMilliseconds(), view.GetProperty("times").GetProperty("bagsOutAt").GetInt64());
    }

    [Fact]
    public async Task AChoiceIsRefusedForItsReasons()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badOption", await Put("disembark/choice", token, new { option = "swim", bags = Bags(1) }));
        Is(HttpStatusCode.BadRequest, "badBags", await Put("disembark/choice", token, new { option = "tagged", bags = new Dictionary<Guid, int> { [Guid.NewGuid()] = 1 } }));
        Is(HttpStatusCode.BadRequest, "badBags", await Put("disembark/choice", token, new { option = "tagged", bags = Bags(7) }));
        Is(HttpStatusCode.BadRequest, "noBags", await Put("disembark/choice", token, new { option = "tagged", bags = Bags(0) }));
        Is(HttpStatusCode.BadRequest, "tooManyToCarry", await Put("disembark/choice", token, new { option = "earlyWalkOff", bags = Bags(3) }));
        Is(HttpStatusCode.Conflict, "notTagged", await Put("disembark/tags", token, new { on = true }));
        Assert.Equal(HttpStatusCode.OK, (await Put("disembark/choice", token, new { option = "earlyWalkOff", bags = Bags(1, 1) })).Status);
        Is(HttpStatusCode.Conflict, "notTagged", await Put("disembark/tags", token, new { on = true }));

        SetNow(AfterBagsOut);
        Is(HttpStatusCode.Conflict, "deadline", await Put("disembark/choice", token, new { option = "selfAssist", bags = Bags(1) }));
        var view = (await Read("disembark", token)).Json;
        Assert.True(view.GetProperty("closed").GetBoolean());
        Assert.False(view.GetProperty("canChoose").GetBoolean());

        SetNow(Docked);
        Is(HttpStatusCode.Conflict, "closed", await Put("disembark/choice", token, new { option = "selfAssist", bags = Bags(1) }));
        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Put("disembark/choice", token, new { option = "selfAssist", bags = Bags(1) }));
    }

    // ---- Customs ----

    [Fact]
    public async Task ACustomsDeclarationIsSavedAndTheAllowanceIsForTheWholeBooking()
    {
        var token = await DanielToken();
        var empty = (await Read("disembark/customs", token)).Json;
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("declaration").ValueKind);
        Assert.Equal((3, 2400), (empty.GetProperty("people").GetInt32(), empty.GetProperty("allowanceUsd").GetInt32()));

        var saved = (await Put("disembark/customs", token, new { food = true, cash = false, goodsUsd = 3000, note = "  Rum for a friend  " })).Json;
        Assert.Equal("Rum for a friend", saved.GetProperty("declaration").GetProperty("note").GetString());
        Assert.Equal(["food", "goods"], saved.GetProperty("declare").EnumerateArray().Select(x => x.GetString()!).ToArray());
        Assert.Equal(600, saved.GetProperty("overUsd").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, saved.GetProperty("submittedAt").ValueKind);
        Assert.True((await Read("disembark", token)).Json.GetProperty("customsDone").GetBoolean());
        Assert.Equal(3000, (await Read("disembark/customs", await SignIn(Priya))).Json.GetProperty("declaration").GetProperty("goodsUsd").GetInt32());

        Is(HttpStatusCode.BadRequest, "badGoods", await Put("disembark/customs", token, new { food = false, cash = false, goodsUsd = -1, note = "" }));
        Is(HttpStatusCode.BadRequest, "badGoods", await Put("disembark/customs", token, new { food = false, cash = false, goodsUsd = 100_001, note = "" }));
        Is(HttpStatusCode.BadRequest, "badNote", await Put("disembark/customs", token, new { food = false, cash = false, goodsUsd = 0, note = new string('x', 201) }));
        SetNow(Docked);
        Is(HttpStatusCode.Conflict, "closed", await Put("disembark/customs", token, new { food = false, cash = false, goodsUsd = 0, note = "" }));
    }

    [Fact]
    public async Task AStoredDeclarationFromAnotherWriterIsReadAsFarAsItFits()
    {
        F.Finish.Customs[Harper.BookingId] = new CustomsRow { Json = """{"goods":false,"cash":true,"food":false}""", SubmittedAt = Utc(27, 1) };
        var view = (await Read("disembark/customs", await DanielToken())).Json;
        Assert.True(view.GetProperty("declaration").GetProperty("cash").GetBoolean());
        Assert.Equal(0, view.GetProperty("declaration").GetProperty("goodsUsd").GetInt32());
        Assert.Equal(["cash"], view.GetProperty("declare").EnumerateArray().Select(x => x.GetString()!).ToArray());
    }

    // ---- Onward travel ----

    [Fact]
    public async Task AnOnwardPlanIsCheckedAgainstWhenTheBookingLeavesTheShip()
    {
        var token = await DanielToken();
        Assert.Equal(JsonValueKind.Null, (await Read("disembark/onward", token)).Json.GetProperty("plan").ValueKind);
        await Put("disembark/choice", token, new { option = "selfAssist", bags = Bags(2, 2) });

        var ok = (await Put("disembark/onward", token, new { mode = "rideshare", flightAt = "14:30", flight = " ua 482 ", note = " Taxi " })).Json;
        Assert.Equal(("rideshare", "14:30", "UA 482", "Taxi"), (ok.GetProperty("plan").GetProperty("mode").GetString(), ok.GetProperty("plan").GetProperty("flightAt").GetString(), ok.GetProperty("plan").GetProperty("flight").GetString(), ok.GetProperty("plan").GetProperty("note").GetString()));
        Assert.Equal(("ok", 180, "11:30"), (ok.GetProperty("check").GetProperty("status").GetString(), ok.GetProperty("check").GetProperty("spare").GetInt32(), ok.GetProperty("check").GetProperty("earliestFlight").GetString()));
        Assert.Equal(new DateTimeOffset(Utc(28, 11, 30)).ToUnixTimeMilliseconds(), ok.GetProperty("offFrom").GetInt64());
        Assert.True((await Read("disembark", token)).Json.GetProperty("onwardSaved").GetBoolean());

        var early = (await Put("disembark/onward", token, new { mode = "rideshare", flightAt = "08:00", flight = "UA 1", note = "" })).Json;
        Assert.Equal("tooEarly", early.GetProperty("check").GetProperty("status").GetString());
        var none = (await Put("disembark/onward", token, new { mode = "hotelShuttle", flightAt = "", flight = "", note = "" })).Json;
        Assert.Equal("noFlight", none.GetProperty("check").GetProperty("status").GetString());

        Is(HttpStatusCode.BadRequest, "badMode", await Put("disembark/onward", token, new { mode = "train", flightAt = "", flight = "", note = "" }));
        Is(HttpStatusCode.BadRequest, "badFlightTime", await Put("disembark/onward", token, new { mode = "rideshare", flightAt = "25:00", flight = "", note = "" }));
        Is(HttpStatusCode.BadRequest, "badFlight", await Put("disembark/onward", token, new { mode = "rideshare", flightAt = "", flight = "UA-482", note = "" }));
        Is(HttpStatusCode.BadRequest, "badNote", await Put("disembark/onward", token, new { mode = "rideshare", flightAt = "", flight = "", note = new string('x', 201) }));
    }

    [Fact]
    public async Task ANoteWithAModeThisServerDoesNotKnowStillShowsButIsNotChecked()
    {
        F.Finish.Onward[Harper.BookingId] = new OnwardRow { Mode = "flight", FlightAt = "14:30", Flight = "UA 482", Note = "Taxi to the airport." };
        var view = (await Read("disembark/onward", await DanielToken())).Json;
        Assert.Equal("flight", view.GetProperty("plan").GetProperty("mode").GetString());
        Assert.Equal(JsonValueKind.Null, view.GetProperty("check").ValueKind);
    }

    // ---- The final night ----

    [Fact]
    public async Task TheFinalNightListFollowsTheChoiceAndItemsAreTickedOrCleared()
    {
        var token = await DanielToken();
        var open = (await Read("disembark/night", token)).Json;
        var ids = open.GetProperty("entries").EnumerateArray().Select(e => e.GetProperty("id").GetString()).ToArray();
        Assert.Contains("bagsOut", ids);                                      // no choice yet: everything is listed

        await Put("disembark/choice", token, new { option = "selfAssist", bags = Bags(2) });
        var view = (await Read("disembark/night", token)).Json;
        var entries = view.GetProperty("entries").EnumerateArray().ToDictionary(e => e.GetProperty("id").GetString()!);
        Assert.DoesNotContain("tags", entries.Keys);
        Assert.DoesNotContain("bagsOut", entries.Keys);
        Assert.Equal(("done", true), (entries["choose"].GetProperty("state").GetString(), entries["choose"].GetProperty("automatic").GetBoolean()));
        Assert.Equal("upcoming", entries["carryOn"].GetProperty("state").GetString());
        Assert.Equal("selfAssist", view.GetProperty("option").GetString());

        string State(JsonElement v, string id) => v.GetProperty("entries").EnumerateArray().Single(e => e.GetProperty("id").GetString() == id).GetProperty("state").GetString()!;
        Assert.Equal("done", State((await Put("disembark/night/carryOn", token, new { done = true })).Json, "carryOn"));
        Assert.Equal("done", State((await Read("disembark/night", await SignIn(Priya))).Json, "carryOn"));       // shared by the booking
        Assert.Equal("upcoming", State((await Put("disembark/night/carryOn", token, new { done = false })).Json, "carryOn"));
        await Put("disembark/customs", token, new { food = false, cash = false, goodsUsd = 0, note = "" });
        Assert.Equal("done", State((await Read("disembark/night", token)).Json, "customs"));

        Is(HttpStatusCode.BadRequest, "automatic", await Put("disembark/night/choose", token, new { done = true }));
        Is(HttpStatusCode.BadRequest, "badItem", await Put("disembark/night/nope", token, new { done = true }));
        SetNow(AfterBagsOut);
        Assert.Equal("overdue", State((await Read("disembark/night", token)).Json, "carryOn"));
        SetNow(Docked);
        Is(HttpStatusCode.Conflict, "closed", await Put("disembark/night/carryOn", token, new { done = true }));
    }

    // ---- The final bill ----

    [Fact]
    public async Task TheFinalBillShowsTheCardAndAPackageThatIncludesGratuitiesLeavesNothingToAdjust()
    {
        var bill = (await Read("disembark/final-bill", await DanielToken())).Json;
        Assert.Equal("Visa ending 4242", bill.GetProperty("card").GetString());
        Assert.Equal(0, bill.GetProperty("tip").GetProperty("charged").GetInt64());      // Princess Plus includes them
        Assert.False(bill.GetProperty("tip").GetProperty("canAdjust").GetBoolean());
    }

    [Fact]
    public async Task TheGratuityCanBePartlyKeptUntilItsDeadlineAndTheCreditIsOnTheAccount()
    {
        Harper.FareId = "standard";
        var token = await DanielToken();
        var bill = (await Read("disembark/final-bill", token)).Json;
        Assert.Equal(3 * 1650 * 7, bill.GetProperty("tip").GetProperty("charged").GetInt64());
        Assert.True(bill.GetProperty("tip").GetProperty("canAdjust").GetBoolean());
        Assert.Equal(100, bill.GetProperty("tip").GetProperty("keepPercent").GetInt32());

        var half = (await Put("disembark/final-bill/tip", token, new { keepPercent = 50 })).Json.GetProperty("tip");
        Assert.Equal((50, 17_325L), (half.GetProperty("keepPercent").GetInt32(), half.GetProperty("credit").GetInt64()));
        var line = Assert.Single(await FolioLines(token), l => l.GetProperty("description").GetString()!.StartsWith("Gratuity adjustment"));
        Assert.Equal((-17_325L, "credit", "Gratuity adjustment (keeping 50%)"), (line.GetProperty("cents").GetInt64(), line.GetProperty("category").GetString(), line.GetProperty("description").GetString()));

        // changing it again replaces the line, and keeping everything takes it off
        await Put("disembark/final-bill/tip", token, new { keepPercent = 0 });
        Assert.Equal(-34_650L, Assert.Single(await FolioLines(token), l => l.GetProperty("description").GetString()!.StartsWith("Gratuity adjustment")).GetProperty("cents").GetInt64());
        await Put("disembark/final-bill/tip", token, new { keepPercent = 100 });
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString()!.StartsWith("Gratuity adjustment"));

        Is(HttpStatusCode.BadRequest, "badTip", await Put("disembark/final-bill/tip", token, new { keepPercent = 60 }));
        SetNow(AfterTip);
        Is(HttpStatusCode.Conflict, "deadline", await Put("disembark/final-bill/tip", token, new { keepPercent = 75 }));
        Assert.False((await Read("disembark/final-bill", token)).Json.GetProperty("tip").GetProperty("canAdjust").GetBoolean());
        SetNow(Docked);
        Is(HttpStatusCode.Conflict, "closed", await Put("disembark/final-bill/tip", token, new { keepPercent = 75 }));
    }

    [Fact]
    public async Task TheReceiptsOpenOnTheFinalEveningAndCanBeEmailedMasked()
    {
        var token = await DanielToken();
        SetNow(Morning);
        Is(HttpStatusCode.Conflict, "closed", await Post("disembark/final-bill/email", token));
        var early = (await Read("disembark/final-bill", token)).Json.GetProperty("receipts").EnumerateArray().ToDictionary(r => r.GetProperty("id").GetString()!, r => r.GetProperty("available").GetBoolean());
        Assert.Equal((false, false, true), (early["folio"], early["gratuities"], early["fare"]));

        SetNow(LastDay);
        var sent = (await Post("disembark/final-bill/email", token)).Json;
        Assert.NotEqual(JsonValueKind.Null, sent.GetProperty("emailedAt").ValueKind);
        var to = sent.GetProperty("emailedTo").GetString()!;
        Assert.Contains("@", to);
        Assert.DoesNotContain("daniel@", to);
        Assert.All(sent.GetProperty("receipts").EnumerateArray(), r => Assert.True(r.GetProperty("available").GetBoolean()));
        Assert.Equal(to, (await Read("disembark/final-bill", await SignIn(Priya))).Json.GetProperty("emailedTo").GetString());
    }

    [Fact]
    public async Task ABillQueryShowsOnTheFinalBillAndHoldsItBackUntilItIsAnswered()
    {
        var token = await DanielToken();
        Assert.True((await Read("disembark/final-bill", token)).Json.GetProperty("settled").GetBoolean());
        var line = Guid.NewGuid().ToString();
        await Post("cases", token, new { kind = "billing", summary = "Charged twice for the same drink", place = "", lineId = line, cents = 3150 });
        var bill = (await Read("disembark/final-bill", token)).Json;
        var query = Assert.Single(bill.GetProperty("queries").EnumerateArray());
        Assert.Equal((line, "received", 3150L), (query.GetProperty("lineId").GetString(), query.GetProperty("stage").GetString(), query.GetProperty("cents").GetInt64()));
        Assert.StartsWith("PC-BD-", query.GetProperty("number").GetString());
        Assert.False(bill.GetProperty("settled").GetBoolean());

        SetNow(Utc(28, 16).AddDays(6));
        Assert.True((await Read("disembark/final-bill", token)).Json.GetProperty("settled").GetBoolean());
    }

    // ---- Cases ----

    private static object Lost(string place = "Princess Theater") => new { kind = "lostItem", summary = "Blue scarf left in the theatre", place, lineId = "", cents = 0 };

    [Fact]
    public async Task ACaseIsOpenedListedForTheWholeBookingAndWithdrawn()
    {
        var token = await DanielToken();
        Assert.Empty((await Read("cases", token)).Json.GetProperty("cases").EnumerateArray());
        var view = (await Post("cases", token, Lost())).Json;
        Assert.True(view.GetProperty("canOpen").GetBoolean());
        var c = Assert.Single(view.GetProperty("cases").EnumerateArray());
        Assert.Equal(("lostItem", "received", "Princess Theater", true, false), (c.GetProperty("kind").GetString(), c.GetProperty("stage").GetString(), c.GetProperty("place").GetString(), c.GetProperty("canWithdraw").GetBoolean(), c.GetProperty("fromFeedback").GetBoolean()));
        Assert.Matches(@"^PC-LF-\d{5}$", c.GetProperty("number").GetString());
        Assert.Equal(c.GetProperty("openedAt").GetInt64() + 72 * 3_600_000L, c.GetProperty("dueAt").GetInt64());
        Assert.Single((await Read("cases", await SignIn(Priya))).Json.GetProperty("cases").EnumerateArray());

        var id = c.GetProperty("id").GetString();
        var done = (await Delete($"cases/{id}", await SignIn(Priya))).Json.GetProperty("cases").EnumerateArray().Single();
        Assert.Equal(("withdrawn", false), (done.GetProperty("stage").GetString(), done.GetProperty("canWithdraw").GetBoolean()));
        Is(HttpStatusCode.Conflict, "tooLate", await Delete($"cases/{id}", token));
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"cases/{Guid.NewGuid()}", token)).Status);
    }

    [Fact]
    public async Task ACaseMovesToInReviewAndThenIsAnsweredAndCanNoLongerBeWithdrawn()
    {
        var token = await DanielToken();
        var id = (await Post("cases", token, Lost())).Json.GetProperty("cases")[0].GetProperty("id").GetString();
        SetNow(LastDay.AddHours(30));
        Assert.Equal("inReview", (await Read("cases", token)).Json.GetProperty("cases")[0].GetProperty("stage").GetString());
        SetNow(LastDay.AddHours(80));
        var answered = (await Read("cases", token)).Json.GetProperty("cases")[0];
        Assert.Equal("resolved", answered.GetProperty("stage").GetString());
        Assert.Contains(answered.GetProperty("outcome").GetString(), new[] { "found", "notFound" });
        Is(HttpStatusCode.Conflict, "tooLate", await Delete($"cases/{id}", token));
    }

    [Fact]
    public async Task ACaseIsRefusedForItsReasons()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badKind", await Post("cases", token, new { kind = "recovery", summary = "Opened by the ship, not by a guest", place = "", lineId = "", cents = 0 }));
        Is(HttpStatusCode.BadRequest, "badSummary", await Post("cases", token, new { kind = "complaint", summary = "no", place = "", lineId = "", cents = 0 }));
        Is(HttpStatusCode.BadRequest, "noPlace", await Post("cases", token, Lost(" ")));
        Is(HttpStatusCode.BadRequest, "noLine", await Post("cases", token, new { kind = "billing", summary = "Charged twice for the same drink", place = "", lineId = "", cents = 1500 }));
        Is(HttpStatusCode.BadRequest, "badAmount", await Post("cases", token, new { kind = "claim", summary = "Suitcase handle broken by the crew", place = "", lineId = "", cents = 0 }));
        Is(HttpStatusCode.BadRequest, "badAmount", await Post("cases", token, new { kind = "claim", summary = "Suitcase handle broken by the crew", place = "", lineId = "", cents = 500_001 }));

        var bill = new { kind = "billing", summary = "Charged twice for the same drink", place = "", lineId = "line-7", cents = 1500 };
        Assert.Equal(HttpStatusCode.OK, (await Post("cases", token, bill)).Status);
        Is(HttpStatusCode.Conflict, "alreadyQueried", await Post("cases", token, bill));

        for (var i = 0; i < 9; i++) Assert.Equal(HttpStatusCode.OK, (await Post("cases", token, Lost($"Deck {i + 1}"))).Status);
        Is(HttpStatusCode.Conflict, "tooManyCases", await Post("cases", token, Lost("Deck 11")));

        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Post("cases", token, Lost()));
        Assert.False((await Read("cases", token)).Json.GetProperty("canOpen").GetBoolean());
    }

    [Fact]
    public async Task ClaimsAndBillQueriesCarryTheirAmountAndTheOthersDoNot()
    {
        var token = await DanielToken();
        await Post("cases", token, new { kind = "claim", summary = "Suitcase handle broken by the crew", place = "", lineId = "", cents = 25_000 });
        await Post("cases", token, new { kind = "complaint", summary = "The air conditioning never worked", place = "", lineId = "", cents = 9999 });
        var cases = (await Read("cases", token)).Json.GetProperty("cases").EnumerateArray().ToDictionary(c => c.GetProperty("kind").GetString()!);
        Assert.Equal(25_000, cases["claim"].GetProperty("cents").GetInt64());
        Assert.Equal(0, cases["complaint"].GetProperty("cents").GetInt64());
        SetNow(LastDay.AddHours(24 * 10 + 1));
        var claim = (await Read("cases", token)).Json.GetProperty("cases").EnumerateArray().Single(c => c.GetProperty("kind").GetString() == "claim");
        Assert.Equal(("goodwill", 12_500L), (claim.GetProperty("outcome").GetString(), claim.GetProperty("refund").GetProperty("cents").GetInt64()));
    }

    // ---- History ----

    [Fact]
    public async Task TheHistoryListsThePastTripsAndAddsThisCruiseOnceTheShipHasTiedUp()
    {
        F.Finish.Trips.Add((Daniel.Id, new HistoryTripRow { Id = "p1", Title = "Alaska", Ship = "Majestic", Departure = new DateTime(2024, 7, 1), Nights = 7, FareCents = 210_000, Docs = [("fareReceipt", true), ("folioStatement", false)] }));
        F.Finish.Trips.Add((Daniel.Id, new HistoryTripRow { Id = "p2", Title = "Mexico", Ship = "Regal", Departure = new DateTime(2023, 2, 1), Nights = 5 }));
        F.Finish.Trips.Add((Daniel.Id, new HistoryTripRow { Id = "p3", Title = "Bahamas", Ship = "Regal", Departure = new DateTime(2022, 2, 1), Nights = 3, Cancelled = true }));
        var token = await DanielToken();

        var during = (await Read("history", token)).Json;
        Assert.False(during.GetProperty("sailed").GetBoolean());
        Assert.Equal(JsonValueKind.Null, during.GetProperty("photosUntil").ValueKind);
        var past = during.GetProperty("trips").EnumerateArray().ToArray();
        Assert.Equal(["p1", "p2", "p3"], past.Select(t => t.GetProperty("id").GetString()!).ToArray());
        Assert.Equal(("2024-07-01", 210_000L), (past[0].GetProperty("departure").GetString(), past[0].GetProperty("fareCents").GetInt64()));
        Assert.Equal([("fareReceipt", true), ("folioStatement", false)], past[0].GetProperty("documents").EnumerateArray().Select(d => (d.GetProperty("id").GetString()!, d.GetProperty("ready").GetBoolean())).ToArray());
        Assert.Equal(["fareReceipt", "taxSummary"], past[1].GetProperty("documents").EnumerateArray().Select(d => d.GetProperty("id").GetString()!).ToArray());       // none recorded: the usual two
        Assert.Empty(past[2].GetProperty("documents").EnumerateArray());
        Assert.True(past[2].GetProperty("cancelled").GetBoolean());

        SetNow(Docked);
        var after = (await Read("history", token)).Json;
        Assert.True(after.GetProperty("sailed").GetBoolean());
        var trips = after.GetProperty("trips").EnumerateArray().ToArray();
        Assert.Equal(4, trips.Length);
        Assert.Equal((true, "2027-03-21", 7, 1_226_300L), (trips[0].GetProperty("current").GetBoolean(), trips[0].GetProperty("departure").GetString(), trips[0].GetProperty("nights").GetInt32(), trips[0].GetProperty("fareCents").GetInt64()));
        Assert.Equal(4, trips[0].GetProperty("documents").GetArrayLength());
        Assert.True(after.GetProperty("photosUntil").GetInt64() > new DateTimeOffset(Utc(28, 12)).ToUnixTimeMilliseconds());
        Assert.Equal(1, (await Read("history", await SignIn(Priya))).Json.GetProperty("trips").GetArrayLength());      // the past trips are Daniel's own
    }

    // ---- Feedback ----

    private static object Good() => new { overall = 4, areas = new { ship = 5, dining = 3 }, comment = "  Lovely trip  ", crew = new[] { "Marisol", " Marisol ", "Dennis" }, allowContact = false, shareName = true };

    [Fact]
    public async Task FeedbackOpensOnceTheShipHasTiedUpAndIsSharedByTheBooking()
    {
        var token = await DanielToken();
        var before = (await Read("post-feedback", token)).Json;
        Assert.False(before.GetProperty("open").GetBoolean());
        Assert.Equal(JsonValueKind.Null, before.GetProperty("feedback").ValueKind);
        Is(HttpStatusCode.Conflict, "closed", await Put("post-feedback", token, Good()));

        SetNow(Docked);
        var open = (await Read("post-feedback", token)).Json;
        Assert.True(open.GetProperty("open").GetBoolean());
        Assert.Equal(7, open.GetProperty("crew").GetArrayLength());
        Assert.False(string.IsNullOrWhiteSpace(open.GetProperty("steward").GetString()));

        var saved = (await Put("post-feedback", token, Good())).Json;
        var f = saved.GetProperty("feedback");
        Assert.Equal((4, "Lovely trip", true), (f.GetProperty("overall").GetInt32(), f.GetProperty("comment").GetString(), f.GetProperty("shareName").GetBoolean()));
        Assert.Equal((5, 3), (f.GetProperty("areas").GetProperty("ship").GetInt32(), f.GetProperty("areas").GetProperty("dining").GetInt32()));
        Assert.Equal(["Marisol", "Dennis"], f.GetProperty("crew").EnumerateArray().Select(x => x.GetString()!).ToArray());
        Assert.NotEqual(JsonValueKind.Null, saved.GetProperty("submittedAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, saved.GetProperty("recovery").ValueKind);
        Assert.Equal(4, (await Read("post-feedback", await SignIn(Priya))).Json.GetProperty("feedback").GetProperty("overall").GetInt32());
        Assert.Empty((await Read("cases", token)).Json.GetProperty("cases").EnumerateArray());
    }

    [Fact]
    public async Task FeedbackIsRefusedForItsReasonsAndCannotBeChangedAfterTwoWeeks()
    {
        SetNow(Docked);
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "noOverall", await Put("post-feedback", token, new { overall = 0 }));
        Is(HttpStatusCode.BadRequest, "badRating", await Put("post-feedback", token, new { overall = 4, areas = new { ship = 9 } }));
        Is(HttpStatusCode.BadRequest, "badRating", await Put("post-feedback", token, new { overall = 4, areas = new { bridge = 3 } }));
        Is(HttpStatusCode.BadRequest, "badComment", await Put("post-feedback", token, new { overall = 4, comment = new string('x', 1001) }));
        Is(HttpStatusCode.BadRequest, "badCrew", await Put("post-feedback", token, new { overall = 4, crew = new[] { "a", "b", "c", "d" } }));
        Is(HttpStatusCode.BadRequest, "badCrew", await Put("post-feedback", token, new { overall = 4, crew = new[] { " " } }));

        await Put("post-feedback", token, Good());
        SetNow(new DateTime(2027, 4, 12, 5, 0, 0, DateTimeKind.Utc));            // after 23:59 EDT on 11 April
        var late = (await Read("post-feedback", token)).Json;
        Assert.False(late.GetProperty("open").GetBoolean());
        Assert.Equal(4, late.GetProperty("feedback").GetProperty("overall").GetInt32());
        Is(HttpStatusCode.Conflict, "expired", await Put("post-feedback", token, Good()));
    }

    [Fact]
    public async Task PoorFeedbackWithPermissionStartsOneServiceRecoveryCase()
    {
        SetNow(Docked);
        var token = await DanielToken();
        await Put("post-feedback", token, new { overall = 1, comment = "The cabin was never cleaned.", allowContact = false });
        Assert.Empty((await Read("cases", token)).Json.GetProperty("cases").EnumerateArray());       // no permission, no case

        var saved = (await Put("post-feedback", token, new { overall = 5, areas = new { dining = 2 }, comment = "The cabin was never cleaned.", allowContact = true })).Json;
        var recovery = saved.GetProperty("recovery");
        Assert.StartsWith("PC-SR-", recovery.GetProperty("number").GetString());
        Assert.Equal("received", recovery.GetProperty("stage").GetString());
        var cases = (await Read("cases", token)).Json.GetProperty("cases").EnumerateArray().ToArray();
        var c = Assert.Single(cases);
        Assert.Equal(("recovery", true, "The cabin was never cleaned."), (c.GetProperty("kind").GetString(), c.GetProperty("fromFeedback").GetBoolean(), c.GetProperty("summary").GetString()));

        await Put("post-feedback", token, new { overall = 1, comment = "", allowContact = true });     // changing it does not start a second
        Assert.Single((await Read("cases", token)).Json.GetProperty("cases").EnumerateArray());

        SetNow(Docked.AddHours(50));
        var answered = (await Read("post-feedback", token)).Json.GetProperty("recovery");
        Assert.Equal("resolved", answered.GetProperty("stage").GetString());
        var credit = (await Read("cases", token)).Json.GetProperty("cases")[0];
        Assert.Equal(("credit", 5000L), (credit.GetProperty("outcome").GetString(), credit.GetProperty("refund").GetProperty("cents").GetInt64()));
    }

    // ---- Loyalty ----

    [Fact]
    public async Task TheCruiseCountsTowardsTheLevelOnceTheShipHasTiedUp()
    {
        Daniel.Tier = "gold";
        F.Finish.Loyalty[Daniel.Id] = new LoyaltyRecordRow { Number = "PC1039595", DaysCounted = 28, ReferralCode = "REFDANIEL", Referrals = [("Ruth", "sailed"), ("Frank", "invited"), ("Camille", "booked")] };
        var token = await DanielToken();

        var during = (await Get("/api/v1/me/loyalty-summary", token)).Json;
        Assert.False(during.GetProperty("counted").GetBoolean());
        Assert.Equal(("gold", "gold", 28, 28, false), (during.GetProperty("status").GetProperty("before").GetString(), during.GetProperty("status").GetProperty("after").GetString(), during.GetProperty("status").GetProperty("daysBefore").GetInt32(), during.GetProperty("status").GetProperty("daysAfter").GetInt32(), during.GetProperty("status").GetProperty("promoted").GetBoolean()));

        SetNow(Docked);
        var after = (await Get("/api/v1/me/loyalty-summary", token)).Json;
        Assert.True(after.GetProperty("counted").GetBoolean());
        var status = after.GetProperty("status");
        Assert.Equal(("ruby", 35, "platinum", 55, true), (status.GetProperty("after").GetString(), status.GetProperty("daysAfter").GetInt32(), status.GetProperty("next").GetString(), status.GetProperty("daysToNext").GetInt32(), status.GetProperty("promoted").GetBoolean()));
        Assert.Contains("welcomeGift", after.GetProperty("perks").EnumerateArray().Select(p => p.GetString()));

        var referral = after.GetProperty("referral");
        Assert.Equal(("REFDANIEL", 5000L, 5000L), (referral.GetProperty("code").GetString(), referral.GetProperty("credit").GetInt64(), referral.GetProperty("earned").GetInt64()));
        Assert.Equal(["Ruth", "Frank", "Camille"], referral.GetProperty("friends").EnumerateArray().Select(x => x.GetProperty("name").GetString()!).ToArray());
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/v1/me/loyalty-summary", null)).Status);
    }

    [Fact]
    public async Task WithoutALoyaltyRecordTheLevelsOwnMinimumIsUsedAndTheCodeIsMadeFromTheFirstName()
    {
        var view = (await Get("/api/v1/me/loyalty-summary", await DanielToken())).Json;
        Assert.Equal(("none", 0, 0), (view.GetProperty("status").GetProperty("before").GetString(), view.GetProperty("status").GetProperty("daysBefore").GetInt32(), view.GetProperty("referral").GetProperty("earned").GetInt32()));
        Assert.Matches(@"^DANIEL\d{3}$", view.GetProperty("referral").GetProperty("code").GetString());
    }

    // ---- Rebooking ----

    private static readonly string[] NextSeason = ["sun-2027-11-07", "sun-2027-11-21", "sun-2027-12-05", "sun-2028-01-09"];

    private void OpenNextSeason()
    {
        foreach (var id in NextSeason)
            F.Journey.Sailings.Add(new SailingRow { Id = id, Departure = DateTime.Parse(id[4..]), BookingOpen = false });
    }

    private static long Quote(string sailing) => Pricing.Quote(sailing, "balcony", 3)!.Total;

    [Fact]
    public async Task OnBoardTheDeparturesComeWithTheLowerDepositAndOnboardCreditForTheLevel()
    {
        OpenNextSeason();
        Daniel.Tier = "ruby";
        var view = (await Read("rebook", await DanielToken())).Json;
        Assert.Equal(("balcony", 3, "ruby", true, true), (view.GetProperty("category").GetString(), view.GetProperty("guests").GetInt32(), view.GetProperty("tier").GetString(), view.GetProperty("onboardOffer").GetBoolean(), view.GetProperty("canHold").GetBoolean()));
        var options = view.GetProperty("options").EnumerateArray().ToArray();
        Assert.Equal(NextSeason, options.Select(o => o.GetProperty("id").GetString()).ToArray());
        var first = options[0];
        Assert.Equal(("2027-11-07", false, Quote("sun-2027-11-07"), 30_000L, 15_000L), (first.GetProperty("departure").GetString(), first.GetProperty("bookable").GetBoolean(), first.GetProperty("total").GetInt64(), first.GetProperty("deposit").GetInt64(), first.GetProperty("credit").GetInt64()));

        SetNow(Home);                                                    // off the ship: the standard deposit and no credit
        var after = (await Read("rebook", await DanielToken())).Json;
        Assert.False(after.GetProperty("onboardOffer").GetBoolean());
        Assert.True(after.GetProperty("canHold").GetBoolean());
        var o = after.GetProperty("options")[0];
        Assert.Equal((PostCruiseRules.HoldDeposit(Quote("sun-2027-11-07"), 3, false), 0L), (o.GetProperty("deposit").GetInt64(), o.GetProperty("credit").GetInt64()));
        Assert.Equal(0, after.GetProperty("slots").GetArrayLength());
    }

    [Fact]
    public async Task AHoldPutsItsCreditOnTheAccountAndReleasingItTakesTheCreditBack()
    {
        OpenNextSeason();
        var token = await DanielToken();
        var view = (await Post("rebook/holds", token, new { departureId = "sun-2027-11-07" })).Json;
        var hold = Assert.Single(view.GetProperty("holds").EnumerateArray());
        Assert.Equal(("2027-11-07", 3, true, 10_000L, false, false), (hold.GetProperty("departure").GetString(), hold.GetProperty("guests").GetInt32(), hold.GetProperty("onboard").GetBoolean(), hold.GetProperty("credit").GetInt64(), hold.GetProperty("expired").GetBoolean(), hold.GetProperty("bookable").GetBoolean()));
        Assert.Equal(hold.GetProperty("placedAt").GetInt64() + 7 * 86_400_000L, hold.GetProperty("expiresAt").GetInt64());
        var credit = Assert.Single(await FolioLines(token), l => l.GetProperty("description").GetString() == "Onboard credit for holding a future cruise");
        Assert.Equal((-10_000L, "credit"), (credit.GetProperty("cents").GetInt64(), credit.GetProperty("category").GetString()));
        Assert.Single((await Read("rebook", await SignIn(Priya))).Json.GetProperty("holds").EnumerateArray());

        var left = (await Delete($"rebook/holds/{hold.GetProperty("id").GetString()}", token)).Json;
        Assert.Empty(left.GetProperty("holds").EnumerateArray());
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString() == "Onboard credit for holding a future cruise");
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"rebook/holds/{Guid.NewGuid()}", token)).Status);
    }

    [Fact]
    public async Task AHoldIsRefusedForItsReasonsAndLapsesAfterAWeek()
    {
        OpenNextSeason();
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badDeparture", await Post("rebook/holds", token, new { departureId = "sun-2030-01-01" }));
        Is(HttpStatusCode.BadRequest, "badDeparture", await Post("rebook/holds", token, new { departureId = "sun-2026-11-08" }));        // before the cruise is over
        Assert.Equal(HttpStatusCode.OK, (await Post("rebook/holds", token, new { departureId = NextSeason[0] })).Status);
        Is(HttpStatusCode.Conflict, "alreadyHeld", await Post("rebook/holds", token, new { departureId = NextSeason[0] }));
        await Post("rebook/holds", token, new { departureId = NextSeason[1] });
        await Post("rebook/holds", token, new { departureId = NextSeason[2] });
        Is(HttpStatusCode.Conflict, "tooManyHolds", await Post("rebook/holds", token, new { departureId = NextSeason[3] }));

        SetNow(LastDay.AddDays(8));                                       // a week has gone: all three have lapsed
        var view = (await Read("rebook", token)).Json;
        Assert.All(view.GetProperty("holds").EnumerateArray(), h => Assert.True(h.GetProperty("expired").GetBoolean()));
        Assert.Equal(HttpStatusCode.OK, (await Post("rebook/holds", token, new { departureId = NextSeason[3] })).Status);        // lapsed holds do not count

        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Post("rebook/holds", token, new { departureId = NextSeason[0] }));
    }

    [Fact]
    public async Task FutureCruiseCreditCoversTheDepositOfAHoldAndCanBeChangedToOnboardCredit()
    {
        OpenNextSeason();
        F.Finish.Credits.Add((Daniel.Id, 1, 25_000, new DateOnly(2028, 3, 31)));
        F.Finish.Credits.Add((Daniel.Id, 2, 9_999, new DateOnly(2026, 1, 1)));           // run out: not counted
        var token = await DanielToken();
        Assert.Equal((25_000L, 0L), ((await Read("rebook", token)).Json.GetProperty("fccLeft").GetInt64(), (await Read("rebook", token)).Json.GetProperty("fccConverted").GetInt64()));

        var held = (await Post("rebook/holds", token, new { departureId = NextSeason[0] })).Json;
        Assert.Equal(0L, held.GetProperty("fccLeft").GetInt64());                                       // the 30,000 deposit takes all of it
        Assert.Equal(25_000L, held.GetProperty("holds")[0].GetProperty("fccApplied").GetInt64());
        Is(HttpStatusCode.BadRequest, "noCredit", await Post("rebook/convert-fcc", token));

        await Delete($"rebook/holds/{held.GetProperty("holds")[0].GetProperty("id").GetString()}", token);
        var converted = (await Post("rebook/convert-fcc", token)).Json;
        Assert.Equal((0L, 25_000L), (converted.GetProperty("fccLeft").GetInt64(), converted.GetProperty("fccConverted").GetInt64()));
        var line = Assert.Single(await FolioLines(token), l => l.GetProperty("description").GetString() == "Future cruise credit changed to onboard credit");
        Assert.Equal(-25_000L, line.GetProperty("cents").GetInt64());
        Is(HttpStatusCode.BadRequest, "noCredit", await Post("rebook/convert-fcc", token));
        Assert.Equal(0, F.Finish.Credits.Single(c => c.Id == 1).Remaining);
        Assert.Equal(9_999, F.Finish.Credits.Single(c => c.Id == 2).Remaining);

        SetNow(Home);
        Is(HttpStatusCode.Conflict, "closed", await Post("rebook/convert-fcc", token));
    }

    [Fact]
    public async Task APartOfTheCreditIsLeftWhenTheDepositIsLessThanTheCredit()
    {
        OpenNextSeason();
        F.Finish.Credits.Add((Daniel.Id, 1, 80_000, new DateOnly(2028, 3, 31)));
        var token = await DanielToken();
        var held = (await Post("rebook/holds", token, new { departureId = NextSeason[0] })).Json;       // onboard deposit for three: 30,000
        Assert.Equal((50_000L, 30_000L), (held.GetProperty("fccLeft").GetInt64(), held.GetProperty("holds")[0].GetProperty("fccApplied").GetInt64()));
        var converted = (await Post("rebook/convert-fcc", token)).Json;
        Assert.Equal((0L, 50_000L), (converted.GetProperty("fccLeft").GetInt64(), converted.GetProperty("fccConverted").GetInt64()));
        Assert.Equal(30_000, F.Finish.Credits.Single().Remaining);       // what the hold has still to use
    }

    // ---- The Future Cruise Desk ----

    private void OpenDesk()
    {
        var days = Itinerary.Days(new DateOnly(2027, 3, 21));
        foreach (var n in PostCruiseRules.DeskDays)
            foreach (var t in PostCruiseRules.DeskTimes())
                F.Finish.Slots[days[n - 1].Date.ToDateTime(t)] = 1;
    }

    private static long Ms(DateTime utc) => new DateTimeOffset(utc).ToUnixTimeMilliseconds();

    [Fact]
    public async Task TheDeskOffersTheNextSlotsAnHourOrMoreAwayAndABookingCanMoveOrBeCancelled()
    {
        OpenDesk();
        SetNow(Utc(27, 15, 55));                                                        // 11:55: the 13:00 slot is 65 minutes away
        var token = await DanielToken();
        var slots = (await Read("rebook", token)).Json.GetProperty("slots").EnumerateArray().ToArray();
        Assert.Equal(8, slots.Length);                                                  // 13:00 to 16:30 on day 7
        Assert.Equal((Ms(Utc(27, 17)), 7), (slots[0].GetProperty("at").GetInt64(), slots[0].GetProperty("day").GetInt32()));
        Assert.Equal(Ms(Utc(27, 20, 30)), slots[^1].GetProperty("at").GetInt64());

        var booked = (await Post("rebook/appointment", token, new { at = Ms(Utc(27, 18)) })).Json;
        Assert.Equal(Ms(Utc(27, 18)), booked.GetProperty("appointment").GetProperty("at").GetInt64());
        var moved = (await Post("rebook/appointment", token, new { at = Ms(Utc(27, 19)) })).Json;
        Assert.Equal(Ms(Utc(27, 19)), moved.GetProperty("appointment").GetProperty("at").GetInt64());
        Assert.Equal(Ms(Utc(27, 19)), (await Read("rebook", await SignIn(Priya))).Json.GetProperty("appointment").GetProperty("at").GetInt64());
        Assert.Equal(JsonValueKind.Null, (await Delete("rebook/appointment", token)).Json.GetProperty("appointment").ValueKind);
    }

    [Fact]
    public async Task ASlotThatIsTakenIsNotOfferedToAnotherBookingAndAnUnknownOneIsRefused()
    {
        OpenDesk();
        SetNow(Utc(27, 15, 55));
        var token = await DanielToken();
        await Post("rebook/appointment", token, new { at = Ms(Utc(27, 18)) });
        var other = await SignIn(Stranger);
        var slots = (await Get("/api/v1/bookings/PC179254/rebook", other)).Json.GetProperty("slots").EnumerateArray().Select(s => s.GetProperty("at").GetInt64()).ToArray();
        Assert.Equal(7, slots.Length);
        Assert.DoesNotContain(Ms(Utc(27, 18)), slots);
        Is(HttpStatusCode.BadRequest, "badSlot", await Call(HttpMethod.Post, "/api/v1/bookings/PC179254/rebook/appointment", other, new { at = Ms(Utc(27, 18)) }));
        Is(HttpStatusCode.BadRequest, "badSlot", await Post("rebook/appointment", token, new { at = Ms(Utc(27, 18)) + 1 }));
        Is(HttpStatusCode.BadRequest, "badSlot", await Post("rebook/appointment", token, new { at = Ms(Utc(27, 12)) }));            // too soon
        Assert.Equal(Ms(Utc(27, 18)), (await Read("rebook", token)).Json.GetProperty("slots").EnumerateArray().Select(s => s.GetProperty("at").GetInt64()).First(a => a == Ms(Utc(27, 18))));       // still its own to move
    }

    [Fact]
    public async Task TheDeskIsOnlyForGuestsStillOnBoard()
    {
        OpenDesk();
        var token = await DanielToken();
        SetNow(Home);
        Assert.Equal(0, (await Read("rebook", token)).Json.GetProperty("slots").GetArrayLength());
        Is(HttpStatusCode.Conflict, "closed", await Post("rebook/appointment", token, new { at = Ms(Utc(27, 18)) }));
    }

    // ---- Seeds ----

    [Fact]
    public async Task AnAppointmentThatWasHeldAndHasPassedNoLongerShows()
    {
        OpenDesk();
        F.Finish.Appointments[Harper.BookingId] = new DateTime(2027, 3, 27, 13, 0, 0);          // 13:00 ship time, 17:00Z
        var token = await DanielToken();
        Assert.Equal(Ms(Utc(27, 17)), (await Read("rebook", token)).Json.GetProperty("appointment").GetProperty("at").GetInt64());
        SetNow(Utc(27, 17, 31));
        Assert.Equal(JsonValueKind.Null, (await Read("rebook", token)).Json.GetProperty("appointment").ValueKind);
    }
}
