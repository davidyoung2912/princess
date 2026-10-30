using System.Net;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class DocumentsApiTests : JourneyWorld
{
    private const string Harpers = "/api/v1/bookings/PC243902";

    private static System.Text.Json.JsonElement GuestOf(Reply r, Guid id) =>
        r.Json.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == id);

    [Fact]
    public async Task TheViewShowsEachGuestsRequirementsAgainstTheReturnDate()
    {
        var r = await Get($"{Harpers}/documents", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("2027-03-28", r.Json.GetProperty("returnDate").GetString());
        Assert.True(r.Json.GetProperty("canEdit").GetBoolean());
        var daniel = GuestOf(r, Daniel.PublicId);
        Assert.Equal(0, daniel.GetProperty("blocking").GetInt32());
        Assert.Equal("2030-02-01", daniel.GetProperty("held").GetProperty("passport").GetProperty("expires").GetString());
        var maya = GuestOf(r, Maya.PublicId);
        Assert.Equal(8, maya.GetProperty("age").GetInt32());
        Assert.Equal(0, maya.GetProperty("blocking").GetInt32());                         // a certified birth certificate is enough for a child
        Assert.Empty(maya.GetProperty("held").GetProperty("birthCertificate").EnumerateObject());
        Assert.DoesNotContain(maya.GetProperty("results").EnumerateArray(), x => x.GetProperty("requirement").GetProperty("id").GetString() == "photoId");
    }

    [Fact]
    public async Task ViewingIsLoggedForThePersonWhoLooked()
    {
        await Get($"{Harpers}/documents", await SignIn(Priya));
        Assert.Contains(F.Journey.Access, a => a.UserId == Priya.Id && a.Row.Purpose == "documents:viewed" && a.Row.Actor == "Priya");
    }

    [Fact]
    public async Task OnlyAGuestOnTheBookingSeesIt() =>
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Harpers}/documents", await SignIn(Stranger))).Status);

    [Fact]
    public async Task ASupervisedChildMayLookButNotEdit()
    {
        var maya = await ViewAsToken(Daniel, Maya);
        var r = await Get($"{Harpers}/documents", maya);
        Assert.False(r.Json.GetProperty("canEdit").GetBoolean());
        var denied = await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/documents/passport", maya, new SetDocumentRequest("2031-01-01"));
        Assert.Equal(HttpStatusCode.Forbidden, denied.Status);
    }

    [Fact]
    public async Task AGuestRecordsAPassportAndTheViewUpdates()
    {
        Held(Priya);   // nothing held
        var token = await SignIn(Priya);
        var before = GuestOf(await Get($"{Harpers}/documents", token), Priya.PublicId);
        Assert.Equal(2, before.GetProperty("blocking").GetInt32());

        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/documents/passport", token, new SetDocumentRequest("2031-05-01"));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        var after = GuestOf(r, Priya.PublicId);
        Assert.Equal(0, after.GetProperty("blocking").GetInt32());
        Assert.Equal(new DateTime(2031, 5, 1), GuestOf(Priya).Held["passport"]);
        Assert.Contains(F.Journey.Access, a => a.UserId == Priya.Id && a.Row.Purpose == "documents:saved");
        Assert.Contains(F.Journey.History, h => h.What == "documents" && h.Detail == "Priya: Passport");
    }

    [Fact]
    public async Task ADocumentWithoutAnExpiryKeepsNoneAndABadDateIsRejected()
    {
        var token = await SignIn(Daniel);
        await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/birthCertificate", token, new SetDocumentRequest("2031-05-01"));
        Assert.Null(GuestOf(Daniel).Held["birthCertificate"]);          // birth certificates carry no expiry, whatever was sent
        var bad = await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/passport", token, new SetDocumentRequest("soon"));
        Assert.Equal(HttpStatusCode.BadRequest, bad.Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/visa", token, new SetDocumentRequest(null))).Status);
        Assert.Equal(new DateTime(2030, 2, 1), GuestOf(Daniel).Held["passport"]);   // the failed calls changed nothing
    }

    [Fact]
    public async Task ATooSoonPassportIsAProblemUntilItIsReplaced()
    {
        var token = await SignIn(Daniel);
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/passport", token, new SetDocumentRequest("2027-08-14"));
        var results = GuestOf(r, Daniel.PublicId).GetProperty("results").EnumerateArray().ToList();
        var passport = results.Single(x => x.GetProperty("requirement").GetProperty("id").GetString() == "passport");
        Assert.Equal("problem", passport.GetProperty("status").GetString());
        Assert.Equal("tooSoon", passport.GetProperty("problem").GetString());
        Assert.Equal(2, GuestOf(r, Daniel.PublicId).GetProperty("blocking").GetInt32());
    }

    [Fact]
    public async Task RemovingADocumentMakesItMissingAgain()
    {
        var r = await Call(HttpMethod.Delete, $"/api/v1/users/{Daniel.PublicId}/documents/passport", await SignIn(Daniel));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(2, GuestOf(r, Daniel.PublicId).GetProperty("blocking").GetInt32());
        Assert.DoesNotContain("passport", GuestOf(Daniel).Held.Keys);
        Assert.Contains(F.Journey.History, h => h.Detail == "Daniel: Passport removed");
    }

    [Fact]
    public async Task TheBookerManagesEveryoneButAnotherAdultOnlyThemself()
    {
        var booker = await SignIn(Daniel);
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, $"/api/v1/users/{Maya.PublicId}/documents/birthCertificate", booker, new SetDocumentRequest(null))).Status);
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/documents/photoId", booker, new SetDocumentRequest("2031-01-01"))).Status);
        var priya = await SignIn(Priya);
        Assert.Equal(HttpStatusCode.Forbidden, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/photoId", priya, new SetDocumentRequest("2031-01-01"))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/photoId", await SignIn(Stranger), new SetDocumentRequest("2031-01-01"))).Status);
    }

    [Fact]
    public async Task AHelperWithDocumentsPermissionEditsOneGuestAndSeesNobodyElse()
    {
        F.Access.Helpers.Add((Paul.Id, Priya.Id, new HelperGrant { Permissions = "view,documents", Status = "active" }));
        var token = await SignIn(Paul);
        var r = await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/documents/photoId", token, new SetDocumentRequest("2031-01-01"));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal([Priya.PublicId], r.Json.GetProperty("guests").EnumerateArray().Select(g => g.GetProperty("id").GetGuid()));
        Assert.Equal(new DateTime(2031, 1, 1), GuestOf(Priya).Held["photoId"]);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Put, $"/api/v1/users/{Daniel.PublicId}/documents/photoId", token, new SetDocumentRequest("2031-01-01"))).Status);
        // A grant for payments only is no use here.
        F.Access.Helpers.Clear();
        F.Access.Helpers.Add((Paul.Id, Priya.Id, new HelperGrant { Permissions = "view,payments", Status = "active" }));
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Put, $"/api/v1/users/{Priya.PublicId}/documents/photoId", token, new SetDocumentRequest("2031-01-01"))).Status);
    }

    [Fact]
    public async Task AnAgentBookingHasNoDocumentsSummary()
    {
        F.Journey.Party[12] = [];
        F.Access.Members.Add((Nina.Id, new BookingMembership { BookingId = 12, Number = "AG7P31BK", BookerUserId = Nina.Id, IsLead = true }));
        F.Journey.Party[12] = [new GuestRow { UserId = Nina.Id, PublicId = Nina.PublicId, FirstName = "Nina", LastName = "C", Dob = new DateTime(1990, 1, 1) }];
        var trip = await Get("/api/v1/trips/AG7P31BK", await SignIn(Nina));
        Assert.Equal(System.Text.Json.JsonValueKind.Null, trip.Json.GetProperty("documents").ValueKind);
        Assert.NotEqual("documents", trip.Json.GetProperty("next").GetString());
    }
}
