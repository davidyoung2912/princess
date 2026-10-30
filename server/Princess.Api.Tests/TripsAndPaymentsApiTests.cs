using System.Net;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class TripsAndPaymentsApiTests : JourneyWorld
{
    private const string Harpers = "/api/v1/bookings/PC243902";

    [Fact]
    public async Task TripsListTheCurrentBookingWithItsPaymentStateAndNextAction()
    {
        var r = await Get("/api/v1/trips", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var trip = r.Json.GetProperty("upcoming")[0];
        Assert.Equal("PC243902", trip.GetProperty("number").GetString());
        Assert.Equal("current", trip.GetProperty("kind").GetString());
        Assert.Equal("2027-03-21", trip.GetProperty("departure").GetString());
        Assert.Equal(3, trip.GetProperty("guests").GetInt32());
        Assert.Equal(16, trip.GetProperty("daysToDeparture").GetInt32());
        Assert.Equal("dueSoon", trip.GetProperty("payment").GetString());     // due 11 March, today is 5 March
        Assert.Equal("payDue", trip.GetProperty("next").GetString());
        Assert.Equal(981_000, trip.GetProperty("plan").GetProperty("balance").GetInt64());
        Assert.Equal("2026-10-22", trip.GetProperty("plan").GetProperty("booked").GetString());
        Assert.Equal("notOpen", trip.GetProperty("checkin").GetProperty("state").GetString());
        Assert.False(trip.TryGetProperty("agent", out _));
        Assert.Empty(r.Json.GetProperty("past").EnumerateArray());
    }

    [Fact]
    public async Task OverdueOnceTheDueDateHasPassedAndOpenOnceCheckinOpens()
    {
        SetNow(new DateTime(2027, 3, 12, 17, 0, 0, DateTimeKind.Utc));
        var trip = (await Get("/api/v1/trips", await SignIn(Daniel))).Json.GetProperty("upcoming")[0];
        Assert.Equal("overdue", trip.GetProperty("payment").GetString());
        Assert.Equal("payOverdue", trip.GetProperty("next").GetString());

        SetNow(new DateTime(2027, 3, 19, 17, 0, 0, DateTimeKind.Utc));
        var later = (await Get("/api/v1/trips/PC243902", await SignIn(Daniel))).Json;
        Assert.Equal("open", later.GetProperty("checkin").GetProperty("state").GetString());
    }

    [Fact]
    public async Task DocumentsSummaryCountsBlockingItemsAndPassportProblems()
    {
        Held(Priya, ("passport", new DateTime(2027, 8, 14)));   // six months short of the return
        var docs = (await Get("/api/v1/trips/PC243902", await SignIn(Daniel))).Json.GetProperty("documents");
        Assert.Equal(3, docs.GetProperty("guests").GetInt32());
        Assert.Equal(2, docs.GetProperty("missing").GetInt32());
        Assert.Equal(1, docs.GetProperty("passportProblems").GetInt32());
        Assert.Equal("documents", (await Get("/api/v1/trips/PC243902", await SignIn(Daniel))).Json.GetProperty("next").GetString());
    }

    [Fact]
    public async Task AStrangerCannotSeeSomeoneElsesTrip()
    {
        var token = await SignIn(Stranger);
        var r = await Get("/api/v1/trips/PC243902", token);
        Assert.Equal(HttpStatusCode.NotFound, r.Status);
        Assert.Equal("notFound", r.ProblemType);
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/v1/trips/PC000000", token)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/v1/trips/nope", token)).Status);
        var list = (await Get("/api/v1/trips", token)).Json.GetProperty("upcoming");
        Assert.Equal(["PC179254"], list.EnumerateArray().Select(t => t.GetProperty("number").GetString()));
    }

    [Fact]
    public async Task SailedAndCancelledBookingsMoveToPastNewestFirst()
    {
        F.Journey.Bookings.Add(new BookingRow
        {
            BookingId = 20, Number = "PC111111", Kind = "direct", BookerUserId = Daniel.Id, SailingId = "sun-2026-11-08", SailingTitle = "Autumn Caribbean", ShipName = "Sun Princess",
            Departure = new DateTime(2026, 11, 8), Nights = 7, CategoryName = "Balcony", Status = "confirmed", TotalCents = 1, DepositCents = 1, FinalDueDate = new DateTime(2026, 8, 10), ConfirmedAt = new DateTime(2026, 5, 1),
        });
        F.Journey.Bookings.Add(new BookingRow
        {
            BookingId = 21, Number = "PC222222", Kind = "direct", BookerUserId = Daniel.Id, SailingId = "sun-2027-05-02", SailingTitle = "Spring Caribbean", ShipName = "Sun Princess",
            Departure = new DateTime(2027, 5, 2), Nights = 7, CategoryName = "Balcony", Status = "cancelled", TotalCents = 1, DepositCents = 1, FinalDueDate = new DateTime(2027, 2, 1), ConfirmedAt = new DateTime(2026, 5, 1),
        });
        F.Journey.Party[20] = [new GuestRow { UserId = Daniel.Id, PublicId = Daniel.PublicId }];
        F.Journey.Party[21] = [new GuestRow { UserId = Daniel.Id, PublicId = Daniel.PublicId }];
        F.Journey.PastTrips.Add(new PastTripRow { Id = "past-daniel-1", Title = "Bahamas", Ship = "Regal Princess", Departure = new DateTime(2025, 6, 22), Nights = 4 });

        var r = await Get("/api/v1/trips", await SignIn(Daniel));
        Assert.Equal(["PC243902"], r.Json.GetProperty("upcoming").EnumerateArray().Select(t => t.GetProperty("number").GetString()));
        var past = r.Json.GetProperty("past").EnumerateArray().ToList();
        Assert.Equal(["PC222222", "sun-2026-11-08", "past-daniel-1"], past.Select(p => p.GetProperty("id").GetString()));
        Assert.True(past[0].GetProperty("cancelled").GetBoolean());
        Assert.False(past[1].TryGetProperty("cancelled", out _));
    }

    // ---- Linking ----

    [Fact]
    public async Task LinkingAnAgentBookingNeedsNumberNameAndDateTogether()
    {
        var token = await SignIn(Priya);
        var ok = await Call(HttpMethod.Post, "/api/v1/trips/link", token, new LinkTripRequest("ag7p-31bk", "whitfield", "2027-03-21"));
        Assert.Equal(HttpStatusCode.OK, ok.Status);
        Assert.Equal("linked", ok.Json.GetProperty("kind").GetString());
        Assert.Equal("Harbour Travel", ok.Json.GetProperty("agent").GetString());
        Assert.Equal(JsonNull, ok.Json.GetProperty("documents").ValueKind);

        var list = await Get("/api/v1/trips", token);
        Assert.Equal(["PC243902", "AG7P31BK"], list.Json.GetProperty("upcoming").EnumerateArray().Select(t => t.GetProperty("number").GetString()));
        Assert.Equal(HttpStatusCode.OK, (await Get("/api/v1/trips/AG7P31BK", token)).Status);
        Assert.Contains(F.Journey.History, h => h.UserId == Priya.Id && h.What == "trip");
    }

    private const System.Text.Json.JsonValueKind JsonNull = System.Text.Json.JsonValueKind.Null;

    [Theory]
    [InlineData("AG7P31BK", "Smith", "2027-03-21")]       // wrong name
    [InlineData("AG7P31BK", "Whitfield", "2027-03-28")]   // wrong date
    [InlineData("AG0000ZZ", "Whitfield", "2027-03-21")]   // no such booking
    [InlineData("PC243902", "Harper", "2027-03-21")]      // a real direct booking is not linkable
    public async Task EveryMismatchLooksTheSame(string number, string name, string date)
    {
        var r = await Call(HttpMethod.Post, "/api/v1/trips/link", await SignIn(Stranger), new LinkTripRequest(number, name, date));
        Assert.Equal(HttpStatusCode.NotFound, r.Status);
        Assert.Equal("noMatch", r.ProblemTitle);
    }

    [Theory]
    [InlineData("AG7", "Whitfield", "2027-03-21")]
    [InlineData("AG7P31BK", "", "2027-03-21")]
    [InlineData("AG7P31BK", "Whitfield", "March 21")]
    public async Task ATypingSlipIsInvalid(string number, string name, string date)
    {
        var r = await Call(HttpMethod.Post, "/api/v1/trips/link", await SignIn(Stranger), new LinkTripRequest(number, name, date));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
        Assert.Equal("format", r.ProblemTitle);
    }

    [Fact]
    public async Task LinkingTwiceIsAConflictAndASupervisedAccountCannotLink()
    {
        var token = await SignIn(Priya);
        var body = new LinkTripRequest("AG7P31BK", "Whitfield", "2027-03-21");
        await Call(HttpMethod.Post, "/api/v1/trips/link", token, body);
        var again = await Call(HttpMethod.Post, "/api/v1/trips/link", token, body);
        Assert.Equal(HttpStatusCode.Conflict, again.Status);
        Assert.Equal("alreadyLinked", again.ProblemTitle);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Post, "/api/v1/trips/link", await ViewAsToken(Daniel, Maya), body)).Status);
    }

    [Fact]
    public async Task LinkingIsRateLimitedPerPerson()
    {
        using var limited = new ApiFactory { LoginAttemptsPerMinute = 3 };
        var user = limited.Users.Add("r@demo.princess.example", Password, first: "R");
        using var http = limited.CreateClient();
        var login = await http.PostAsJsonAsyncCompat("/api/v1/auth/login", new LoginRequest(user.Email, Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var token = System.Text.Json.JsonDocument.Parse(await login.Content.ReadAsStringAsync()).RootElement.GetProperty("accessToken").GetString()!;
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/trips/link") { Content = System.Net.Http.Json.JsonContent.Create(new LinkTripRequest("AG0000ZZ", "X", "2027-03-21")) };
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            codes.Add((await http.SendAsync(req)).StatusCode);
        }
        Assert.Equal([HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests], codes);
    }

    // ---- Core and sailings ----

    [Fact]
    public async Task BookingCoreAndPublicSailings()
    {
        F.Journey.Sailings.Add(new SailingRow { Id = "sun-2027-03-21", Departure = new DateTime(2027, 3, 21), IsReference = true });
        var core = await Get($"{Harpers}", await SignIn(Priya));
        Assert.Equal(Priya.PublicId, core.Json.GetProperty("personaId").GetGuid());
        Assert.Equal(Daniel.PublicId, core.Json.GetProperty("bookerId").GetGuid());
        Assert.Equal(3, core.Json.GetProperty("party").GetArrayLength());
        Assert.Equal("plus", core.Json.GetProperty("package").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Harpers}", await SignIn(Stranger))).Status);

        var sailings = await Get("/api/v1/sailings", null);
        Assert.Equal(HttpStatusCode.OK, sailings.Status);
        Assert.Equal("2027-03-21", sailings.Json[0].GetProperty("departure").GetString());
    }

    // ---- Payments ----

    [Fact]
    public async Task PaymentsShowReceiptsAndCards()
    {
        var r = await Get($"{Harpers}/payments", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var receipt = r.Json.GetProperty("receipts")[0];
        Assert.Equal("deposit", receipt.GetProperty("label").GetString());
        Assert.Equal(245_300, receipt.GetProperty("cents").GetInt64());
        Assert.Equal("Visa ending 4242", receipt.GetProperty("method").GetString());
        Assert.Equal("4242", r.Json.GetProperty("cards")[0].GetProperty("last4").GetString());
        Assert.True(r.Json.GetProperty("canPay").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Harpers}/payments", await SignIn(Stranger))).Status);
    }

    [Fact]
    public async Task PayingTheBalanceRecordsAReceiptAndSettlesTheTrip()
    {
        var token = await SignIn(Daniel);
        var card = F.Journey.Cards.Single(c => c.UserId == Daniel.Id).Card;
        var r = await Call(HttpMethod.Post, $"{Harpers}/payments/balance", token, new PayBalanceRequest(card.PublicId));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("paid", r.Json.GetProperty("trip").GetProperty("payment").GetString());
        var receipts = r.Json.GetProperty("receipts").EnumerateArray().ToList();
        Assert.Equal(["deposit", "balance"], receipts.Select(x => x.GetProperty("label").GetString()));
        Assert.Equal(981_000, receipts[1].GetProperty("cents").GetInt64());
        Assert.Contains(F.Journey.History, h => h.What == "payment" && h.Detail.Contains("9810.00") && h.Detail.Contains("Visa ending 4242"));

        var again = await Call(HttpMethod.Post, $"{Harpers}/payments/balance", token, new PayBalanceRequest(card.PublicId));
        Assert.Equal(HttpStatusCode.Conflict, again.Status);
        Assert.Equal("paid", again.ProblemTitle);
        Assert.Single(F.Journey.Payments, p => p.BookingId == 10 && p.Row.Label == "balance");
    }

    [Fact]
    public async Task PayingNeedsAUsableCardAndAnAdultMember()
    {
        var token = await SignIn(Daniel);
        var expired = await Call(HttpMethod.Post, "/api/v1/me/cards", token, new AddCardRequest("visa", "1111", "01/27"));
        Assert.Equal(HttpStatusCode.BadRequest, expired.Status);   // already expired when added
        F.Journey.Cards.Add((Daniel.Id, new CardRow { Id = 9, PublicId = Guid.NewGuid(), Brand = "amex", Last4 = "0005", Expiry = "02/27" }));
        var old = F.Journey.Cards.Last().Card.PublicId;
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, $"{Harpers}/payments/balance", token, new PayBalanceRequest(old))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, $"{Harpers}/payments/balance", token, new PayBalanceRequest(Guid.NewGuid()))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, $"{Harpers}/payments/balance", token, new PayBalanceRequest(null))).Status);

        // Someone else's card is not usable, and a supervised child cannot pay at all; a stranger gets notFound.
        var danielsCard = F.Journey.Cards.First(c => c.UserId == Daniel.Id).Card.PublicId;
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, $"{Harpers}/payments/balance", await SignIn(Priya), new PayBalanceRequest(danielsCard))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Post, $"{Harpers}/payments/balance", await ViewAsToken(Daniel, Maya), new PayBalanceRequest(danielsCard))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Post, $"{Harpers}/payments/balance", await SignIn(Stranger), new PayBalanceRequest(danielsCard))).Status);
        Assert.DoesNotContain(F.Journey.Payments, p => p.Row.Label == "balance");
    }

    [Fact]
    public async Task ACancelledBookingCannotBePaid()
    {
        Harper.Status = "cancelled";
        var card = F.Journey.Cards.Single(c => c.UserId == Daniel.Id).Card;
        var r = await Call(HttpMethod.Post, $"{Harpers}/payments/balance", await SignIn(Daniel), new PayBalanceRequest(card.PublicId));
        Assert.Equal(HttpStatusCode.Conflict, r.Status);
    }

    [Fact]
    public async Task CardsAreAddedAndRemovedAndNeverStoreMoreThanTheLastFour()
    {
        var token = await SignIn(Priya);
        var added = await Call(HttpMethod.Post, "/api/v1/me/cards", token, new AddCardRequest("mastercard", "4444", "12/30"));
        Assert.Equal(HttpStatusCode.OK, added.Status);
        var card = added.Json[0];
        Assert.Equal("mastercard", card.GetProperty("brand").GetString());
        Assert.Equal(["id", "brand", "last4", "expiry"], card.EnumerateObject().Select(p => p.Name));
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/cards", token, new AddCardRequest("visa", "42424242", "12/30"))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/cards", token, new AddCardRequest("diners", "4242", "12/30"))).Status);

        var id = card.GetProperty("id").GetGuid();
        // Someone else's card id is a notFound, not a deletion.
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Delete, $"/api/v1/me/cards/{id}", await SignIn(Daniel))).Status);
        var removed = await Call(HttpMethod.Delete, $"/api/v1/me/cards/{id}", token);
        Assert.Equal(HttpStatusCode.OK, removed.Status);
        Assert.Empty(removed.Json.EnumerateArray());
        Assert.Equal(["card", "card"], F.Journey.History.Where(h => h.UserId == Priya.Id).Select(h => h.What));
    }
}

internal static class HttpExtensions
{
    public static Task<HttpResponseMessage> PostAsJsonAsyncCompat(this HttpClient http, string url, object body) =>
        System.Net.Http.Json.HttpClientJsonExtensions.PostAsJsonAsync(http, url, body);
}
