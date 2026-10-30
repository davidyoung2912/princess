using System.Net;
using System.Text.Json.Nodes;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class InboxApiTests : JourneyWorld
{
    [Fact]
    public async Task NoticesAreDerivedFromTheTripAndCanBeMarkedRead()
    {
        Held(Priya);   // two blocking items for Priya
        var token = await SignIn(Daniel);
        var r = await Get("/api/v1/me/notifications", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var notices = r.Json.GetProperty("notices").EnumerateArray().ToList();
        Assert.Equal(["payDue", "documentsMissing", "checkinOpens"], notices.Select(n => n.GetProperty("id").GetString()));
        Assert.Equal("payments", notices[0].GetProperty("category").GetString());
        Assert.Equal("2027-03-11", notices[0].GetProperty("params").GetProperty("date").GetString());
        Assert.Equal(2, notices[1].GetProperty("params").GetProperty("count").GetInt32());
        Assert.Equal("2027-03-18", notices[2].GetProperty("params").GetProperty("date").GetString());
        Assert.All(notices, n => Assert.False(n.GetProperty("read").GetBoolean()));

        var mark = await Call(HttpMethod.Post, "/api/v1/me/notifications/read", token, new MarkReadRequest(["payDue", "madeUp"]));
        Assert.Equal(HttpStatusCode.NoContent, mark.Status);
        var after = (await Get("/api/v1/me/notifications", token)).Json.GetProperty("notices").EnumerateArray().ToList();
        Assert.True(after[0].GetProperty("read").GetBoolean());
        Assert.False(after[1].GetProperty("read").GetBoolean());
        Assert.DoesNotContain("madeUp", F.Journey.NoticesRead[Daniel.Id]);
    }

    [Fact]
    public async Task NoTripMeansNoNoticesButPreferencesStillWork()
    {
        var token = await SignIn(Nina);   // linked nothing yet: no bookings at all
        F.Journey.Bookings.Remove(Agent);
        var r = await Get("/api/v1/me/notifications", token);
        Assert.Empty(r.Json.GetProperty("notices").EnumerateArray());
        Assert.True(r.Json.GetProperty("prefs").GetProperty("channels").GetProperty("critical").GetProperty("push").GetBoolean());
    }

    [Fact]
    public async Task CriticalNoticesCannotBeSwitchedOffAndPreferencesPersist()
    {
        var token = await SignIn(Priya);
        var body = JsonNode.Parse("""{"channels":{"critical":{"push":false,"email":false,"sms":false},"offers":{"push":true,"email":true,"sms":false}},"quiet":{"on":true,"from":"23:00","to":"06:30"}}""");
        var r = await Call(HttpMethod.Put, "/api/v1/me/notification-prefs", token, body);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.True(r.Json.GetProperty("channels").GetProperty("critical").GetProperty("sms").GetBoolean());
        var read = await Get("/api/v1/me/notifications", token);
        Assert.True(read.Json.GetProperty("prefs").GetProperty("channels").GetProperty("offers").GetProperty("email").GetBoolean());
        Assert.Equal("23:00", read.Json.GetProperty("prefs").GetProperty("quiet").GetProperty("from").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, "/api/v1/me/notification-prefs", await ViewAsToken(Daniel, Maya), body)).Status);
    }

    [Fact]
    public async Task SupportRequestsAdvanceWithTimeAndAreValidated()
    {
        var token = await SignIn(Priya);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/support-tickets", token, new CreateTicketRequest("callback", "call me", null))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/support-tickets", token, new CreateTicketRequest("email", null, "  "))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/support-tickets", token, new CreateTicketRequest("fax", null, "x"))).Status);

        var cb = await Call(HttpMethod.Post, "/api/v1/me/support-tickets", token, new CreateTicketRequest("callback", "555-0142", null));
        Assert.Equal("received", cb.Json.GetProperty("status").GetString());
        await Call(HttpMethod.Post, "/api/v1/me/support-tickets", token, new CreateTicketRequest("email", null, new string('x', 1500)));
        Assert.Equal(1000, F.Journey.Tickets.Last().Ticket.Detail.Length);

        SetNow(new DateTime(2027, 3, 5, 17, 30, 0, DateTimeKind.Utc));
        var list = await Get("/api/v1/me/support-tickets", token);
        Assert.Equal(["email", "callback"], list.Json.EnumerateArray().Select(t => t.GetProperty("kind").GetString()));
        Assert.Equal("inProgress", list.Json[0].GetProperty("status").GetString());
        SetNow(new DateTime(2027, 3, 5, 19, 0, 0, DateTimeKind.Utc));
        Assert.Equal("resolved", (await Get("/api/v1/me/support-tickets", token)).Json[0].GetProperty("status").GetString());
        // Only your own.
        Assert.Empty((await Get("/api/v1/me/support-tickets", await SignIn(Daniel))).Json.EnumerateArray());
    }

    [Fact]
    public async Task HelpContactsArePublic()
    {
        var r = await Get("/api/v1/help/contacts", null);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("555-0100", r.Json.GetProperty("guestServices").GetString());
        Assert.Equal("555-0111", r.Json.GetProperty("emergency").GetString());
    }

    [Theory]
    [InlineData("bug", "ok")]
    [InlineData("bug", "hi")]
    [InlineData("rant", "this is long enough")]
    public async Task FeedbackIsValidated(string kind, string text)
    {
        var r = await Call(HttpMethod.Post, "/api/v1/me/feedback", await SignIn(Priya), new SendFeedbackRequest(kind, text, [], null));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
    }

    [Fact]
    public async Task FeedbackIsKeptPerPersonWithAReferenceAndScreenshotFlag()
    {
        var token = await SignIn(Priya);
        var long1 = new string('y', 1001);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/feedback", token, new SendFeedbackRequest("idea", long1, [], null))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/feedback", token, new SendFeedbackRequest("idea", "a fine idea", [], "javascript:alert(1)"))).Status);

        var r = await Call(HttpMethod.Post, "/api/v1/me/feedback", token, new SendFeedbackRequest("bug", "The map would not load", Enumerable.Range(0, 30).Select(i => $"error {i}").ToArray(), "data:image/png;base64,AAAA"));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var row = r.Json[0];
        Assert.Equal("bug", row.GetProperty("kind").GetString());
        Assert.Equal(20, row.GetProperty("log").GetArrayLength());
        Assert.True(row.GetProperty("screenshot").GetBoolean());
        Assert.StartsWith("FB-", row.GetProperty("reference").GetString());
        Assert.DoesNotContain("data:image", row.ToString());   // the picture itself is never sent back
        Assert.Empty((await Get("/api/v1/me/feedback", await SignIn(Daniel))).Json.EnumerateArray());
    }

    [Fact]
    public async Task FavouritesToggleInOrder()
    {
        var token = await SignIn(Priya);
        Assert.Empty((await Get("/api/v1/me/favourites", token)).Json.EnumerateArray());
        await Call(HttpMethod.Post, "/api/v1/me/favourites/toggle", token, new ToggleFavouriteRequest("excursion:coz-snorkel"));
        var two = await Call(HttpMethod.Post, "/api/v1/me/favourites/toggle", token, new ToggleFavouriteRequest("item:wine-tasting"));
        Assert.Equal(["excursion:coz-snorkel", "item:wine-tasting"], two.Json.EnumerateArray().Select(x => x.GetString()));
        var one = await Call(HttpMethod.Post, "/api/v1/me/favourites/toggle", token, new ToggleFavouriteRequest("excursion:coz-snorkel"));
        Assert.Equal(["item:wine-tasting"], one.Json.EnumerateArray().Select(x => x.GetString()));
        Assert.Empty((await Get("/api/v1/me/favourites", await SignIn(Daniel))).Json.EnumerateArray());
        foreach (var bad in new[] { "", "nocolon", "has space:x", new string('k', 90) + ":x" })
            Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/favourites/toggle", token, new ToggleFavouriteRequest(bad))).Status);
    }
}

public class PrivacyAndBudgetApiTests : JourneyWorld
{
    private const string Harpers = "/api/v1/bookings/PC243902";

    private static System.Text.Json.JsonElement Person(Reply r, Guid id) =>
        r.Json.GetProperty("people").EnumerateArray().Single(p => p.GetProperty("id").GetGuid() == id);

    [Fact]
    public async Task PrivacyViewListsDatesPeopleAndWhoMayDecide()
    {
        var r = await Get($"{Harpers}/privacy", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("2027-03-28", r.Json.GetProperty("cruiseEnds").GetString());
        Assert.Equal("2027-04-27", r.Json.GetProperty("deleteOn").GetProperty("idDocuments").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, r.Json.GetProperty("deleteOn").GetProperty("payment").ValueKind);
        Assert.True(Person(r, Daniel.PublicId).GetProperty("canEdit").GetBoolean());
        Assert.True(Person(r, Maya.PublicId).GetProperty("canEdit").GetBoolean());       // a parent decides for a child
        Assert.False(Person(r, Priya.PublicId).GetProperty("canEdit").GetBoolean());     // another adult decides for themself
        Assert.False(Person(r, Maya.PublicId).GetProperty("consents").GetProperty("parent").GetBoolean());   // everything starts off
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Harpers}/privacy", await SignIn(Stranger))).Status);
    }

    [Fact]
    public async Task ConsentsAreDecidedByTheAdultOrTheChildsParentOnly()
    {
        var daniel = await SignIn(Daniel);
        var own = await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/consents/marketingEmail", daniel, new SetConsentRequest(true));
        Assert.Equal(HttpStatusCode.OK, own.Status);
        Assert.True(Person(own, Daniel.PublicId).GetProperty("consents").GetProperty("marketingEmail").GetBoolean());
        Assert.Equal(Daniel.Id, F.Journey.Consents.Single().UserId);

        var child = await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/consents/parent", daniel, new SetConsentRequest(true));
        Assert.True(Person(child, Maya.PublicId).GetProperty("consents").GetProperty("parent").GetBoolean());

        var priya = await SignIn(Priya);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/consents/improve", priya, new SetConsentRequest(true))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/consents/shipPhotos", priya, new SetConsentRequest(true))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/consents/shipPhotos", await ViewAsToken(Daniel, Maya), new SetConsentRequest(true))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/consents/improve", await SignIn(Stranger), new SetConsentRequest(true))).Status);
        Assert.DoesNotContain(F.Journey.Consents, c => c.ConsentId is "improve" or "shipPhotos");
    }

    [Theory]
    [InlineData("marketingEmail")]   // not asked of an under-13
    [InlineData("nonsense")]
    public async Task AChoiceThatDoesNotApplyToTheirAgeIsInvalid(string consent)
    {
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/consents/{consent}", await SignIn(Daniel), new SetConsentRequest(true));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
        Assert.Empty(F.Journey.Consents);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/consents/parent", await SignIn(Daniel), new SetConsentRequest(true))).Status);   // child-only
    }

    [Fact]
    public async Task ConsentNeedsAnExplicitOnOrOff()
    {
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/consents/improve", await SignIn(Daniel), new SetConsentRequest(null));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
    }

    [Fact]
    public async Task DataPastItsRetentionDateIsDeletedOnceAndNoted()
    {
        var token = await SignIn(Daniel);
        // Before the date nothing is deleted.
        Assert.Empty((await Get($"{Harpers}/privacy", token)).Json.GetProperty("deleted").EnumerateArray());
        Assert.Empty(F.Journey.Purges);

        SetNow(new DateTime(2027, 4, 28, 17, 0, 0, DateTimeKind.Utc));   // 31 days after the cruise
        var r = await Get($"{Harpers}/privacy", token);
        var deleted = r.Json.GetProperty("deleted").EnumerateArray().ToList();
        Assert.Single(deleted);
        Assert.Equal(["ci-guest", "documents"], deleted[0].GetProperty("kinds").EnumerateArray().Select(k => k.GetString()));
        Assert.Empty(GuestOf(Daniel).Held);
        Assert.Contains(r.Json.GetProperty("access").EnumerateArray(), a => a.GetProperty("what").GetString() == "documents" && a.GetProperty("action").GetString() == "deleted");

        await Get($"{Harpers}/privacy", token);
        Assert.Single(F.Journey.Purges);   // not again

        SetNow(new DateTime(2027, 7, 1, 17, 0, 0, DateTimeKind.Utc));     // health rules fall due later
        await Get($"{Harpers}/privacy", token);
        Assert.Equal(2, F.Journey.Purges.Count);
        Assert.Equal(["illness", "clubReg"], F.Journey.Purges[1].Kinds);
    }

    // ---- Budget ----

    [Fact]
    public async Task BudgetStartsEmptyAndListsTheChildren()
    {
        var r = await Get($"{Harpers}/budget", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, r.Json.GetProperty("budget").GetProperty("total").ValueKind);
        Assert.Equal(80, r.Json.GetProperty("budget").GetProperty("alertAt").GetInt32());
        Assert.Equal([Maya.PublicId], r.Json.GetProperty("kids").EnumerateArray().Select(k => k.GetProperty("id").GetGuid()));
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Harpers}/budget", await SignIn(Stranger))).Status);
    }

    [Fact]
    public async Task SavingABudgetKeepsTheLimitsAndALimitForAChildIsTheParentsToSet()
    {
        var body = new JsonObject { ["total"] = 150000, ["alertAt"] = 50, ["kids"] = new JsonObject { [Maya.PublicId.ToString()] = 5000 } };
        var denied = await Call(HttpMethod.Put, $"{Harpers}/budget", await SignIn(Priya), body);
        Assert.Equal(HttpStatusCode.Forbidden, denied.Status);   // Priya is an adult guest but not Maya's booker

        var r = await Call(HttpMethod.Put, $"{Harpers}/budget", await SignIn(Daniel), body);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(150_000, r.Json.GetProperty("budget").GetProperty("total").GetInt64());
        Assert.Equal(5000, r.Json.GetProperty("budget").GetProperty("kids").GetProperty(Maya.PublicId.ToString()).GetInt64());
        // Anyone on the booking sees it afterwards; an adult who is not the parent may set the booking total alone.
        Assert.Equal(150_000, (await Get($"{Harpers}/budget", await SignIn(Priya))).Json.GetProperty("budget").GetProperty("total").GetInt64());
        var total = await Call(HttpMethod.Put, $"{Harpers}/budget", await SignIn(Priya), JsonNode.Parse("""{"total":200000,"alertAt":100,"kids":{}}"""));
        Assert.Equal(HttpStatusCode.OK, total.Status);
        Assert.Equal(200_000, total.Json.GetProperty("budget").GetProperty("total").GetInt64());
    }

    [Theory]
    [InlineData("""{"total":0,"alertAt":80,"kids":{}}""")]
    [InlineData("""{"total":2000000,"alertAt":80,"kids":{}}""")]
    [InlineData("""{"total":1000,"alertAt":60,"kids":{}}""")]
    [InlineData("""{"total":1000,"alertAt":80,"kids":{"00000000-0000-0000-0000-000000000001":100}}""")]
    public async Task OutOfRangeBudgetsAreRejectedAndNothingIsSaved(string json)
    {
        var r = await Call(HttpMethod.Put, $"{Harpers}/budget", await SignIn(Daniel), JsonNode.Parse(json));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
        Assert.Empty(F.Journey.Budgets);
    }

    [Fact]
    public async Task ASupervisedAccountCannotSetABudget()
    {
        var r = await Call(HttpMethod.Put, $"{Harpers}/budget", await ViewAsToken(Daniel, Maya), JsonNode.Parse("""{"total":1000,"alertAt":80,"kids":{}}"""));
        Assert.Equal(HttpStatusCode.Forbidden, r.Status);
        var view = await Get($"{Harpers}/budget", await ViewAsToken(Daniel, Maya));
        Assert.False(view.Json.GetProperty("canEdit").GetBoolean());
    }
}

public class DemoClockApiTests : JourneyWorld
{
    [Fact]
    public async Task OnlyDemoUsersGetTheOffsetAndRealUsersGetRealTime()
    {
        // Daniel is a demo user whose clock reads 12 March 2027; Priya is a real user on the same booking, so she sees the real date.
        SetNow(new DateTime(2027, 3, 12, 17, 0, 0, DateTimeKind.Utc));
        Priya.IsDemo = false;
        var demo = (await Get("/api/v1/trips/PC243902", await SignIn(Daniel))).Json;
        Assert.Equal("overdue", demo.GetProperty("payment").GetString());
        Assert.Equal(9, demo.GetProperty("daysToDeparture").GetInt32());
        var real = (await Get("/api/v1/trips/PC243902", await SignIn(Priya))).Json;
        var expected = (new DateOnly(2027, 3, 21).DayNumber - Princess.Api.Domain.TripRules.Today(DateTime.UtcNow).DayNumber);
        Assert.Equal(expected, real.GetProperty("daysToDeparture").GetInt32());
        Assert.NotEqual(9, expected);
    }
}
