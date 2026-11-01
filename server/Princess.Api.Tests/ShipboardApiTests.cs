using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Orders, the family, health, the stateroom, photos, laundry, Wi-Fi and trip updates over the real pipeline. The Harpers (Balcony, Princess Plus) sail 21 March 2027; Maya is eight.
/// Every test user is a demo user, so "now" and the scenarios are set per person. Eastern daylight time is UTC-4 until the ship moves to Belize time on day 4.
/// </summary>
public class ShipboardApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);

    private static readonly DateTime BeforeSailing = Utc(20, 16);
    private static readonly DateTime SeaDay = Utc(22, 16);                    // 12:00 Eastern on day 2

    public ShipboardApiTests() => SetNow(SeaDay);

    /// <summary>The demo clock is set to the second, so a stamp is only as exact as that.</summary>
    private static void Near(long expectedMs, long actualMs) => Assert.InRange(Math.Abs(expectedMs - actualMs), 0, 2000);

    private Task<string> DanielToken() => SignIn(Daniel);

    private void Scenario(UserRecord u, params string[] ids) => F.Journey.Scenarios[u.Id] = [.. ids];

    private Task<Reply> Put(string path, string token, object? body = null) => Call(HttpMethod.Put, $"{Base}/{path}", token, body);
    private Task<Reply> Post(string path, string token, object? body = null) => Call(HttpMethod.Post, $"{Base}/{path}", token, body);
    private Task<Reply> Delete(string path, string token) => Call(HttpMethod.Delete, $"{Base}/{path}", token);
    private Task<Reply> Patch(string path, string token, object? body) => Call(HttpMethod.Patch, $"{Base}/{path}", token, body);
    private Task<Reply> Read(string path, string token) => Get($"{Base}/{path}", token);

    private async Task<JsonElement[]> FolioLines(string token) => (await Read("onboard/folio", token)).Json.GetProperty("lines").EnumerateArray().ToArray();

    private static object Burgers(int qty = 2) => new { kind = "delivery", lines = new[] { new { itemId = "cheeseburger", qty, extras = Array.Empty<string>(), guest = Guid.Empty } }, location = new { kind = "cabin" }, tip = 0 };

    private object Order(string kind, string itemId, int qty, UserRecord guest, object location, long tip = 0, long? deliverAt = null) => new
    {
        kind, lines = new[] { new { itemId, qty, extras = Array.Empty<string>(), guest = guest.PublicId } }, location, tip, deliverAt,
    };

    private static readonly object CabinPlace = new { kind = "cabin" };
    private static readonly object Pool = new { kind = "zone", placeId = "lido-pool" };

    // ---- Access ----

    [Fact]
    public async Task AnyGuestMayReadAndStrangersGetNotFound()
    {
        foreach (var path in new[] { "orders/menu", "orders", "family", "health", "room", "photos", "laundry", "wifi", "updates" })
        {
            Assert.Equal(HttpStatusCode.OK, (await Read(path, await SignIn(Priya))).Status);
            Assert.Equal(HttpStatusCode.NotFound, (await Read(path, await SignIn(Stranger))).Status);
        }
    }

    [Fact]
    public async Task ASupervisedChildCanLookButNotChangeAnything()
    {
        var maya = MayaToken();
        foreach (var path in new[] { "orders/menu", "orders", "family", "health", "room", "photos", "laundry", "wifi", "updates" })
            Assert.Equal(HttpStatusCode.OK, (await Read(path, maya)).Status);
        Assert.False((await Read("orders/menu", maya)).Json.GetProperty("canOrder").GetBoolean());
        Assert.False((await Read("family", maya)).Json.GetProperty("canEdit").GetBoolean());
        Assert.False((await Read("room", maya)).Json.GetProperty("canEdit").GetBoolean());
        Assert.False((await Read("laundry", maya)).Json.GetProperty("canRequest").GetBoolean());
        Assert.False((await Read("wifi", maya)).Json.GetProperty("canBuy").GetBoolean());
        var anId = Guid.NewGuid();
        foreach (var (verb, url, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Post, "orders", Order("delivery", "fries", 1, Maya, CabinPlace)),
            (HttpMethod.Delete, $"orders/{anId}", null),
            (HttpMethod.Put, $"family/{Maya.PublicId}/zones", new { zones = new[] { "lido-pool" } }),
            (HttpMethod.Post, $"family/{Maya.PublicId}/check-in", null),
            (HttpMethod.Put, "family/reunion", new { placeId = "piazza", backupId = "eatery" }),
            (HttpMethod.Post, "health/reports", new { guests = new[] { Maya.PublicId }, symptoms = new[] { "cough" }, startedHoursAgo = 1 }),
            (HttpMethod.Post, "health/requests", new { kind = "seasick", note = "" }),
            (HttpMethod.Patch, "room/housekeeping", new { mode = "dnd" }),
            (HttpMethod.Patch, "room/devices", new { lights = "dim" }),
            (HttpMethod.Post, "photos/purchases", new { photoIds = new[] { "gangway" }, option = "each" }),
            (HttpMethod.Post, "laundry", new { service = "press", qty = 1, pickupAt = 0, note = "" }),
            (HttpMethod.Post, "wifi/devices", new { name = "Tablet", plan = "surf", days = 1 }),
            (HttpMethod.Post, "updates/planChange/ack", new { option = "ok" }),
        })
        {
            var r = await Call(verb, $"{Base}/{url}", maya, body);
            Assert.Equal(HttpStatusCode.Forbidden, r.Status);
            Assert.Equal("supervised", r.ProblemTitle);
        }
    }

    // ---- Orders ----

    [Fact]
    public async Task OrderingOpensOnBoardingDay()
    {
        SetNow(BeforeSailing);
        var token = await DanielToken();
        var menu = (await Read("orders/menu", token)).Json;
        Assert.False(menu.GetProperty("open").GetBoolean());
        Assert.False(menu.GetProperty("canOrder").GetBoolean());
        Assert.Empty(menu.GetProperty("mornings").EnumerateArray());
        var r = await Post("orders", token, Order("delivery", "fries", 1, Daniel, CabinPlace));
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (r.Status, r.ProblemTitle));

        SetNow(SeaDay);
        menu = (await Read("orders/menu", token)).Json;
        Assert.True(menu.GetProperty("open").GetBoolean());
        Assert.True(menu.GetProperty("canOrder").GetBoolean());
        Assert.Equal(3, menu.GetProperty("mornings").GetArrayLength());
        Assert.Equal(3, menu.GetProperty("guests").GetArrayLength());
        Assert.All(menu.GetProperty("guests").EnumerateArray(), g => Assert.Equal(15, g.GetProperty("drinkCapUsd").GetInt32()));       // Princess Plus
        Assert.False(string.IsNullOrEmpty(menu.GetProperty("cabin").GetString()));
        Assert.False(menu.GetProperty("isolating").GetBoolean());
    }

    [Fact]
    public async Task ADeliveryOrderIsPricedPlacedOnTheAccountAndListed()
    {
        var token = await DanielToken();
        var r = await Post("orders", token, Order("delivery", "cheeseburger", 2, Daniel, Pool, tip: 200));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var o = r.Json;
        Assert.Equal("received", o.GetProperty("stage").GetString());
        Near(TripRules.ToMs(SeaDay), o.GetProperty("placedAt").GetInt64());
        Near(TripRules.ToMs(SeaDay.AddMinutes(30)), o.GetProperty("etaAt").GetInt64());
        Assert.Equal(200, o.GetProperty("fee").GetInt64());
        Assert.Equal(1900 + 200 + 200, o.GetProperty("total").GetInt64());
        Assert.Equal("lido-pool", o.GetProperty("location").GetProperty("placeId").GetString());
        Assert.True(o.GetProperty("canCancel").GetBoolean());
        Assert.False(o.GetProperty("free").GetBoolean());

        var lines = await FolioLines(token);
        Assert.Equal(1900, lines.Single(l => l.GetProperty("description").GetString() == "2 × Cheeseburger (order)").GetProperty("cents").GetInt64());
        Assert.Equal(200, lines.Single(l => l.GetProperty("description").GetString() == "Delivery fee (order)").GetProperty("cents").GetInt64());
        Assert.Equal(200, lines.Single(l => l.GetProperty("description").GetString() == "Tip for the crew (order)").GetProperty("cents").GetInt64());

        var list = (await Read("orders", await SignIn(Priya))).Json;                      // the whole booking sees it
        Assert.Equal(o.GetProperty("id").GetString(), list[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task ADrinksPackageCoversADrinkUpToItsCapAndTheFolioShowsIt()
    {
        var token = await DanielToken();
        var r = await Post("orders", token, new
        {
            kind = "delivery", location = CabinPlace, tip = 0,
            lines = new[]
            {
                new { itemId = "wine", qty = 1, extras = Array.Empty<string>(), guest = Daniel.PublicId },
                new { itemId = "premium-cocktail", qty = 1, extras = Array.Empty<string>(), guest = Daniel.PublicId },
            },
        });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(594, r.Json.GetProperty("service").GetInt64());
        Assert.Equal(700 + 594, r.Json.GetProperty("total").GetInt64());
        Assert.Equal(1100 + 1500, r.Json.GetProperty("covered").GetInt64());
        var wine = (await FolioLines(token)).Single(l => l.GetProperty("description").GetString() == "Glass of wine (order)");
        Assert.Equal(0, wine.GetProperty("cents").GetInt64());
        Assert.Equal("package", wine.GetProperty("coveredBy").GetString());
    }

    [Theory]
    [InlineData("empty")]
    [InlineData("underage")]
    [InlineData("unknownItem")]
    [InlineData("wrongMenu")]
    [InlineData("badLocation")]
    [InlineData("badTip")]
    [InlineData("noTime")]
    [InlineData("badQuantity")]
    [InlineData("noGuest")]
    public async Task AnOrderThatBreaksARuleIsRefusedWithTheProblem(string problem)
    {
        object body = problem switch
        {
            "empty" => new { kind = "delivery", lines = Array.Empty<object>(), location = CabinPlace, tip = 0 },
            "underage" => Order("delivery", "beer", 1, Maya, CabinPlace),
            "unknownItem" => Order("delivery", "sushi", 1, Daniel, CabinPlace),
            "wrongMenu" => Order("delivery", "club-sandwich", 1, Daniel, CabinPlace),
            "badLocation" => Order("delivery", "fries", 1, Daniel, new { kind = "zone", placeId = "casino" }),
            "badTip" => Order("delivery", "fries", 1, Daniel, CabinPlace, tip: 999),
            "noTime" => Order("breakfast", "continental", 1, Daniel, CabinPlace),
            "badQuantity" => Order("delivery", "fries", 0, Daniel, CabinPlace),
            _ => Order("delivery", "fries", 1, Stranger, CabinPlace),
        };
        var r = await Post("orders", await DanielToken(), body);
        Assert.Equal((HttpStatusCode.BadRequest, problem), (r.Status, r.ProblemTitle));
    }

    [Fact]
    public async Task AnOrderMovesThroughItsStagesAndCannotBeCancelledOnceCooking()
    {
        var token = await DanielToken();
        var id = (await Post("orders", token, Order("delivery", "fries", 1, Daniel, CabinPlace))).Json.GetProperty("id").GetString();
        async Task<JsonElement> Now(int minutes) { SetNow(SeaDay.AddMinutes(minutes)); return (await Read("orders", token)).Json[0]; }

        Assert.Equal("received", (await Now(4)).GetProperty("stage").GetString());
        var preparing = await Now(6);
        Assert.Equal("preparing", preparing.GetProperty("stage").GetString());
        Assert.False(preparing.GetProperty("canCancel").GetBoolean());
        Assert.Equal("onTheWay", (await Now(22)).GetProperty("stage").GetString());
        Assert.Equal("delivered", (await Now(31)).GetProperty("stage").GetString());

        SetNow(SeaDay.AddMinutes(6));
        var late = await Delete($"orders/{id}", token);
        Assert.Equal((HttpStatusCode.Conflict, "tooLate"), (late.Status, late.ProblemTitle));
    }

    [Fact]
    public async Task CancellingBeforeCookingRefundsTheOrderOnTheAccount()
    {
        var token = await DanielToken();
        var id = (await Post("orders", token, Order("delivery", "cheeseburger", 1, Daniel, Pool))).Json.GetProperty("id").GetString();
        SetNow(SeaDay.AddMinutes(2));
        var r = await Delete($"orders/{id}", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("cancelled", r.Json.GetProperty("stage").GetString());
        Assert.Equal(1150, r.Json.GetProperty("refund").GetInt64());
        Assert.Equal(JsonValueKind.Null, r.Json.GetProperty("etaAt").ValueKind);

        var lines = await FolioLines(token);
        Assert.Equal(1150, lines.Single(l => l.GetProperty("description").GetString() == "Refund, order cancelled").GetProperty("cents").GetInt64() * -1);
        Assert.Equal(0, lines.Where(l => l.GetProperty("description").GetString()!.Contains("(order)") || l.GetProperty("description").GetString()!.StartsWith("Refund")).Sum(l => l.GetProperty("cents").GetInt64()));
    }

    [Fact]
    public async Task AnOrderCanBeMovedUntilItArrivesAndTheFeeFollowsThePlace()
    {
        var token = await DanielToken();
        var id = (await Post("orders", token, Order("delivery", "fries", 1, Daniel, CabinPlace))).Json.GetProperty("id").GetString();
        var moved = await Put($"orders/{id}/location", token, new { location = Pool });
        Assert.Equal(HttpStatusCode.OK, moved.Status);
        Assert.Equal(200, moved.Json.GetProperty("fee").GetInt64());
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Delivery fee (order)");

        var typed = await Put($"orders/{id}/location", token, new { location = new { kind = "other", text = "  the aft deck  " } });
        Assert.Equal("the aft deck", typed.Json.GetProperty("location").GetProperty("text").GetString());

        var bad = await Put($"orders/{id}/location", token, new { location = new { kind = "other", text = "ab" } });
        Assert.Equal((HttpStatusCode.BadRequest, "badLocation"), (bad.Status, bad.ProblemTitle));

        SetNow(SeaDay.AddMinutes(40));
        var late = await Put($"orders/{id}/location", token, new { location = CabinPlace });
        Assert.Equal((HttpStatusCode.Conflict, "tooLate"), (late.Status, late.ProblemTitle));
    }

    [Fact]
    public async Task AskingGuestServicesAboutAnOrderIsCounted()
    {
        var token = await DanielToken();
        var id = (await Post("orders", token, Order("delivery", "fries", 1, Daniel, CabinPlace))).Json.GetProperty("id").GetString();
        await Post($"orders/{id}/contact", token);
        Assert.Equal(2, (await Post($"orders/{id}/contact", token)).Json.GetProperty("contacted").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"orders/{Guid.NewGuid()}/contact", token)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"orders/{id}/contact", await SignIn(Stranger))).Status);
    }

    [Fact]
    public async Task WhenAnItemRunsOutTheOrderWaitsForAChoice()
    {
        Scenario(Daniel, "orderStock");
        var token = await DanielToken();
        Assert.Equal(["fish-tacos"], (await Read("orders/menu", token)).Json.GetProperty("outOfStock").EnumerateArray().Select(x => x.GetString()));
        var gone = await Post("orders", token, Order("delivery", "fish-tacos", 1, Daniel, CabinPlace));
        Assert.Equal((HttpStatusCode.Conflict, "unavailable"), (gone.Status, gone.ProblemTitle));

        var id = (await Post("orders", token, Order("delivery", "lava-cake", 1, Daniel, CabinPlace))).Json.GetProperty("id").GetString();
        var early = await Post($"orders/{id}/resolve", token, new { choices = new Dictionary<int, string> { [0] = "remove" } });
        Assert.Equal((HttpStatusCode.Conflict, "nothingToChoose"), (early.Status, early.ProblemTitle));

        SetNow(SeaDay.AddMinutes(8));
        var waiting = (await Read("orders", token)).Json[0];
        Assert.Equal("needsChoice", waiting.GetProperty("stage").GetString());
        Assert.Equal([0], waiting.GetProperty("unavailable").EnumerateArray().Select(x => x.GetInt32()));
        Assert.Equal(JsonValueKind.Null, waiting.GetProperty("etaAt").ValueKind);

        var incomplete = await Post($"orders/{id}/resolve", token, new { choices = new Dictionary<int, string>() });
        Assert.Equal((HttpStatusCode.BadRequest, "incomplete"), (incomplete.Status, incomplete.ProblemTitle));

        var swapped = await Post($"orders/{id}/resolve", token, new { choices = new Dictionary<int, string> { [0] = "substitute" } });
        Assert.Equal(HttpStatusCode.OK, swapped.Status);
        Assert.Equal("fruit-plate", swapped.Json.GetProperty("lines")[0].GetProperty("itemId").GetString());
        Assert.Equal(600, swapped.Json.GetProperty("total").GetInt64());
        Assert.Equal("preparing", swapped.Json.GetProperty("stage").GetString());
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "Seasonal fruit plate (order)");
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString() == "Chocolate lava cake (order)");
    }

    [Fact]
    public async Task RemovingEveryLineThatRanOutCancelsTheOrder()
    {
        Scenario(Daniel, "orderStock");
        var token = await DanielToken();
        var id = (await Post("orders", token, Order("delivery", "lava-cake", 1, Daniel, CabinPlace))).Json.GetProperty("id").GetString();
        SetNow(SeaDay.AddMinutes(8));
        var r = await Post($"orders/{id}/resolve", token, new { choices = new Dictionary<int, string> { [0] = "remove" } });
        Assert.Equal("cancelled", r.Json.GetProperty("stage").GetString());
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString()!.Contains("(order)"));
    }

    [Fact]
    public async Task BreakfastIsScheduledForAMorningSlotAndCanBeCancelledBeforeItStarts()
    {
        var token = await DanielToken();
        var slot = (await Read("orders/menu", token)).Json.GetProperty("mornings")[0].GetProperty("slots")[0].GetProperty("at").GetInt64();
        var r = await Post("orders", token, Order("breakfast", "continental", 1, Daniel, CabinPlace, deliverAt: slot));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("scheduled", r.Json.GetProperty("stage").GetString());
        Assert.Equal(slot, r.Json.GetProperty("deliverAt").GetInt64());
        var id = r.Json.GetProperty("id").GetString();

        var off = await Post("orders", token, Order("breakfast", "continental", 1, Daniel, CabinPlace, deliverAt: slot + 1000));
        Assert.Equal((HttpStatusCode.BadRequest, "noTime"), (off.Status, off.ProblemTitle));
        Assert.Equal("cancelled", (await Delete($"orders/{id}", token)).Json.GetProperty("stage").GetString());
    }

    [Fact]
    public async Task WhileIsolatingFoodAndDeliveryAreFree()
    {
        var token = await DanielToken();
        Assert.Equal(HttpStatusCode.OK, (await Post("health/reports", token, new { guests = new[] { Daniel.PublicId }, symptoms = new[] { "vomiting" }, startedHoursAgo = 2 })).Status);
        Assert.True((await Read("orders/menu", await SignIn(Priya))).Json.GetProperty("isolating").GetBoolean());       // the whole booking is
        var o = (await Post("orders", await SignIn(Priya), Order("delivery", "cheeseburger", 1, Priya, Pool))).Json;
        Assert.True(o.GetProperty("free").GetBoolean());
        Assert.Equal(0, o.GetProperty("fee").GetInt64());
        Assert.Equal(0, o.GetProperty("total").GetInt64());
        Assert.Equal("fare", o.GetProperty("lines")[0].GetProperty("coveredBy").GetString());
    }

    // ---- Family ----

    [Fact]
    public async Task TheFamilyViewShowsTheChildTheirClubAndWhoMayCollectThem()
    {
        var f = (await Read("family", await DanielToken())).Json;
        Assert.True(f.GetProperty("canEdit").GetBoolean());
        Assert.Equal(2, f.GetProperty("adults").GetArrayLength());
        var kid = Assert.Single(f.GetProperty("kids").EnumerateArray());
        Assert.Equal(Maya.PublicId.ToString(), kid.GetProperty("id").GetString());
        Assert.Equal(8, kid.GetProperty("age").GetInt32());
        Assert.Equal("neon-grove", kid.GetProperty("club").GetProperty("id").GetString());
        Assert.True(kid.GetProperty("club").GetProperty("open").GetBoolean());
        Assert.Equal(JsonValueKind.Null, kid.GetProperty("inClub").ValueKind);
        Assert.Equal(2, kid.GetProperty("auth").GetProperty("pickup").GetArrayLength());
        Assert.Contains("neon-grove", kid.GetProperty("zones").EnumerateArray().Select(z => z.GetString()));
        Assert.Equal("band", kid.GetProperty("seen").GetProperty("source").GetString());
        Assert.Equal("guest-services", f.GetProperty("reunion").GetProperty("placeId").GetString());
    }

    [Fact]
    public async Task ACheckInPutsTheChildInTheClubAndTheLogRecordsWhoDidIt()
    {
        var token = await DanielToken();
        var r = await Post($"family/{Maya.PublicId}/check-in", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var kid = r.Json.GetProperty("kids")[0];
        Assert.Equal("neon-grove", kid.GetProperty("inClub").GetProperty("clubId").GetString());
        Assert.Equal("inClub", kid.GetProperty("status").GetString());
        Assert.True(kid.GetProperty("canCheckOut").GetBoolean());
        Assert.Equal("Maya checked in to Neon Grove (by Daniel)", r.Json.GetProperty("log")[0].GetProperty("text").GetString());

        var again = await Post($"family/{Maya.PublicId}/check-in", token);
        Assert.Equal((HttpStatusCode.BadRequest, "alreadyIn"), (again.Status, again.ProblemTitle));
    }

    [Fact]
    public async Task AClubCannotTakeAChildWhileClosedOrAnAdultOrWhenNotAboard()
    {
        var token = await DanielToken();
        SetNow(Utc(23, 3));                                                   // 23:00 Eastern on day 2: Neon Grove closed at 22:00
        var closed = await Post($"family/{Maya.PublicId}/check-in", token);
        Assert.Equal((HttpStatusCode.BadRequest, "closed"), (closed.Status, closed.ProblemTitle));
        var adult = await Post($"family/{Priya.PublicId}/check-in", token);
        Assert.Equal((HttpStatusCode.Forbidden, "notYourChild"), (adult.Status, adult.ProblemTitle));
        SetNow(BeforeSailing);
        var ashore = await Post($"family/{Maya.PublicId}/check-in", token);
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (ashore.Status, ashore.ProblemTitle));
    }

    [Fact]
    public async Task OnlyAListedAdultOrAChildAllowedToSignThemselvesOutMayCheckOut()
    {
        var token = await DanielToken();
        await Post($"family/{Maya.PublicId}/check-in", token);
        var notIn = await Post($"family/{Maya.PublicId}/check-out", await SignIn(Priya));
        Assert.Equal(HttpStatusCode.OK, notIn.Status);                         // Priya is a listed adult by default
        var out2 = await Post($"family/{Maya.PublicId}/check-out", token);
        Assert.Equal((HttpStatusCode.Conflict, "notIn"), (out2.Status, out2.ProblemTitle));

        await Post($"family/{Maya.PublicId}/check-in", token);
        Assert.Equal(HttpStatusCode.OK, (await Put($"family/{Maya.PublicId}/auth", token, new { pickup = new[] { Priya.PublicId }, signOutAlone = false, photos = false })).Status);
        var denied = await Post($"family/{Maya.PublicId}/check-out", token);
        Assert.Equal((HttpStatusCode.Forbidden, "notAuthorised"), (denied.Status, denied.ProblemTitle));
        Assert.False((await Read("family", token)).Json.GetProperty("kids")[0].GetProperty("canCheckOut").GetBoolean());
        var maya = await Post($"family/{Maya.PublicId}/check-out", MayaToken());
        Assert.Equal((HttpStatusCode.Forbidden, "notAuthorised"), (maya.Status, maya.ProblemTitle));
        var done = await Post($"family/{Maya.PublicId}/check-out", await SignIn(Priya));
        Assert.Equal(JsonValueKind.Null, done.Json.GetProperty("kids")[0].GetProperty("inClub").ValueKind);
        Assert.Equal("Maya checked out of Neon Grove (by Priya)", done.Json.GetProperty("log")[0].GetProperty("text").GetString());
    }

    [Fact]
    public async Task AuthorisationIsCheckedBeforeItIsSaved()
    {
        var token = await DanielToken();
        var none = await Put($"family/{Maya.PublicId}/auth", token, new { pickup = Array.Empty<Guid>(), signOutAlone = false, photos = false });
        Assert.Equal((HttpStatusCode.BadRequest, "noPickup"), (none.Status, none.ProblemTitle));
        var child = await Put($"family/{Maya.PublicId}/auth", token, new { pickup = new[] { Maya.PublicId }, signOutAlone = false, photos = false });
        Assert.Equal("noPickup", child.ProblemTitle);                                       // a child is not an adult who may collect
        var young = await Put($"family/{Maya.PublicId}/auth", token, new { pickup = new[] { Daniel.PublicId }, signOutAlone = true, photos = false });
        Assert.Equal((HttpStatusCode.BadRequest, "tooYoungAlone"), (young.Status, young.ProblemTitle));       // Neon Grove from ten
        var ok = await Put($"family/{Maya.PublicId}/auth", token, new { pickup = new[] { Daniel.PublicId }, signOutAlone = false, photos = true });
        var auth = ok.Json.GetProperty("kids")[0].GetProperty("auth");
        Assert.Equal([Daniel.PublicId.ToString()], auth.GetProperty("pickup").EnumerateArray().Select(x => x.GetString()));
        Assert.True(auth.GetProperty("photos").GetBoolean());
    }

    [Fact]
    public async Task PlacesAndTheMeetingPointAreSavedAndChecked()
    {
        var token = await DanielToken();
        Assert.Equal("badZones", (await Put($"family/{Maya.PublicId}/zones", token, new { zones = new[] { "casino" } })).ProblemTitle);
        Assert.Equal("badZones", (await Put($"family/{Maya.PublicId}/zones", token, new { zones = Array.Empty<string>() })).ProblemTitle);
        var set = await Put($"family/{Maya.PublicId}/zones", token, new { zones = new[] { "piazza", "piazza", "dome" } });
        Assert.Equal(["piazza", "dome"], set.Json.GetProperty("kids")[0].GetProperty("zones").EnumerateArray().Select(z => z.GetString()));

        Assert.Equal("badMeeting", (await Put("family/reunion", token, new { placeId = "piazza", backupId = "piazza" })).ProblemTitle);
        var plan = await Put("family/reunion", token, new { placeId = "eatery", backupId = "promenade", note = "By the big clock" });
        Assert.Equal("eatery", plan.Json.GetProperty("reunion").GetProperty("placeId").GetString());
        Assert.Equal("By the big clock", (await Read("family", await SignIn(Priya))).Json.GetProperty("reunion").GetProperty("note").GetString());
    }

    [Fact]
    public async Task AChildWhoseBandHasGoneQuietIsOverdueInTheMissingChildScenario()
    {
        var token = await DanielToken();
        Scenario(Daniel, "childMissing");
        Assert.Equal("overdue", (await Read("family", token)).Json.GetProperty("kids")[0].GetProperty("status").GetString());
        await Post($"family/{Maya.PublicId}/check-in", token);
        Assert.Equal("inClub", (await Read("family", token)).Json.GetProperty("kids")[0].GetProperty("status").GetString());
    }

    // ---- Health ----

    [Fact]
    public async Task TheMedicalCenterHoursFollowTheShipsClockAndTheKindOfDay()
    {
        var token = await DanielToken();
        SetNow(Utc(22, 13));                                                   // 09:00 at sea
        var open = (await Read("health", token)).Json;
        Assert.Equal("sea", open.GetProperty("day").GetString());
        Assert.True(open.GetProperty("open").GetBoolean());

        SetNow(Utc(22, 16, 5));                                                // 12:05
        var closed = (await Read("health", token)).Json;
        Assert.False(closed.GetProperty("open").GetBoolean());
        Assert.Equal("15:00", closed.GetProperty("nextOpen").GetString());

        SetNow(Utc(23, 17));                                                   // Cozumel afternoon, 13:00 ship time
        var port = (await Read("health", token)).Json;
        Assert.Equal("port", port.GetProperty("day").GetString());
        Assert.Equal("17:30", port.GetProperty("nextOpen").GetString());
        Scenario(Daniel, "illness");
        Assert.True((await Read("health", token)).Json.GetProperty("notice").GetBoolean());
    }

    [Fact]
    public async Task AReportIsPrivateToTheReporterButIsolatesTheWholeBooking()
    {
        var priya = await SignIn(Priya);
        var r = await Post("health/reports", priya, new { guests = new[] { Daniel.PublicId, Priya.PublicId }, symptoms = new[] { "vomiting", "fever" }, startedHoursAgo = 6 });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var report = Assert.Single(r.Json.GetProperty("reports").EnumerateArray());
        Assert.Equal(2, report.GetProperty("guests").GetArrayLength());
        Assert.Equal(6, report.GetProperty("startedHoursAgo").GetInt32());
        Assert.True(r.Json.GetProperty("isolating").GetBoolean());

        var daniel = (await Read("health", await DanielToken())).Json;
        Assert.Empty(daniel.GetProperty("reports").EnumerateArray());
        Assert.True(daniel.GetProperty("isolating").GetBoolean());

        SetNow(SeaDay.AddHours(73));
        Assert.False((await Read("health", priya)).Json.GetProperty("isolating").GetBoolean());
    }

    [Theory]
    [InlineData("noGuest")]
    [InlineData("noSymptoms")]
    [InlineData("badSymptom")]
    [InlineData("badStart")]
    public async Task AReportThatBreaksARuleIsRefused(string problem)
    {
        object body = problem switch
        {
            "noGuest" => new { guests = Array.Empty<Guid>(), symptoms = new[] { "cough" }, startedHoursAgo = 1 },
            "noSymptoms" => new { guests = new[] { Daniel.PublicId }, symptoms = Array.Empty<string>(), startedHoursAgo = 1 },
            "badSymptom" => new { guests = new[] { Daniel.PublicId }, symptoms = new[] { "sneezing" }, startedHoursAgo = 1 },
            _ => new { guests = new[] { Daniel.PublicId }, symptoms = new[] { "cough" }, startedHoursAgo = 200 },
        };
        var r = await Post("health/reports", await DanielToken(), body);
        Assert.Equal((HttpStatusCode.BadRequest, problem), (r.Status, r.ProblemTitle));
    }

    [Fact]
    public async Task OnlyPeopleOnTheBookingCanBeReportedAndNotBeforeSailing()
    {
        var token = await DanielToken();
        var stranger = await Post("health/reports", token, new { guests = new[] { Stranger.PublicId }, symptoms = new[] { "cough" }, startedHoursAgo = 1 });
        Assert.Equal((HttpStatusCode.Forbidden, "notOnBooking"), (stranger.Status, stranger.ProblemTitle));
        SetNow(BeforeSailing);
        var early = await Post("health/reports", token, new { guests = new[] { Daniel.PublicId }, symptoms = new[] { "cough" }, startedHoursAgo = 1 });
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (early.Status, early.ProblemTitle));
    }

    [Fact]
    public async Task RequestsAreCheckedAndSharedWithTheBooking()
    {
        var token = await DanielToken();
        Assert.Equal("badKind", (await Post("health/requests", token, new { kind = "spa", note = "" })).ProblemTitle);
        Assert.Equal("badNote", (await Post("health/requests", token, new { kind = "seasick", note = new string('x', 301) })).ProblemTitle);
        var r = await Post("health/requests", token, new { kind = "seasick", note = "  ginger please " });
        var request = Assert.Single(r.Json.GetProperty("requests").EnumerateArray());
        Assert.Equal(("seasick", "ginger please"), (request.GetProperty("kind").GetString(), request.GetProperty("note").GetString()));
        Assert.Single((await Read("health", await SignIn(Priya))).Json.GetProperty("requests").EnumerateArray());
    }

    // ---- The stateroom ----

    [Fact]
    public async Task TheRoomCardShowsTheCabinTheStewardAndTheAmenities()
    {
        var room = (await Read("room", await DanielToken())).Json;
        Assert.False(string.IsNullOrEmpty(room.GetProperty("number").GetString()));
        Assert.Contains(room.GetProperty("steward").GetString(), RoomRules.Stewards);
        var amenities = room.GetProperty("amenities").EnumerateArray().Select(a => a.GetString()).ToList();
        Assert.All(new[] { "bed", "bath", "tv", "safe", "balcony", "fridge" }, a => Assert.Contains(a, amenities));
        Assert.True(room.GetProperty("hasView").GetBoolean());
        Assert.Equal("none", room.GetProperty("housekeeping").GetProperty("mode").GetString());
        Assert.Equal(72, room.GetProperty("devices").GetProperty("tempF").GetInt32());
        Assert.False(room.GetProperty("checkDue").GetBoolean());
        Assert.True(room.GetProperty("canEdit").GetBoolean());
    }

    [Fact]
    public async Task DoNotDisturbIsTimedAndAfterADayTheStewardChecks()
    {
        var token = await DanielToken();
        var dnd = (await Patch("room/housekeeping", token, new { mode = "dnd", window = "morning" })).Json;
        Assert.Equal("dnd", dnd.GetProperty("housekeeping").GetProperty("mode").GetString());
        Near(TripRules.ToMs(SeaDay), dnd.GetProperty("housekeeping").GetProperty("since").GetInt64());
        Assert.True(dnd.GetProperty("housekeeping").GetProperty("turndown").GetBoolean());

        SetNow(SeaDay.AddHours(5));
        var same = (await Patch("room/housekeeping", token, new { turndown = false })).Json;               // other settings do not restart the clock
        Near(TripRules.ToMs(SeaDay), same.GetProperty("housekeeping").GetProperty("since").GetInt64());
        Assert.False(same.GetProperty("housekeeping").GetProperty("turndown").GetBoolean());
        Assert.Equal("morning", same.GetProperty("housekeeping").GetProperty("window").GetString());
        Assert.False(same.GetProperty("checkDue").GetBoolean());

        SetNow(SeaDay.AddHours(25));
        Assert.True((await Read("room", token)).Json.GetProperty("checkDue").GetBoolean());
        var off = (await Patch("room/housekeeping", token, new { mode = "none" })).Json;
        Assert.Equal(JsonValueKind.Null, off.GetProperty("housekeeping").GetProperty("since").ValueKind);
        Assert.False(off.GetProperty("checkDue").GetBoolean());
    }

    [Fact]
    public async Task RoomControlsAreSavedTogetherAndChecked()
    {
        var token = await DanielToken();
        var set = (await Patch("room/devices", token, new { lights = "dim", tempF = 70, tv = true, shades = "closed" })).Json.GetProperty("devices");
        Assert.Equal(("dim", 70, true, "closed"), (set.GetProperty("lights").GetString(), set.GetProperty("tempF").GetInt32(), set.GetProperty("tv").GetBoolean(), set.GetProperty("shades").GetString()));
        var part = (await Patch("room/devices", token, new { tempF = 68.4 })).Json.GetProperty("devices");
        Assert.Equal((68, "dim"), (part.GetProperty("tempF").GetInt32(), part.GetProperty("lights").GetString()));

        Assert.Equal("badLights", (await Patch("room/devices", token, new { lights = "disco" })).ProblemTitle);
        Assert.Equal("badTemp", (await Patch("room/devices", token, new { tempF = 90 })).ProblemTitle);
        Assert.Equal("badMode", (await Patch("room/housekeeping", token, new { mode = "sleep" })).ProblemTitle);
        Assert.Equal("badWindow", (await Patch("room/housekeeping", token, new { window = "night" })).ProblemTitle);
        SetNow(BeforeSailing);
        Assert.Equal(HttpStatusCode.Conflict, (await Patch("room/devices", token, new { tv = false })).Status);

        Assert.Equal("closed", (await Read("room", await SignIn(Priya))).Json.GetProperty("devices").GetProperty("shades").GetString());       // shared by the booking
    }

    // ---- Photos ----

    private static string[] Ids(JsonElement list) => [.. list.EnumerateArray().Select(x => x.GetString()!)];

    [Fact]
    public async Task PhotosAppearAsTheCruiseGoesOnAndFavouritesArePersonal()
    {
        var token = await DanielToken();
        SetNow(BeforeSailing);
        Assert.Empty((await Read("photos", token)).Json.GetProperty("photos").EnumerateArray());
        SetNow(SeaDay);
        var v = (await Read("photos", token)).Json;
        Assert.Equal(["gangway", "formal1"], v.GetProperty("photos").EnumerateArray().Select(p => p.GetProperty("id").GetString()));
        Assert.Equal(2, v.GetProperty("throughDay").GetInt32());
        Assert.Equal(6, v.GetProperty("schedule").GetArrayLength());
        Assert.Equal(0, v.GetProperty("includedLeft").GetInt32());

        Assert.Equal(["gangway"], Ids((await Put("photos/gangway/favourite", token)).Json));
        Assert.Equal(["gangway", "formal1"], Ids((await Put("photos/formal1/favourite", token)).Json));
        Assert.Equal(["formal1"], Ids((await Put("photos/gangway/favourite", token)).Json));
        Assert.Empty((await Read("photos", await SignIn(Priya))).Json.GetProperty("favourites").EnumerateArray());
        Assert.Equal("unknownPhoto", (await Put("photos/roatan/favourite", token)).ProblemTitle);               // day 5 has not happened yet
    }

    [Fact]
    public async Task AQuotePricesEachWayOfBuyingAndChecksTheChoice()
    {
        var token = await DanielToken();
        var q = (await Post("photos/quote", token, new { photoIds = new[] { "gangway", "formal1" } })).Json;
        Assert.Equal((0, 2, "each"), (q.GetProperty("included").GetInt32(), q.GetProperty("paid").GetInt32(), q.GetProperty("cheapest").GetString()));
        Assert.Equal([3990L, 7995L, 14995L], q.GetProperty("options").EnumerateArray().Select(o => o.GetProperty("total").GetInt64()));
        Assert.Equal("empty", (await Post("photos/quote", token, new { photoIds = Array.Empty<string>() })).ProblemTitle);
        Assert.Equal("unknownPhoto", (await Post("photos/quote", token, new { photoIds = new[] { "belize" } })).ProblemTitle);
    }

    [Fact]
    public async Task BuyingPhotosChargesTheAccountAndThePhotosCannotBeBoughtTwice()
    {
        var token = await DanielToken();
        Assert.Equal("badOption", (await Post("photos/purchases", token, new { photoIds = new[] { "gangway" }, option = "dozen" })).ProblemTitle);
        var r = await Post("photos/purchases", token, new { photoIds = new[] { "gangway", "formal1" }, option = "each" });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(("each", 3990, 0, false), (r.Json.GetProperty("option").GetString(), (int)r.Json.GetProperty("paid").GetInt64(), r.Json.GetProperty("saved").GetInt32(), r.Json.GetProperty("verified").GetBoolean()));
        Assert.Equal(TripRules.ToMs(new DateTime(2027, 4, 12, 3, 59, 0, DateTimeKind.Utc)), r.Json.GetProperty("until").GetInt64());        // 23:59 Eastern fourteen days after the last day
        Assert.Equal(3990, (await FolioLines(token)).Single(l => l.GetProperty("description").GetString() == "Photos, 2 digital").GetProperty("cents").GetInt64());

        Assert.Equal("alreadyOwned", (await Post("photos/purchases", token, new { photoIds = new[] { "gangway" }, option = "each" })).ProblemTitle);
        var list = (await Read("photos", await SignIn(Priya))).Json;                                           // the booking owns them
        Assert.Equal(["gangway", "formal1"], Ids(list.GetProperty("owned")));
        Assert.Single(list.GetProperty("receipts").EnumerateArray());
    }

    [Fact]
    public async Task EveryPhotoForTheCruiseIsOneOptionThatSkipsWhatIsAlreadyOwned()
    {
        var token = await DanielToken();
        await Post("photos/purchases", token, new { photoIds = new[] { "gangway" }, option = "each" });
        SetNow(Utc(27, 16));                                                   // day 7: all but the second formal night's... every spot through day 7
        var r = await Post("photos/purchases", token, new { photoIds = new[] { "cozumel", "belize", "roatan", "pool" }, option = "all" });
        Assert.Equal(14995, r.Json.GetProperty("paid").GetInt64());
        Assert.Equal(new[] { "cozumel", "belize", "roatan", "pool", "dining", "formal1", "formal2" }.Order(), Ids(r.Json.GetProperty("photoIds")).Order());
        Assert.Equal("Photos, all digital for the cruise", (await FolioLines(token)).Single(l => l.GetProperty("cents").GetInt64() == 14995).GetProperty("description").GetString());
    }

    [Fact]
    public async Task APremierPackageIncludesTwelvePhotos()
    {
        Harper.FareId = "premier";
        var token = await DanielToken();
        Assert.Equal(12, (await Read("photos", token)).Json.GetProperty("includedLeft").GetInt32());
        var q = (await Post("photos/quote", token, new { photoIds = new[] { "gangway", "formal1" } })).Json;
        Assert.Equal((2, 0), (q.GetProperty("included").GetInt32(), q.GetProperty("paid").GetInt32()));

        var r = await Post("photos/purchases", token, new { photoIds = new[] { "gangway", "formal1" } });
        Assert.Equal(("included", 0), (r.Json.GetProperty("option").GetString(), (int)r.Json.GetProperty("paid").GetInt64()));
        Assert.Equal(10, (await Read("photos", token)).Json.GetProperty("includedLeft").GetInt32());
        var line = (await FolioLines(token)).Single(l => l.GetProperty("description").GetString() == "Photos, 2 digital");
        Assert.Equal(("package", 0), (line.GetProperty("coveredBy").GetString(), (int)line.GetProperty("cents").GetInt64()));
    }

    [Fact]
    public async Task PhotosAreSavedInBatchesOfFiveAndAreVerifiedWhenAllAreSaved()
    {
        var token = await DanielToken();
        SetNow(Utc(28, 3));                                                    // day 7: seven spots
        var id = (await Post("photos/purchases", token, new { photoIds = new[] { "gangway", "formal1", "cozumel", "belize", "roatan", "pool", "dining" }, option = "all" })).Json.GetProperty("id").GetString();
        var first = await Post($"photos/purchases/{id}/download", token);
        Assert.Equal((5, false), (first.Json.GetProperty("saved").GetInt32(), first.Json.GetProperty("verified").GetBoolean()));
        var second = await Post($"photos/purchases/{id}/download", token);
        Assert.Equal((8, true), (second.Json.GetProperty("saved").GetInt32(), second.Json.GetProperty("verified").GetBoolean()));       // "all" brings in every photo so far, formal night two as well
        Assert.Equal(8, (await Post($"photos/purchases/{id}/download", token)).Json.GetProperty("saved").GetInt32());

        SetNow(new DateTime(2027, 4, 13, 12, 0, 0, DateTimeKind.Utc));          // the fortnight to save them has passed
        var late = await Post($"photos/purchases/{id}/download", token);
        Assert.Equal((HttpStatusCode.Conflict, "expired"), (late.Status, late.ProblemTitle));
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"photos/purchases/{Guid.NewGuid()}/download", token)).Status);
    }

    // ---- Laundry ----

    private static JsonElement[] Windows(JsonElement view, string service) => [.. view.GetProperty("pickups").GetProperty(service).EnumerateArray()];

    [Fact]
    public async Task LaundryOffersPickUpWindowsOnBoardOnly()
    {
        var token = await DanielToken();
        SetNow(Utc(22, 16, 5));                                                // 12:05, so 13:00 is under an hour away
        var v = (await Read("laundry", token)).Json;
        Assert.True(v.GetProperty("canRequest").GetBoolean());
        Assert.Equal(6, Windows(v, "press").Length);
        Assert.Equal("18:00", Windows(v, "press")[0].GetProperty("time").GetString());
        Assert.False(v.GetProperty("freeBagLeft").GetBoolean());
        SetNow(BeforeSailing);
        Assert.Empty(Windows((await Read("laundry", token)).Json, "washFold"));
    }

    [Fact]
    public async Task ARequestIsPricedAndReachesTheAccountAtPickUpAndCanBeCancelledBeforeThen()
    {
        var token = await DanielToken();
        var pickup = Windows((await Read("laundry", token)).Json, "press")[0].GetProperty("at").GetInt64();
        var v = (await Post("laundry", token, new { service = "press", qty = 4, pickupAt = pickup, note = " starch " })).Json;
        var req = Assert.Single(v.GetProperty("requests").EnumerateArray());
        Assert.Equal((1200, "requested", "starch", pickup + 12 * 3_600_000L), (req.GetProperty("total").GetInt64() is var t ? (int)t : 0, req.GetProperty("stage").GetString(), req.GetProperty("note").GetString(), req.GetProperty("returnAt").GetInt64()));
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString() == "4 × pressing");        // not until the steward collects it

        SetNow(SeaDay.AddHours(7));                                            // after the 18:00 pick-up
        Assert.Contains(await FolioLines(token), l => l.GetProperty("description").GetString() == "4 × pressing" && l.GetProperty("cents").GetInt64() == 1200);
        var gone = await Delete($"laundry/{req.GetProperty("id").GetString()}", token);
        Assert.Equal((HttpStatusCode.Conflict, "tooLate"), (gone.Status, gone.ProblemTitle));
        Assert.Equal("cleaning", (await Read("laundry", token)).Json.GetProperty("requests")[0].GetProperty("stage").GetString());
        SetNow(SeaDay.AddHours(20));
        Assert.Equal("returned", (await Read("laundry", token)).Json.GetProperty("requests")[0].GetProperty("stage").GetString());
    }

    [Fact]
    public async Task CancellingBeforePickUpTakesTheChargeOffTheAccount()
    {
        var token = await DanielToken();
        var pickup = Windows((await Read("laundry", token)).Json, "press")[0].GetProperty("at").GetInt64();
        var id = (await Post("laundry", token, new { service = "press", qty = 1, pickupAt = pickup, note = "" })).Json.GetProperty("requests")[0].GetProperty("id").GetString();
        var v = (await Delete($"laundry/{id}", token)).Json;
        Assert.Equal("cancelled", v.GetProperty("requests")[0].GetProperty("stage").GetString());
        SetNow(SeaDay.AddHours(7));
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString() == "1 × pressing");
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"laundry/{Guid.NewGuid()}", token)).Status);
    }

    [Fact]
    public async Task TheFirstWashAndFoldBagIsFreeForAGuestWithThePerk()
    {
        GuestOf(Daniel).Tier = "platinum";
        var token = await DanielToken();
        var v = (await Read("laundry", token)).Json;
        Assert.True(v.GetProperty("freeBagLeft").GetBoolean());
        var at = Windows(v, "washFold")[0].GetProperty("at").GetInt64();
        var first = (await Post("laundry", token, new { service = "washFold", qty = 1, pickupAt = at, note = "" })).Json;
        Assert.Equal((0L, 1800L), (first.GetProperty("requests")[0].GetProperty("total").GetInt64(), first.GetProperty("requests")[0].GetProperty("free").GetInt64()));
        Assert.False(first.GetProperty("freeBagLeft").GetBoolean());
        var second = (await Post("laundry", token, new { service = "washFold", qty = 1, pickupAt = at, note = "" })).Json;
        Assert.Equal(1800, second.GetProperty("requests")[0].GetProperty("total").GetInt64());
    }

    [Theory]
    [InlineData("badService")]
    [InlineData("badQuantity")]
    [InlineData("badNote")]
    [InlineData("badPickup")]
    public async Task ARequestThatBreaksARuleIsRefused(string problem)
    {
        var token = await DanielToken();
        var at = Windows((await Read("laundry", token)).Json, "washFold")[0].GetProperty("at").GetInt64();
        object body = problem switch
        {
            "badService" => new { service = "ironing", qty = 1, pickupAt = at, note = "" },
            "badQuantity" => new { service = "washFold", qty = 4, pickupAt = at, note = "" },
            "badNote" => new { service = "washFold", qty = 1, pickupAt = at, note = new string('x', 201) },
            _ => new { service = "washFold", qty = 1, pickupAt = at + 60_000, note = "" },
        };
        var r = await Post("laundry", token, body);
        Assert.Equal((HttpStatusCode.BadRequest, problem), (r.Status, r.ProblemTitle));
        SetNow(BeforeSailing);
        Assert.Equal(HttpStatusCode.Conflict, (await Post("laundry", token, new { service = "press", qty = 1, pickupAt = at, note = "" })).Status);
    }

    // ---- Wi-Fi ----

    private static JsonElement[] Devices(JsonElement view) => [.. view.GetProperty("devices").EnumerateArray()];

    [Fact]
    public async Task APackageWifiDeviceIsFreeAndTheNextOnePays()
    {
        var token = await DanielToken();
        var v = (await Read("wifi", token)).Json;
        Assert.Equal((1, true), (v.GetProperty("includedLeft").GetInt32(), v.GetProperty("canBuy").GetBoolean()));

        var free = (await Post("wifi/devices", token, new { name = "Laptop", plan = "messaging", days = 3 })).Json;
        var laptop = Devices(free).Single();
        Assert.Equal(("surf", 8, true, 0L, 3000), (laptop.GetProperty("plan").GetString(), laptop.GetProperty("days").GetInt32(), laptop.GetProperty("included").GetBoolean(), laptop.GetProperty("paid").GetInt64(), laptop.GetProperty("capMb").GetInt32()));
        Assert.Equal(0, free.GetProperty("includedLeft").GetInt32());

        var paid = Devices((await Post("wifi/devices", token, new { name = "Phone", plan = "stream", days = 2 })).Json).Single(d => d.GetProperty("name").GetString() == "Phone");
        Assert.Equal((5998L, false), (paid.GetProperty("paid").GetInt64(), paid.GetProperty("included").GetBoolean()));
        Assert.Equal(JsonValueKind.Null, paid.GetProperty("capMb").ValueKind);
        var lines = await FolioLines(token);
        var laptopLine = lines.Single(l => l.GetProperty("description").GetString() == "Wi-Fi surf, Laptop, 8 days");
        Assert.Equal(("package", 0L), (laptopLine.GetProperty("coveredBy").GetString(), laptopLine.GetProperty("cents").GetInt64()));
        Assert.Equal(5998, lines.Single(l => l.GetProperty("description").GetString() == "Wi-Fi stream, Phone, 2 days").GetProperty("cents").GetInt64());
    }

    [Theory]
    [InlineData("badName")]
    [InlineData("duplicate")]
    [InlineData("badPlan")]
    [InlineData("badDays")]
    [InlineData("tooMany")]
    public async Task ADeviceThatBreaksARuleIsRefused(string problem)
    {
        var token = await DanielToken();
        await Post("wifi/devices", token, new { name = "Laptop", plan = "messaging", days = 1 });
        if (problem == "tooMany") for (var i = 2; i <= 6; i++) await Post("wifi/devices", token, new { name = $"Device {i}", plan = "messaging", days = 1 });
        object body = problem switch
        {
            "badName" => new { name = "L", plan = "surf", days = 1 },
            "duplicate" => new { name = "laptop", plan = "surf", days = 1 },
            "badPlan" => new { name = "Tablet", plan = "turbo", days = 1 },
            "badDays" => new { name = "Tablet", plan = "surf", days = 9 },
            _ => new { name = "Seventh", plan = "surf", days = 1 },
        };
        var r = await Post("wifi/devices", token, body);
        Assert.Equal((HttpStatusCode.BadRequest, problem), (r.Status, r.ProblemTitle));
    }

    [Fact]
    public async Task AnUpgradeCostsTheDifferenceForTheDaysLeftAndMustBeBetter()
    {
        var token = await DanielToken();
        await Post("wifi/devices", token, new { name = "Laptop", plan = "messaging", days = 1 });             // the included one
        var tablet = Devices((await Post("wifi/devices", token, new { name = "Tablet", plan = "messaging", days = 2 })).Json).Single(d => d.GetProperty("name").GetString() == "Tablet");
        var id = tablet.GetProperty("id").GetString();
        Assert.Equal(1998, tablet.GetProperty("paid").GetInt64());

        var up = Devices((await Put($"wifi/devices/{id}", token, new { plan = "surf" })).Json).Single(d => d.GetProperty("name").GetString() == "Tablet");
        Assert.Equal(("surf", 1998L + 2000L), (up.GetProperty("plan").GetString(), up.GetProperty("paid").GetInt64()));
        Assert.Equal(3998, (await FolioLines(token)).Single(l => l.GetProperty("description").GetString() == "Wi-Fi surf, Tablet, 2 days").GetProperty("cents").GetInt64());

        Assert.Equal("notAnUpgrade", (await Put($"wifi/devices/{id}", token, new { plan = "messaging" })).ProblemTitle);
        Assert.Equal("badPlan", (await Put($"wifi/devices/{id}", token, new { plan = "turbo" })).ProblemTitle);
        Assert.Equal(HttpStatusCode.NotFound, (await Put($"wifi/devices/{Guid.NewGuid()}", token, new { plan = "stream" })).Status);

        SetNow(SeaDay.AddDays(3));
        var view = (await Read("wifi", token)).Json;
        Assert.True(Devices(view).Single(d => d.GetProperty("name").GetString() == "Tablet").GetProperty("expired").GetBoolean());
        Assert.Equal("expired", (await Put($"wifi/devices/{id}", token, new { plan = "stream" })).ProblemTitle);
    }

    [Fact]
    public async Task RemovingADeviceTakesItsChargeOffTheAccountAndGivesBackAnIncludedSlot()
    {
        var token = await DanielToken();
        var id = Devices((await Post("wifi/devices", token, new { name = "Laptop", plan = "messaging", days = 1 })).Json)[0].GetProperty("id").GetString();
        var after = (await Delete($"wifi/devices/{id}", token)).Json;
        Assert.Empty(Devices(after));
        Assert.Equal(1, after.GetProperty("includedLeft").GetInt32());
        Assert.DoesNotContain(await FolioLines(token), l => l.GetProperty("description").GetString()!.StartsWith("Wi-Fi messaging, Laptop"));   // not the generated "Wi-Fi, one device" line
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"wifi/devices/{id}", token)).Status);
    }

    [Fact]
    public async Task AnUpgradedPackageDeviceStaysPackageCoveredAndOnlyTheExtraIsCharged()
    {
        var token = await DanielToken();
        var id = Devices((await Post("wifi/devices", token, new { name = "Laptop", plan = "messaging", days = 1 })).Json)[0].GetProperty("id").GetString();
        var up = Devices((await Put($"wifi/devices/{id}", token, new { plan = "stream" })).Json)[0];
        Assert.Equal((true, 8000L), (up.GetProperty("included").GetBoolean(), up.GetProperty("paid").GetInt64()));          // 10.00 a day more for eight days
    }

    // ---- Trip updates ----

    [Fact]
    public async Task ChangesInForceAreListedMostSeriousFirstAndAreAcknowledgedPerPerson()
    {
        Scenario(Daniel, "planChange", "portSkipped");
        var token = await DanielToken();
        var list = (await Read("updates", token)).Json;
        Assert.Equal(["portSkipped", "planChange"], list.EnumerateArray().Select(u => u.GetProperty("id").GetString()));
        Assert.Equal(["critical", "info"], list.EnumerateArray().Select(u => u.GetProperty("severity").GetString()));
        Assert.All(list.EnumerateArray(), u => { Assert.True(u.GetProperty("active").GetBoolean()); Assert.Equal(JsonValueKind.Null, u.GetProperty("ack").ValueKind); });

        var acked = (await Post("updates/portSkipped/ack", token, new { option = "credit" })).Json;
        var ack = acked[0].GetProperty("ack");
        Assert.Equal("credit", ack.GetProperty("option").GetString());
        Near(TripRules.ToMs(SeaDay), ack.GetProperty("at").GetInt64());
        Assert.Equal(JsonValueKind.Null, acked[1].GetProperty("ack").ValueKind);
        Assert.Empty((await Read("updates", await SignIn(Priya))).Json.EnumerateArray());                  // Priya has no scenarios
    }

    [Fact]
    public async Task AnAcknowledgementMustBeForARealChangeInForceWithAnOfferedOption()
    {
        Scenario(Daniel, "planChange");
        var token = await DanielToken();
        Assert.Equal("option", (await Post("updates/planChange/ack", token, new { option = "credit" })).ProblemTitle);
        Assert.Equal("option", (await Post("updates/chatSlow/ack", token, new { option = "ok" })).ProblemTitle);
        Assert.Equal("option", (await Post("updates/planChange/ack", token, new { })).ProblemTitle);
        var ended = await Post("updates/portSkipped/ack", token, new { option = "talk" });
        Assert.Equal((HttpStatusCode.Conflict, "ended"), (ended.Status, ended.ProblemTitle));
    }

    [Fact]
    public async Task AChangeThatHasEndedStaysInTheRecordOnceAcknowledged()
    {
        Scenario(Daniel, "planChange", "belizeTender");
        var token = await DanielToken();
        await Post("updates/planChange/ack", token, new { option = "ok" });
        Scenario(Daniel, "belizeTender");
        var list = (await Read("updates", token)).Json;
        Assert.Equal(["belizeTender", "planChange"], list.EnumerateArray().Select(u => u.GetProperty("id").GetString()));
        Assert.Equal([true, false], list.EnumerateArray().Select(u => u.GetProperty("active").GetBoolean()));
        Assert.Equal("ok", list[1].GetProperty("ack").GetProperty("option").GetString());
    }
}
