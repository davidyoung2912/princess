using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Online check-in, boarding passes and embarkation day over the real pipeline. The Harpers (Balcony, Princess Plus) sail 21 March 2027 and return on the 28th.
/// Check-in opens at midnight on the 18th and closes at 10:00 on the 21st, ship home time (Eastern, UTC-4 that week). "Now" starts on the 19th at 13:00.
/// </summary>
public class CheckinApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static readonly DateTime Open = new(2027, 3, 19, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime EmbarkMorning = new(2027, 3, 21, 14, 30, 0, DateTimeKind.Utc);        // 10:30 on board, check-in has just closed
    private static readonly DateTime Afternoon = new(2027, 3, 21, 19, 0, 0, DateTimeKind.Utc);              // 15:00 on board

    private static readonly object GoodPhoto = new { width = 1200, height = 1500, brightness = 135, sharpness = 28 };
    private static readonly object NoAnswers = new { symptoms = false, positive = false, contact = false };

    public CheckinApiTests() => SetNow(Open);

    private Task<Reply> Step(string step, string token, object body) => Call(HttpMethod.Put, $"{Base}/checkin/steps/{step}", token, body);

    private async Task<string> DanielToken() => await SignIn(Daniel);

    private Guid[] Everyone => [Daniel.PublicId, Priya.PublicId, Maya.PublicId];

    /// <summary>Every step for the three Harpers, as Daniel (who holds the only saved card).</summary>
    private async Task CompleteAll(string token)
    {
        await Step("confirm", token, new { guests = Everyone });
        await Step("document", token, new { guest = Daniel.PublicId, kind = "passport", country = "United States", number = "X1234567", expires = "2030-02-01" });
        await Step("document", token, new { guest = Priya.PublicId, kind = "passport", country = "United States", number = "Y7654321", expires = "2030-02-01" });
        await Step("document", token, new { guest = Maya.PublicId, kind = "birthCertificate" });
        foreach (var g in Everyone) await Step("photo", token, new { guest = g, metrics = GoodPhoto });
        await Step("emergency", token, new { guests = Everyone, name = "Alex Outsider", phone = "555-0188", relationship = "Neighbour" });
        await Step("contract", token, new { guests = Everyone });
        foreach (var g in Everyone) await Step("health", token, new { guest = g, answers = NoAnswers });
        await Step("payment", token, new { cardId = F.Journey.Cards.First(c => c.UserId == Daniel.Id).Card.PublicId });
        await Step("arrival", token, new { window = "11:00" });
    }

    private async Task<Reply> Finish(string token)
    {
        await CompleteAll(token);
        return await Call(HttpMethod.Post, $"{Base}/checkin/submit", token, new { });
    }

    // ---- Access ----

    [Fact]
    public async Task AnyGuestMayReadAndStrangersGetNotFound()
    {
        foreach (var path in new[] { "checkin", "checkin/status", "checkin/receipt", "boarding", "embark" })
        {
            Assert.Equal(HttpStatusCode.OK, (await Get($"{Base}/{path}", await SignIn(Priya))).Status);
            Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Base}/{path}", await SignIn(Stranger))).Status);
        }
    }

    [Fact]
    public async Task ASupervisedChildCanLookButNotChange()
    {
        var maya = MayaToken();
        var view = await Get($"{Base}/checkin", maya);
        Assert.Equal(HttpStatusCode.OK, view.Status);
        Assert.False(view.Json.GetProperty("canEdit").GetBoolean());
        Assert.False((await Get($"{Base}/embark", maya)).Json.GetProperty("canEdit").GetBoolean());
        foreach (var (verb, url, body) in new (HttpMethod, string, object)[]
        {
            (HttpMethod.Put, "checkin/steps/confirm", new { guests = new[] { Maya.PublicId } }),
            (HttpMethod.Post, "checkin/submit", new { }),
            (HttpMethod.Post, "boarding/wallet", new { }),
            (HttpMethod.Put, "embark/companion/terminal", new { done = true }),
            (HttpMethod.Put, "embark/carry-on/documents", new { done = true }),
            (HttpMethod.Put, "embark/bags", new { dropped = true }),
        })
        {
            var r = await Call(verb, $"{Base}/{url}", maya, body);
            Assert.Equal(HttpStatusCode.Forbidden, r.Status);
            Assert.Equal("supervised", r.ProblemTitle);
        }
    }

    [Fact]
    public async Task AParentCompletesEveryStepForAChild()
    {
        var token = await DanielToken();
        await CompleteAll(token);
        var maya = (await Get($"{Base}/checkin", token)).Json.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == Maya.PublicId);
        Assert.True(maya.GetProperty("progress").GetProperty("complete").GetBoolean());
        Assert.True(maya.GetProperty("child").GetBoolean());
        Assert.Equal("birthCertificate", maya.GetProperty("record").GetProperty("document").GetProperty("kind").GetString());
    }

    // ---- The window ----

    [Fact]
    public async Task StatusFollowsTheClockAndFinishedIsDone()
    {
        var token = await DanielToken();
        var s = (await Get($"{Base}/checkin/status", token)).Json;
        Assert.Equal("open", s.GetProperty("state").GetString());
        Assert.Equal(new DateTime(2027, 3, 18, 4, 0, 0, DateTimeKind.Utc), DateTimeOffset.FromUnixTimeMilliseconds(s.GetProperty("opensAt").GetInt64()).UtcDateTime);
        Assert.Equal(new DateTime(2027, 3, 21, 14, 0, 0, DateTimeKind.Utc), DateTimeOffset.FromUnixTimeMilliseconds(s.GetProperty("closesAt").GetInt64()).UtcDateTime);

        SetNow(new DateTime(2027, 3, 10, 17, 0, 0, DateTimeKind.Utc));
        Assert.Equal("notOpen", (await Get($"{Base}/checkin/status", token)).Json.GetProperty("state").GetString());
        SetNow(EmbarkMorning);
        Assert.Equal("closed", (await Get($"{Base}/checkin/status", token)).Json.GetProperty("state").GetString());

        SetNow(Open);
        await Finish(token);
        SetNow(EmbarkMorning);
        Assert.Equal("done", (await Get($"{Base}/checkin/status", token)).Json.GetProperty("state").GetString());
    }

    [Fact]
    public async Task StepsAndSubmitAreRefusedBeforeItOpensAndAfterItCloses()
    {
        var token = await DanielToken();
        SetNow(new DateTime(2027, 3, 10, 17, 0, 0, DateTimeKind.Utc));
        var early = await Step("confirm", token, new { guests = Everyone });
        Assert.Equal((HttpStatusCode.Conflict, "notOpen"), (early.Status, early.ProblemTitle));
        Assert.Equal("notOpen", (await Call(HttpMethod.Post, $"{Base}/checkin/submit", token, new { })).ProblemTitle);

        SetNow(EmbarkMorning);
        var late = await Step("confirm", token, new { guests = Everyone });
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (late.Status, late.ProblemTitle));
        Assert.Equal("closed", (await Call(HttpMethod.Post, $"{Base}/checkin/submit", token, new { })).ProblemTitle);
        Assert.False((await Get($"{Base}/checkin", token)).Json.GetProperty("canEdit").GetBoolean());
    }

    [Fact]
    public async Task AFinishedCheckinCanBeCorrectedOnlyWhileItIsOpen()
    {
        var token = await DanielToken();
        await Finish(token);
        Assert.Equal(HttpStatusCode.OK, (await Step("arrival", token, new { window = "12:00" })).Status);
        SetNow(EmbarkMorning);
        Assert.Equal("closed", (await Step("arrival", token, new { window = "12:30" })).ProblemTitle);
    }

    // ---- Step rules ----

    [Theory]
    [InlineData("passport", "2027-03-27", "document:expired")]
    [InlineData("passport", "2027-09-01", "document:tooSoon")]
    [InlineData("passport", "soon", "document:expiry")]
    [InlineData("licence", "2030-02-01", "document:kind")]
    public async Task RefusesAnUnusableDocument(string kind, string expires, string problem)
    {
        var r = await Step("document", await DanielToken(), new { guest = Daniel.PublicId, kind, country = "United States", number = "X1234567", expires });
        Assert.Equal((HttpStatusCode.BadRequest, problem), (r.Status, r.ProblemTitle));
    }

    [Fact]
    public async Task ABirthCertificateIsForUsGuestsOnly()
    {
        GuestOf(Priya).Citizenship = "other";
        var r = await Step("document", await DanielToken(), new { guest = Priya.PublicId, kind = "birthCertificate" });
        Assert.Equal("document:notAllowed", r.ProblemTitle);
    }

    [Fact]
    public async Task AWeakPhotoIsRefusedWithEveryProblemAndNothingIsSaved()
    {
        var token = await DanielToken();
        var r = await Step("photo", token, new { guest = Daniel.PublicId, metrics = new { width = 300, height = 375, brightness = 30, sharpness = 3 } });
        Assert.Equal("photo:small,dark,blurry", r.ProblemTitle);
        Assert.Equal("photo:small", (await Step("photo", token, new { guest = Daniel.PublicId })).ProblemTitle);
        Assert.DoesNotContain(F.Checkin.Steps, x => x.Row.Step == "photo" && x.Row.UserId == Daniel.Id);
        Assert.Equal(HttpStatusCode.OK, (await Step("photo", token, new { guest = Daniel.PublicId, metrics = GoodPhoto })).Status);
    }

    [Fact]
    public async Task TheEmergencyContactMustNotBeTravelling()
    {
        var token = await DanielToken();
        var r = await Step("emergency", token, new { guests = Everyone, name = "priya harper", phone = "555-0188", relationship = "Wife" });
        Assert.Equal("emergency:travelling", r.ProblemTitle);
        Assert.Equal("emergency:phone", (await Step("emergency", token, new { guests = Everyone, name = "Alex Outsider", phone = "12", relationship = "Friend" })).ProblemTitle);
        Assert.Equal("emergency:name", (await Step("emergency", token, new { guests = Everyone, phone = "555-0188", relationship = "Friend" })).ProblemTitle);
    }

    [Fact]
    public async Task HealthNeedsAnAnswerToEveryQuestion()
    {
        var token = await DanielToken();
        Assert.Equal("health:answers", (await Step("health", token, new { guest = Daniel.PublicId, answers = new { symptoms = false, positive = false } })).ProblemTitle);
        Assert.Equal("health:answers", (await Step("health", token, new { guest = Daniel.PublicId, answers = new { symptoms = "no", positive = false, contact = false } })).ProblemTitle);
        Assert.Equal("health:answers", (await Step("health", token, new { guest = Daniel.PublicId })).ProblemTitle);
    }

    [Fact]
    public async Task GuestsMustBeOnTheBooking()
    {
        var token = await DanielToken();
        Assert.Equal("guests", (await Step("confirm", token, new { guests = new[] { Stranger.PublicId } })).ProblemTitle);
        Assert.Equal("guests", (await Step("confirm", token, new { guests = new Guid[0] })).ProblemTitle);
        Assert.Equal("guests", (await Step("confirm", token, new { })).ProblemTitle);
        Assert.Equal("guests", (await Step("photo", token, new { metrics = GoodPhoto })).ProblemTitle);
        Assert.Equal("step", (await Step("passport", token, new { guests = Everyone })).ProblemTitle);
    }

    [Fact]
    public async Task ThePaymentCardMustBeTheCallersOwnAndInDate()
    {
        var token = await DanielToken();
        Assert.Equal("payment:card", (await Step("payment", token, new { cardId = Guid.NewGuid() })).ProblemTitle);
        F.Journey.Cards.Add((Daniel.Id, new CardRow { Id = 901, PublicId = Guid.NewGuid(), Brand = "visa", Last4 = "1111", Expiry = "01/27" }));
        var expired = F.Journey.Cards.Last().Card.PublicId;
        Assert.Equal("payment:card", (await Step("payment", token, new { cardId = expired })).ProblemTitle);
        var priya = await SignIn(Priya);                                                                          // Priya cannot use Daniel's card
        Assert.Equal("payment:card", (await Step("payment", priya, new { cardId = F.Journey.Cards.First().Card.PublicId })).ProblemTitle);
    }

    [Fact]
    public async Task ADeclinedCardIsNotSaved()
    {
        var token = await DanielToken();
        var declined = new CardRow { Id = 902, PublicId = Guid.NewGuid(), Brand = "visa", Last4 = "0002", Expiry = "09/29" };
        F.Journey.Cards.Add((Daniel.Id, declined));
        var r = await Step("payment", token, new { cardId = declined.PublicId });
        Assert.Equal(HttpStatusCode.PaymentRequired, r.Status);
        Assert.Contains("0002", r.ProblemTitle);
        Assert.Equal(JsonValueKind.Null, (await Get($"{Base}/checkin", token)).Json.GetProperty("payment").ValueKind);
    }

    [Fact]
    public async Task OnlyAWindowThisBookingMayUseCanBeChosen()
    {
        var token = await DanielToken();
        var view = (await Get($"{Base}/checkin", token)).Json;
        Assert.False(view.GetProperty("priority").GetBoolean());
        Assert.DoesNotContain("10:30", view.GetProperty("windows").EnumerateArray().Select(w => w.GetProperty("start").GetString()));
        Assert.Equal("11:00", view.GetProperty("suggested").GetString());
        Assert.Equal("arrival:window", (await Step("arrival", token, new { window = "10:30" })).ProblemTitle);
        Assert.Equal("arrival:window", (await Step("arrival", token, new { window = "soon" })).ProblemTitle);
        var ok = await Step("arrival", token, new { window = "12:00" });
        Assert.Equal("12:00", ok.Json.GetProperty("arrival").GetString());
        Assert.Equal("12:00", F.Plan.Travel[10].Window);                                                          // the travel screen sees the same choice
    }

    [Fact]
    public async Task ChoosingAnArrivalWindowKeepsTheTravelModeAndHotel()
    {
        var token = await DanielToken();
        F.Plan.Travel[10] = new TravelRow { Mode = "drive", Hotel = "harbour" };
        await Step("arrival", token, new { window = "12:00" });
        Assert.Equal(("12:00", "drive", "harbour"), (F.Plan.Travel[10].Window, F.Plan.Travel[10].Mode, F.Plan.Travel[10].Hotel));
    }

    // ---- Progress, submit and the receipt ----

    [Fact]
    public async Task ProgressCountsStepsAndNamesTheNextOne()
    {
        var token = await DanielToken();
        var fresh = (await Get($"{Base}/checkin", token)).Json.GetProperty("progress");
        Assert.Equal((0, 20, false), (fresh.GetProperty("done").GetInt32(), fresh.GetProperty("total").GetInt32(), fresh.GetProperty("complete").GetBoolean()));
        Assert.Equal("confirm", fresh.GetProperty("next").GetProperty("step").GetString());
        Assert.Equal(Daniel.PublicId, fresh.GetProperty("next").GetProperty("guest").GetGuid());                 // the booker is first in boarding order

        var after = (await Step("confirm", token, new { guests = Everyone })).Json.GetProperty("progress");
        Assert.Equal(3, after.GetProperty("done").GetInt32());
        Assert.Equal("document", after.GetProperty("next").GetProperty("step").GetString());
    }

    [Fact]
    public async Task SubmitNeedsEveryStep()
    {
        var token = await DanielToken();
        await Step("confirm", token, new { guests = Everyone });
        var r = await Call(HttpMethod.Post, $"{Base}/checkin/submit", token, new { });
        Assert.Equal((HttpStatusCode.Conflict, "incomplete"), (r.Status, r.ProblemTitle));
        Assert.Null(F.Checkin.Bookings.GetValueOrDefault(10)?.FinishedAt);
    }

    [Fact]
    public async Task SubmitFinishesOnceAndRepeatingIsHarmless()
    {
        var token = await DanielToken();
        var done = await Finish(token);
        Assert.Equal((HttpStatusCode.OK, "done"), (done.Status, done.Json.GetProperty("state").GetString()));
        var finishedAt = F.Checkin.Bookings[10].FinishedAt;
        SetNow(Open.AddHours(2));
        var again = await Call(HttpMethod.Post, $"{Base}/checkin/submit", token, new { });
        Assert.Equal("done", again.Json.GetProperty("state").GetString());
        Assert.Equal(finishedAt, F.Checkin.Bookings[10].FinishedAt);
        Assert.Contains(F.Journey.History, h => h.What == "checkin" && h.Detail == "Online check-in finished");
    }

    [Fact]
    public async Task TheReceiptShowsWhatIsOnFileWithoutTheFullPassportNumber()
    {
        var token = await DanielToken();
        await Finish(token);
        var r = (await Get($"{Base}/checkin/receipt", token)).Json;
        Assert.Equal("PC243902", r.GetProperty("number").GetString());
        Assert.True(r.GetProperty("complete").GetBoolean());
        var daniel = r.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == Daniel.PublicId);
        var doc = daniel.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("step").GetString() == "document");
        Assert.Equal("Passport ending 4567, United States", doc.GetProperty("detail").GetString());
        Assert.DoesNotContain("X1234567", r.GetRawText());
        var maya = r.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == Maya.PublicId);
        Assert.Equal("Birth certificate (certified copy)", maya.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("step").GetString() == "document").GetProperty("detail").GetString());
        var booking = r.GetProperty("booking").EnumerateArray().ToList();
        Assert.Equal("Visa ending 4242", booking.Single(i => i.GetProperty("step").GetString() == "payment").GetProperty("detail").GetString());
        Assert.Equal("Arrive 11:00", booking.Single(i => i.GetProperty("step").GetString() == "arrival").GetProperty("detail").GetString());
    }

    [Fact]
    public async Task AnUnansweredStepHasNoDetailOnTheReceipt()
    {
        var r = (await Get($"{Base}/checkin/receipt", await DanielToken())).Json;
        Assert.False(r.GetProperty("complete").GetBoolean());
        Assert.All(r.GetProperty("guests")[0].GetProperty("items").EnumerateArray(), i => Assert.Equal(JsonValueKind.Null, i.GetProperty("detail").ValueKind));
    }

    [Fact]
    public async Task AFlaggedHealthAnswerGoesToTheTerminalNurseAndNeverBlocks()
    {
        var token = await DanielToken();
        await CompleteAll(token);
        await Step("health", token, new { guest = Priya.PublicId, answers = new { symptoms = true, positive = false, contact = false } });
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Post, $"{Base}/checkin/submit", token, new { })).Status);
        var embark = (await Get($"{Base}/embark", token)).Json;
        Assert.Equal(["Priya Harper"], embark.GetProperty("nurseCheck").EnumerateArray().Select(n => n.GetString()));
        var receipt = (await Get($"{Base}/checkin/receipt", token)).Json;
        var priya = receipt.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == Priya.PublicId);
        Assert.Contains("nurse", priya.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("step").GetString() == "health").GetProperty("detail").GetString());
    }

    [Fact]
    public async Task EmergencyAndPassportDefaultsComeFromWhatIsAlreadyKnown()
    {
        var token = await DanielToken();
        var guests = (await Get($"{Base}/checkin", token)).Json.GetProperty("guests").EnumerateArray().ToList();
        var daniel = guests.Single(g => g.GetProperty("id").GetGuid() == Daniel.PublicId).GetProperty("defaults");
        Assert.Equal("Sam Example", daniel.GetProperty("emergency").GetProperty("name").GetString());
        Assert.Equal(("passport", "2030-02-01"), (daniel.GetProperty("documentKind").GetString(), daniel.GetProperty("passportExpires").GetString()));
        var maya = guests.Single(g => g.GetProperty("id").GetGuid() == Maya.PublicId).GetProperty("defaults");           // a child with no contact of their own uses the booker's
        Assert.Equal("Sam Example", maya.GetProperty("emergency").GetProperty("name").GetString());
        Assert.Equal("birthCertificate", maya.GetProperty("documentKind").GetString());
        Assert.Equal("2027-03-28", (await Get($"{Base}/checkin", token)).Json.GetProperty("returnDate").GetString());
    }

    // ---- Boarding pass ----

    [Fact]
    public async Task BeforeCheckinThereIsNoQrCodeAndTheLaneIsBlue()
    {
        var b = (await Get($"{Base}/boarding", await DanielToken())).Json;
        Assert.Equal(("blue", false), (b.GetProperty("lane").GetString(), b.GetProperty("checkinDone").GetBoolean()));
        Assert.Equal(3, b.GetProperty("passes").GetArrayLength());
        Assert.All(b.GetProperty("passes").EnumerateArray(), p => Assert.Equal(("", false), (p.GetProperty("code").GetString(), p.GetProperty("ready").GetBoolean())));
        Assert.Empty(F.Checkin.Passes);
    }

    [Fact]
    public async Task AfterCheckinEachGuestHasASignedPassInBoardingOrder()
    {
        var token = await DanielToken();
        await Finish(token);
        var b = (await Get($"{Base}/boarding", token)).Json;
        Assert.Equal(("green", true, "PC243902", "2027-03-21"), (b.GetProperty("lane").GetString(), b.GetProperty("checkinDone").GetBoolean(), b.GetProperty("number").GetString(), b.GetProperty("departure").GetString()));
        var passes = b.GetProperty("passes").EnumerateArray().ToList();
        Assert.Equal([1, 2, 3], passes.Select(p => p.GetProperty("seq").GetInt32()));
        Assert.Equal([Daniel.PublicId, Priya.PublicId, Maya.PublicId], passes.Select(p => p.GetProperty("id").GetGuid()));
        Assert.Equal("HARPER/PRIYA", passes[1].GetProperty("printed").GetString());
        var key = "test-signing-key-test-signing-key-0123456789";
        foreach (var p in passes)
        {
            var data = BoardingRules.DecodePass(key, p.GetProperty("code").GetString()!);
            Assert.NotNull(data);
            Assert.Equal(("PC243902", p.GetProperty("seq").GetInt32(), "Group 1", p.GetProperty("cabin").GetString()), (data.Booking, data.Seq, data.Group, data.Cabin));
        }
        Assert.Single(passes.Select(p => p.GetProperty("cabin").GetString()).Distinct());                         // one stateroom, one muster station
        Assert.Single(passes.Select(p => p.GetProperty("muster").GetString()).Distinct());
        Assert.StartsWith("Station ", passes[0].GetProperty("muster").GetString());
        Assert.Equal(3, F.Checkin.Passes.Count);
        Assert.Equal(("Terminal 2", 10), (b.GetProperty("terminal").GetProperty("name").GetString(), b.GetProperty("waitMinutes").GetInt32()));
        Assert.Equal("11:00", b.GetProperty("arrival").GetProperty("start").GetString());
    }

    [Fact]
    public async Task TheBoardingGroupFollowsTheChosenWindow()
    {
        var token = await DanielToken();
        await Finish(token);
        await Step("arrival", token, new { window = "13:00" });
        var b = (await Get($"{Base}/boarding", token)).Json;
        Assert.Equal("Group 5", b.GetProperty("passes")[0].GetProperty("group").GetString());
        Assert.Equal(25, b.GetProperty("waitMinutes").GetInt32());
    }

    [Fact]
    public async Task AStepFreeStateroomIsAssignedWhenTheBookerNeedsIt()
    {
        F.Journey.Profiles[Daniel.Id].Needs = ["mobility"];
        var token = await DanielToken();
        await Finish(token);
        var cabin = (await Get($"{Base}/boarding", token)).Json.GetProperty("passes")[0].GetProperty("cabin").GetString();
        Assert.True(CabinRules.CabinsFor("sun-2027-03-21", "balcony").Single(c => c.Number == cabin).Accessible);
    }

    [Fact]
    public async Task AChosenStateroomIsTheOneOnThePass()
    {
        var chosen = CabinRules.CabinsFor("sun-2027-03-21", "balcony").First(c => c.Available && !c.Accessible);
        Harper.CabinNumber = chosen.Number;
        var token = await DanielToken();
        await Finish(token);
        var pass = (await Get($"{Base}/boarding", token)).Json.GetProperty("passes")[0];
        Assert.Equal((chosen.Number, chosen.Deck), (pass.GetProperty("cabin").GetString(), pass.GetProperty("deck").GetInt32()));
    }

    [Fact]
    public async Task AMovedTerminalNamesTheOneItReplaced()
    {
        F.Checkin.Embark[10] = new EmbarkRow { Terminal = "Terminal 4" };
        var t = (await Get($"{Base}/boarding", await DanielToken())).Json.GetProperty("terminal");
        Assert.Equal(("Terminal 4", "Terminal 2"), (t.GetProperty("name").GetString(), t.GetProperty("changedFrom").GetString()));
    }

    [Fact]
    public async Task TheWalletNeedsAFinishedCheckin()
    {
        var token = await DanielToken();
        var early = await Call(HttpMethod.Post, $"{Base}/boarding/wallet", token, new { });
        Assert.Equal((HttpStatusCode.Conflict, "notDone"), (early.Status, early.ProblemTitle));
        await Finish(token);
        Assert.False((await Get($"{Base}/boarding", token)).Json.GetProperty("inWallet").GetBoolean());
        var added = await Call(HttpMethod.Post, $"{Base}/boarding/wallet", token, new { });
        Assert.True(added.Json.GetProperty("inWallet").GetBoolean());
        Assert.True((await Get($"{Base}/boarding", await SignIn(Priya))).Json.GetProperty("inWallet").GetBoolean());   // the wallet is per booking
    }

    // ---- The public lookup ----

    [Fact]
    public async Task LooksUpAPassWithNoSignInByBookingNumberAndAnyGuestsLastName()
    {
        await Finish(await DanielToken());
        var r = await Get("/api/v1/pass/lookup?number=pc%20243-902&lastName=%20harper%20", null);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("PC243902", r.Json.GetProperty("number").GetString());
        Assert.True(r.Json.GetProperty("checkinDone").GetBoolean());
        Assert.Equal(3, r.Json.GetProperty("passes").GetArrayLength());
        Assert.All(r.Json.GetProperty("passes").EnumerateArray(), p => Assert.NotEqual("", p.GetProperty("code").GetString()));
    }

    [Fact]
    public async Task ALookupBeforeCheckinShowsTheBlueLaneAndNoCodes()
    {
        var r = await Get("/api/v1/pass/lookup?number=PC243902&lastName=Harper", null);
        Assert.Equal(("blue", false), (r.Json.GetProperty("lane").GetString(), r.Json.GetProperty("checkinDone").GetBoolean()));
        Assert.All(r.Json.GetProperty("passes").EnumerateArray(), p => Assert.Equal("", p.GetProperty("code").GetString()));
    }

    [Theory]
    [InlineData("number=PC243902&lastName=Smith")]
    [InlineData("number=PC999999&lastName=Harper")]
    [InlineData("number=PC243902&lastName=")]
    [InlineData("number=&lastName=Harper")]
    [InlineData("lastName=Harper")]
    [InlineData("number=PC243902")]
    [InlineData("number=short&lastName=Harper")]
    [InlineData("number=PC179254&lastName=Harper")]
    public async Task EveryMismatchIsTheSameNotFound(string query)
    {
        var r = await Get($"/api/v1/pass/lookup?{query}", null);
        Assert.Equal((HttpStatusCode.NotFound, "notFound"), (r.Status, r.ProblemTitle));
        var baseline = await Get("/api/v1/pass/lookup?number=PC000000&lastName=Nobody", null);
        static string Body(Reply x) => string.Join(',', x.Json.EnumerateObject().Where(p => p.Name is not ("instance" or "traceId")).Select(p => $"{p.Name}={p.Value}"));
        Assert.Equal(Body(baseline), Body(r));                                                                   // nothing in the answer tells a wrong number from a wrong name
    }

    [Fact]
    public async Task ACancelledOrAgentBookingCannotBeLookedUp()
    {
        Harper.Status = "cancelled";
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/v1/pass/lookup?number=PC243902&lastName=Harper", null)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/v1/pass/lookup?number=AG7P31BK&lastName=Whitfield", null)).Status);
    }

    [Fact]
    public async Task TheLookupIsRateLimitedByAddress()
    {
        using var limited = new ApiFactory { LoginAttemptsPerMinute = 3 };
        using var http = limited.CreateClient();
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++) codes.Add((await http.GetAsync("/api/v1/pass/lookup?number=PC000000&lastName=Nobody")).StatusCode);
        Assert.Equal([HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests], codes);
    }

    // ---- Embarkation day ----

    [Fact]
    public async Task EmbarkationDayHasTheTimesOnTheShipsClock()
    {
        SetNow(EmbarkMorning);
        var e = (await Get($"{Base}/embark", await DanielToken())).Json;
        long Ms(DateTime utc) => new DateTimeOffset(utc).ToUnixTimeMilliseconds();
        Assert.Equal(Ms(new DateTime(2027, 3, 21, 15, 0, 0, DateTimeKind.Utc)), e.GetProperty("opensAt").GetInt64());               // 11:00 for everyone but priority guests
        Assert.Equal(Ms(new DateTime(2027, 3, 21, 17, 30, 0, DateTimeKind.Utc)), e.GetProperty("gangwayClosesAt").GetInt64());
        Assert.Equal(Ms(new DateTime(2027, 3, 21, 17, 0, 0, DateTimeKind.Utc)), e.GetProperty("stateroomReadyAt").GetInt64());
        Assert.False(e.GetProperty("stateroomReady").GetBoolean());
        Assert.Equal(["lunch", "stateroom", "muster", "sailAway"], e.GetProperty("afternoon").EnumerateArray().Select(a => a.GetProperty("id").GetString()));
        Assert.Equal(Ms(new DateTime(2027, 3, 21, 19, 0, 0, DateTimeKind.Utc)), e.GetProperty("afternoon")[3].GetProperty("at").GetInt64());
        Assert.Equal("terminal", e.GetProperty("current").GetString());
        Assert.Equal(6, e.GetProperty("companion").GetArrayLength());
        Assert.Equal(["documents", "medication", "swimwear", "chargers", "valuables"], e.GetProperty("carryOn").EnumerateArray().Select(c => c.GetProperty("id").GetString()));
        Assert.Equal(("notDropped", true), (e.GetProperty("luggage").GetProperty("status").GetString(), e.GetProperty("canEdit").GetBoolean()));
        Assert.Equal(3, e.GetProperty("documents").GetArrayLength());
        Assert.All(e.GetProperty("documents").EnumerateArray(), d => Assert.True(d.GetProperty("ready").GetBoolean()));
        SetNow(Afternoon);
        Assert.True((await Get($"{Base}/embark", await DanielToken())).Json.GetProperty("stateroomReady").GetBoolean());
    }

    [Fact]
    public async Task AGuestWithoutADocumentIsNotReadyOnEmbarkationDay()
    {
        Held(Priya);
        var docs = (await Get($"{Base}/embark", await DanielToken())).Json.GetProperty("documents").EnumerateArray().ToList();
        Assert.False(docs.Single(d => d.GetProperty("id").GetGuid() == Priya.PublicId).GetProperty("ready").GetBoolean());
        Assert.True(docs.Single(d => d.GetProperty("id").GetGuid() == Daniel.PublicId).GetProperty("ready").GetBoolean());
    }

    [Fact]
    public async Task TheCompanionIsWorkedThroughInOrderAndEitherGuestSeesIt()
    {
        var daniel = await DanielToken();
        var one = await Call(HttpMethod.Put, $"{Base}/embark/companion/terminal", daniel, new { done = true });
        Assert.Equal("security", one.Json.GetProperty("current").GetString());
        var skip = await Call(HttpMethod.Put, $"{Base}/embark/companion/photo", await SignIn(Priya), new { done = true });
        Assert.Equal("security", skip.Json.GetProperty("current").GetString());                                                      // the first not done, not the last done
        var undone = await Call(HttpMethod.Put, $"{Base}/embark/companion/terminal", daniel, new { done = false });
        Assert.Equal("terminal", undone.Json.GetProperty("current").GetString());
        foreach (var id in BoardingRules.Companion) await Call(HttpMethod.Put, $"{Base}/embark/companion/{id}", daniel, new { done = true });
        var all = await Get($"{Base}/embark", daniel);
        Assert.Equal(JsonValueKind.Null, all.Json.GetProperty("current").ValueKind);
        Assert.All(all.Json.GetProperty("companion").EnumerateArray(), c => Assert.True(c.GetProperty("done").GetBoolean()));
    }

    [Fact]
    public async Task OnlyKnownCompanionAndCarryOnItemsCanBeTicked()
    {
        var daniel = await DanielToken();
        var step = await Call(HttpMethod.Put, $"{Base}/embark/companion/jetpack", daniel, new { done = true });
        Assert.Equal((HttpStatusCode.BadRequest, "step"), (step.Status, step.ProblemTitle));
        var item = await Call(HttpMethod.Put, $"{Base}/embark/carry-on/jetpack", daniel, new { done = true });
        Assert.Equal((HttpStatusCode.BadRequest, "item"), (item.Status, item.ProblemTitle));
        var ok = await Call(HttpMethod.Put, $"{Base}/embark/carry-on/medication", daniel, new { done = true });
        Assert.Equal(["medication"], ok.Json.GetProperty("carryOn").EnumerateArray().Where(c => c.GetProperty("done").GetBoolean()).Select(c => c.GetProperty("id").GetString()));
        var off = await Call(HttpMethod.Put, $"{Base}/embark/carry-on/medication", daniel, new { done = false });
        Assert.DoesNotContain(off.Json.GetProperty("carryOn").EnumerateArray(), c => c.GetProperty("done").GetBoolean());
    }

    [Fact]
    public async Task BagsAreDeliveredThreeHoursAfterTheDropAndNotBeforeTheStateroomIsReady()
    {
        var token = await DanielToken();
        SetNow(new DateTime(2027, 3, 21, 15, 0, 0, DateTimeKind.Utc));                                                               // 11:00 on board, two hours before the staterooms
        var dropped = (await Call(HttpMethod.Put, $"{Base}/embark/bags", token, new { dropped = true })).Json.GetProperty("luggage");
        Assert.Equal("dropped", dropped.GetProperty("status").GetString());
        var droppedAt = DateTimeOffset.FromUnixTimeMilliseconds(dropped.GetProperty("droppedAt").GetInt64()).UtcDateTime;
        Assert.InRange((droppedAt - new DateTime(2027, 3, 21, 15, 0, 0, DateTimeKind.Utc)).TotalSeconds, -2, 2);                      // the demo clock offset is kept in whole seconds
        SetNow(new DateTime(2027, 3, 21, 17, 30, 0, DateTimeKind.Utc));                                                              // the stateroom is ready but three hours are not up
        Assert.Equal("dropped", (await Get($"{Base}/embark", token)).Json.GetProperty("luggage").GetProperty("status").GetString());
        SetNow(new DateTime(2027, 3, 21, 18, 1, 0, DateTimeKind.Utc));
        Assert.Equal("delivered", (await Get($"{Base}/embark", token)).Json.GetProperty("luggage").GetProperty("status").GetString());
        var undone = (await Call(HttpMethod.Put, $"{Base}/embark/bags", token, new { dropped = false })).Json.GetProperty("luggage");
        Assert.Equal(("notDropped", JsonValueKind.Null), (undone.GetProperty("status").GetString(), undone.GetProperty("droppedAt").ValueKind));
    }

    [Fact]
    public async Task TrafficFollowsTheArrivalWindow()
    {
        var token = await DanielToken();
        Assert.Equal(JsonValueKind.Null, (await Get($"{Base}/embark", token)).Json.GetProperty("traffic").ValueKind);
        await Step("arrival", token, new { window = "12:00" });
        Assert.Equal("heavy", (await Get($"{Base}/embark", token)).Json.GetProperty("traffic").GetString());
        await Step("arrival", token, new { window = "11:00" });
        Assert.Equal("light", (await Get($"{Base}/embark", token)).Json.GetProperty("traffic").GetString());
    }

    [Fact]
    public async Task APriorityGuestMayArriveEarlyAndBoardsFirst()
    {
        Harper.CategoryId = "signatureSuite";
        Harper.FareId = "premier";
        var token = await DanielToken();
        var view = (await Get($"{Base}/checkin", token)).Json;
        Assert.True(view.GetProperty("priority").GetBoolean());
        Assert.Equal("10:30", view.GetProperty("suggested").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Step("arrival", token, new { window = "10:30" })).Status);
        await Finish(token);
        Assert.All((await Get($"{Base}/boarding", token)).Json.GetProperty("passes").EnumerateArray(), p => Assert.Equal("Priority", p.GetProperty("group").GetString()));
        Assert.Equal(new DateTimeOffset(new DateTime(2027, 3, 21, 14, 30, 0, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), (await Get($"{Base}/embark", token)).Json.GetProperty("opensAt").GetInt64());
    }

    [Fact]
    public async Task ACancelledBookingCannotBeCheckedIn()
    {
        Harper.Status = "cancelled";
        var r = await Step("confirm", await DanielToken(), new { guests = Everyone });
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (r.Status, r.ProblemTitle));
    }
}
