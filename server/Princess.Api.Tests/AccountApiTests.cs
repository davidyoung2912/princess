using System.Net;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class AccountApiTests : JourneyWorld
{
    private static ProfileInput Edit(string first = "Priya", string last = "Harper", string email = "priya@demo.princess.example") =>
        new(first, last, "1984-06-02", email, "555-0103", "us", ["vegetarian", "bogus"], ["hearing"], "twin", "Quiet cabin", new EmergencyInput("Sam Example", "555-0104", "Friend"));

    [Fact]
    public async Task EveryEndpointNeedsASignIn()
    {
        foreach (var url in new[] { $"/api/v1/bookings/PC243902/party", $"/api/v1/users/{Daniel.PublicId}/profile", "/api/v1/me/helper", "/api/v1/me/history", "/api/v1/trips", "/api/v1/me/notifications", "/api/v1/me/favourites", "/api/v1/me/cards" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await Get(url, null)).Status);
    }

    [Fact]
    public async Task PartyListsEveryoneWithAgesOnTheDepartureDay()
    {
        var r = await Get("/api/v1/bookings/pc-243902/party", await SignIn(Priya));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var people = r.Json.EnumerateArray().ToList();
        Assert.Equal(3, people.Count);
        var maya = people.Single(p => p.GetProperty("id").GetGuid() == Maya.PublicId);
        Assert.Equal(8, maya.GetProperty("age").GetInt32());
        Assert.True(maya.GetProperty("child").GetBoolean());
        Assert.False(people.Single(p => p.GetProperty("id").GetGuid() == Priya.PublicId).GetProperty("child").GetBoolean());
    }

    [Fact]
    public async Task AStrangerGetsNotFoundForSomeoneElsesBookingAndProfile()
    {
        var token = await SignIn(Stranger);
        var party = await Get("/api/v1/bookings/PC243902/party", token);
        Assert.Equal(HttpStatusCode.NotFound, party.Status);
        Assert.Equal("notFound", party.ProblemType);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/v1/users/{Maya.PublicId}/profile", token)).Status);
        // Same answer for a person who does not exist at all.
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/v1/users/{Guid.NewGuid()}/profile", token)).Status);
    }

    [Fact]
    public async Task APartyMemberReadsAProfileAndCanEditOnlyWhatTheyMay()
    {
        var token = await SignIn(Priya);
        var own = await Get($"/api/v1/users/{Priya.PublicId}/profile", token);
        Assert.True(own.Json.GetProperty("canEdit").GetBoolean());
        Assert.Equal(16, own.Json.GetProperty("daysToDeparture").GetInt32());

        var danielsProfile = await Get($"/api/v1/users/{Daniel.PublicId}/profile", token);
        Assert.Equal(HttpStatusCode.OK, danielsProfile.Status);
        Assert.False(danielsProfile.Json.GetProperty("canEdit").GetBoolean());   // another adult who is not the booker

        var mayas = await Get($"/api/v1/users/{Maya.PublicId}/profile", token);
        Assert.False(mayas.Json.GetProperty("canEdit").GetBoolean());
        Assert.True((await Get($"/api/v1/users/{Maya.PublicId}/profile", await SignIn(Daniel))).Json.GetProperty("canEdit").GetBoolean());
    }

    [Fact]
    public async Task SavingAProfileKeepsOnlyKnownCodesAndWritesHistory()
    {
        var token = await SignIn(Priya);
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", token, Edit());
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var profile = r.Json.GetProperty("profile");
        Assert.Equal(["vegetarian"], profile.GetProperty("dietary").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal("twin", profile.GetProperty("bedding").GetString());
        Assert.Equal(["twin"], [F.Journey.Profiles[Priya.Id].Bedding]);
        var history = await Get("/api/v1/me/history", token);
        Assert.Equal("profile", history.Json[0].GetProperty("what").GetString());
        Assert.Equal("Priya", history.Json[0].GetProperty("by").GetString());
    }

    [Fact]
    public async Task ABookerEditsAChildButAnotherAdultCannot()
    {
        var edit = Edit("Maya", "Harper", "") with { Dob = "2018-09-30", Phone = "", Emergency = new EmergencyInput("", "", "") };
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/profile", await SignIn(Daniel), edit)).Status);
        var denied = await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/profile", await SignIn(Priya), edit);
        Assert.Equal(HttpStatusCode.Forbidden, denied.Status);
        Assert.Equal("forbidden", denied.ProblemType);
    }

    [Fact]
    public async Task ASupervisedAccountCannotWriteAnything()
    {
        var maya = await ViewAsToken(Daniel, Maya);
        var own = await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/profile", maya, Edit("Maya", "Harper", ""));
        Assert.Equal(HttpStatusCode.Forbidden, own.Status);
        Assert.Equal("supervised", own.ProblemTitle);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Post, "/api/v1/me/cards", maya, new AddCardRequest("visa", "4242", "09/29"))).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, "/api/v1/me/helper", maya, new SaveHelperRequest("Paul", "Uncle", ["view"], "active"))).Status);
        // Reading is fine, and the profile says it cannot be edited.
        var read = await Get($"/api/v1/users/{Maya.PublicId}/profile", maya);
        Assert.False(read.Json.GetProperty("canEdit").GetBoolean());
    }

    [Theory]
    [InlineData("", "Harper", "1984-06-02", "priya@demo.princess.example")]
    [InlineData("Priya", "Harper", "2031-01-01", "priya@demo.princess.example")]
    [InlineData("Priya", "Harper", "1984-06-02", "not-an-email")]
    public async Task BadFieldsAreRejected(string first, string last, string dob, string email)
    {
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", await SignIn(Priya), Edit(first, last, email) with { Dob = dob });
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
        Assert.Equal("invalid", r.ProblemType);
    }

    [Fact]
    public async Task NameChangesFollowTheTypoAndTwoWeekRules()
    {
        var token = await SignIn(Priya);
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", token, Edit(last: "Harpar"))).Status);   // one letter, 16 days out
        var large = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", token, Edit("Jane", "Smith"));
        Assert.Equal(HttpStatusCode.Conflict, large.Status);
        Assert.Equal("large", large.ProblemTitle);

        SetNow(new DateTime(2027, 3, 10, 17, 0, 0, DateTimeKind.Utc));   // 11 days out
        var late = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", token, Edit(last: "Harper"));
        Assert.Equal(HttpStatusCode.Conflict, late.Status);
        Assert.Equal("late", late.ProblemTitle);
    }

    [Fact]
    public async Task OnlyThePersonChangesTheirOwnSignInEmail()
    {
        var token = await SignIn(Daniel);
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/profile", token, Edit("Maya", "Harper", "kid@example.com") with { Dob = "2018-09-30" });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("", F.Journey.Profiles[Maya.Id].Email);   // a booker editing a child leaves the sign-in email alone
        await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", await SignIn(Priya), Edit(email: "priya.new@example.com"));
        Assert.Equal("priya.new@example.com", F.Journey.Profiles[Priya.Id].Email);
    }

    [Fact]
    public async Task ATakenEmailIsAConflict()
    {
        F.Journey.TakenEmailOwners.Add(Priya.Id);
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", await SignIn(Priya), Edit(email: "someone@else.example"));
        Assert.Equal(HttpStatusCode.Conflict, r.Status);
        Assert.Equal("emailTaken", r.ProblemTitle);
    }

    // ---- Helper ----

    [Fact]
    public async Task HelperLifecycle()
    {
        var token = await SignIn(Priya);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, (await Get("/api/v1/me/helper", token)).Json.ValueKind);

        var saved = await Call(HttpMethod.Put, "/api/v1/me/helper", token, new SaveHelperRequest("Paul Abernathy", "Son", ["payments", "root"], "active"));
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        Assert.Equal(["view", "payments"], saved.Json.GetProperty("permissions").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal("active", saved.Json.GetProperty("status").GetString());

        var revoked = await Call(HttpMethod.Delete, "/api/v1/me/helper", token);
        Assert.Equal("revoked", revoked.Json.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Delete, "/api/v1/me/helper", token)).Status);
        Assert.Equal(["helper", "helper"], F.Journey.History.Where(h => h.UserId == Priya.Id).Select(h => h.What));
    }

    [Theory]
    [InlineData("", "active")]
    [InlineData("Paul", "revoked")]
    [InlineData("Paul", null)]
    public async Task ABadHelperRequestIsRejected(string name, string? status)
    {
        var r = await Call(HttpMethod.Put, "/api/v1/me/helper", await SignIn(Priya), new SaveHelperRequest(name, "Son", ["view"], status));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
    }

    [Fact]
    public async Task AnActiveHelperNeedsAtLeastOnePermission()
    {
        var r = await Call(HttpMethod.Put, "/api/v1/me/helper", await SignIn(Priya), new SaveHelperRequest("Paul", "Son", [], "active"));
        Assert.Equal(HttpStatusCode.BadRequest, r.Status);
        Assert.Equal("permissions", r.ProblemTitle);
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, "/api/v1/me/helper", await SignIn(Priya), new SaveHelperRequest("Paul", "Son", [], "requested"))).Status);
    }

    [Fact]
    public async Task AHelperWithProfilePermissionReadsAndEditsAGuestTheyDoNotShareABookingWith()
    {
        F.Access.Helpers.Add((Paul.Id, Priya.Id, new HelperGrant { Permissions = "view,profile", Status = "active" }));
        var token = await SignIn(Paul);
        var read = await Get($"/api/v1/users/{Priya.PublicId}/profile", token);
        Assert.Equal(HttpStatusCode.OK, read.Status);
        Assert.True(read.Json.GetProperty("canEdit").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/profile", token, Edit())).Status);
        // The grant is Priya's alone.
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/v1/users/{Daniel.PublicId}/profile", token)).Status);
    }

    [Fact]
    public async Task ARevokedOrViewlessHelperGetsNothing()
    {
        F.Access.Helpers.Add((Paul.Id, Priya.Id, new HelperGrant { Permissions = "profile", Status = "active" }));       // no view
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/v1/users/{Priya.PublicId}/profile", await SignIn(Paul))).Status);
        F.Access.Helpers.Clear();
        F.Access.Helpers.Add((Paul.Id, Priya.Id, new HelperGrant { Permissions = "view,profile", Status = "revoked" }));
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/v1/users/{Priya.PublicId}/profile", await SignIn(Paul))).Status);
    }
}
