using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>Shared setup: eight sailings, a clock on 29 October 2026, and Daniel with his default Visa, a second card the bank challenges, and a card it declines.</summary>
public abstract class BookingWorld : JourneyWorld
{
    protected const string Api = "/api/v1";
    protected const string March = "sun-2027-03-21";
    protected readonly CardRow DefaultCard, NewCard, DeclinedCard;

    protected BookingWorld()
    {
        foreach (var (id, date, holiday) in new[]
        {
            ("sun-2026-11-08", "2026-11-08", false), ("sun-2026-11-22", "2026-11-22", false), ("sun-2026-12-06", "2026-12-06", false), ("sun-2026-12-27", "2026-12-27", true),
            ("sun-2027-01-17", "2027-01-17", false), ("sun-2027-02-07", "2027-02-07", false), ("sun-2027-02-28", "2027-02-28", false), ("sun-2027-03-21", "2027-03-21", false),
        })
            F.Journey.Sailings.Add(new SailingRow { Id = id, Departure = DateTime.Parse(date), IsHoliday = holiday, IsReference = id == March });

        SetNow(new DateTime(2026, 10, 29, 17, 0, 0, DateTimeKind.Utc));
        DefaultCard = F.Journey.Cards.First(c => c.UserId == Daniel.Id).Card;
        DefaultCard.IsDefault = true;
        NewCard = AddCard("mastercard", "5454", "12/30");
        DeclinedCard = AddCard("visa", "0002", "12/30");
    }

    private CardRow AddCard(string brand, string last4, string expiry)
    {
        var card = new CardRow { Id = 7000 + F.Journey.Cards.Count, PublicId = Guid.NewGuid(), Brand = brand, Last4 = last4, Expiry = expiry };
        F.Journey.Cards.Add((Daniel.Id, card));
        return card;
    }

    protected static object Person(string first, string last, string dob) => new
    {
        firstName = first, lastName = last, dob, gender = "F", citizenship = "us", needs = new string[0], dietaryStatus = "none", dietary = new string[0], allergyNote = "",
    };

    protected static Dictionary<string, object?> GoodDraft(string sailing = March, string category = "balcony", string fare = "plus", int guests = 2, string id = "draft-abc12345",
        string cabinMode = "guaranteed", string cabinNumber = "", string loyalty = "", bool useCredit = false) => new()
    {
        ["id"] = id, ["sailingId"] = sailing, ["category"] = category, ["guests"] = guests, ["cabinMode"] = cabinMode, ["cabinNumber"] = cabinNumber, ["fare"] = fare,
        ["people"] = new[] { Person("Daniel", "Harper", "1982-04-10"), Person("Priya", "Harper", "1984-06-02"), Person("Asha", "Harper", "1990-01-01"), Person("Ravi", "Harper", "1991-01-01") }.Take(guests).ToArray(),
        ["contact"] = new { email = "daniel@demo.princess.example", phone = "555-010-0142", street = "1 Main St", city = "Reno", region = "NV", postcode = "89501", country = "United States" },
        ["dining"] = "anytime", ["occasion"] = "none", ["loyaltyNumber"] = loyalty, ["useCredit"] = useCredit,
        ["accepted"] = new { terms = true, health = true, age = true, pregnancy = true },
    };

    protected static object Card(CardRow c, long cents) => new { method = "card", cardId = c.PublicId, cents };

    protected static object Wallet(long cents) => new { method = "wallet", cents };

    protected async Task<Reply> Send(HttpMethod method, string url, string? token, object? body = null, string? key = null)
    {
        var req = new HttpRequestMessage(method, url);
        if (token is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (key is not null) req.Headers.Add("Idempotency-Key", key);
        if (body is not null) req.Content = JsonContent.Create(body);
        var res = await Http.SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        var json = text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone();
        var problem = res.Content.Headers.ContentType?.MediaType == "application/problem+json";
        return new Reply(res.StatusCode, json, problem ? json.GetProperty("type").GetString() : null, problem ? json.GetProperty("title").GetString() : null);
    }

    protected async Task<long> TotalOf(string token, Dictionary<string, object?> draft)
    {
        var q = await Send(HttpMethod.Post, $"{Api}/booking/quote", token, draft);
        Assert.Equal(HttpStatusCode.OK, q.Status);
        return q.Json.GetProperty("total").GetInt64();
    }

    protected Task<Reply> Book(string token, Dictionary<string, object?> draft, long total, string option, object[] parts, string? challenge = null, string? key = null) =>
        Send(HttpMethod.Post, $"{Api}/bookings", token, new { draft, expectedTotal = total, option, parts, challenge }, key);

    /// <summary>Books the draft with a deposit on the default card and returns the booking number.</summary>
    protected async Task<string> BookDeposit(string token, Dictionary<string, object?> draft)
    {
        var total = await TotalOf(token, draft);
        var deposit = Pricing.PayPlanFor(total, DateOnly.FromDateTime(DateTime.Parse("2027-03-21")), 143).Deposit;
        var r = await Book(token, draft, total, "deposit", [Card(DefaultCard, deposit)]);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        return r.Json.GetProperty("number").GetString()!;
    }
}

public class DiscoverApiTests : BookingWorld
{
    [Fact]
    public async Task OffersListEverySailingWithItsFromPriceToAnyone()
    {
        var r = await Send(HttpMethod.Get, $"{Api}/sailings/offers", null);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(8, r.Json.GetArrayLength());
        var first = r.Json[0];
        Assert.Equal("sun-2026-11-08", first.GetProperty("id").GetString());
        Assert.Equal(153_900, first.GetProperty("from").GetProperty("fare").GetInt64());
        Assert.Equal(23_600, first.GetProperty("from").GetProperty("taxes").GetInt64());
        Assert.True(r.Json.EnumerateArray().Single(s => s.GetProperty("id").GetString() == "sun-2026-12-27").GetProperty("holiday").GetBoolean());
    }

    [Fact]
    public async Task DatesShowDaysToGoAndCloseASailingTheDayItLeaves()
    {
        F.Clock.UtcNow = new DateTime(2026, 11, 7, 17, 0, 0, DateTimeKind.Utc);
        var one = (await Send(HttpMethod.Get, $"{Api}/sailings/bookable", null)).Json.EnumerateArray().First();
        Assert.Equal(1, one.GetProperty("daysToDeparture").GetInt32());
        Assert.True(one.GetProperty("open").GetBoolean());

        F.Clock.UtcNow = new DateTime(2026, 11, 8, 17, 0, 0, DateTimeKind.Utc);
        var zero = (await Send(HttpMethod.Get, $"{Api}/sailings/bookable", null)).Json.EnumerateArray().First();
        Assert.Equal(0, zero.GetProperty("daysToDeparture").GetInt32());
        Assert.False(zero.GetProperty("open").GetBoolean());
    }

    [Fact]
    public async Task AManuallyClosedSailingIsNotOpen()
    {
        F.Journey.Sailings.Single(s => s.Id == March).BookingOpen = false;
        var march = (await Send(HttpMethod.Get, $"{Api}/sailings/bookable", null)).Json.EnumerateArray().Single(s => s.GetProperty("id").GetString() == March);
        Assert.False(march.GetProperty("open").GetBoolean());
    }

    [Fact]
    public async Task QuotesAnAllInEstimateAndRefusesWhatItCannotPrice()
    {
        var r = await Send(HttpMethod.Get, $"{Api}/sailings/{March}/quote?category=balcony&guests=2", null);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(550_800 + 47_200 + 23_100, r.Json.GetProperty("total").GetInt64());     // fare, taxes and fees, gratuities
        Assert.False(r.Json.TryGetProperty("fare", out _));
        Assert.Equal(["fare", "taxes", "gratuities"], r.Json.GetProperty("lines").EnumerateArray().Select(l => l.GetProperty("key").GetString()));

        foreach (var url in new[] { $"{Api}/sailings/nope/quote?category=balcony&guests=2", $"{Api}/sailings/{March}/quote?category=nope&guests=2", $"{Api}/sailings/{March}/quote?category=balcony&guests=9", $"{Api}/sailings/{March}/quote?category=balcony" })
        {
            var bad = await Send(HttpMethod.Get, url, null);
            Assert.Equal(HttpStatusCode.BadRequest, bad.Status);
            Assert.Equal("invalid", bad.ProblemType);
        }
    }

    [Fact]
    public async Task RoomsListEveryTypeWithItsFareCapacityAndIncludedPackage()
    {
        var r = await Send(HttpMethod.Get, $"{Api}/sailings/{March}/rooms", null);
        Assert.Equal(6, r.Json.GetArrayLength());
        var suite = r.Json.EnumerateArray().Single(x => x.GetProperty("id").GetString() == "signatureSuite");
        Assert.Equal(3, suite.GetProperty("capacity").GetInt32());
        Assert.Equal("premier", suite.GetProperty("includes").GetString());
        var interior = r.Json[0];
        Assert.Equal(189_900, interior.GetProperty("fare").GetInt64());
        Assert.Equal(JsonValueKind.Null, interior.GetProperty("includes").ValueKind);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, $"{Api}/sailings/nope/rooms", null)).Status);
    }

    [Fact]
    public async Task CabinsAreTheSampleRoomsAndBookedOnesDropOut()
    {
        var before = await Send(HttpMethod.Get, $"{Api}/sailings/{March}/cabins?category=interior", null);
        Assert.Equal(9, before.Json.GetArrayLength());
        var first = before.Json[0];
        Assert.Equal("8188", first.GetProperty("number").GetString());
        Assert.Equal("forward", first.GetProperty("position").GetString());
        Assert.True(first.GetProperty("available").GetBoolean());

        var token = await SignIn(Daniel);
        var draft = GoodDraft(category: "interior", fare: "standard", cabinMode: "pick", cabinNumber: "8188", id: "draft-cabin0001");
        await BookDeposit(token, draft);

        var after = await Send(HttpMethod.Get, $"{Api}/sailings/{March}/cabins?category=interior", null);
        Assert.False(after.Json[0].GetProperty("available").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, $"{Api}/sailings/{March}/cabins?category=nope", null)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, $"{Api}/sailings/nope/cabins?category=interior", null)).Status);
    }
}

public class BookingFunnelApiTests : BookingWorld
{
    [Fact]
    public async Task QuotePricesTheDraftHoldsItForADayAndShowsThePaymentPlan()
    {
        var token = await SignIn(Daniel);
        var r = await Send(HttpMethod.Post, $"{Api}/booking/quote", token, GoodDraft());
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(682_000, r.Json.GetProperty("total").GetInt64());
        Assert.Equal("plus", r.Json.GetProperty("quote").GetProperty("fare").GetString());
        Assert.Equal(143, r.Json.GetProperty("daysToDeparture").GetInt32());
        Assert.Equal(["deposit", "full"], r.Json.GetProperty("pay").GetProperty("options").EnumerateArray().Select(o => o.GetString()));
        Assert.Equal(136_400, r.Json.GetProperty("pay").GetProperty("deposit").GetInt64());
        Assert.Equal("2026-12-21", r.Json.GetProperty("pay").GetProperty("finalDue").GetString());
        Assert.Equal(15_000, r.Json.GetProperty("promotions")[0].GetProperty("creditCents").GetInt64());
        var hours = (r.Json.GetProperty("lockedUntil").GetInt64() - new DateTimeOffset(new DateTime(2026, 10, 29, 17, 0, 0, DateTimeKind.Utc)).ToUnixTimeMilliseconds()) / 3_600_000.0;
        Assert.Equal(24, hours, 1);
        Assert.False(r.Json.GetProperty("perks").GetProperty("numberOk").GetBoolean());
    }

    [Fact]
    public async Task QuoteNeedsASailingARoomTypeAndAFare()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft();
        draft["sailingId"] = "";
        var r = await Send(HttpMethod.Post, $"{Api}/booking/quote", token, draft);
        Assert.Equal((HttpStatusCode.BadRequest, "invalid", "incomplete"), (r.Status, r.ProblemType, r.ProblemTitle));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Post, $"{Api}/booking/quote", null, GoodDraft())).Status);
    }

    [Fact]
    public async Task MemberDiscountAndFutureCruiseCreditComeOffTheQuote()
    {
        F.Bookings.Loyalty[Daniel.Id] = new LoyaltyRecord { Number = "CC1234560", CreditLeftCents = 25_000 };
        var token = await SignIn(Daniel);
        var r = await Send(HttpMethod.Post, $"{Api}/booking/quote", token, GoodDraft(loyalty: "CC1234561", useCredit: true));
        Assert.Equal(682_000 - 13_600 - 25_000, r.Json.GetProperty("total").GetInt64());
        var perks = r.Json.GetProperty("perks");
        Assert.True(perks.GetProperty("numberOk").GetBoolean());
        Assert.Equal("gold", perks.GetProperty("tier").GetString());      // any other valid number joins at Gold
        Assert.Equal(13_600, perks.GetProperty("discount").GetInt64());
        Assert.Equal(25_000, perks.GetProperty("credit").GetInt64());
        Assert.Equal(25_000, perks.GetProperty("creditLeft").GetInt64());

        var bad = await Send(HttpMethod.Post, $"{Api}/booking/quote", token, GoodDraft(loyalty: "CC1234567", useCredit: false));
        Assert.False(bad.Json.GetProperty("perks").GetProperty("numberOk").GetBoolean());
        Assert.Equal(682_000, bad.Json.GetProperty("total").GetInt64());
    }

    [Fact]
    public async Task FaresArePricedForThePartyAndSuitesOfferOnlyPremier()
    {
        var token = await SignIn(Daniel);
        var r = await Send(HttpMethod.Post, $"{Api}/booking/fares", token, GoodDraft());
        Assert.Equal(["standard", "plus", "premier"], r.Json.EnumerateArray().Select(f => f.GetProperty("id").GetString()));
        Assert.Equal(0, r.Json[0].GetProperty("difference").GetInt64());
        Assert.Equal(Pricing.BookingQuote(March, "balcony", 2, "plus")!.Total - Pricing.BookingQuote(March, "balcony", 2, "standard")!.Total, r.Json[1].GetProperty("difference").GetInt64());
        Assert.Equal(6000, r.Json[1].GetProperty("perNight").GetInt64());

        var suite = await Send(HttpMethod.Post, $"{Api}/booking/fares", token, GoodDraft(category: "signatureSuite", fare: ""));
        var only = suite.Json.EnumerateArray().Single();
        Assert.Equal("premier", only.GetProperty("id").GetString());
        Assert.True(only.GetProperty("included").GetBoolean());
    }

    [Fact]
    public async Task PrefillStartsWithThePersonAndTheirPartyFromTheirProfiles()
    {
        var r = await Send(HttpMethod.Get, $"{Api}/me/booking-prefill", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var people = r.Json.GetProperty("people");
        Assert.Equal(["Daniel", "Priya", "Maya"], people.EnumerateArray().Select(p => p.GetProperty("firstName").GetString()));
        Assert.Equal("1982-04-10", people[0].GetProperty("dob").GetString());
        Assert.Equal("daniel@demo.princess.example", r.Json.GetProperty("contact").GetProperty("email").GetString());
        Assert.Equal("555-0103", r.Json.GetProperty("contact").GetProperty("phone").GetString());

        var alone = await Send(HttpMethod.Get, $"{Api}/me/booking-prefill", await SignIn(Paul));
        Assert.Equal(["Paul"], alone.Json.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("firstName").GetString()));
    }

    [Fact]
    public async Task TheDraftIsSavedWithAServerChosenIdKeptAcrossSavesAndDiscarded()
    {
        var token = await SignIn(Daniel);
        Assert.Equal(JsonValueKind.Null, (await Send(HttpMethod.Get, $"{Api}/me/draft", token)).Json.ValueKind);

        var draft = GoodDraft(id: "client-chosen-id");
        var saved = await Send(HttpMethod.Put, $"{Api}/me/draft", token, draft);
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        var id = saved.Json.GetProperty("id").GetString()!;
        Assert.NotEqual("client-chosen-id", id);
        Assert.Equal(32, id.Length);

        draft["dining"] = "late";
        var again = await Send(HttpMethod.Put, $"{Api}/me/draft", token, draft);
        Assert.Equal(id, again.Json.GetProperty("id").GetString());

        var read = await Send(HttpMethod.Get, $"{Api}/me/draft", token);
        Assert.Equal("late", read.Json.GetProperty("dining").GetString());
        Assert.Equal(March, read.Json.GetProperty("sailingId").GetString());
        Assert.Equal("Priya", read.Json.GetProperty("people")[1].GetProperty("firstName").GetString());
        Assert.Equal(4, read.Json.GetProperty("accepted").EnumerateObject().Count());

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"{Api}/me/draft", token)).Status);
        Assert.Equal(JsonValueKind.Null, (await Send(HttpMethod.Get, $"{Api}/me/draft", token)).Json.ValueKind);

        // A draft belongs to one person: Priya never sees Daniel's.
        await Send(HttpMethod.Put, $"{Api}/me/draft", token, draft);
        Assert.Equal(JsonValueKind.Null, (await Send(HttpMethod.Get, $"{Api}/me/draft", await SignIn(Priya))).Json.ValueKind);
    }

    [Fact]
    public async Task ASupervisedChildCannotSaveADraftOrBook()
    {
        var token = MayaToken();
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Put, $"{Api}/me/draft", token, GoodDraft())).Status);
        var r = await Book(token, GoodDraft(), 682_000, "deposit", [Card(DefaultCard, 136_400)]);
        Assert.Equal((HttpStatusCode.Forbidden, "supervised"), (r.Status, r.ProblemTitle));
    }

    [Fact]
    public async Task ResumeLinkNeedsASavedDraftAndAUsableAddressAndHidesTheMiddleOfIt()
    {
        var token = await SignIn(Daniel);
        var none = await Send(HttpMethod.Post, $"{Api}/me/draft/resume-link", token, new { via = "email", to = "daniel@example.com" });
        Assert.Equal(HttpStatusCode.NotFound, none.Status);

        var saved = await Send(HttpMethod.Put, $"{Api}/me/draft", token, GoodDraft());
        var id = saved.Json.GetProperty("id").GetString();
        foreach (var bad in new object[] { new { via = "email", to = "nope" }, new { via = "sms", to = "12" }, new { via = "pigeon", to = "x" } })
            Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, $"{Api}/me/draft/resume-link", token, bad)).Status);

        var email = await Send(HttpMethod.Post, $"{Api}/me/draft/resume-link", token, new { via = "email", to = "daniel@example.com" });
        Assert.Equal("d***@example.com", email.Json.GetProperty("to").GetString());
        Assert.Equal($"/book/resume/{id}", email.Json.GetProperty("link").GetString());
        var sms = await Send(HttpMethod.Post, $"{Api}/me/draft/resume-link", token, new { via = "sms", to = "+1 555 010 0142" });
        Assert.Equal("***-0142", sms.Json.GetProperty("to").GetString());
        Assert.Equal(2, F.Bookings.ResumeLinks.Count);
    }
}
