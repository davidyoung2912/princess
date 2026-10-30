using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class BookApiTests : BookingWorld
{
    [Fact]
    public async Task BooksWithADepositOnTheDefaultCardAndShowsTheWholeBooking()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft();
        await Send(HttpMethod.Put, $"{Api}/me/draft", token, draft);
        draft["id"] = F.Bookings.DraftIdOf(Daniel.Id);

        var r = await Book(token, draft, 682_000, "deposit", [Card(DefaultCard, 136_400)]);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var b = r.Json;
        Assert.Matches(@"^PB\d{6}$", b.GetProperty("number").GetString());
        Assert.Equal("confirmed", b.GetProperty("status").GetString());
        Assert.Equal(March, b.GetProperty("sailingId").GetString());
        Assert.Equal("2027-03-28", b.GetProperty("returnDate").GetString());
        Assert.Equal("Deluxe Balcony", b.GetProperty("categoryName").GetString());
        Assert.Equal(JsonValueKind.Null, b.GetProperty("cabin").ValueKind);
        Assert.Equal(682_000, b.GetProperty("total").GetInt64());
        Assert.Equal(136_400, b.GetProperty("paid").GetInt64());
        Assert.Equal(545_600, b.GetProperty("balance").GetInt64());
        Assert.Equal("2026-12-21", b.GetProperty("finalDue").GetString());
        Assert.Equal("upcoming", b.GetProperty("payment").GetString());
        Assert.Equal(143, b.GetProperty("daysToDeparture").GetInt32());
        Assert.Equal(["Daniel", "Priya"], b.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("firstName").GetString()));
        Assert.Equal("anytime", b.GetProperty("dining").GetString());
        Assert.Equal(["terms", "health", "age", "pregnancy"], b.GetProperty("accepted").EnumerateArray().Select(a => a.GetProperty("id").GetString()));
        Assert.Equal("2026-10", b.GetProperty("accepted")[0].GetProperty("version").GetString());
        Assert.Equal(["email", "sms"], b.GetProperty("notified").EnumerateArray().Select(n => n.GetProperty("via").GetString()));
        Assert.Equal("d***@demo.princess.example", b.GetProperty("notified")[0].GetProperty("to").GetString());
        Assert.Equal("***-0142", b.GetProperty("notified")[1].GetProperty("to").GetString());

        var receipt = b.GetProperty("receipts").EnumerateArray().Single();
        Assert.Equal("deposit", receipt.GetProperty("label").GetString());
        Assert.Equal(136_400, receipt.GetProperty("cents").GetInt64());
        Assert.Equal(["Visa ending 4242"], receipt.GetProperty("methods").EnumerateArray().Select(m => m.GetString()));
        Assert.True(b.GetProperty("canCancel").GetBoolean());
        Assert.True(b.GetProperty("canChange").GetBoolean());
        Assert.Equal("free24h", b.GetProperty("cancel").GetProperty("tier").GetString());

        // The draft is used up, and the booking is Daniel's like any other.
        Assert.Equal(JsonValueKind.Null, (await Send(HttpMethod.Get, $"{Api}/me/draft", token)).Json.ValueKind);
        var trips = await Send(HttpMethod.Get, $"{Api}/trips", token);
        Assert.Equal(2, trips.Json.GetProperty("upcoming").GetArrayLength());
        var detail = await Send(HttpMethod.Get, $"{Api}/bookings/{b.GetProperty("number").GetString()}/detail", token);
        Assert.Equal(HttpStatusCode.OK, detail.Status);
        Assert.Equal(682_000, detail.Json.GetProperty("total").GetInt64());
    }

    [Fact]
    public async Task BookingTheSameDraftTwiceReturnsTheFirstBookingAndChargesOnce()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft();
        var first = await Book(token, draft, 682_000, "deposit", [Card(DefaultCard, 136_400)]);
        var second = await Book(token, draft, 682_000, "deposit", [Card(DefaultCard, 136_400)]);
        Assert.Equal(HttpStatusCode.OK, second.Status);
        Assert.Equal(first.Json.GetProperty("number").GetString(), second.Json.GetProperty("number").GetString());
        Assert.Equal(1, second.Json.GetProperty("receipts").GetArrayLength());
        Assert.Equal(136_400, second.Json.GetProperty("paid").GetInt64());
        Assert.Single(F.Journey.Bookings, b => b.BookerUserId == Daniel.Id && b.Number.StartsWith("PB"));
    }

    [Fact]
    public async Task AnotherPersonCannotTakeOverADraftIdThatIsAlreadyBooked()
    {
        await Book(await SignIn(Daniel), GoodDraft(), 682_000, "deposit", [Card(DefaultCard, 136_400)]);
        var priya = await Book(await SignIn(Priya), GoodDraft(), 682_000, "deposit", [Wallet(136_400)]);
        Assert.Equal((HttpStatusCode.Conflict, "conflict", "draftTaken"), (priya.Status, priya.ProblemType, priya.ProblemTitle));
    }

    [Fact]
    public async Task AnIdempotencyKeyReturnsTheFirstBookingEvenForAnotherDraft()
    {
        var token = await SignIn(Daniel);
        var first = await Book(token, GoodDraft(id: "draft-one00001"), 682_000, "deposit", [Card(DefaultCard, 136_400)], key: "attempt-0001");
        var retry = await Book(token, GoodDraft(id: "draft-two00002"), 682_000, "deposit", [Card(DefaultCard, 136_400)], key: "attempt-0001");
        Assert.Equal(first.Json.GetProperty("number").GetString(), retry.Json.GetProperty("number").GetString());
        Assert.Equal(1, F.Journey.Bookings.Count(b => b.Number.StartsWith("PB")));

        // The key is the caller's own; someone else's is refused, and a malformed one is invalid.
        var theirs = await Book(await SignIn(Priya), GoodDraft(id: "draft-three0003"), 682_000, "deposit", [Wallet(136_400)], key: "attempt-0001");
        Assert.Equal((HttpStatusCode.Conflict, "idempotencyKey"), (theirs.Status, theirs.ProblemTitle));
        var bad = await Book(token, GoodDraft(id: "draft-four0004"), 682_000, "deposit", [Card(DefaultCard, 136_400)], key: "no good!");
        Assert.Equal((HttpStatusCode.BadRequest, "idempotencyKey"), (bad.Status, bad.ProblemTitle));
    }

    [Fact]
    public async Task RefusesWhenThePriceHasMovedAnswersAreMissingOrTheSailingIsClosed()
    {
        var token = await SignIn(Daniel);
        var moved = await Book(token, GoodDraft(), 600_000, "deposit", [Card(DefaultCard, 120_000)]);
        Assert.Equal((HttpStatusCode.Conflict, "priceChanged"), (moved.Status, moved.ProblemTitle));

        var missing = GoodDraft();
        missing["dining"] = "";
        var incomplete = await Book(token, missing, 682_000, "deposit", [Card(DefaultCard, 136_400)]);
        Assert.Equal((HttpStatusCode.BadRequest, "incomplete"), (incomplete.Status, incomplete.ProblemTitle));

        var noId = GoodDraft(id: "");
        Assert.Equal("draft", (await Book(token, noId, 682_000, "deposit", [Card(DefaultCard, 136_400)])).ProblemTitle);

        Assert.DoesNotContain(F.Journey.Bookings, b => b.Number.StartsWith("PB"));

        SetNow(new DateTime(2026, 11, 8, 17, 0, 0, DateTimeKind.Utc));
        var d = GoodDraft(sailing: "sun-2026-11-08", fare: "standard", id: "draft-closed001");
        var closed = await Book(await SignIn(Daniel), d, Pricing.BookingQuote("sun-2026-11-08", "balcony", 2, "standard")!.Total, "full", [Wallet(Pricing.BookingQuote("sun-2026-11-08", "balcony", 2, "standard")!.Total)]);
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (closed.Status, closed.ProblemTitle));
    }

    [Fact]
    public async Task OnlyPayingInFullIsOfferedInsideTheFinalPaymentDate()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft(sailing: "sun-2026-12-27", fare: "standard");      // 59 days away
        var total = await TotalOf(token, draft);
        var deposit = Pricing.PayPlanFor(total, new DateOnly(2026, 12, 27), 59).Deposit;
        var r = await Book(token, draft, total, "deposit", [Card(DefaultCard, deposit)]);
        Assert.Equal((HttpStatusCode.BadRequest, "option"), (r.Status, r.ProblemTitle));
        var q = await Send(HttpMethod.Post, $"{Api}/booking/quote", token, draft);
        Assert.Equal(["full"], q.Json.GetProperty("pay").GetProperty("options").EnumerateArray().Select(o => o.GetString()));
        Assert.Equal(0, q.Json.GetProperty("promotions").GetArrayLength());
    }

    [Fact]
    public async Task ThePartsMustMakeUpTheAmountDueOnSavedUnexpiredCards()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft();
        foreach (var parts in new[] { new[] { Card(DefaultCard, 100_000) }, [], new[] { Card(DefaultCard, 68_200), Card(DefaultCard, 68_200) }, new[] { Wallet(36_400), Wallet(100_000) } })
        {
            var r = await Book(token, draft, 682_000, "deposit", parts);
            Assert.Equal((HttpStatusCode.BadRequest, "payment"), (r.Status, r.ProblemTitle));
        }

        var stranger = new CardRow { Id = 1, PublicId = Guid.NewGuid(), Brand = "visa", Last4 = "1111", Expiry = "12/30" };
        Assert.Equal("card", (await Book(token, draft, 682_000, "deposit", [Card(stranger, 136_400)])).ProblemTitle);

        DefaultCard.Expiry = "01/26";
        Assert.Equal("card", (await Book(token, draft, 682_000, "deposit", [Card(DefaultCard, 136_400)])).ProblemTitle);
        Assert.DoesNotContain(F.Journey.Bookings, b => b.Number.StartsWith("PB"));
    }

    [Fact]
    public async Task ADeclinedCardChargesNothingAndRecordsNoBooking()
    {
        var token = await SignIn(Daniel);
        var r = await Book(token, GoodDraft(), 682_000, "deposit", [Card(DeclinedCard, 136_400)]);
        Assert.Equal((HttpStatusCode.PaymentRequired, "declined", "Visa ending 0002"), (r.Status, r.ProblemType, r.ProblemTitle));
        Assert.DoesNotContain(F.Journey.Bookings, b => b.Number.StartsWith("PB"));
        Assert.DoesNotContain(F.Journey.Payments, p => p.Row.Label == "deposit" && p.Row.Last4 == "0002");
    }

    [Fact]
    public async Task ANewCardOrALargePaymentNeedsTheBanksCodeButAWalletDoesNot()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft();

        var asked = await Book(token, draft, 682_000, "deposit", [Card(NewCard, 136_400)]);
        Assert.Equal((HttpStatusCode.PaymentRequired, "challenge", "required"), (asked.Status, asked.ProblemType, asked.ProblemTitle));
        var wrong = await Book(token, draft, 682_000, "deposit", [Card(NewCard, 136_400)], challenge: "000000");
        Assert.Equal("wrong", wrong.ProblemTitle);
        Assert.DoesNotContain(F.Journey.Bookings, b => b.Number.StartsWith("PB"));

        var large = await Book(token, draft, 682_000, "full", [Card(DefaultCard, 682_000)]);       // $6,820 on the card on file is over the limit
        Assert.Equal("required", large.ProblemTitle);

        var ok = await Book(token, draft, 682_000, "deposit", [Card(NewCard, 136_400)], challenge: " 123456 ");
        Assert.Equal(HttpStatusCode.OK, ok.Status);
        Assert.Equal(["Mastercard ending 5454"], ok.Json.GetProperty("receipts")[0].GetProperty("methods").EnumerateArray().Select(m => m.GetString()));

        var wallet = await Book(token, GoodDraft(id: "draft-wallet001"), 682_000, "full", [Wallet(682_000)]);
        Assert.Equal(HttpStatusCode.OK, wallet.Status);
        Assert.Equal("full", wallet.Json.GetProperty("receipts")[0].GetProperty("label").GetString());
        Assert.Equal("paid", wallet.Json.GetProperty("payment").GetString());
        Assert.Equal(0, wallet.Json.GetProperty("balance").GetInt64());
    }

    [Fact]
    public async Task ASplitPaymentRecordsEachWayItWasMade()
    {
        var token = await SignIn(Daniel);
        var r = await Book(token, GoodDraft(), 682_000, "deposit", [Card(DefaultCard, 100_000), Wallet(36_400)]);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var receipt = r.Json.GetProperty("receipts").EnumerateArray().Single();
        Assert.Equal(136_400, receipt.GetProperty("cents").GetInt64());
        Assert.Equal(["Visa ending 4242", "Device wallet"], receipt.GetProperty("methods").EnumerateArray().Select(m => m.GetString()));
    }

    [Fact]
    public async Task APickedStateroomIsKeptUnlessItIsTakenOrNotReal()
    {
        var token = await SignIn(Daniel);
        var mine = await BookDeposit(token, GoodDraft(category: "interior", fare: "standard", cabinMode: "pick", cabinNumber: "8188", id: "draft-cabin-a01"));
        Assert.Equal("8188", (await Send(HttpMethod.Get, $"{Api}/bookings/{mine}/detail", token)).Json.GetProperty("cabin").GetString());

        var draft = GoodDraft(category: "interior", fare: "standard", cabinMode: "pick", cabinNumber: "8188", id: "draft-cabin-b02");
        var total = await TotalOf(token, draft);
        var deposit = Pricing.PayPlanFor(total, new DateOnly(2027, 3, 21), 143).Deposit;
        var taken = await Book(token, draft, total, "deposit", [Card(DefaultCard, deposit)]);
        Assert.Equal((HttpStatusCode.Conflict, "cabinTaken"), (taken.Status, taken.ProblemTitle));

        draft["cabinNumber"] = "99999";
        Assert.Equal("cabinTaken", (await Book(token, draft, total, "deposit", [Card(DefaultCard, deposit)])).ProblemTitle);

        // The same number on another sailing is another stateroom.
        var other = GoodDraft(sailing: "sun-2027-02-28", category: "interior", fare: "standard", cabinMode: "pick", cabinNumber: "8188", id: "draft-cabin-c03");
        var otherTotal = await TotalOf(token, other);
        var ok = await Book(token, other, otherTotal, "deposit", [Card(DefaultCard, Pricing.PayPlanFor(otherTotal, new DateOnly(2027, 2, 28), 122).Deposit)]);
        Assert.Equal(HttpStatusCode.OK, ok.Status);
    }

    [Fact]
    public async Task MemberDiscountAndCreditAreAppliedChargedAndUsedUp()
    {
        F.Bookings.Loyalty[Daniel.Id] = new LoyaltyRecord { Number = "CC1234560", CreditLeftCents = 25_000 };
        var token = await SignIn(Daniel);
        var draft = GoodDraft(loyalty: "CC1234561", useCredit: true);
        var total = await TotalOf(token, draft);
        Assert.Equal(643_400, total);
        var deposit = Pricing.PayPlanFor(total, new DateOnly(2027, 3, 21), 143).Deposit;

        var r = await Book(token, draft, total, "deposit", [Card(DefaultCard, deposit)]);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(643_400, r.Json.GetProperty("total").GetInt64());
        Assert.Equal(0, F.Bookings.Loyalty[Daniel.Id].CreditLeftCents);

        // Credit already spent: the same ask now costs the full discounted price, so the old total is refused.
        var again = await Book(token, GoodDraft(loyalty: "CC1234561", useCredit: true, id: "draft-again0001"), total, "deposit", [Card(DefaultCard, deposit)]);
        Assert.Equal("priceChanged", again.ProblemTitle);
    }
}

public class BookingAfterwardsApiTests : BookingWorld
{
    private async Task<string> BookFull(string token, string sailing, string id, string category = "balcony", string fare = "plus")
    {
        var draft = GoodDraft(sailing: sailing, id: id, category: category, fare: fare);
        var total = await TotalOf(token, draft);
        var r = await Book(token, draft, total, "full", [Wallet(total)]);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        return r.Json.GetProperty("number").GetString()!;
    }

    [Fact]
    public async Task OnlyAGuestOnTheBookingCanReadIt()
    {
        var token = await SignIn(Daniel);
        var number = await BookDeposit(token, GoodDraft());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/detail", await SignIn(Stranger))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"{Api}/bookings/PB000000/detail", token)).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/detail", null)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"{Api}/bookings/PC243902/detail", await SignIn(Priya))).Status);
    }

    [Fact]
    public async Task PayingTheBalanceByWalletClearsItAndAskingAgainIsNothingDue()
    {
        var token = await SignIn(Daniel);
        var r = await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/pay-balance", token, new { parts = new[] { Wallet(981_000) } });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(0, r.Json.GetProperty("balance").GetInt64());
        Assert.Equal("paid", r.Json.GetProperty("payment").GetString());
        var last = r.Json.GetProperty("receipts").EnumerateArray().Last();
        Assert.Equal("balance", last.GetProperty("label").GetString());
        Assert.Equal(["Device wallet"], last.GetProperty("methods").EnumerateArray().Select(m => m.GetString()));

        var again = await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/pay-balance", token, new { parts = new[] { Wallet(1) } });
        Assert.Equal((HttpStatusCode.Conflict, "nothingDue"), (again.Status, again.ProblemTitle));
    }

    [Fact]
    public async Task PayingTheBalanceChecksTheAmountTheCardAndTheBank()
    {
        var token = await SignIn(Daniel);
        var url = $"{Api}/bookings/PC243902/pay-balance";
        Assert.Equal("payment", (await Send(HttpMethod.Post, url, token, new { parts = new[] { Wallet(5) } })).ProblemTitle);
        Assert.Equal("declined", (await Send(HttpMethod.Post, url, token, new { parts = new[] { Card(DeclinedCard, 981_000) } })).ProblemType);
        var asked = await Send(HttpMethod.Post, url, token, new { parts = new[] { Card(DefaultCard, 981_000) } });
        Assert.Equal((HttpStatusCode.PaymentRequired, "challenge", "required"), (asked.Status, asked.ProblemType, asked.ProblemTitle));

        var split = await Send(HttpMethod.Post, url, token, new { parts = new[] { Wallet(481_000), Card(DefaultCard, 500_000) }, challenge = "123456" });
        Assert.Equal(HttpStatusCode.OK, split.Status);
        Assert.Equal(["Device wallet", "Visa ending 4242"], split.Json.GetProperty("receipts").EnumerateArray().Last().GetProperty("methods").EnumerateArray().Select(m => m.GetString()));
        Assert.Equal(1, F.Journey.Payments.Count(p => p.BookingId == 10 && p.Row.Label == "balance"));
    }

    [Fact]
    public async Task AnIdempotencyKeyOnPayBalanceChargesOnlyOnce()
    {
        var token = await SignIn(Daniel);
        var url = $"{Api}/bookings/PC243902/pay-balance";
        var body = new { parts = new[] { Wallet(981_000) } };
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, url, token, body, "pay-attempt-1")).Status);
        var retry = await Send(HttpMethod.Post, url, token, body, "pay-attempt-1");
        Assert.Equal(HttpStatusCode.OK, retry.Status);
        Assert.Equal(0, retry.Json.GetProperty("balance").GetInt64());
        Assert.Equal(1, F.Journey.Payments.Count(p => p.BookingId == 10 && p.Row.Label == "balance"));
    }

    [Fact]
    public async Task AnAdultGuestMayPayButAChildAndAnOutsiderMayNot()
    {
        var body = new { parts = new[] { Wallet(981_000) } };
        var url = $"{Api}/bookings/PC243902/pay-balance";
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, url, MayaToken(), body)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, url, await SignIn(Stranger), body)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, url, await SignIn(Priya), body)).Status);
    }

    [Fact]
    public async Task ChangePreviewShowsThePriceDifferenceAndWhetherTheStateroomIsKept()
    {
        var token = await SignIn(Daniel);
        var draft = GoodDraft(sailing: "sun-2027-02-28", category: "interior", fare: "standard", cabinMode: "pick", cabinNumber: "8188", id: "draft-change001");
        var total = await TotalOf(token, draft);
        var number = (await Book(token, draft, total, "deposit", [Card(DefaultCard, Pricing.PayPlanFor(total, new DateOnly(2027, 2, 28), 122).Deposit)])).Json.GetProperty("number").GetString();

        var p = await Send(HttpMethod.Get, $"{Api}/bookings/{number}/change?sailingId={March}", token);
        Assert.Equal(HttpStatusCode.OK, p.Status);
        Assert.Equal("ok", p.Json.GetProperty("check").GetString());
        var cheaper = Pricing.BookingQuote(March, "interior", 2, "standard")!.Total;
        Assert.Equal(cheaper, p.Json.GetProperty("newTotal").GetInt64());
        Assert.Equal(cheaper - total, p.Json.GetProperty("difference").GetInt64());
        Assert.True(p.Json.GetProperty("difference").GetInt64() < 0);
        Assert.True(p.Json.GetProperty("cabinKept").GetBoolean());

        Assert.Equal("same", (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/change?sailingId=sun-2027-02-28", token)).Json.GetProperty("check").GetString());
        Assert.Equal("newTooSoon", (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/change?sailingId=sun-2027-01-17", token)).Json.GetProperty("check").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/change?sailingId=nope", token)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/change", token)).Status);
    }

    [Fact]
    public async Task ChangingToACheaperSailingKeepsTheStateroomAndRefundsWhatWasOverpaid()
    {
        var token = await SignIn(Daniel);
        var number = await BookFull(token, "sun-2027-02-28", "draft-change002");
        var before = Pricing.BookingQuote("sun-2027-02-28", "balcony", 2, "plus")!.Total;
        var after = Pricing.BookingQuote(March, "balcony", 2, "plus")!.Total;

        var r = await Send(HttpMethod.Post, $"{Api}/bookings/{number}/change?sailingId={March}", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(March, r.Json.GetProperty("sailingId").GetString());
        Assert.Equal("2027-03-21", r.Json.GetProperty("departure").GetString());
        Assert.Equal(after, r.Json.GetProperty("total").GetInt64());
        Assert.Equal(after, r.Json.GetProperty("paid").GetInt64());
        Assert.Equal(0, r.Json.GetProperty("balance").GetInt64());
        var refund = r.Json.GetProperty("receipts").EnumerateArray().Last();
        Assert.Equal("refund", refund.GetProperty("label").GetString());
        Assert.Equal(after - before, refund.GetProperty("cents").GetInt64());
        Assert.Equal(["Refunded to the original payment"], refund.GetProperty("methods").EnumerateArray().Select(m => m.GetString()));
        Assert.Equal("2026-12-21", r.Json.GetProperty("finalDue").GetString());
    }

    [Fact]
    public async Task ChangingToADearerSailingLeavesABalanceAndANewDueDate()
    {
        var token = await SignIn(Daniel);
        var number = await BookDeposit(token, GoodDraft(id: "draft-change003"));
        var r = await Send(HttpMethod.Post, $"{Api}/bookings/{number}/change?sailingId=sun-2027-02-28", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var total = Pricing.BookingQuote("sun-2027-02-28", "balcony", 2, "plus")!.Total;
        Assert.Equal(total, r.Json.GetProperty("total").GetInt64());
        Assert.Equal(136_400, r.Json.GetProperty("paid").GetInt64());
        Assert.Equal(total - 136_400, r.Json.GetProperty("balance").GetInt64());
        Assert.Equal("2026-11-30", r.Json.GetProperty("finalDue").GetString());
        Assert.Equal(1, r.Json.GetProperty("receipts").GetArrayLength());
    }

    [Fact]
    public async Task ChangeIsRefusedInsideTheFinalPaymentDateToTheSameSailingOrToATooSoonDate()
    {
        var token = await SignIn(Daniel);
        var late = await BookFull(token, "sun-2026-12-27", "draft-change004");
        var tooLate = await Send(HttpMethod.Post, $"{Api}/bookings/{late}/change?sailingId={March}", token);
        Assert.Equal((HttpStatusCode.Conflict, "tooLate"), (tooLate.Status, tooLate.ProblemTitle));
        Assert.False((await Send(HttpMethod.Get, $"{Api}/bookings/{late}/detail", token)).Json.GetProperty("canChange").GetBoolean());

        var number = await BookDeposit(token, GoodDraft(id: "draft-change005"));
        Assert.Equal("same", (await Send(HttpMethod.Post, $"{Api}/bookings/{number}/change?sailingId={March}", token)).ProblemTitle);
        Assert.Equal("newTooSoon", (await Send(HttpMethod.Post, $"{Api}/bookings/{number}/change?sailingId=sun-2027-01-17", token)).ProblemTitle);
        Assert.Equal(March, (await Send(HttpMethod.Get, $"{Api}/bookings/{number}/detail", token)).Json.GetProperty("sailingId").GetString());
    }

    [Fact]
    public async Task OnlyTheBookerMayChangeOrCancel()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, $"{Api}/bookings/PC243902/change?sailingId=sun-2027-02-28", await SignIn(Priya))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/change?sailingId=sun-2027-02-28", await SignIn(Priya))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/cancel", await SignIn(Priya))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/cancel", MayaToken())).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/cancel", await SignIn(Stranger))).Status);
    }

    [Fact]
    public async Task CancellingRightAfterBookingRefundsEverything()
    {
        var token = await SignIn(Daniel);
        var number = await BookDeposit(token, GoodDraft());
        var r = await Send(HttpMethod.Post, $"{Api}/bookings/{number}/cancel", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("cancelled", r.Json.GetProperty("status").GetString());
        Assert.Equal(0, r.Json.GetProperty("paid").GetInt64());
        Assert.Equal(0, r.Json.GetProperty("balance").GetInt64());
        Assert.Equal(0, r.Json.GetProperty("cancelled").GetProperty("fee").GetInt64());
        Assert.Equal(136_400, r.Json.GetProperty("cancelled").GetProperty("refund").GetInt64());
        Assert.Equal(-136_400, r.Json.GetProperty("receipts").EnumerateArray().Last().GetProperty("cents").GetInt64());
        Assert.False(r.Json.GetProperty("canCancel").GetBoolean());
        Assert.False(r.Json.GetProperty("canChange").GetBoolean());

        var again = await Send(HttpMethod.Post, $"{Api}/bookings/{number}/cancel", token);
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (again.Status, again.ProblemTitle));
        // A cancelled stateroom is free again.
        var cancelledCabin = await Send(HttpMethod.Get, $"{Api}/sailings/{March}/cabins?category=balcony", null);
        Assert.Equal(9, cancelledCabin.Json.GetArrayLength());
    }

    [Fact]
    public async Task LaterCancellationKeepsAFeeAndNeverRefundsMoreThanWasPaid()
    {
        SetNow(new DateTime(2027, 3, 5, 17, 0, 0, DateTimeKind.Utc));       // 16 days out, booked on 22 October
        var token = await SignIn(Daniel);
        var terms = (await Send(HttpMethod.Get, $"{Api}/bookings/PC243902/detail", token)).Json.GetProperty("cancel");
        Assert.Equal("late", terms.GetProperty("tier").GetString());
        Assert.Equal(919_700, terms.GetProperty("fee").GetInt64());           // 75% of 12,263.00, to the dollar
        Assert.Equal(0, terms.GetProperty("refund").GetInt64());

        var r = await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/cancel", token);
        Assert.Equal("cancelled", r.Json.GetProperty("status").GetString());
        Assert.Equal(919_700, r.Json.GetProperty("cancelled").GetProperty("fee").GetInt64());
        Assert.DoesNotContain(r.Json.GetProperty("receipts").EnumerateArray(), x => x.GetProperty("label").GetString() == "refund");
    }

    [Fact]
    public async Task NothingCanBeCancelledOnceTheShipHasLeft()
    {
        SetNow(new DateTime(2027, 3, 21, 17, 0, 0, DateTimeKind.Utc));
        var token = await SignIn(Daniel);
        var view = await Send(HttpMethod.Get, $"{Api}/bookings/PC243902/detail", token);
        Assert.False(view.Json.GetProperty("canCancel").GetBoolean());
        var r = await Send(HttpMethod.Post, $"{Api}/bookings/PC243902/cancel", token);
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (r.Status, r.ProblemTitle));
    }
}
