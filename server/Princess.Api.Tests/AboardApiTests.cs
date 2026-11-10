using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Bookings on board, requests, reports, drinks, money, parties, group tables, games, the TV, last-minute tours, readiness and the group chat over the real pipeline.
/// The Harpers (Balcony, Princess Plus) sail 21 March 2027; Maya is eight. Eastern daylight time is UTC-4 until the ship moves to Belize time; Cozumel is UTC-5.
/// </summary>
public class AboardApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);

    private static readonly DateTime BeforeSailing = Utc(20, 16);
    private static readonly DateTime SeaDay = Utc(22, 16);                    // 12:00 Eastern on day 2
    private static readonly DateTime CozumelMorning = Utc(23, 12, 30);        // 07:30 in Cozumel, the ship docked at 07:00

    public AboardApiTests() => SetNow(SeaDay);

    private Task<string> DanielToken() => SignIn(Daniel);

    private Task<Reply> Put(string path, string token, object? body = null) => Call(HttpMethod.Put, $"{Base}/{path}", token, body);
    private Task<Reply> Post(string path, string token, object? body = null) => Call(HttpMethod.Post, $"{Base}/{path}", token, body);
    private Task<Reply> Delete(string path, string token) => Call(HttpMethod.Delete, $"{Base}/{path}", token);
    private Task<Reply> Patch(string path, string token, object? body) => Call(HttpMethod.Patch, $"{Base}/{path}", token, body);
    private Task<Reply> Read(string path, string token) => Get($"{Base}/{path}", token);

    private async Task<JsonElement[]> FolioLines(string token) => (await Read("onboard/folio", token)).Json.GetProperty("lines").EnumerateArray().ToArray();

    private static void Is(HttpStatusCode status, string? title, Reply r) => Assert.Equal((status, title), (r.Status, r.ProblemTitle));

    // ---- Access ----

    private static readonly string[] ReadPaths = ["selections", "requests", "safety-reports", "drinks", "money", "parties", "games", "tv", "last-minute", "ready"];

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
    public async Task ASupervisedChildCanLookButNotChangeAnythingExceptReportAndPlay()
    {
        var maya = MayaToken();
        foreach (var path in ReadPaths) Assert.Equal(HttpStatusCode.OK, (await Read(path, maya)).Status);
        Assert.False((await Read("money", maya)).Json.GetProperty("canEdit").GetBoolean());
        var anId = Guid.NewGuid();
        foreach (var (verb, url, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Post, "selections", new { item = "shop-hat", day = 0, time = "", qty = 1 }),
            (HttpMethod.Delete, $"selections/{anId}", null),
            (HttpMethod.Post, "requests", new { item = "towels", qty = 1, note = "" }),
            (HttpMethod.Delete, $"requests/{anId}", null),
            (HttpMethod.Post, "money/top-ups", new { dollars = 25, source = "card" }),
            (HttpMethod.Put, "money/pin", new { next = "1357" }),
            (HttpMethod.Post, "money/forgot-pin", null),
            (HttpMethod.Put, "money/gratuity", new { choice = "removal", reason = "long enough reason here" }),
            (HttpMethod.Post, "parties", new { title = "Party", day = 3, time = "20:00", cabins = new[] { "8101" } }),
            (HttpMethod.Delete, $"parties/{anId}", null),
            (HttpMethod.Post, $"dining/reservations/{anId}/group/friends", new { name = "Bo Chan", cabin = "8102" }),
            (HttpMethod.Patch, "tv", new { on = true }),
            (HttpMethod.Post, $"last-minute/coz-glass", new { guests = new[] { Maya.PublicId } }),
        })
        {
            var r = await Call(verb, $"{Base}/{url}", maya, body);
            Is(HttpStatusCode.Forbidden, "supervised", r);
        }
        // reporting, logging a soft drink, the games and the readiness list are open to a child
        Assert.Equal(HttpStatusCode.OK, (await Post("safety-reports", maya, new { kind = "hazard", where = "Deck 5 pool", note = "Water on the floor", anonymous = false })).Status);
        Assert.Equal(HttpStatusCode.OK, (await Post("drinks", maya, new { drinkId = "soda" })).Status);
        Assert.Equal(HttpStatusCode.OK, (await Put("games/clues/h-pool", maya, new { on = true })).Status);
        Assert.Equal(HttpStatusCode.OK, (await Put("ready/sun", maya, new { on = true })).Status);
    }

    // ---- Bookings on board ----

    private static object Spa(int day = 2, string time = "13:00") => new { item = "spa-swedish", day, time, qty = 1 };

    [Fact]
    public async Task ABookingChargesTheAccountAndCancellingTakesTheChargeOff()
    {
        var token = await DanielToken();
        var list = (await Post("selections", token, Spa())).Json;
        var pick = Assert.Single(list.EnumerateArray());
        Assert.Equal(("spa-swedish", 2, "13:00", 1, 13900), (pick.GetProperty("item").GetString(), pick.GetProperty("day").GetInt32(), pick.GetProperty("time").GetString(), pick.GetProperty("qty").GetInt32(), pick.GetProperty("total").GetInt32()));
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Swedish massage" && l.GetProperty("cents").GetInt64() == 13900 && l.GetProperty("category").GetString() == "spa");
        Assert.Single((await Read("selections", await SignIn(Priya))).Json.EnumerateArray());      // the booking's, so Priya sees it too

        Assert.Empty((await Delete($"selections/{pick.GetProperty("id").GetString()}", token)).Json.EnumerateArray());
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString() == "Swedish massage");
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"selections/{Guid.NewGuid()}", token)).Status);
    }

    [Fact]
    public async Task ABookingIsRefusedForItsReasons()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "unknown", await Post("selections", token, new { item = "nope", day = 2, time = "13:00", qty = 1 }));
        Is(HttpStatusCode.BadRequest, "badDay", await Post("selections", token, new { item = "fit-yoga", day = 3, time = "07:00", qty = 1 }));
        Is(HttpStatusCode.BadRequest, "badTime", await Post("selections", token, Spa(time: "12:00")));
        Is(HttpStatusCode.BadRequest, "badQty", await Post("selections", token, new { item = "spa-swedish", day = 2, time = "13:00", qty = 9 }));
        Is(HttpStatusCode.BadRequest, "notBookable", await Post("selections", token, new { item = "shop-hat", day = 2, time = "", qty = 1 }));
        Is(HttpStatusCode.Conflict, "past", await Post("selections", token, Spa(time: "10:00")));       // it is 12:00 on day 2
        Assert.Equal(HttpStatusCode.OK, (await Post("selections", token, Spa())).Status);
        Is(HttpStatusCode.Conflict, "duplicate", await Post("selections", token, Spa()));

        var trainer = CatalogueRules.ById("fit-trainer")!;
        var left = CatalogueRules.PlacesLeft(trainer, 2, "16:00", 0)!.Value;
        Is(HttpStatusCode.Conflict, "soldOut", await Post("selections", token, new { item = "fit-trainer", day = 2, time = "16:00", qty = left + 1 }));

        SetNow(Utc(30, 12));                                                                              // the cruise is over
        Is(HttpStatusCode.Conflict, "closed", await Post("selections", token, Spa(day: 6)));
    }

    [Fact]
    public async Task GoodsCanBeOrderedBeforeSailingAndAGreaterQuantityReplacesTheLesser()
    {
        SetNow(BeforeSailing);
        var token = await DanielToken();
        var hat = (int qty) => new { item = "shop-hat", day = 0, time = "", qty };
        Assert.Equal(HttpStatusCode.OK, (await Post("selections", token, hat(2))).Status);
        var list = (await Post("selections", token, hat(3))).Json;
        var pick = Assert.Single(list.EnumerateArray());
        Assert.Equal((3, 8700), (pick.GetProperty("qty").GetInt32(), pick.GetProperty("total").GetInt32()));
        Assert.Equal(8700, Assert.Single(F.Onboard.Folio, f => f.Row.Description == "3 × Wide-brim sun hat").Row.Cents);
    }

    // ---- Requests ----

    [Fact]
    public async Task ARequestIsReceivedThenOnTheWayThenDoneAndCanBeCancelledOnlyWhileReceived()
    {
        var token = await DanielToken();
        var v = (await Post("requests", token, new { item = "towels", qty = 2, note = " extra bath towels " })).Json;
        var req = Assert.Single(v.EnumerateArray());
        Assert.Equal(("received", true, "extra bath towels", 2), (req.GetProperty("stage").GetString(), req.GetProperty("canCancel").GetBoolean(), req.GetProperty("note").GetString(), req.GetProperty("qty").GetInt32()));
        Assert.Equal(req.GetProperty("placedAt").GetInt64() + 20 * 60_000L, req.GetProperty("etaAt").GetInt64());
        Is(HttpStatusCode.Conflict, "duplicate", await Post("requests", token, new { item = "towels", qty = 1, note = "" }));

        SetNow(SeaDay.AddMinutes(11));
        Assert.Equal("onTheWay", (await Read("requests", token)).Json[0].GetProperty("stage").GetString());
        Is(HttpStatusCode.Conflict, "tooLate", await Delete($"requests/{req.GetProperty("id").GetString()}", token));
        SetNow(SeaDay.AddMinutes(21));
        Assert.Equal("done", (await Read("requests", token)).Json[0].GetProperty("stage").GetString());
    }

    [Fact]
    public async Task ACancelledRequestSaysSoAndFreesTheItemToAskAgain()
    {
        var token = await DanielToken();
        var id = (await Post("requests", token, new { item = "ice", qty = 1, note = "" })).Json[0].GetProperty("id").GetString();
        Assert.Equal("cancelled", (await Delete($"requests/{id}", token)).Json[0].GetProperty("stage").GetString());
        Assert.Equal(2, (await Post("requests", token, new { item = "ice", qty = 1, note = "" })).Json.GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"requests/{Guid.NewGuid()}", token)).Status);
    }

    [Fact]
    public async Task RequestsAreCheckedForTheItemQuantityHowManyAreOpenAndWhetherTheShipIsUnderWay()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badItem", await Post("requests", token, new { item = "nope", qty = 1, note = "" }));
        Is(HttpStatusCode.BadRequest, "badQuantity", await Post("requests", token, new { item = "towels", qty = 5, note = "" }));
        foreach (var item in new[] { "towels", "pillows", "bedding", "toiletries", "ice", "turndown" }) Assert.Equal(HttpStatusCode.OK, (await Post("requests", token, new { item, qty = 1, note = "" })).Status);
        Is(HttpStatusCode.Conflict, "tooMany", await Post("requests", token, new { item = "light", qty = 1, note = "" }));
        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Post("requests", token, new { item = "tv", qty = 1, note = "" }));
    }

    // ---- Reports ----

    [Fact]
    public async Task AReportGetsAReferenceAndAnUrgentOneIsNeverAnonymous()
    {
        var token = await DanielToken();
        var first = (await Post("safety-reports", token, new { kind = "theft", where = " Deck 5 aft ", note = " A wallet was taken ", anonymous = true })).Json;
        var one = Assert.Single(first.EnumerateArray());
        Assert.Equal(("SEC-001", "Deck 5 aft", "A wallet was taken", true), (one.GetProperty("reference").GetString(), one.GetProperty("where").GetString(), one.GetProperty("note").GetString(), one.GetProperty("anonymous").GetBoolean()));
        SetNow(SeaDay.AddMinutes(5));
        var both = (await Post("safety-reports", token, new { kind = "overboard", where = "Deck 12 stern", note = "Someone went over the rail", anonymous = true })).Json;
        Assert.Equal(["SEC-002", "SEC-001"], both.EnumerateArray().Select(r => r.GetProperty("reference").GetString()!).ToArray());
        Assert.False(both[0].GetProperty("anonymous").GetBoolean());
    }

    [Fact]
    public async Task AReportIsCheckedAndOnlyForThoseAboard()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badKind", await Post("safety-reports", token, new { kind = "x", where = "Deck 5", note = "Something odd", anonymous = false }));
        Is(HttpStatusCode.BadRequest, "noWhere", await Post("safety-reports", token, new { kind = "hazard", where = "", note = "Something odd", anonymous = false }));
        Is(HttpStatusCode.BadRequest, "noNote", await Post("safety-reports", token, new { kind = "hazard", where = "Deck 5", note = "odd", anonymous = false }));
        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Post("safety-reports", token, new { kind = "hazard", where = "Deck 5", note = "Something odd", anonymous = false }));
    }

    // ---- Drinks ----

    [Fact]
    public async Task DrinksAreCountedForTheCallerAgainstThePackageAndAFifthBeerAsksThemToSlowDown()
    {
        var token = await DanielToken();
        var v = (await Read("drinks", token)).Json;
        Assert.Equal((15, true), (v.GetProperty("capUsd").GetInt32(), v.GetProperty("adult").GetBoolean()));
        string? undo = null;
        for (var i = 0; i < 4; i++)
        {
            SetNow(SeaDay.AddMinutes(i * 10));
            v = (await Post("drinks", token, new { drinkId = "beer" })).Json;
            undo = v.GetProperty("logs")[0].GetProperty("id").GetString();
        }
        var s = v.GetProperty("summary");
        Assert.Equal((4, 4, 11, 0, "slow"), (s.GetProperty("today").GetInt32(), s.GetProperty("covered").GetInt32(), s.GetProperty("left").GetInt32(), s.GetProperty("paid").GetInt32(), s.GetProperty("alert").GetString()));
        Assert.Equal(0, (await Read("drinks", await SignIn(Priya))).Json.GetProperty("logs").GetArrayLength());       // drinks belong to the person
        v = (await Delete($"drinks/{undo}", token)).Json;
        Assert.Equal((3, "none"), (v.GetProperty("summary").GetProperty("today").GetInt32(), v.GetProperty("summary").GetProperty("alert").GetString()));
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"drinks/{undo}", await SignIn(Priya))).Status);
    }

    [Fact]
    public async Task OnlyTodaysDrinksCountAndADrinkMustBeKnownAndAllowed()
    {
        var token = await DanielToken();
        await Post("drinks", token, new { drinkId = "wine" });
        SetNow(SeaDay.AddDays(1));
        Assert.Equal(0, (await Read("drinks", token)).Json.GetProperty("summary").GetProperty("today").GetInt32());
        Is(HttpStatusCode.BadRequest, "badDrink", await Post("drinks", token, new { drinkId = "absinthe" }));
        var maya = MayaToken();
        Is(HttpStatusCode.Forbidden, "age", await Post("drinks", maya, new { drinkId = "beer" }));
        Assert.False((await Read("drinks", maya)).Json.GetProperty("adult").GetBoolean());
        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Post("drinks", token, new { drinkId = "soda" }));
    }

    // ---- Money ----

    [Fact]
    public async Task ACardTopUpCountsAtOnceAndACashOneWaitsForTheDesk()
    {
        var token = await DanielToken();
        var v = (await Post("money/top-ups", token, new { dollars = 100, source = "card" })).Json;
        var card = Assert.Single(v.GetProperty("topUps").EnumerateArray());
        Assert.Equal(("TOP-001", 100), (card.GetProperty("reference").GetString(), card.GetProperty("dollars").GetInt32()));
        Assert.Equal(card.GetProperty("at").GetInt64(), card.GetProperty("settledAt").GetInt64());
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Top-up by card" && l.GetProperty("cents").GetInt64() == -10_000);

        v = (await Post("money/top-ups", token, new { dollars = 50, source = "cash" })).Json;
        var cash = v.GetProperty("topUps").EnumerateArray().First(t => t.GetProperty("source").GetString() == "cash");
        Assert.Equal(JsonValueKind.Null, cash.GetProperty("settledAt").ValueKind);
        Assert.Equal(150, v.GetProperty("topUpTotal").GetInt32());
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString() == "Cash deposit");

        SetNow(SeaDay.AddMinutes(121));
        Assert.NotEqual(JsonValueKind.Null, (await Read("money", token)).Json.GetProperty("topUps").EnumerateArray().First(t => t.GetProperty("source").GetString() == "cash").GetProperty("settledAt").ValueKind);
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Cash deposit" && l.GetProperty("cents").GetInt64() == -5_000);
    }

    [Fact]
    public async Task ATopUpIsInStepsAndCappedAtTwoThousandAndNeedsACardForACardTopUp()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badSource", await Post("money/top-ups", token, new { dollars = 100, source = "cheque" }));
        Is(HttpStatusCode.BadRequest, "badAmount", await Post("money/top-ups", token, new { dollars = 30, source = "card" }));
        Is(HttpStatusCode.BadRequest, "badAmount", await Post("money/top-ups", token, new { dollars = 1025, source = "card" }));
        var priya = await SignIn(Priya);                                                                   // the card is Daniel's
        Is(HttpStatusCode.Conflict, "noCard", await Post("money/top-ups", priya, new { dollars = 25, source = "card" }));
        Assert.False((await Read("money", priya)).Json.GetProperty("hasCard").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Post("money/top-ups", token, new { dollars = 1000, source = "card" })).Status);
        Assert.Equal(HttpStatusCode.OK, (await Post("money/top-ups", token, new { dollars = 975, source = "cash" })).Status);
        Is(HttpStatusCode.Conflict, "tooMuch", await Post("money/top-ups", token, new { dollars = 50, source = "card" }));
        Assert.Equal(HttpStatusCode.OK, (await Post("money/top-ups", token, new { dollars = 25, source = "card" })).Status);       // exactly 2000
        SetNow(BeforeSailing);                                                                             // still open before sailing
        Is(HttpStatusCode.Conflict, "tooMuch", await Post("money/top-ups", priya, new { dollars = 25, source = "cash" }));
    }

    [Fact]
    public async Task TopUpsOpenBeforeSailingAndCloseWhenTheCruiseIsOver()
    {
        SetNow(BeforeSailing);
        var token = await DanielToken();
        Assert.Equal(HttpStatusCode.OK, (await Post("money/top-ups", token, new { dollars = 25, source = "card" })).Status);
        SetNow(Utc(30, 12));
        Is(HttpStatusCode.Conflict, "closed", await Post("money/top-ups", token, new { dollars = 25, source = "card" }));
    }

    [Fact]
    public async Task ThePinIsCheckedHashedAndLockedAfterFiveWrongGuesses()
    {
        var token = await DanielToken();
        Assert.False((await Read("money", token)).Json.GetProperty("pinSet").GetBoolean());
        Is(HttpStatusCode.BadRequest, "format", await Put("money/pin", token, new { next = "12" }));
        Is(HttpStatusCode.BadRequest, "weak", await Put("money/pin", token, new { next = "1234" }));
        Assert.True((await Put("money/pin", token, new { next = "1357" })).Json.GetProperty("pinSet").GetBoolean());
        var stored = F.Aboard.Accounts[10];
        Assert.NotEqual("1357", Convert.ToHexString(stored.PinHash!));
        Assert.Equal(32, stored.PinHash!.Length);

        Assert.Equal(HttpStatusCode.OK, (await Put("money/pin", token, new { next = "2468", current = "1357" })).Status);
        for (var i = 0; i < 5; i++) Is(HttpStatusCode.Forbidden, "wrongPin", await Put("money/pin", token, new { next = "9753", current = "0000" }));
        Is(HttpStatusCode.Conflict, "locked", await Put("money/pin", token, new { next = "9753", current = "2468" }));
    }

    [Fact]
    public async Task AForgottenPinIsPassedToGuestServicesInChat()
    {
        var token = await DanielToken();
        Assert.Equal(HttpStatusCode.OK, (await Post("money/forgot-pin", token)).Status);
        var thread = (await Read("service/guestServices", token)).Json;
        Assert.Contains(thread.GetProperty("messages").EnumerateArray(), m => m.GetProperty("from").GetString() == "me" && m.GetProperty("text").GetString()!.Contains("forgotten my account PIN"));
    }

    [Fact]
    public async Task GratuitiesAreNothingDueOnAPackageAndPrepaidOrRemovedOnceOtherwise()
    {
        var token = await DanielToken();
        var g = (await Read("money", token)).Json.GetProperty("gratuity");
        Assert.Equal(0, g.GetProperty("due").GetInt64());                                                  // Princess Plus includes them
        Is(HttpStatusCode.Conflict, "nothingDue", await Put("money/gratuity", token, new { choice = "prepaid" }));

        Harper.FareId = "standard";
        g = (await Read("money", token)).Json.GetProperty("gratuity");
        Assert.Equal((3 * 7 * 1650L, true, "standard"), (g.GetProperty("due").GetInt64(), g.GetProperty("canChange").GetBoolean(), g.GetProperty("choice").GetString()));
        Is(HttpStatusCode.BadRequest, "badChoice", await Put("money/gratuity", token, new { choice = "free" }));
        Is(HttpStatusCode.BadRequest, "noReason", await Put("money/gratuity", token, new { choice = "removal", reason = "too short" }));
        g = (await Put("money/gratuity", token, new { choice = "prepaid" })).Json.GetProperty("gratuity");
        Assert.Equal(("prepaid", false), (g.GetProperty("choice").GetString(), g.GetProperty("canChange").GetBoolean()));
        Assert.NotEqual(JsonValueKind.Null, g.GetProperty("paidAt").ValueKind);
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Gratuities prepaid by card" && l.GetProperty("cents").GetInt64() == -3 * 7 * 1650);
        Is(HttpStatusCode.Conflict, "already", await Put("money/gratuity", token, new { choice = "removal", reason = "I changed my mind about this" }));
    }

    [Fact]
    public async Task ARemovalNeedsAReasonAndStopsFurtherChangesAndPrepayingNeedsACard()
    {
        Harper.FareId = "standard";
        var token = await DanielToken();
        var g = (await Put("money/gratuity", token, new { choice = "removal", reason = "  The service fell short of what we expected.  " })).Json.GetProperty("gratuity");
        Assert.Equal(("removal", "The service fell short of what we expected.", false), (g.GetProperty("choice").GetString(), g.GetProperty("reason").GetString(), g.GetProperty("canChange").GetBoolean()));
        Assert.Equal(JsonValueKind.Null, g.GetProperty("paidAt").ValueKind);
        Is(HttpStatusCode.Conflict, "already", await Put("money/gratuity", token, new { choice = "prepaid" }));
    }

    [Fact]
    public async Task APrepaidGratuityNeedsACardAndIsClosedFromDaySeven()
    {
        Harper.FareId = "standard";
        var priya = await SignIn(Priya);
        Is(HttpStatusCode.Conflict, "noCard", await Put("money/gratuity", priya, new { choice = "prepaid" }));
        SetNow(Utc(27, 16));                                                                               // day 7
        Assert.False((await Read("money", priya)).Json.GetProperty("gratuity").GetProperty("canChange").GetBoolean());
        Is(HttpStatusCode.Conflict, "already", await Put("money/gratuity", await DanielToken(), new { choice = "prepaid" }));
    }

    [Fact]
    public async Task TheDisplayCurrencyIsCheckedAndKept()
    {
        var token = await DanielToken();
        Assert.Equal("USD", (await Read("money", token)).Json.GetProperty("currency").GetString());
        Is(HttpStatusCode.BadRequest, "badCurrency", await Put("money/currency", token, new { code = "XXX" }));
        Assert.Equal("EUR", (await Put("money/currency", token, new { code = "EUR" })).Json.GetProperty("currency").GetString());
        Assert.Equal("EUR", (await Read("money", await SignIn(Priya))).Json.GetProperty("currency").GetString());
        Assert.Equal("EUR", (await Put("money/currency", MayaToken(), new { code = "EUR" })).Json.GetProperty("currency").GetString());          // a child may choose how the account is shown
    }

    // ---- Parties ----

    [Fact]
    public async Task APartyInvitesNeighboursWhoseAnswersAreTheSameEveryTime()
    {
        var token = await DanielToken();
        var v = (await Post("parties", token, new { title = " Birthday ", day = 3, time = "20:00", cabins = new[] { "8101", "8102" } })).Json;
        var party = Assert.Single(v.EnumerateArray());
        Assert.Equal(("Birthday", 3, "20:00"), (party.GetProperty("title").GetString(), party.GetProperty("day").GetInt32(), party.GetProperty("time").GetString()));
        Assert.Equal(["8101", "8102"], party.GetProperty("invited").EnumerateArray().Select(i => i.GetProperty("cabin").GetString()!).ToArray());
        Assert.Equal(ServiceRules.Rsvp("8101", "Birthday"), party.GetProperty("invited")[0].GetProperty("answer").GetString());
        Assert.Empty((await Delete($"parties/{party.GetProperty("id").GetString()}", token)).Json.EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"parties/{Guid.NewGuid()}", token)).Status);
    }

    [Fact]
    public async Task APartyIsCheckedForTimeCabinsAndDayAndIsForTheShipAtSea()
    {
        var token = await DanielToken();
        object Party(int day = 3, string time = "20:00", string[]? cabins = null) => new { title = "Birthday", day, time, cabins = cabins ?? ["8101"] };
        Is(HttpStatusCode.BadRequest, "quiet", await Post("parties", token, Party(time: "23:30")));
        Is(HttpStatusCode.BadRequest, "noCabins", await Post("parties", token, Party(cabins: [])));
        Is(HttpStatusCode.BadRequest, "badCabin", await Post("parties", token, Party(cabins: ["8101", "8101"])));
        Is(HttpStatusCode.BadRequest, "badDay", await Post("parties", token, Party(day: 9)));
        Is(HttpStatusCode.Conflict, "past", await Post("parties", token, Party(day: 1)));
        SetNow(BeforeSailing);
        Is(HttpStatusCode.Conflict, "closed", await Post("parties", token, Party()));
    }

    // ---- Group tables ----

    private Guid DinnerFor(params UserRecord[] guests)
    {
        var id = Guid.NewGuid();
        F.Plan.Tables.Add((10, new TableRow { Id = 77, PublicId = id, VenueId = "eclipse", Day = 3, Time = "19:00", GuestIds = [.. guests.Select(g => g.Id)] }, "booked"));
        return id;
    }

    [Fact]
    public async Task FriendsJoinATableUpToEightSeatsAndCanBeRemovedAndTheBillSplit()
    {
        var token = await DanielToken();
        var table = $"dining/reservations/{DinnerFor(Daniel, Priya, Maya)}/group";
        var g = (await Read(table, token)).Json;
        Assert.Equal(("mine", 0), (g.GetProperty("split").GetString(), g.GetProperty("friends").GetArrayLength()));
        for (var i = 0; i < 5; i++) g = (await Post($"{table}/friends", token, new { name = $"Friend {i}", cabin = $"810{i}" })).Json;
        Assert.Equal(5, g.GetProperty("friends").GetArrayLength());
        Is(HttpStatusCode.Conflict, "full", await Post($"{table}/friends", token, new { name = "One More", cabin = "8199" }));       // 3 + 5 = 8
        g = (await Delete($"{table}/friends/1", token)).Json;
        Assert.Equal(["Friend 0", "Friend 2", "Friend 3", "Friend 4"], g.GetProperty("friends").EnumerateArray().Take(4).Select(f => f.GetProperty("name").GetString()!).ToArray());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"{table}/friends/9", token)).Status);
        Assert.Equal("even", (await Put($"{table}/split", token, new { split = "even" })).Json.GetProperty("split").GetString());
        Assert.Equal("even", (await Read(table, await SignIn(Priya))).Json.GetProperty("split").GetString());
    }

    [Fact]
    public async Task AFriendIsCheckedAndAnUnknownTableIsNotFound()
    {
        var token = await DanielToken();
        var table = $"dining/reservations/{DinnerFor(Daniel, Priya)}/group";
        Is(HttpStatusCode.BadRequest, "noName", await Post($"{table}/friends", token, new { name = "B", cabin = "8101" }));
        Is(HttpStatusCode.BadRequest, "badCabin", await Post($"{table}/friends", token, new { name = "Bo Chan", cabin = "81" }));
        await Post($"{table}/friends", token, new { name = "Bo Chan", cabin = "8101" });
        Is(HttpStatusCode.BadRequest, "duplicate", await Post($"{table}/friends", token, new { name = "bo chan", cabin = "8101" }));
        Is(HttpStatusCode.BadRequest, "badSplit", await Put($"{table}/split", token, new { split = "thirds" }));
        Assert.Equal(HttpStatusCode.NotFound, (await Read($"dining/reservations/{Guid.NewGuid()}/group", token)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Read(table, await SignIn(Stranger))).Status);
    }

    // ---- Games ----

    [Fact]
    public async Task GameProgressBelongsToThePersonAndATriviaQuestionIsAnsweredOnce()
    {
        var token = await DanielToken();
        Assert.Equal(0, (await Read("games", token)).Json.GetProperty("found").GetArrayLength());
        Assert.Equal(["h-pool"], (await Put("games/clues/h-pool", token, new { on = true })).Json.GetProperty("found").EnumerateArray().Select(x => x.GetString()!).ToArray());
        Assert.Equal(0, (await Put("games/clues/h-pool", token, new { on = false })).Json.GetProperty("found").GetArrayLength());
        Is(HttpStatusCode.BadRequest, "badClue", await Put("games/clues/h-nowhere", token, new { on = true }));

        Assert.Equal(1, (await Put("games/trivia/q-ports", token, new { option = 1 })).Json.GetProperty("answers").GetProperty("q-ports").GetInt32());
        Is(HttpStatusCode.Conflict, "answered", await Put("games/trivia/q-ports", token, new { option = 2 }));
        Is(HttpStatusCode.BadRequest, "badAnswer", await Put("games/trivia/q-clock", token, new { option = 3 }));
        Is(HttpStatusCode.BadRequest, "badAnswer", await Put("games/trivia/q-nope", token, new { option = 0 }));

        await Put("games/bingo/12", token, new { on = true });
        var marked = (await Put("games/bingo/40", token, new { on = true })).Json.GetProperty("marked").EnumerateArray().Select(x => x.GetInt32()).Order().ToArray();
        Assert.Equal(new[] { 12, 40 }, marked);
        Is(HttpStatusCode.BadRequest, "badNumber", await Put("games/bingo/76", token, new { on = true }));
        var priya = (await Read("games", await SignIn(Priya))).Json;
        Assert.Equal((0, 0, 0), (priya.GetProperty("found").GetArrayLength(), priya.GetProperty("answers").EnumerateObject().Count(), priya.GetProperty("marked").GetArrayLength()));
    }

    // ---- TV ----

    [Fact]
    public async Task TheTvStartsOffAndChangesAreKeptForTheStateroom()
    {
        var token = await DanielToken();
        var tv = (await Read("tv", token)).Json;
        Assert.Equal((false, 1, 20, false), (tv.GetProperty("on").GetBoolean(), tv.GetProperty("channel").GetInt32(), tv.GetProperty("volume").GetInt32(), tv.GetProperty("muted").GetBoolean()));
        tv = (await Patch("tv", token, new { on = true, channel = 5, volume = 35 })).Json;
        Assert.Equal((true, 5, 35), (tv.GetProperty("on").GetBoolean(), tv.GetProperty("channel").GetInt32(), tv.GetProperty("volume").GetInt32()));
        tv = (await Patch("tv", token, new { muted = true, casting = "Daniel's phone" })).Json;
        Assert.Equal((true, "Daniel's phone", 5), (tv.GetProperty("muted").GetBoolean(), tv.GetProperty("casting").GetString(), tv.GetProperty("channel").GetInt32()));
        tv = (await Read("tv", await SignIn(Priya))).Json;                                                 // shared with the stateroom
        Assert.Equal(("Daniel's phone", 35), (tv.GetProperty("casting").GetString(), tv.GetProperty("volume").GetInt32()));
        tv = (await Patch("tv", token, JsonDocument.Parse("""{"casting":null}""").RootElement)).Json;
        Assert.Equal(JsonValueKind.Null, tv.GetProperty("casting").ValueKind);
        Assert.Equal(35, tv.GetProperty("volume").GetInt32());
    }

    [Fact]
    public async Task ATvChangeIsCheckedAndATitleStartsVideoOnDemand()
    {
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badChannel", await Patch("tv", token, new { channel = 13 }));
        Is(HttpStatusCode.BadRequest, "badVolume", await Patch("tv", token, new { volume = 101 }));
        Is(HttpStatusCode.BadRequest, "badDevice", await Patch("tv", token, new { casting = "<script>" }));
        Is(HttpStatusCode.BadRequest, "badTitle", await Patch("tv", token, new { vod = "v-nope" }));
        var tv = (await Patch("tv", token, new { vod = "v-comedy" })).Json;
        Assert.Equal((true, 12, "v-comedy"), (tv.GetProperty("on").GetBoolean(), tv.GetProperty("channel").GetInt32(), tv.GetProperty("vod").GetString()));
    }

    // ---- Last-minute tours ----

    [Fact]
    public async Task LastMinuteToursAreOnlyOfferedInPort()
    {
        var token = await DanielToken();
        var v = (await Read("last-minute", token)).Json;                                                   // day 2 is at sea
        Assert.Equal(JsonValueKind.Null, v.GetProperty("port").ValueKind);
        Assert.Empty(v.GetProperty("tours").EnumerateArray());
        Assert.Equal(3, v.GetProperty("guests").GetArrayLength());
        Is(HttpStatusCode.Conflict, "closed", await Post("last-minute/coz-glass", token, new { guests = new[] { Daniel.PublicId } }));

        SetNow(CozumelMorning);
        v = (await Read("last-minute", token)).Json;
        Assert.Equal("cozumel", v.GetProperty("port").GetString());
        Assert.Equal(["coz-snorkel", "coz-ruins", "coz-beach", "coz-glass"], v.GetProperty("tours").EnumerateArray().Select(t => t.GetProperty("excursionId").GetString()!).ToArray());
    }

    private static JsonElement Tour(JsonElement view, string id) => view.GetProperty("tours").EnumerateArray().First(t => t.GetProperty("excursionId").GetString() == id);

    [Fact]
    public async Task ATourStartingSoonIsTooLateAndOneLaterInTheDayIsOpen()
    {
        SetNow(CozumelMorning);
        var view = (await Read("last-minute", await DanielToken())).Json;
        Assert.Equal("tooLate", Tour(view, "coz-snorkel").GetProperty("closed").GetString());              // leaves 08:30, under two hours away
        Assert.Equal("tooLate", Tour(view, "coz-ruins").GetProperty("closed").GetString());                // 09:00
        Assert.Equal(JsonValueKind.Null, Tour(view, "coz-glass").GetProperty("closed").ValueKind);         // 13:00
        Assert.Equal(Itinerary.LocalToUtc(new DateOnly(2027, 3, 23), new TimeOnly(13, 0), "America/Cancun"), DateTimeOffset.FromUnixTimeMilliseconds(Tour(view, "coz-glass").GetProperty("leaves").GetInt64()).UtcDateTime);
        SetNow(Utc(23, 20));                                                                               // 15:00 local, after the last tour left
        Assert.Equal("started", Tour(( await Read("last-minute", await DanielToken())).Json, "coz-glass").GetProperty("closed").GetString());
    }

    [Fact]
    public async Task BookingALastMinuteTourChargesTheAccountAndFillsTheSeatsAndCannotBeBookedTwice()
    {
        SetNow(CozumelMorning);
        var token = await DanielToken();
        var x = ExcursionRules.ById("coz-glass")!;
        var before = Tour((await Read("last-minute", token)).Json, "coz-glass").GetProperty("left").GetInt32();
        var v = (await Post("last-minute/coz-glass", token, new { guests = new[] { Daniel.PublicId, Maya.PublicId } })).Json;
        Assert.Equal(("booked", before - 2), (Tour(v, "coz-glass").GetProperty("closed").GetString(), Tour(v, "coz-glass").GetProperty("left").GetInt32()));
        var total = ExcursionRules.GuestPrice(x, 45) + ExcursionRules.GuestPrice(x, 8);
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Glass-bottom boat and town (booked on board)" && l.GetProperty("cents").GetInt64() == total && l.GetProperty("category").GetString() == "excursions");
        var tour = Assert.Single(F.Plan.Tours);
        Assert.Equal((10, 3, "coz-glass", 2), (tour.BookingId, tour.Row.Day, tour.Row.ExcursionId, tour.Row.GuestIds.Count));
        Is(HttpStatusCode.Conflict, "duplicate", await Post("last-minute/coz-glass", token, new { guests = new[] { Priya.PublicId } }));
    }

    [Fact]
    public async Task ALastMinuteBookingIsCheckedForTheTourTheGuestsAndAnAdult()
    {
        SetNow(CozumelMorning);
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "badTour", await Post("last-minute/nowhere", token, new { guests = new[] { Daniel.PublicId } }));
        Is(HttpStatusCode.BadRequest, "guests", await Post("last-minute/coz-glass", token, new { guests = Array.Empty<Guid>() }));
        Is(HttpStatusCode.BadRequest, "guests", await Post("last-minute/coz-glass", token, new { guests = new[] { Stranger.PublicId } }));
        Is(HttpStatusCode.Conflict, "age", await Post("last-minute/coz-glass", token, new { guests = new[] { Maya.PublicId } }));          // a child cannot go alone
        Is(HttpStatusCode.Conflict, "closed", await Post("last-minute/bze-walk", token, new { guests = new[] { Daniel.PublicId } }));       // not a Cozumel tour
        Is(HttpStatusCode.Conflict, "tooLate", await Post("last-minute/coz-snorkel", token, new { guests = new[] { Daniel.PublicId } }));
    }

    // ---- Readiness ----

    [Fact]
    public async Task ThePortReadyListIsTickedPerDayAndResetsTomorrow()
    {
        var token = await DanielToken();
        Assert.Empty((await Read("ready", token)).Json.EnumerateArray());
        Assert.Equal(["card", "sun"], (await Put("ready/sun", token, new { on = true })).Json.EnumerateArray().Concat((await Put("ready/card", token, new { on = true })).Json.EnumerateArray()).Select(x => x.GetString()!).Distinct().Order().ToArray());
        Assert.Equal(["card"], (await Put("ready/sun", token, new { on = false })).Json.EnumerateArray().Select(x => x.GetString()!).ToArray());
        Assert.Equal(["card"], (await Read("ready", await SignIn(Priya))).Json.EnumerateArray().Select(x => x.GetString()!).ToArray());      // shared with the booking
        Is(HttpStatusCode.BadRequest, "badItem", await Put("ready/lunch", token, new { on = true }));
        SetNow(SeaDay.AddDays(1));
        Assert.Empty((await Read("ready", token)).Json.EnumerateArray());
    }

    // ---- Chat ----

    private const string Chat = "/api/v1/me/chat";

    private Task<Reply> ChatGet(string path, string token) => Get($"{Chat}/{path}", token);
    private Task<Reply> ChatPost(string path, string token, object? body = null) => Call(HttpMethod.Post, $"{Chat}/{path}", token, body);
    private Task<Reply> ChatPut(string path, string token, object? body) => Call(HttpMethod.Put, $"{Chat}/{path}", token, body);

    private static string Msgs(InMemoryChatStore.Conversation c) => $"conversations/{c.PublicId}/messages";

    private async Task<string> Say(InMemoryChatStore.Conversation c, UserRecord who, string text, int minutes = 0)
    {
        SetNow(SeaDay.AddMinutes(minutes));
        return (await ChatPost(Msgs(c), await SignIn(who), new { text })).Json.GetProperty("id").GetString()!;
    }

    private async Task<string[]> Texts(InMemoryChatStore.Conversation c, string token) =>
        [.. (await ChatGet(Msgs(c), token)).Json.GetProperty("messages").EnumerateArray().Select(m => m.GetProperty("text").GetString()!)];

    [Fact]
    public async Task PeopleInAGroupSeeEachOthersMessagesInOrderAndOthersSeeNothing()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id, Paul.Id);
        var alone = F.Chat.Group(Stranger.Id);
        await Say(party, Daniel, "Meet at the pool", 0);
        await Say(party, Priya, "On my way", 2);
        await Say(alone, Stranger, "Anyone here?", 3);
        var seen = (await ChatGet(Msgs(party), await SignIn(Paul))).Json.GetProperty("messages");
        Assert.Equal(["Meet at the pool", "On my way"], seen.EnumerateArray().Select(m => m.GetProperty("text").GetString()!).ToArray());
        Assert.Equal([Daniel.PublicId.ToString(), Priya.PublicId.ToString()], seen.EnumerateArray().Select(m => m.GetProperty("from").GetString()!).ToArray());
        Assert.Equal(["Daniel U.", "Priya U."], seen.EnumerateArray().Select(m => m.GetProperty("fromName").GetString()!).ToArray());
        Assert.Equal(["Anyone here?"], await Texts(alone, await SignIn(Stranger)));
        Assert.False(seen[0].TryGetProperty("photo", out _));
        Assert.False(seen[0].TryGetProperty("seenBy", out _));
    }

    [Fact]
    public async Task AMemberOfOneConversationCannotReadSendCountMuteOrReportInAnother()
    {
        var mine = F.Chat.Direct(Daniel.Id, Priya.Id);
        var theirs = F.Chat.Direct(Paul.Id, Stranger.Id);
        var theirMessage = await Say(theirs, Paul, "Private", 0);
        var daniel = await DanielToken();
        Assert.Equal(HttpStatusCode.NotFound, (await ChatGet(Msgs(theirs), daniel)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost(Msgs(theirs), daniel, new { text = "Hello?" })).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost($"conversations/{theirs.PublicId}/read", daniel)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPut($"conversations/{theirs.PublicId}/mute", daniel, new { on = true })).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost($"conversations/{theirs.PublicId}/photos", daniel, Photo())).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost("reports", daniel, new { messageId = theirMessage, reason = "rude" })).Status);
        var list = (await ChatGet("conversations", daniel)).Json.EnumerateArray().Select(c => c.GetProperty("id").GetString()).ToArray();
        Assert.Contains(mine.PublicId.ToString(), list);
        Assert.DoesNotContain(theirs.PublicId.ToString(), list);
        Assert.Equal(1, (await ChatGet("summary", daniel)).Json.GetProperty("unread").GetInt32());   // only Stanley's welcome: nothing from the other conversation leaks in
        Assert.DoesNotContain(F.Chat.Messages, m => m.GroupId == mine.Id);
    }

    [Fact]
    public async Task EachConversationHasItsOwnHistoryAndUnreadCountThatClearsWhenRead()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id);
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        await Say(party, Priya, "Party one", 0);
        await Say(direct, Priya, "Direct one", 1);
        await Say(direct, Priya, "Direct two", 2);
        var daniel = await DanielToken();
        var list = (await ChatGet("conversations", daniel)).Json.EnumerateArray().ToDictionary(c => c.GetProperty("id").GetString()!);
        Assert.Equal(1, list[party.PublicId.ToString()].GetProperty("unread").GetInt32());
        Assert.Equal(2, list[direct.PublicId.ToString()].GetProperty("unread").GetInt32());
        Assert.Equal("Direct two", list[direct.PublicId.ToString()].GetProperty("last").GetProperty("text").GetString());
        Assert.Equal(4, (await ChatGet("summary", daniel)).Json.GetProperty("unread").GetInt32());   // the group, the direct chat and Stanley's welcome
        Assert.Equal(["Direct one", "Direct two"], await Texts(direct, daniel));
        Assert.Equal(HttpStatusCode.NoContent, (await ChatPost($"conversations/{direct.PublicId}/read", daniel)).Status);
        Assert.Equal(2, (await ChatGet("summary", daniel)).Json.GetProperty("unread").GetInt32());
        Assert.Equal(0, (await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString()).GetProperty("unread").GetInt32());
    }

    [Fact]
    public async Task APersonOnlyReadsWhatWasSentWhileTheyWereAMemberOfADirectOrGuestChat()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        await Say(direct, Priya, "Before", 0);
        direct.Members.First(m => m.UserId == Daniel.Id).JoinedAt = SeaDay.AddMinutes(5);
        await Say(direct, Priya, "After", 10);
        Assert.Equal(["After"], await Texts(direct, await DanielToken()));
    }

    [Fact]
    public async Task ThreadsComeInPagesOfThirtyWithOlderOnesFetchedBeforeTheOldestShown()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        for (var i = 1; i <= 45; i++) await Say(direct, Priya, $"m{i}", i);
        var daniel = await DanielToken();
        var first = (await ChatGet(Msgs(direct), daniel)).Json;
        Assert.True(first.GetProperty("hasMore").GetBoolean());
        var page = first.GetProperty("messages");
        Assert.Equal(30, page.GetArrayLength());
        Assert.Equal(("m16", "m45"), (page[0].GetProperty("text").GetString(), page[29].GetProperty("text").GetString()));
        var older = (await ChatGet($"{Msgs(direct)}?before={page[0].GetProperty("id").GetString()}", daniel)).Json;
        Assert.False(older.GetProperty("hasMore").GetBoolean());
        Assert.Equal(15, older.GetProperty("messages").GetArrayLength());
        Assert.Equal("m15", older.GetProperty("messages")[14].GetProperty("text").GetString());
    }

    [Fact]
    public async Task AMessageThatFailsTheWordFilterIsNotSentOrStoredAndTheSenderIsTold()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        Is(HttpStatusCode.BadRequest, "blocked", await ChatPost(Msgs(direct), await DanielToken(), new { text = "you are a fucking idiot" }));
        Assert.Empty(F.Chat.Messages);
        Assert.Equal(HttpStatusCode.OK, (await ChatPost(Msgs(direct), await DanielToken(), new { text = "Class starts at ten" })).Status);
    }

    [Fact]
    public async Task ARetriedMessageWithTheSameClientIdIsStoredOnce()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        var daniel = await DanielToken();
        var clientId = Guid.NewGuid();
        var one = (await ChatPost(Msgs(direct), daniel, new { text = "Hello", clientId })).Json.GetProperty("id").GetString();
        var two = (await ChatPost(Msgs(direct), daniel, new { text = "Hello", clientId })).Json.GetProperty("id").GetString();
        Assert.Equal(one, two);
        Assert.Single(F.Chat.Messages);
    }

    [Fact]
    public async Task AnEndedDirectChatStaysReadableButClosesSending()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        await Say(direct, Priya, "Bye", 0);
        direct.DirectEnded = true;
        var daniel = await DanielToken();
        Is(HttpStatusCode.Conflict, "closed", await ChatPost(Msgs(direct), daniel, new { text = "Wait" }));
        Assert.Equal(["Bye"], await Texts(direct, daniel));
        Assert.True((await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString()).GetProperty("closed").GetBoolean());
    }

    private static JsonElement Message(JsonElement thread, string id) => thread.GetProperty("messages").EnumerateArray().First(m => m.GetProperty("id").GetString() == id);

    [Fact]
    public async Task AReactionIsOnePerPersonAndThePickedOneAgainTakesItAway()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Priya, "Dinner at eight?", 0);
        var daniel = await DanielToken();
        var react = (string emoji) => ChatPost($"conversations/{group.PublicId}/messages/{said}/react", daniel, new { emoji });
        var first = (await react("👍")).Json.EnumerateArray().Single();
        Assert.Equal((1, true), (first.GetProperty("count").GetInt32(), first.GetProperty("mine").GetBoolean()));
        var replaced = (await react("❤️")).Json.EnumerateArray().Single();
        Assert.Equal("❤️", replaced.GetProperty("emoji").GetString());   // one per person: the new one replaced the old
        var seenByPriya = Message((await ChatGet(Msgs(group), await SignIn(Priya))).Json, said).GetProperty("reactions").EnumerateArray().Single();
        Assert.Equal(["Daniel U."], seenByPriya.GetProperty("names").EnumerateArray().Select(n => n.GetString()!).ToArray());
        Assert.False(seenByPriya.GetProperty("mine").GetBoolean());
        Assert.Empty((await react("❤️")).Json.EnumerateArray());   // the same one again clears it
        Assert.False(Message((await ChatGet(Msgs(group), daniel)).Json, said).TryGetProperty("reactions", out _));
        Is(HttpStatusCode.BadRequest, "emoji", await react("🔥"));
    }

    [Fact]
    public async Task AReactionOrAReplyNeverReachesAMessageOfAConversationTheCallerIsNotIn()
    {
        var mine = F.Chat.Direct(Daniel.Id, Priya.Id);
        var theirs = F.Chat.Direct(Paul.Id, Stranger.Id);
        var theirMessage = await Say(theirs, Paul, "Private", 0);
        var daniel = await DanielToken();
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost($"conversations/{theirs.PublicId}/messages/{theirMessage}/react", daniel, new { emoji = "👍" })).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost($"conversations/{theirs.PublicId}/delivered", daniel)).Status);
        // Naming their message from my own conversation is refused as if it did not exist, and nothing is stored.
        Is(HttpStatusCode.BadRequest, "replyTo", await ChatPost(Msgs(mine), daniel, new { text = "Hi", replyTo = theirMessage }));
        Assert.DoesNotContain(F.Chat.Messages, m => m.GroupId == mine.Id);
        Assert.Empty(F.Chat.ReactionsBy);
        // And a member cannot react to a message of their own conversation that is not a person's (a line about the group).
        F.Chat.Messages.Add(new InMemoryChatStore.Stored(mine.Id, new ChatMessageRow { Id = 9001, PublicId = Guid.NewGuid(), FromUserId = Priya.Id, Text = "Priya joined", IsSystem = true, At = SeaDay }, null));
        var line = F.Chat.Messages.Last().Row.PublicId;
        Is(HttpStatusCode.BadRequest, "notMessage", await ChatPost($"conversations/{mine.PublicId}/messages/{line}/react", daniel, new { emoji = "👍" }));
    }

    [Fact]
    public async Task SettingAReactionIsIdempotentSoAQueuedTapCanBeReplayed()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Priya, "Dinner at eight?", 0);
        var daniel = await DanielToken();
        var set = (object? emoji) => ChatPut($"conversations/{group.PublicId}/messages/{said}/reaction", daniel, new { emoji });
        Assert.Equal("👍", (await set("👍")).Json.EnumerateArray().Single().GetProperty("emoji").GetString());
        Assert.Equal("👍", (await set("👍")).Json.EnumerateArray().Single().GetProperty("emoji").GetString());   // a replay keeps it; the toggle would have cleared it
        Assert.Equal("❤️", (await set("❤️")).Json.EnumerateArray().Single().GetProperty("emoji").GetString());
        Assert.Empty((await set(null)).Json.EnumerateArray());
        Assert.Empty((await set(null)).Json.EnumerateArray());   // clearing twice is fine
        Is(HttpStatusCode.BadRequest, "emoji", await set("🔥"));
    }

    [Fact]
    public async Task ADeviceThatAnsweredTheLiveNudgeIsRecordedAsHavingTheMessageOnlyOnce()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Anyone for cards?", 0);
        var id = F.Chat.Messages.Single(m => m.Row.PublicId.ToString() == said).Row.PublicId;
        Assert.True(await F.Chat.AddDeliveryAsync(id, Priya.Id, SeaDay, CancellationToken.None));
        Assert.False(await F.Chat.AddDeliveryAsync(id, Priya.Id, SeaDay, CancellationToken.None));   // a repeat tells the sender nothing more
        Assert.False(await F.Chat.AddDeliveryAsync(id, Daniel.Id, SeaDay, CancellationToken.None));   // never one's own message
        Assert.Single(F.Chat.MessageDeliveries);
    }

    [Fact]
    public async Task AReactionIsRefusedOnAnEndedDirectChat()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        var said = await Say(direct, Priya, "Bye", 0);
        direct.DirectEnded = true;
        Is(HttpStatusCode.Conflict, "closed", await ChatPost($"conversations/{direct.PublicId}/messages/{said}/react", await DanielToken(), new { emoji = "👍" }));
    }

    [Fact]
    public async Task AReplyCarriesAQuoteAndShowsMessageRemovedWhenTheOriginalIsOutOfTheReadersWindow()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        var original = await Say(direct, Priya, "Meet at the pool at three", 0);
        SetNow(SeaDay.AddMinutes(1));
        var sent = (await ChatPost(Msgs(direct), await DanielToken(), new { text = "On my way", replyTo = original })).Json;
        var quote = sent.GetProperty("replyTo");
        Assert.Equal((original, "Meet at the pool at three", "Priya U."), (quote.GetProperty("id").GetString(), quote.GetProperty("text").GetString(), quote.GetProperty("fromName").GetString()));
        var priya = await SignIn(Priya);
        Assert.True(Message((await ChatGet(Msgs(direct), priya)).Json, sent.GetProperty("id").GetString()!).GetProperty("replyTo").GetProperty("mine").GetBoolean());
        // Priya's window moves past her own original (say she re-joined): she can no longer open it, so the quote does not reveal it.
        direct.Members.First(m => m.UserId == Priya.Id).JoinedAt = SeaDay.AddMinutes(1);
        var removed = Message((await ChatGet(Msgs(direct), priya)).Json, sent.GetProperty("id").GetString()!).GetProperty("replyTo");
        Assert.Equal(("Message removed", true), (removed.GetProperty("text").GetString(), removed.GetProperty("removed").GetBoolean()));
        Assert.False(removed.TryGetProperty("id", out _));
    }

    [Fact]
    public async Task DeliveredShowsOnlyWhenBothSidesHaveReceiptsOnAndTheAckIsIdempotent()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Anyone for cards?", 0);
        var daniel = await DanielToken();
        var priya = await SignIn(Priya);
        Assert.Equal(HttpStatusCode.NoContent, (await ChatPost($"conversations/{group.PublicId}/delivered", priya)).Status);
        Assert.False(Message((await ChatGet(Msgs(group), daniel)).Json, said).TryGetProperty("delivered", out _));   // receipts are off on both sides
        await ChatPut("receipts", daniel, new { on = true });
        Assert.False(Message((await ChatGet(Msgs(group), daniel)).Json, said).TryGetProperty("delivered", out _));   // only the sender has them on
        await ChatPut("receipts", priya, new { on = true });
        Assert.True(Message((await ChatGet(Msgs(group), daniel)).Json, said).GetProperty("delivered").GetBoolean());
        Assert.Equal(HttpStatusCode.NoContent, (await ChatPost($"conversations/{group.PublicId}/delivered", priya)).Status);   // a repeat changes nothing
        Assert.Single(F.Chat.MessageDeliveries);
        // The sender's own device does not mark their own message delivered.
        await ChatPost($"conversations/{group.PublicId}/delivered", daniel);
        Assert.Single(F.Chat.MessageDeliveries);
    }

    [Fact]
    public async Task TheThreadNamesTheFirstUnreadMessageFromSomeoneElse()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        await Say(group, Priya, "Old", 0);
        var daniel = await DanielToken();
        await ChatPost($"conversations/{group.PublicId}/read", daniel);
        var first = await Say(group, Priya, "New one", 1);
        await Say(group, Priya, "New two", 2);
        Assert.Equal(first, (await ChatGet(Msgs(group), daniel)).Json.GetProperty("firstUnread").GetString());
        await ChatPost($"conversations/{group.PublicId}/read", daniel);
        Assert.False((await ChatGet(Msgs(group), daniel)).Json.TryGetProperty("firstUnread", out _));
    }

    [Fact]
    public async Task AConversationCanBeMutedAndTheListSaysSo()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        var daniel = await DanielToken();
        Assert.True((await ChatPut($"conversations/{direct.PublicId}/mute", daniel, new { on = true })).Json.GetBoolean());
        Assert.True((await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString()).GetProperty("muted").GetBoolean());
        Assert.False((await ChatPut($"conversations/{direct.PublicId}/mute", daniel, new { on = false })).Json.GetBoolean());
    }

    [Fact]
    public async Task AMessageNeedsTextAndAChildCannotPassOnANumberOrALink()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id);
        var token = await DanielToken();
        Is(HttpStatusCode.BadRequest, "text", await ChatPost(Msgs(party), token, new { text = "   " }));
        Is(HttpStatusCode.BadRequest, "text", await ChatPost(Msgs(party), token, new { text = new string('x', 2001) }));
        Assert.Equal(HttpStatusCode.OK, (await ChatPost(Msgs(party), token, new { text = "Call me on 555 123 4567" })).Status);       // an adult may
        var maya = MayaToken();
        var kids = F.Chat.Group(Maya.Id, Priya.Id);
        Is(HttpStatusCode.BadRequest, "contactInfo", await ChatPost(Msgs(kids), maya, new { text = "Call me on 555 123 4567" }));
        Is(HttpStatusCode.BadRequest, "contactInfo", await ChatPost(Msgs(kids), maya, new { text = "look at https://example.com" }));
        Assert.Equal(HttpStatusCode.OK, (await ChatPost(Msgs(kids), maya, new { text = "See you at seven" })).Status);
    }

    [Fact]
    public async Task TheConversationListMakesMyGroupForSomeoneWithNone()
    {
        var list = (await ChatGet("conversations", await SignIn(Stranger))).Json;
        Assert.Equal(2, list.GetArrayLength());
        Assert.Equal(("stanley", "Stanley"), (list[0].GetProperty("kind").GetString(), list[0].GetProperty("name").GetString()));   // always first
        Assert.Equal(("party", "My group"), (list[1].GetProperty("kind").GetString(), list[1].GetProperty("name").GetString()));
    }

    [Fact]
    public async Task EveryoneHasAPermanentStanleyChatFirstInTheListWithAWelcome()
    {
        var token = await SignIn(Stranger);
        var list = (await ChatGet("conversations", token)).Json;
        var stanley = list[0];
        Assert.Equal(("stanley", "Stanley", true), (stanley.GetProperty("kind").GetString(), stanley.GetProperty("name").GetString(), stanley.GetProperty("permanent").GetBoolean()));
        Assert.Equal("company", stanley.GetProperty("voice").GetString());
        Assert.Equal("Princess Cruises", stanley.GetProperty("subtitle").GetString());
        Assert.Equal(1, stanley.GetProperty("unread").GetInt32());
        var thread = (await ChatGet($"conversations/{stanley.GetProperty("id").GetString()}/messages", token)).Json;
        var welcome = thread.GetProperty("messages")[0];
        Assert.True(welcome.GetProperty("stanley").GetBoolean());
        Assert.Equal("Princess Cruises", welcome.GetProperty("subtitle").GetString());
        Assert.Contains("cannot be removed", welcome.GetProperty("text").GetString());
    }

    [Fact]
    public async Task ReadingTheListTwiceStillLeavesOneStanleyChatAndOneWelcome()
    {
        var token = await SignIn(Stranger);
        await ChatGet("conversations", token);
        await ChatGet("conversations", token);
        Assert.Single(F.Chat.Conversations, c => c.Kind == "stanley");
        Assert.Single(F.Chat.Messages, m => m.Row.FromUserId == 0);
    }

    [Fact]
    public async Task TheStanleyChatCannotBeMutedPostedIntoOrGivenAnAwayNoticeAndNobodyElseCanOpenIt()
    {
        var token = await SignIn(Stranger);
        var id = (await ChatGet("conversations", token)).Json[0].GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.Forbidden, (await ChatPut($"conversations/{id}/mute", token, new { on = true })).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await ChatPut($"conversations/{id}/notify-away", token, new { on = true })).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await ChatPost($"conversations/{id}/messages", token, new { text = "Hi Stanley" })).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await ChatPost($"conversations/{id}/photos", token, Photo())).Status);
        Assert.DoesNotContain(F.Chat.Conversations.First(c => c.Kind == "stanley").Members, m => m.Muted);
        // Someone else gets the same 404 as for a conversation that does not exist.
        Assert.Equal(HttpStatusCode.NotFound, (await ChatGet($"conversations/{id}/messages", await DanielToken())).Status);
    }

    [Fact]
    public async Task TheStanleyChatIsNotAPersonSoItIsNotInPeopleAndIsNotCountedAsAConnection()
    {
        var token = await SignIn(Stranger);
        await ChatGet("conversations", token);
        Assert.Empty((await ChatGet("blocks", token)).Json.EnumerateArray());
        Assert.Equal(0, (await ChatGet("connections", token)).Json.GetProperty("connected").GetArrayLength());
    }

    [Fact]
    public async Task ReadReceiptsShowOnlyWhenBothTheSenderAndTheReaderHaveThemOn()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id, Paul.Id);
        var daniel = await DanielToken();
        var priya = await SignIn(Priya);
        var paul = await SignIn(Paul);
        Assert.False((await ChatGet("receipts", daniel)).Json.GetBoolean());
        await Say(party, Daniel, "Dinner at seven?", 0);
        await ChatPost($"conversations/{party.PublicId}/read", priya);                                       // receipts off: nothing recorded
        Assert.False((await ChatGet(Msgs(party), daniel)).Json.GetProperty("messages")[0].TryGetProperty("seenBy", out _));

        Assert.True((await ChatPut("receipts", daniel, new { on = true })).Json.GetBoolean());
        Assert.True((await ChatPut("receipts", priya, new { on = true })).Json.GetBoolean());
        await ChatPost($"conversations/{party.PublicId}/read", priya);
        await ChatPost($"conversations/{party.PublicId}/read", paul);                                        // Paul has them off
        var first = (await ChatGet(Msgs(party), daniel)).Json.GetProperty("messages")[0];
        Assert.Equal([Priya.PublicId.ToString()], first.GetProperty("seenBy").EnumerateArray().Select(x => x.GetString()!).ToArray());
        await ChatPut("receipts", daniel, new { on = false });                                              // the sender turns them off: nobody is shown
        Assert.False((await ChatGet(Msgs(party), daniel)).Json.GetProperty("messages")[0].TryGetProperty("seenBy", out _));
    }

    [Fact]
    public async Task ABlockedPersonsMessagesAreHiddenFromTheBlockerOnly()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id, Paul.Id);
        await Say(party, Paul, "Hello all", 0);
        await Say(party, Priya, "Hi Paul", 1);
        var daniel = await DanielToken();
        Assert.Empty((await ChatGet("blocks", daniel)).Json.EnumerateArray());
        Assert.Equal([Paul.PublicId.ToString()], (await ChatPut($"blocks/{Paul.PublicId}", daniel, new { on = true })).Json.EnumerateArray().Select(x => x.GetString()!).ToArray());
        Assert.Equal(["Hi Paul"], await Texts(party, daniel));
        Assert.Equal(2, (await Texts(party, await SignIn(Priya))).Length);
        Assert.Empty((await ChatPut($"blocks/{Paul.PublicId}", daniel, new { on = false })).Json.EnumerateArray());
        Assert.Equal(2, (await Texts(party, daniel)).Length);
        Is(HttpStatusCode.BadRequest, "notInChat", await ChatPut($"blocks/{Stranger.PublicId}", daniel, new { on = true }));
    }

    [Fact]
    public async Task AMessageCanBeReportedOnlyByThoseWhoCanSeeItForAKnownReason()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id);
        var id = await Say(party, Priya, "Something rude", 0);
        var daniel = await DanielToken();
        Assert.Equal(HttpStatusCode.NoContent, (await ChatPost("reports", daniel, new { messageId = id, reason = "rude" })).Status);
        Assert.Equal((Daniel.Id, "rude"), (F.Chat.Reports[0].UserId, F.Chat.Reports[0].Reason));
        Is(HttpStatusCode.BadRequest, "badReason", await ChatPost("reports", daniel, new { messageId = id, reason = "boring" }));
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost("reports", await SignIn(Stranger), new { messageId = id, reason = "rude" })).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ChatPost("reports", daniel, new { messageId = Guid.NewGuid(), reason = "rude" })).Status);
    }

    private static object Photo(string type = "image/png", long bytes = 500, string caption = "The sunset") => new { type, bytes, dataUrl = $"data:{type};base64,AAAA", caption };

    [Fact]
    public async Task AnAdultCanSendAPhotoWithACaptionAndItAppearsInTheChat()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id);
        var daniel = await DanielToken();
        SetNow(SeaDay);
        Assert.Equal(HttpStatusCode.OK, (await ChatPost($"conversations/{party.PublicId}/photos", daniel, Photo(caption: " The sunset "))).Status);
        var priya = await SignIn(Priya);
        var m = (await ChatGet(Msgs(party), priya)).Json.GetProperty("messages")[0];
        // A thread page says there is a photo; the photo itself is fetched once, by message.
        Assert.Equal(("The sunset", true, false), (m.GetProperty("text").GetString(), m.GetProperty("hasPhoto").GetBoolean(), m.TryGetProperty("photo", out _)));
        var photo = await ChatGet($"conversations/{party.PublicId}/messages/{m.GetProperty("id").GetString()}/photo", priya);
        Assert.Equal("data:image/png;base64,AAAA", photo.Json.GetProperty("photo").GetString());
    }

    [Fact]
    public async Task APhotoIsCheckedForTypeSizeAgeAndTheDataUrl()
    {
        var party = F.Chat.Group(Daniel.Id, Priya.Id, Maya.Id);
        var photos = $"conversations/{party.PublicId}/photos";
        var daniel = await DanielToken();
        Is(HttpStatusCode.BadRequest, "type", await ChatPost(photos, daniel, Photo(type: "image/gif")));
        Is(HttpStatusCode.BadRequest, "empty", await ChatPost(photos, daniel, Photo(bytes: 0)));
        Is(HttpStatusCode.BadRequest, "size", await ChatPost(photos, daniel, Photo(bytes: 1_000_001)));
        Is(HttpStatusCode.BadRequest, "size", await ChatPost(photos, daniel, new { type = "image/png", bytes = 500, dataUrl = "data:image/jpeg;base64,AAAA", caption = "" }));
        Is(HttpStatusCode.BadRequest, "size", await ChatPost(photos, daniel, new { type = "image/png", bytes = 500, dataUrl = "data:image/png;base64," + new string('A', 1_400_000), caption = "" }));
        Is(HttpStatusCode.Forbidden, "age", await ChatPost(photos, MayaToken(), Photo()));
    }

    // ---- Account lines are one source each ----

    [Fact]
    public async Task EveryChargeIsOnTheAccountExactlyOnce()
    {
        SetNow(CozumelMorning);
        var token = await DanielToken();
        await Post("selections", token, new { item = "shop-tote", day = 0, time = "", qty = 1 });
        await Post("money/top-ups", token, new { dollars = 50, source = "card" });
        await Post("last-minute/coz-glass", token, new { guests = new[] { Daniel.PublicId } });
        var lines = (await FolioLines(token)).Select(l => l.GetProperty("description").GetString()).ToList();
        Assert.Single(lines, "Sun Princess tote bag");
        Assert.Single(lines, "Top-up by card");
        Assert.Single(lines, "Glass-bottom boat and town (booked on board)");
    }

    // ---- Chat phase 2: control and safety ----

    private Task<Reply> ChatPatch(string path, string token, object? body) => Call(HttpMethod.Patch, $"{Chat}/{path}", token, body);
    private Task<Reply> ChatDelete(string path, string token) => Call(HttpMethod.Delete, $"{Chat}/{path}", token, null);
    private static string One(InMemoryChatStore.Conversation c, string id) => $"conversations/{c.PublicId}/messages/{id}";

    [Fact]
    public async Task AnEditInsideTheWindowReplacesTheTextForEveryoneAndIsLabelledEdited()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Dinner at eihgt?", 0);
        SetNow(SeaDay.AddMinutes(14).AddSeconds(59));
        var daniel = await DanielToken();
        Assert.True((await ChatPatch(One(group, said), daniel, new { text = "Dinner at eight?" })).Json.GetProperty("edited").GetBoolean());
        var seen = Message((await ChatGet(Msgs(group), await SignIn(Priya))).Json, said);
        Assert.Equal(("Dinner at eight?", true), (seen.GetProperty("text").GetString(), seen.GetProperty("edited").GetBoolean()));
        Assert.Equal("Dinner at eihgt?", F.Chat.Messages.Single(m => m.Row.PublicId.ToString() == said).Row.OriginalText);   // the first words are kept for a report
    }

    [Fact]
    public async Task AnEditOrDeleteAfterFifteenMinutesIsRefusedAndOnlyTheSenderMayChange()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Hello", 0);
        var daniel = await DanielToken();
        var priya = await SignIn(Priya);
        Is(HttpStatusCode.Forbidden, "notYours", await ChatPatch(One(group, said), priya, new { text = "Hijacked" }));
        Is(HttpStatusCode.Forbidden, "notYours", await ChatDelete(One(group, said), priya));
        SetNow(SeaDay.AddMinutes(15).AddSeconds(1));
        Is(HttpStatusCode.Conflict, "tooLate", await ChatPatch(One(group, said), daniel, new { text = "Too late" }));
        Is(HttpStatusCode.Conflict, "tooLate", await ChatDelete(One(group, said), daniel));
        Assert.Equal(["Hello"], await Texts(group, priya));
    }

    [Fact]
    public async Task AnEditIsCheckedLikeASendAndSavingTheSameWordsIsNotAnEdit()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Hello there", 0);
        var daniel = await DanielToken();
        Is(HttpStatusCode.BadRequest, "text", await ChatPatch(One(group, said), daniel, new { text = "   " }));
        Assert.False((await ChatPatch(One(group, said), daniel, new { text = "Hello there" })).Json.TryGetProperty("edited", out _));
        Assert.False(Message((await ChatGet(Msgs(group), daniel)).Json, said).TryGetProperty("edited", out _));
    }

    [Fact]
    public async Task ADeletedMessageIsGoneForEveryoneItsQuoteSaysRemovedAndStaffKeepTheOriginal()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Wrong chat, sorry", 0);
        var priya = await SignIn(Priya);
        var answer = (await ChatPost(Msgs(group), priya, new { text = "Ha", replyTo = said })).Json.GetProperty("id").GetString()!;
        var daniel = await DanielToken();
        Assert.Equal(HttpStatusCode.NoContent, (await ChatDelete(One(group, said), daniel)).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await ChatDelete(One(group, said), daniel)).Status);   // repeating changes nothing
        var thread = (await ChatGet(Msgs(group), priya)).Json;
        var gone = Message(thread, said);
        Assert.Equal(("", true), (gone.GetProperty("text").GetString(), gone.GetProperty("deleted").GetBoolean()));
        Assert.True(Message(thread, answer).GetProperty("replyTo").GetProperty("removed").GetBoolean());
        Is(HttpStatusCode.BadRequest, "notMessage", await ChatPost($"{One(group, said)}/react", priya, new { emoji = "👍" }));
        Is(HttpStatusCode.BadRequest, "replyTo", await ChatPost(Msgs(group), priya, new { text = "Still there?", replyTo = said }));
        Is(HttpStatusCode.Conflict, "deleted", await ChatPatch(One(group, said), daniel, new { text = "Back again" }));
        Assert.Equal("Wrong chat, sorry", F.Chat.Messages.Single(m => m.Row.PublicId.ToString() == said).Row.OriginalText);
    }

    [Fact]
    public async Task ADeletedLastMessageShowsAsDeletedInTheListWithNoPhotoOrText()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var said = await Say(group, Daniel, "Oops", 0);
        await ChatDelete(One(group, said), await DanielToken());
        var last = (await ChatGet("conversations", await SignIn(Priya))).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == group.PublicId.ToString()).GetProperty("last");
        Assert.Equal("Message deleted", last.GetProperty("text").GetString());
        Assert.False(last.GetProperty("photo").GetBoolean());
    }

    [Fact]
    public async Task ATimedMuteEndsByItselfAndArchivingComesBackWithANewMessage()
    {
        var direct = F.Chat.Direct(Daniel.Id, Priya.Id);
        var daniel = await DanielToken();
        Is(HttpStatusCode.BadRequest, "for", await ChatPut($"conversations/{direct.PublicId}/mute", daniel, new { on = true, @for = "fortnight" }));
        await ChatPut($"conversations/{direct.PublicId}/mute", daniel, new { on = true, @for = "hour" });
        var row = () => F.Chat.Conversations.First(c => c.PublicId == direct.PublicId).Members.First(m => m.UserId == Daniel.Id);
        var listed = (await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString());
        Assert.True(listed.GetProperty("muted").GetBoolean());
        Assert.True(listed.GetProperty("mutedUntil").GetInt64() > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        row().MutedUntil = DateTime.UtcNow.AddMinutes(-1);   // the hour is over
        listed = (await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString());
        Assert.False(listed.GetProperty("muted").GetBoolean());
        Assert.False(listed.TryGetProperty("mutedUntil", out _));

        Assert.True((await ChatPut($"conversations/{direct.PublicId}/archive", daniel, new { on = true })).Json.GetBoolean());
        Assert.True((await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString()).GetProperty("archived").GetBoolean());
        await Say(direct, Priya, "Ping", 1);
        Assert.False((await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("id").GetString() == direct.PublicId.ToString()).TryGetProperty("archived", out _));
        var stanley = (await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("kind").GetString() == "stanley").GetProperty("id").GetString();
        Is(HttpStatusCode.Forbidden, "stanley", await ChatPut($"conversations/{stanley}/archive", daniel, new { on = true }));
    }

    [Fact]
    public async Task TypingIsNeverStoredIsOffWhenEitherSideTurnsItOffAndTheStanleyChatHasNone()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var daniel = await DanielToken();
        var priya = await SignIn(Priya);
        Assert.Equal(HttpStatusCode.NoContent, (await ChatPost($"conversations/{group.PublicId}/typing", priya)).Status);
        Assert.Equal(["Priya U."], (await ChatGet($"conversations/{group.PublicId}/typing", daniel)).Json.EnumerateArray().Select(n => n.GetString()!).ToArray());
        Assert.Empty((await ChatGet($"conversations/{group.PublicId}/typing", priya)).Json.EnumerateArray());            // not your own
        F.Chat.TypingOff.Add(Daniel.Id);
        Assert.Empty((await ChatGet($"conversations/{group.PublicId}/typing", daniel)).Json.EnumerateArray());           // off means you see no one
        F.Chat.TypingOff.Remove(Daniel.Id);
        await ChatPost(Msgs(group), priya, new { text = "Done typing" });
        Assert.Empty((await ChatGet($"conversations/{group.PublicId}/typing", daniel)).Json.EnumerateArray());           // sending ends it
        var stanley = (await ChatGet("conversations", daniel)).Json.EnumerateArray().First(c => c.GetProperty("kind").GetString() == "stanley").GetProperty("id").GetString();
        Is(HttpStatusCode.Forbidden, "stanley", await ChatPost($"conversations/{stanley}/typing", daniel));
    }

    [Fact]
    public async Task TooManyMessagesInAMinuteAreRefusedAndANewMinuteStartsFresh()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id);
        var daniel = await DanielToken();
        SetNow(SeaDay);
        for (var i = 0; i < 20; i++) Assert.Equal(HttpStatusCode.OK, (await ChatPost(Msgs(group), daniel, new { text = $"m{i}" })).Status);
        Is(HttpStatusCode.TooManyRequests, "rate", await ChatPost(Msgs(group), daniel, new { text = "one too many" }));
        SetNow(SeaDay.AddMinutes(2));
        Assert.Equal(HttpStatusCode.OK, (await ChatPost(Msgs(group), daniel, new { text = "later" })).Status);
    }

    [Fact]
    public async Task ReportingAPersonFromTheHeaderFilesTheirNewestMessageAndNeedsAReasonAndAMessage()
    {
        var group = F.Chat.Group(Daniel.Id, Priya.Id, Paul.Id);
        await Say(group, Priya, "First", 0);
        var last = await Say(group, Priya, "Second", 1);
        var daniel = await DanielToken();
        var people = (await ChatGet(Msgs(group), daniel)).Json.GetProperty("conversation").GetProperty("people").EnumerateArray().ToList();
        Assert.Equal(2, people.Count);
        var priya = people.First(p => p.GetProperty("name").GetString() == "Priya U.").GetProperty("id").GetString();
        var paul = people.First(p => p.GetProperty("name").GetString() != "Priya U.").GetProperty("id").GetString();
        Is(HttpStatusCode.BadRequest, "badReason", await ChatPost($"conversations/{group.PublicId}/people/{priya}/report", daniel, new { reason = "nonsense" }));
        Is(HttpStatusCode.NotFound, "notFound", await ChatPost($"conversations/{group.PublicId}/people/{paul}/report", daniel, new { reason = "rude" }));   // Paul has said nothing
        Is(HttpStatusCode.BadRequest, "notInChat", await ChatPost($"conversations/{group.PublicId}/people/{Guid.NewGuid()}/report", daniel, new { reason = "rude" }));
        Assert.Equal(HttpStatusCode.NoContent, (await ChatPost($"conversations/{group.PublicId}/people/{priya}/report", daniel, new { reason = "rude" })).Status);
        var filed = F.Chat.Reports.Single();
        Assert.Equal((Daniel.Id, last, "rude"), (filed.UserId, filed.MessageId.ToString(), filed.Reason));
    }
}
