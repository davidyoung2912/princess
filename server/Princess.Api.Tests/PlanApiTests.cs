using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The pre-cruise plan over the real pipeline. The Harpers (Balcony, Princess Plus) sail 21 March 2027; "now" is 5 March, 16 days out.</summary>
public class PlanApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static readonly DateTime Mar12 = new(2027, 3, 12, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Mar19 = new(2027, 3, 19, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Mar21 = new(2027, 3, 21, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Mar23 = new(2027, 3, 23, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Mar22 = new(2027, 3, 22, 17, 0, 0, DateTimeKind.Utc);

    private object[] Card(long cents)
    {
        var card = F.Journey.Cards.First(c => c.UserId == Daniel.Id).Card;
        card.IsDefault = true;
        return [new { method = "card", cardId = card.PublicId, cents }];
    }

    private void Paid() => Harper.PaidCents = Harper.TotalCents;

    private Task<Reply> Put(string url, string token, object body) => Call(HttpMethod.Put, url, token, body);
    private Task<Reply> Post(string url, string token, object? body = null) => Call(HttpMethod.Post, url, token, body ?? new { });
    private Task<Reply> Delete(string url, string token) => Call(HttpMethod.Delete, url, token);

    private static JsonElement Offer(Reply r, string id) => r.Json.GetProperty("offers").EnumerateArray().First(o => o.GetProperty("item").GetProperty("id").GetString() == id);

    // ---- Access ----

    [Fact]
    public async Task AnyGuestOnTheBookingMayReadItAndStrangersGetNotFound()
    {
        foreach (var path in new[] { "plan", "excursions", "dining", "packages", "checklist", "packing", "travel", "assistance" })
        {
            Assert.Equal(HttpStatusCode.OK, (await Get($"{Base}/{path}", await SignIn(Priya))).Status);
            Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Base}/{path}", await SignIn(Stranger))).Status);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/v1/bookings/ZZ000000/plan", await SignIn(Daniel))).Status);
    }

    [Fact]
    public async Task ASupervisedChildCanLookButNotChange()
    {
        var maya = MayaToken();
        var view = await Get($"{Base}/excursions", maya);
        Assert.Equal(HttpStatusCode.OK, view.Status);
        Assert.False(view.Json.GetProperty("canBook").GetBoolean());
        Assert.False((await Get($"{Base}/packages", maya)).Json.GetProperty("canBuy").GetBoolean());
        Assert.False((await Get($"{Base}/assistance", maya)).Json.GetProperty("canRequest").GetBoolean());

        var write = await Put($"{Base}/excursions/cart/coz-snorkel", maya, new { guests = new[] { Maya.PublicId } });
        Assert.Equal(HttpStatusCode.Forbidden, write.Status);
        Assert.Equal("supervised", write.ProblemTitle);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put($"{Base}/checklist/names", maya, new { done = true })).Status);
    }

    // ---- Excursions ----

    [Fact]
    public async Task ListsEveryTourWithPlacesLeftAndTheItineraryDay()
    {
        var r = await Get($"{Base}/excursions", await SignIn(Daniel));
        Assert.Equal(12, r.Json.GetProperty("offers").GetArrayLength());
        Assert.Equal(3, r.Json.GetProperty("party").GetArrayLength());
        Assert.True(r.Json.GetProperty("canBook").GetBoolean());
        Assert.Equal(16, r.Json.GetProperty("daysToDeparture").GetInt32());
        var snorkel = Offer(r, "coz-snorkel");
        Assert.Equal("2027-03-23", snorkel.GetProperty("date").GetString());
        Assert.Equal(3, snorkel.GetProperty("day").GetInt32());
        Assert.Equal("15:45", snorkel.GetProperty("backBy").GetString());
        Assert.Equal(JsonValueKind.Null, snorkel.GetProperty("timing").ValueKind);
        Assert.True(Offer(r, "bze-reef").GetProperty("tender").GetBoolean());
        Assert.Equal(0, Offer(r, "rtb-zip").GetProperty("spots").GetInt32());
        Assert.Equal("Reef snorkel by boat", snorkel.GetProperty("item").GetProperty("name").GetString());
    }

    [Fact]
    public async Task PlacesLeftAreSharedWithEveryOtherBookingOnTheSailing()
    {
        var before = Offer(await Get($"{Base}/excursions", await SignIn(Daniel)), "coz-ruins").GetProperty("spots").GetInt32();
        F.Plan.Tours.Add((11, new TourRow { Id = 1, PublicId = Guid.NewGuid(), ExcursionId = "coz-ruins", Day = 3, TotalCents = 6_900, GuestIds = [101, 102, 103], At = DateTime.UtcNow }));
        F.Plan.Tours.Add((11, new TourRow { Id = 2, PublicId = Guid.NewGuid(), ExcursionId = "coz-ruins", Day = 3, TotalCents = 6_900, Status = "cancelled", GuestIds = [104], At = DateTime.UtcNow }));
        var after = Offer(await Get($"{Base}/excursions", await SignIn(Daniel)), "coz-ruins").GetProperty("spots").GetInt32();
        Assert.Equal(before - 3, after);                            // the cancelled tour frees its places
    }

    [Fact]
    public async Task PutsToursInTheCartAndPricesChildrenLess()
    {
        var daniel = await SignIn(Daniel);
        var r = await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId, Maya.PublicId } });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(7_900 + 5_500, r.Json.GetProperty("cartTotal").GetInt64());      // a child pays 70%, to the dollar
        Assert.Equal(1, r.Json.GetProperty("cart").GetArrayLength());

        var replaced = await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId } });
        Assert.Equal(7_900, replaced.Json.GetProperty("cartTotal").GetInt64());
        Assert.Equal(1, replaced.Json.GetProperty("cart").GetArrayLength());
        Assert.Equal(0, (await Delete($"{Base}/excursions/cart/coz-snorkel", daniel)).Json.GetProperty("cart").GetArrayLength());
    }

    [Theory]
    [InlineData("coz-snorkel", "age", true)]          // a child alone, with no adult
    [InlineData("bze-cave", "age", false)]            // strenuous: twelve and over
    [InlineData("rtb-zip", "soldOut", false)]
    public async Task RefusesToursThatBreakTheRules(string tour, string why, bool childOnly)
    {
        var guests = childOnly ? new[] { Maya.PublicId } : new[] { Daniel.PublicId, Maya.PublicId };
        if (tour == "rtb-zip") guests = [Daniel.PublicId];
        var r = await Put($"{Base}/excursions/cart/{tour}", await SignIn(Daniel), new { guests });
        Assert.Equal(HttpStatusCode.Conflict, r.Status);
        Assert.Equal("conflict", r.ProblemType);
        Assert.Equal(why, r.ProblemTitle);
    }

    [Fact]
    public async Task RefusesOverlappingToursForTheSamePersonButNotDifferentPeople()
    {
        var daniel = await SignIn(Daniel);
        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId } });
        var clash = await Put($"{Base}/excursions/cart/coz-ruins", daniel, new { guests = new[] { Daniel.PublicId, Priya.PublicId } });
        Assert.Equal("overlap", clash.ProblemTitle);
        var fine = await Put($"{Base}/excursions/cart/coz-ruins", daniel, new { guests = new[] { Priya.PublicId } });
        Assert.Equal(HttpStatusCode.OK, fine.Status);
        Assert.Equal(2, fine.Json.GetProperty("cart").GetArrayLength());
    }

    [Fact]
    public async Task BadTourOrGuestIsInvalid()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("tour", (await Put($"{Base}/excursions/cart/nope", daniel, new { guests = new[] { Daniel.PublicId } })).ProblemTitle);
        Assert.Equal("guests", (await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Stranger.PublicId } })).ProblemTitle);
        Assert.Equal("guests", (await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = Array.Empty<Guid>() })).ProblemTitle);
    }

    [Fact]
    public async Task CheckoutChargesTheCardBooksTheToursAndEmptiesTheCart()
    {
        var daniel = await SignIn(Daniel);
        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId, Priya.PublicId } });
        await Put($"{Base}/excursions/cart/bze-walk", daniel, new { guests = new[] { Daniel.PublicId } });
        var total = 2 * 7_900 + 4_500;

        Assert.Equal("payment", (await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(total - 1) })).ProblemTitle);       // does not add up

        var r = await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(total) });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(0, r.Json.GetProperty("cart").GetArrayLength());
        var booked = r.Json.GetProperty("booked");
        Assert.Equal(2, booked.GetArrayLength());
        Assert.Equal("Visa ending 4242", booked[0].GetProperty("methods")[0].GetString());
        Assert.Equal("booked", booked[0].GetProperty("status").GetString());
        var payment = Assert.Single(F.Plan.Payments);
        Assert.Equal("tour", payment.Payment.Label);
        Assert.Equal(total, payment.Payment.AmountCents);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(1) })).Status);   // the cart is now empty
    }

    [Fact]
    public async Task ABankDeclineBooksNothingAndTakesNoMoney()
    {
        var daniel = await SignIn(Daniel);
        var card = F.Journey.Cards.First(c => c.UserId == Daniel.Id).Card;
        card.IsDefault = true;
        card.Last4 = "0002";
        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId } });
        var r = await Post($"{Base}/excursions/checkout", daniel, new { parts = new[] { new { method = "card", cardId = card.PublicId, cents = 7_900 } } });
        Assert.Equal(HttpStatusCode.PaymentRequired, r.Status);
        Assert.Equal("declined", r.ProblemType);
        Assert.Empty(F.Plan.Payments);
        Assert.Empty(F.Plan.Tours);
        Assert.Single((await Get($"{Base}/excursions", daniel)).Json.GetProperty("cart").EnumerateArray());   // still in the cart
    }

    [Fact]
    public async Task ThePremierCreditPaysFirstAndOnlyTheRestIsCharged()
    {
        var daniel = await SignIn(Daniel);
        // Premier: $100 of excursion credit each. Upgrade Daniel and Priya, then book $158 of tours.
        F.Plan.Purchases.Add((10, new PurchaseRow { Id = 70, PublicId = Guid.NewGuid(), Kind = "upgrade", ItemId = "plus>premier", Units = 2, UnitCents = 21_000, TotalCents = 42_000, At = DateTime.UtcNow, GuestIds = [Daniel.Id, Priya.Id] }));
        var packages = await Get($"{Base}/packages", daniel);
        Assert.Equal(20_000, packages.Json.GetProperty("credit").GetProperty("total").GetInt64());

        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId, Priya.PublicId } });
        var cart = await Get($"{Base}/excursions", daniel);
        Assert.Equal(15_800, cart.Json.GetProperty("cartTotal").GetInt64());
        Assert.Equal(15_800, cart.Json.GetProperty("creditApplied").GetInt64());     // the credit covers it all

        var r = await Post($"{Base}/excursions/checkout", daniel, new { });           // no card needed
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Empty(F.Plan.Payments);
        Assert.Equal(15_800, r.Json.GetProperty("booked")[0].GetProperty("credit").GetInt64());
        Assert.Equal(4_200, r.Json.GetProperty("creditLeft").GetInt64());
    }

    [Fact]
    public async Task CancellingEarlyRefundsTheCardInFullAndCancellingLateKeepsTheFee()
    {
        var daniel = await SignIn(Daniel);
        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId } });
        await Put($"{Base}/excursions/cart/bze-walk", daniel, new { guests = new[] { Daniel.PublicId } });
        var booked = (await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(7_900 + 4_500) })).Json.GetProperty("booked");
        var snorkel = booked.EnumerateArray().First(b => b.GetProperty("excursionId").GetString() == "coz-snorkel");
        var walk = booked.EnumerateArray().First(b => b.GetProperty("excursionId").GetString() == "bze-walk");
        Assert.True(snorkel.GetProperty("cancel").GetProperty("free").GetBoolean());

        var early = await Delete($"{Base}/excursions/bookings/{snorkel.GetProperty("id").GetString()}", daniel);
        Assert.Equal(HttpStatusCode.OK, early.Status);
        var gone = early.Json.GetProperty("booked").EnumerateArray().First(b => b.GetProperty("excursionId").GetString() == "coz-snorkel");
        Assert.Equal("cancelled", gone.GetProperty("status").GetString());
        Assert.Equal(7_900, gone.GetProperty("cancel").GetProperty("refund").GetInt64());
        Assert.Contains(F.Plan.Payments, p => p.Payment.Label == "refund" && p.Payment.AmountCents == -7_900);

        SetNow(Mar23);      // the Belize walk is on the 24th: one day away is too late for a free cancel
        var late = await Delete($"{Base}/excursions/bookings/{walk.GetProperty("id").GetString()}", daniel);
        var kept = late.Json.GetProperty("booked").EnumerateArray().First(b => b.GetProperty("excursionId").GetString() == "bze-walk").GetProperty("cancel");
        Assert.Single(F.Plan.Payments, p => p.Payment.Label == "refund");                                // the late cancel refunds nothing
        Assert.Equal(4_500, kept.GetProperty("fee").GetInt64());
        Assert.False(kept.GetProperty("free").GetBoolean());
    }

    [Fact]
    public async Task ChangingGuestsRefundsOnlyThePeopleTakenOff()
    {
        var daniel = await SignIn(Daniel);
        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId, Priya.PublicId } });
        var id = (await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(15_800) })).Json.GetProperty("booked")[0].GetProperty("id").GetString();

        var r = await Put($"{Base}/excursions/bookings/{id}", daniel, new { guests = new[] { Daniel.PublicId } });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var tour = r.Json.GetProperty("booked")[0];
        Assert.Equal(7_900, tour.GetProperty("total").GetInt64());
        Assert.Single(tour.GetProperty("guests").EnumerateArray());
        Assert.Contains(F.Plan.Payments, p => p.Payment.AmountCents == -7_900);

        Assert.Equal("guests", (await Put($"{Base}/excursions/bookings/{id}", daniel, new { guests = new[] { Maya.PublicId } })).ProblemTitle);   // cannot add someone new
        Assert.Equal(HttpStatusCode.NotFound, (await Put($"{Base}/excursions/bookings/{Guid.NewGuid()}", daniel, new { guests = new[] { Daniel.PublicId } })).Status);
    }

    [Fact]
    public async Task ToursCloseOnSailingDay()
    {
        SetNow(Mar21);
        var r = await Put($"{Base}/excursions/cart/coz-snorkel", await SignIn(Daniel), new { guests = new[] { Daniel.PublicId } });
        Assert.Equal("closed", r.ProblemTitle);
        Assert.False((await Get($"{Base}/excursions", await SignIn(Daniel))).Json.GetProperty("canBook").GetBoolean());
    }

    // ---- Dining ----

    [Fact]
    public async Task DiningOpensOnlyOncePaidInFullUnlessThePersonIsPlatinumOrElite()
    {
        var daniel = await SignIn(Daniel);
        var closed = await Get($"{Base}/dining", daniel);
        Assert.False(closed.Json.GetProperty("window").GetProperty("open").GetBoolean());
        Assert.Equal("awaitingPayment", closed.Json.GetProperty("window").GetProperty("reason").GetString());
        Assert.Equal("2027-03-11", closed.Json.GetProperty("window").GetProperty("opensOn").GetString());
        Assert.Equal("notOpen", (await Post($"{Base}/dining/reservations", daniel, new { venueId = "crown", day = 3, time = "18:30", guests = new[] { Daniel.PublicId } })).ProblemTitle);

        GuestOf(Daniel).Tier = "platinum";
        Assert.True((await Get($"{Base}/dining", daniel)).Json.GetProperty("window").GetProperty("open").GetBoolean());
        GuestOf(Daniel).Tier = "none";
        Paid();
        Assert.True((await Get($"{Base}/dining", daniel)).Json.GetProperty("window").GetProperty("open").GetBoolean());
    }

    private async Task<Reply> Reserve(string token, string venue, int day, string time, params UserRecord[] who) =>
        await Post($"{Base}/dining/reservations", token, new { venueId = venue, day, time, guests = who.Select(u => u.PublicId).ToArray(), note = "Window seat" });

    [Fact]
    public async Task ReservesATableAndCoversSpecialtyDinnersWithThePackage()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var r = await Reserve(daniel, "crown", 3, "18:30", Daniel, Priya);       // Princess Plus: two specialty dinners each
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var table = r.Json.GetProperty("reservations")[0];
        Assert.Equal("crown", table.GetProperty("venueId").GetString());
        Assert.Equal(2, table.GetProperty("covered").GetArrayLength());
        Assert.Equal(0, table.GetProperty("charge").GetInt64());
        Assert.Equal("2027-03-22", table.GetProperty("reminderOn").GetString());
        Assert.Equal("Window seat", table.GetProperty("note").GetString());
        Assert.Equal(3 * 2 - 2, r.Json.GetProperty("mealsLeft").GetInt32());     // Daniel, Priya and Maya hold two each; two are used

        // A party of three with only one dinner left each: the guest without cover pays the cover charge.
        var more = await Reserve(daniel, "sabatini", 4, "18:00", Daniel, Priya, Maya);     // each still has a dinner left, so all three are covered
        Assert.Equal(HttpStatusCode.OK, more.Status);
        Assert.Equal(3, more.Json.GetProperty("reservations")[1].GetProperty("covered").GetArrayLength());
        Assert.Equal(1, more.Json.GetProperty("mealsLeft").GetInt32());
    }

    [Fact]
    public async Task ChargesTheCoverForGuestsWhoseDinnersAreUsedUp()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        await Reserve(daniel, "crown", 3, "18:30", Daniel, Priya);
        await Reserve(daniel, "sabatini", 4, "18:00", Daniel, Priya);
        var third = await Reserve(daniel, "catch", 5, "18:30", Daniel, Priya);       // two used each, none left
        var table = third.Json.GetProperty("reservations").EnumerateArray().First(t => t.GetProperty("venueId").GetString() == "catch");
        Assert.Equal(0, table.GetProperty("covered").GetArrayLength());
        Assert.Equal(2 * 4_800, table.GetProperty("charge").GetInt64());
    }

    [Fact]
    public async Task TableCapacityIsSharedWithEveryBookingOnTheSailing()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        // Crown Grill night 3 at 18:30 has two tables; another booking holds both.
        Assert.Equal(2, (await Get($"{Base}/dining/slots?venue=crown&day=3", daniel)).Json.EnumerateArray().First(s => s.GetProperty("time").GetString() == "18:30").GetProperty("tables").GetInt32());
        for (var i = 0; i < 2; i++) F.Plan.Tables.Add((11, new TableRow { Id = 500 + i, PublicId = Guid.NewGuid(), VenueId = "crown", Day = 3, Time = "18:30", GuestIds = [900 + i], At = DateTime.UtcNow }, "booked"));
        var slots = await Get($"{Base}/dining/slots?venue=crown&day=3", daniel);
        Assert.Equal(0, slots.Json.EnumerateArray().First(s => s.GetProperty("time").GetString() == "18:30").GetProperty("tables").GetInt32());
        Assert.Equal("full", (await Reserve(daniel, "crown", 3, "18:30", Daniel)).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Reserve(daniel, "crown", 3, "20:00", Daniel)).Status);
    }

    [Fact]
    public async Task StopsTwoTablesAtOnceBadVenuesAndChildrenAlone()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        await Reserve(daniel, "crown", 3, "18:30", Daniel);
        Assert.Equal("clash", (await Reserve(daniel, "sabatini", 3, "18:30", Daniel, Priya)).ProblemTitle);     // Daniel is at Crown Grill within the sitting
        Assert.Equal(HttpStatusCode.OK, (await Reserve(daniel, "sabatini", 4, "18:00", Daniel, Priya)).Status);
        Assert.Equal("age", (await Reserve(daniel, "catch", 6, "18:00", Maya)).ProblemTitle);
        Assert.Equal("venue", (await Reserve(daniel, "alfredo", 3, "18:30", Daniel)).ProblemTitle);               // walk-in only
        Assert.Equal("venue", (await Reserve(daniel, "crown", 9, "18:30", Daniel)).ProblemTitle);
        Assert.Equal("venue", (await Reserve(daniel, "crown", 3, "21:30", Daniel)).ProblemTitle);
        Assert.Equal("guests", (await Reserve(daniel, "crown", 4, "18:30", Stranger)).ProblemTitle);
    }

    [Fact]
    public async Task FixedSeatingGuestsCannotReserveTheMainDiningRoom()
    {
        Paid();
        Harper.Dining = "early";
        var daniel = await SignIn(Daniel);
        var view = await Get($"{Base}/dining", daniel);
        Assert.Equal("early", view.Json.GetProperty("plan").GetString());
        Assert.Equal("17:00", view.Json.GetProperty("seating").GetString());
        Assert.Equal("fixedSeating", (await Reserve(daniel, "eclipse", 3, "18:30", Daniel)).ProblemTitle);
        Harper.Dining = "anytime";
        var anytime = await Get($"{Base}/dining", daniel);
        Assert.Equal(JsonValueKind.Null, anytime.Json.GetProperty("seating").ValueKind);
        Assert.Equal(HttpStatusCode.OK, (await Reserve(daniel, "eclipse", 3, "18:30", Daniel)).Status);
    }

    [Fact]
    public async Task MovesATableInPlaceAndALostMoveLeavesTheOriginalAlone()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var id = (await Reserve(daniel, "crown", 3, "18:30", Daniel, Priya)).Json.GetProperty("reservations")[0].GetProperty("id").GetString();
        await Reserve(daniel, "sabatini", 4, "20:30", Daniel);

        var moved = await Post($"{Base}/dining/reservations/{id}/move", daniel, new { day = 3, time = "20:00" });
        Assert.Equal(HttpStatusCode.OK, moved.Status);
        var crown = moved.Json.GetProperty("reservations").EnumerateArray().First(r => r.GetProperty("id").GetString() == id);
        Assert.Equal("20:00", crown.GetProperty("time").GetString());
        Assert.Equal(2, moved.Json.GetProperty("reservations").GetArrayLength());       // never doubled or missing

        Assert.Equal("unchanged", (await Post($"{Base}/dining/reservations/{id}/move", daniel, new { day = 3, time = "20:00" })).ProblemTitle);
        Assert.Equal("clash", (await Post($"{Base}/dining/reservations/{id}/move", daniel, new { day = 4, time = "20:30" })).ProblemTitle);
        var still = (await Get($"{Base}/dining", daniel)).Json.GetProperty("reservations").EnumerateArray().First(r => r.GetProperty("id").GetString() == id);
        Assert.Equal(3, still.GetProperty("day").GetInt32());
        Assert.Equal("20:00", still.GetProperty("time").GetString());
        Assert.Equal("slot", (await Post($"{Base}/dining/reservations/{id}/move", daniel, new { day = 12, time = "20:30" })).ProblemTitle);
    }

    [Fact]
    public async Task TellsTheRestaurantYouAreLateBetweenFiveAndThirtyMinutesAndCancelsATable()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        var id = (await Reserve(daniel, "crown", 3, "18:30", Daniel)).Json.GetProperty("reservations")[0].GetProperty("id").GetString();
        Assert.Equal(15, (await Post($"{Base}/dining/reservations/{id}/late", daniel, new { minutes = 15 })).Json.GetProperty("reservations")[0].GetProperty("lateMinutes").GetInt32());
        Assert.Equal("minutes", (await Post($"{Base}/dining/reservations/{id}/late", daniel, new { minutes = 4 })).ProblemTitle);
        Assert.Equal("minutes", (await Post($"{Base}/dining/reservations/{id}/late", daniel, new { minutes = 31 })).ProblemTitle);
        Assert.Equal(0, (await Delete($"{Base}/dining/reservations/{id}", daniel)).Json.GetProperty("reservations").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"{Base}/dining/reservations/{id}", daniel)).Status);
    }

    [Fact]
    public async Task ADinnerThatHasAlreadyStartedCannotBeBookedAndOnboardDiningStaysOpen()
    {
        Paid();
        SetNow(Mar22);                // night 1 was 21 March
        var daniel = await SignIn(Daniel);
        Assert.Equal("closed", (await Reserve(daniel, "crown", 1, "18:00", Daniel)).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Reserve(daniel, "crown", 5, "18:30", Daniel)).Status);
        Assert.True((await Get($"{Base}/dining", daniel)).Json.GetProperty("canBook").GetBoolean());
    }

    [Fact]
    public async Task DietaryNeedsGoWithTheReservation()
    {
        Paid();
        F.Journey.Profiles[Priya.Id].Dietary = ["vegan"];
        var r = await Reserve(await SignIn(Daniel), "crown", 3, "18:30", Daniel, Priya);
        var note = Assert.Single(r.Json.GetProperty("reservations")[0].GetProperty("dietary").EnumerateArray());
        Assert.Equal("Priya", note.GetProperty("name").GetString());
        Assert.Equal("vegan", note.GetProperty("needs")[0].GetString());
    }

    // ---- Packages ----

    [Fact]
    public async Task ShowsWhatEachGuestGetsFromTheirFareTierAndSuite()
    {
        GuestOf(Priya).Tier = "platinum";
        var r = await Get($"{Base}/packages", await SignIn(Daniel));
        var people = r.Json.GetProperty("people").EnumerateArray().ToList();
        var daniel = people.First(p => p.GetProperty("id").GetGuid() == Daniel.PublicId);
        Assert.Equal("plus", daniel.GetProperty("package").GetString());
        Assert.Equal(15, daniel.GetProperty("entitlements").GetProperty("drinkCapUsd").GetInt32());
        Assert.Equal(2, daniel.GetProperty("balances").GetProperty("specialtyMeals").GetProperty("remaining").GetInt32());
        var priya = people.First(p => p.GetProperty("id").GetGuid() == Priya.PublicId);
        Assert.Equal(2, priya.GetProperty("entitlements").GetProperty("wifiDevices").GetInt32());        // the package's plus the tier's
        Assert.Contains("priorityEmbarkation", priya.GetProperty("entitlements").GetProperty("perks").EnumerateArray().Select(p => p.GetString()));
        Assert.Equal(0, r.Json.GetProperty("credit").GetProperty("total").GetInt64());                  // Plus has no excursion credit
    }

    [Fact]
    public async Task OffersUpgradesNetOfGratuitiesAndAddOnsOnlyToEligibleGuests()
    {
        var r = await Get($"{Base}/packages", await SignIn(Daniel));
        var up = r.Json.GetProperty("upgrades")[0].GetProperty("options")[0];
        Assert.Equal("premier", up.GetProperty("to").GetString());
        Assert.Equal(21_000, up.GetProperty("price").GetInt64());
        Assert.Equal("2027-03-07", up.GetProperty("changeOn").GetString());
        Assert.Equal(23_100, up.GetProperty("changesTo").GetInt64());
        var drinks = r.Json.GetProperty("addOns").EnumerateArray().First(a => a.GetProperty("id").GetString() == "drinks");
        Assert.Equal(5_200, drinks.GetProperty("price").GetInt64());
        Assert.DoesNotContain(Maya.PublicId, drinks.GetProperty("eligible").EnumerateArray().Select(e => e.GetProperty("id").GetGuid()));    // under 21
        Assert.Equal(2, drinks.GetProperty("eligible").GetArrayLength());
    }

    [Fact]
    public async Task BuyingAnUpgradeChargesForEveryGuestAndRaisesThePackage()
    {
        var daniel = await SignIn(Daniel);
        var r = await Post($"{Base}/packages/purchases", daniel, new { kind = "upgrade", to = "premier", guests = new[] { Daniel.PublicId, Priya.PublicId }, parts = Card(42_000) });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var buy = r.Json.GetProperty("purchases")[0];
        Assert.Equal("upgrade", buy.GetProperty("kind").GetString());
        Assert.Equal("premier", buy.GetProperty("item").GetString());
        Assert.Equal(42_000, buy.GetProperty("total").GetInt64());
        Assert.Equal("same", buy.GetProperty("price").GetProperty("state").GetString());
        Assert.Equal("upgrade", Assert.Single(F.Plan.Payments).Payment.Label);
        var daniel2 = r.Json.GetProperty("people").EnumerateArray().First(p => p.GetProperty("id").GetGuid() == Daniel.PublicId);
        Assert.Equal("premier", daniel2.GetProperty("package").GetString());
        Assert.Equal(100, daniel2.GetProperty("entitlements").GetProperty("excursionCreditUsd").GetInt32());
        Assert.Equal(20_000, r.Json.GetProperty("credit").GetProperty("total").GetInt64());

        var again = await Post($"{Base}/packages/purchases", daniel, new { kind = "upgrade", to = "premier", guests = new[] { Daniel.PublicId }, parts = Card(21_000) });
        Assert.Equal("alreadyHeld", again.ProblemTitle);
    }

    [Fact]
    public async Task AGuestWhoStartsFromADifferentPackageNeedsASeparatePurchase()
    {
        var daniel = await SignIn(Daniel);
        await Post($"{Base}/packages/purchases", daniel, new { kind = "upgrade", to = "premier", guests = new[] { Daniel.PublicId }, parts = Card(21_000) });
        F.Plan.Purchases.Clear();
        Harper.FareId = "standard";
        await Post($"{Base}/packages/purchases", daniel, new { kind = "upgrade", to = "plus", guests = new[] { Priya.PublicId }, parts = Card(4_350 * 7) });
        var mixed = await Post($"{Base}/packages/purchases", daniel, new { kind = "upgrade", to = "premier", guests = new[] { Daniel.PublicId, Priya.PublicId }, parts = Card(1) });
        Assert.Equal("mixedStart", mixed.ProblemTitle);
    }

    [Fact]
    public async Task AddOnsFollowTheAgeAndOnePerGuestRules()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("age", (await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "drinks", guests = new[] { Maya.PublicId }, parts = Card(1) })).ProblemTitle);
        Assert.Equal("item", (await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "yacht", guests = new[] { Daniel.PublicId }, parts = Card(1) })).ProblemTitle);
        Assert.Equal("kind", (await Post($"{Base}/packages/purchases", daniel, new { kind = "gift", guests = new[] { Daniel.PublicId } })).ProblemTitle);

        var bought = await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "wifi", guests = new[] { Daniel.PublicId }, parts = Card(3_000 * 7) });
        Assert.Equal(HttpStatusCode.OK, bought.Status);
        Assert.Equal("purchase", Assert.Single(F.Plan.Payments).Payment.Label);
        var d = bought.Json.GetProperty("people").EnumerateArray().First(p => p.GetProperty("id").GetGuid() == Daniel.PublicId);
        Assert.Equal(2, d.GetProperty("entitlements").GetProperty("wifiDevices").GetInt32());      // the package's one plus this add-on
        Assert.Equal("held", (await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "wifi", guests = new[] { Daniel.PublicId }, parts = Card(3_000 * 7) })).ProblemTitle);
    }

    [Fact]
    public async Task APriceRiseIsLockedForThoseWhoBoughtBeforeIt()
    {
        var daniel = await SignIn(Daniel);
        await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "drinks", guests = new[] { Daniel.PublicId, Priya.PublicId }, parts = Card(2 * 5_200 * 7) });
        SetNow(Mar12);        // nine days out: drinks have gone from $52 to $59 a night
        var buy = (await Get($"{Base}/packages", daniel)).Json.GetProperty("purchases")[0];
        Assert.Equal(5_200, buy.GetProperty("unit").GetInt64());
        Assert.Equal("locked", buy.GetProperty("price").GetProperty("state").GetString());
        Assert.Equal(700, buy.GetProperty("price").GetProperty("perUnit").GetInt64());
        Assert.Equal(14 * 700, buy.GetProperty("price").GetProperty("total").GetInt64());
        Assert.Equal("nothing", (await Post($"{Base}/packages/purchases/{buy.GetProperty("id").GetString()}/claim-drop", daniel)).ProblemTitle);
    }

    [Fact]
    public async Task APriceDropIsOwedAsACreditThatCanBeTakenOnce()
    {
        var daniel = await SignIn(Daniel);
        await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "photo", guests = new[] { Daniel.PublicId }, parts = Card(14_900) });
        SetNow(Mar12);        // photo packages fall by 20% from ten days out
        var id = (await Get($"{Base}/packages", daniel)).Json.GetProperty("purchases")[0];
        Assert.Equal("dropped", id.GetProperty("price").GetProperty("state").GetString());
        Assert.Equal(3_000, id.GetProperty("price").GetProperty("total").GetInt64());

        var claimed = await Post($"{Base}/packages/purchases/{id.GetProperty("id").GetString()}/claim-drop", daniel);
        Assert.Equal(HttpStatusCode.OK, claimed.Status);
        Assert.Equal(3_000, claimed.Json.GetProperty("purchases")[0].GetProperty("credited").GetInt64());
        Assert.Equal("nothing", (await Post($"{Base}/packages/purchases/{id.GetProperty("id").GetString()}/claim-drop", daniel)).ProblemTitle);
    }

    [Fact]
    public async Task APurchaseCanBeCancelledForARefundUntilThreeDaysBeforeSailing()
    {
        var daniel = await SignIn(Daniel);
        await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "photo", guests = new[] { Daniel.PublicId, Priya.PublicId }, parts = Card(2 * 14_900) });
        await Post($"{Base}/packages/purchases", daniel, new { kind = "addOn", item = "laundry", guests = new[] { Daniel.PublicId }, parts = Card(9_900) });
        var ps = (await Get($"{Base}/packages", daniel)).Json.GetProperty("purchases").EnumerateArray().ToList();
        var photo = ps.First(p => p.GetProperty("item").GetString() == "photo").GetProperty("id").GetString();
        var laundry = ps.First(p => p.GetProperty("item").GetString() == "laundry").GetProperty("id").GetString();

        var gone = await Delete($"{Base}/packages/purchases/{photo}", daniel);
        Assert.Equal(HttpStatusCode.OK, gone.Status);
        Assert.Equal("cancelled", gone.Json.GetProperty("purchases").EnumerateArray().First(p => p.GetProperty("id").GetString() == photo).GetProperty("status").GetString());
        Assert.Contains(F.Plan.Payments, p => p.Payment.Label == "refund" && p.Payment.AmountCents == -2 * 14_900);
        Assert.Contains("photo", gone.Json.GetProperty("addOns").EnumerateArray().Where(a => a.GetProperty("eligible").GetArrayLength() == 3).Select(a => a.GetProperty("id").GetString()));   // eligible again

        SetNow(new DateTime(2027, 3, 19, 17, 0, 0, DateTimeKind.Utc));      // two days out
        Assert.Equal("locked", (await Delete($"{Base}/packages/purchases/{laundry}", daniel)).ProblemTitle);
    }

    [Fact]
    public async Task PurchasesNeedAnAdultAndCloseOnSailingDay()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await Post($"{Base}/packages/purchases", MayaToken(), new { kind = "addOn", item = "wifi", guests = new[] { Maya.PublicId } })).Status);
        SetNow(Mar21);
        Assert.Equal("closed", (await Post($"{Base}/packages/purchases", await SignIn(Daniel), new { kind = "addOn", item = "wifi", guests = new[] { Daniel.PublicId }, parts = Card(1) })).ProblemTitle);
    }

    // ---- Checklist, packing, travel ----

    [Fact]
    public async Task TheChecklistTicksWhatTheAppSeesAndLetsTheGuestTickTheRest()
    {
        var daniel = await SignIn(Daniel);
        var r = await Get($"{Base}/checklist", daniel);
        Assert.Equal(14, r.Json.GetProperty("entries").GetArrayLength());
        Assert.Equal(6, r.Json.GetProperty("milestones").GetArrayLength());
        var pay = r.Json.GetProperty("entries").EnumerateArray().First(e => e.GetProperty("id").GetString() == "pay");
        Assert.Equal("overdue", pay.GetProperty("state").GetString());                  // 90 days before sailing has gone

        Paid();
        var paid = await Get($"{Base}/checklist", daniel);
        var done = paid.Json.GetProperty("entries").EnumerateArray().First(e => e.GetProperty("id").GetString() == "pay");
        Assert.Equal("done", done.GetProperty("state").GetString());
        Assert.True(done.GetProperty("automatic").GetBoolean());
        Assert.Equal("invalid", (await Put($"{Base}/checklist/pay", daniel, new { done = true })).ProblemType);      // the app ticks this one itself

        var ticked = await Put($"{Base}/checklist/names", daniel, new { done = true });
        Assert.Equal("done", ticked.Json.GetProperty("entries").EnumerateArray().First(e => e.GetProperty("id").GetString() == "names").GetProperty("state").GetString());
        var undone = await Put($"{Base}/checklist/names", daniel, new { done = false });
        Assert.NotEqual("done", undone.Json.GetProperty("entries").EnumerateArray().First(e => e.GetProperty("id").GetString() == "names").GetProperty("state").GetString());
        Assert.Equal("item", (await Put($"{Base}/checklist/nope", daniel, new { done = true })).ProblemTitle);
    }

    [Fact]
    public async Task BookingThingsTicksTheirChecklistItems()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        State GetState(JsonElement json, string id) => new(json.GetProperty("entries").EnumerateArray().First(e => e.GetProperty("id").GetString() == id).GetProperty("state").GetString()!);
        Assert.NotEqual("done", GetState((await Get($"{Base}/checklist", daniel)).Json, "dining").Value);
        await Reserve(daniel, "crown", 3, "18:30", Daniel);
        await Put($"{Base}/travel", daniel, new { window = "11:00", mode = "drive", hotel = (string?)null });
        await Post($"{Base}/assistance", daniel, new { kind = "tender", guest = Priya.PublicId, note = "" });
        var after = (await Get($"{Base}/checklist", daniel)).Json;
        Assert.Equal("done", GetState(after, "dining").Value);
        Assert.Equal("done", GetState(after, "travel").Value);
        Assert.Equal("done", GetState(after, "assistance").Value);
        Assert.Equal("done", GetState(after, "documents").Value);       // everyone holds what they need
        Assert.NotEqual("done", GetState(after, "tours").Value);
    }

    private readonly record struct State(string Value);

    [Fact]
    public async Task ThePackingListFollowsThePartyAndTheToursBooked()
    {
        var daniel = await SignIn(Daniel);
        var r = await Get($"{Base}/packing", daniel);
        var ids = r.Json.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()).ToList();
        Assert.Contains("games", ids);                       // Maya is eight
        Assert.DoesNotContain("swimDiapers", ids);
        Assert.DoesNotContain("waterShoes", ids);
        Assert.Contains("tenderBag", ids);
        Assert.Equal(7, r.Json.GetProperty("nights").GetInt32());
        Assert.Equal(84, r.Json.GetProperty("weather").GetProperty("highF").GetInt32());              // March

        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId } });
        await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(7_900) });
        F.Journey.Profiles[Priya.Id].Needs = ["cpap"];
        var more = (await Get($"{Base}/packing", daniel)).Json.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()).ToList();
        Assert.Contains("waterShoes", more);
        Assert.Contains("cpap", more);
    }

    [Fact]
    public async Task PackingItemsAreTickedAndUnticked()
    {
        var daniel = await SignIn(Daniel);
        var r = await Put($"{Base}/packing/passport", daniel, new { done = true });
        Assert.Equal(["passport"], r.Json.GetProperty("ticked").EnumerateArray().Select(t => t.GetString()));
        Assert.Empty((await Put($"{Base}/packing/passport", daniel, new { done = false })).Json.GetProperty("ticked").EnumerateArray());
        Assert.Equal("item", (await Put($"{Base}/packing/cpap", daniel, new { done = true })).ProblemTitle);         // not on this party's list
    }

    [Fact]
    public async Task TheTravelPlanOffersTheEarlyWindowOnlyToPriorityGuests()
    {
        var daniel = await SignIn(Daniel);
        var view = await Get($"{Base}/travel", daniel);
        Assert.Equal(5, view.Json.GetProperty("windows").GetArrayLength());
        Assert.False(view.Json.GetProperty("priority").GetBoolean());
        Assert.Equal("11:00", view.Json.GetProperty("suggested").GetString());
        Assert.Equal("choices", (await Put($"{Base}/travel", daniel, new { window = "10:30", mode = "drive", hotel = (string?)null })).ProblemTitle);
        Assert.Equal("choices", (await Put($"{Base}/travel", daniel, new { window = "11:00", mode = "teleport", hotel = (string?)null })).ProblemTitle);

        var saved = await Put($"{Base}/travel", daniel, new { window = "11:30", mode = "transfer", hotel = "harbour" });
        Assert.Equal("11:30", saved.Json.GetProperty("plan").GetProperty("window").GetString());
        Assert.Equal("harbour", (await Get($"{Base}/travel", await SignIn(Priya))).Json.GetProperty("plan").GetProperty("hotel").GetString());       // shared by the booking

        GuestOf(Daniel).Tier = "elite";
        var priority = await Get($"{Base}/travel", daniel);
        Assert.Equal(6, priority.Json.GetProperty("windows").GetArrayLength());
        Assert.Equal("10:30", priority.Json.GetProperty("suggested").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Put($"{Base}/travel", daniel, new { window = "10:30", mode = "drive", hotel = (string?)null })).Status);
    }

    // ---- Assistance ----

    [Fact]
    public async Task AssistanceRecordsTheNeedOnTheProfileAndFlagsLateRequests()
    {
        var daniel = await SignIn(Daniel);
        var view = await Get($"{Base}/assistance", daniel);
        Assert.Equal(9, view.Json.GetProperty("deadlines").GetArrayLength());

        var r = await Post($"{Base}/assistance", daniel, new { kind = "wheelchair", guest = Priya.PublicId, note = "" });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var req = r.Json.GetProperty("requests")[0];
        Assert.Equal("wheelchair", req.GetProperty("kind").GetString());
        Assert.Equal("late", req.GetProperty("status").GetString());           // 30 days notice; there are 16
        Assert.Contains("mobility", F.Journey.Profiles[Priya.Id].Needs);
        Assert.Equal("mobility", r.Json.GetProperty("needs").GetProperty(Priya.PublicId.ToString()).EnumerateArray().Select(n => n.GetString()).Single());

        var tender = await Post($"{Base}/assistance", daniel, new { kind = "tender", guest = Priya.PublicId, note = "" });
        Assert.Equal("received", tender.Json.GetProperty("requests").EnumerateArray().First(q => q.GetProperty("kind").GetString() == "tender").GetProperty("status").GetString());
        Assert.Single(F.Journey.Profiles[Priya.Id].Needs);                     // the need is only recorded once

        SetNow(Mar19);
        Assert.Equal("confirmed", (await Get($"{Base}/assistance", daniel)).Json.GetProperty("requests").EnumerateArray().First(q => q.GetProperty("kind").GetString() == "tender").GetProperty("status").GetString());
    }

    [Fact]
    public async Task AssistanceRefusesDuplicatesMissingNotesAndUnknownKinds()
    {
        var daniel = await SignIn(Daniel);
        Assert.Equal("note", (await Post($"{Base}/assistance", daniel, new { kind = "oxygen", guest = Daniel.PublicId, note = " " })).ProblemTitle);
        Assert.Equal("kind", (await Post($"{Base}/assistance", daniel, new { kind = "jetpack", guest = Daniel.PublicId, note = "" })).ProblemTitle);
        Assert.Equal("guest", (await Post($"{Base}/assistance", daniel, new { kind = "cpap", guest = Stranger.PublicId, note = "" })).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/assistance", daniel, new { kind = "cpap", guest = Daniel.PublicId, note = "" })).Status);
        Assert.Equal("duplicate", (await Post($"{Base}/assistance", daniel, new { kind = "cpap", guest = Daniel.PublicId, note = "" })).ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/assistance", daniel, new { kind = "cpap", guest = Priya.PublicId, note = "" })).Status);   // another guest may ask
    }

    [Fact]
    public async Task AWithdrawnRequestGoesAndCanBeMadeAgain()
    {
        var daniel = await SignIn(Daniel);
        var id = (await Post($"{Base}/assistance", daniel, new { kind = "dietary", guest = Daniel.PublicId, note = "No shellfish" })).Json.GetProperty("requests")[0].GetProperty("id").GetString();
        Assert.Equal(0, (await Delete($"{Base}/assistance/{id}", daniel)).Json.GetProperty("requests").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await Delete($"{Base}/assistance/{id}", daniel)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Base}/assistance", daniel, new { kind = "dietary", guest = Daniel.PublicId, note = "No shellfish" })).Status);
    }

    // ---- Overview ----

    [Fact]
    public async Task TheOverviewShowsBookedToursAndTablesAndTheGaps()
    {
        Paid();
        var daniel = await SignIn(Daniel);
        await Put($"{Base}/excursions/cart/coz-snorkel", daniel, new { guests = new[] { Daniel.PublicId } });
        await Post($"{Base}/excursions/checkout", daniel, new { parts = Card(7_900) });
        await Reserve(daniel, "crown", 3, "18:30", Daniel);

        var r = await Get($"{Base}/plan", daniel);
        Assert.Equal(8, r.Json.GetProperty("days").GetArrayLength());
        Assert.Equal(16, r.Json.GetProperty("daysToDeparture").GetInt32());
        Assert.Equal("2027-03-21", r.Json.GetProperty("departure").GetString());
        var day3 = r.Json.GetProperty("days")[2];
        Assert.Equal(["tour", "allAboard", "dinner"], day3.GetProperty("entries").EnumerateArray().Select(e => e.GetProperty("kind").GetString()));
        Assert.Equal(0, day3.GetProperty("gaps").GetArrayLength());
        Assert.Equal(["tour", "dinner"], r.Json.GetProperty("days")[3].GetProperty("gaps").EnumerateArray().Select(g => g.GetString()));
        Assert.Equal("Cozumel, Mexico", day3.GetProperty("place").GetString());
    }
}
