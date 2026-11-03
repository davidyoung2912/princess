using System.Net;
using Princess.Api.Contracts;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;
using Xunit;

namespace Princess.Api.Tests;

public class ContextTests : JourneyWorld
{
    [Fact]
    public async Task ASignedInPersonGetsThemselvesTheirPartyTheirTripAndTheServersTime()
    {
        var now = new DateTime(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc);
        SetNow(now);
        var token = await SignIn(Daniel);
        var r = await Get("/api/v1/me/context", token);
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal(new DateTimeOffset(now).ToUnixTimeMilliseconds(), r.Json.GetProperty("nowMs").GetInt64());
        Assert.True(r.Json.GetProperty("isDemo").GetBoolean());
        Assert.Equal(Daniel.PublicId.ToString(), r.Json.GetProperty("person").GetProperty("id").GetString(), ignoreCase: true);
        Assert.True(r.Json.GetProperty("party").GetArrayLength() >= 1);
        Assert.NotEqual(System.Text.Json.JsonValueKind.Null, r.Json.GetProperty("sailingId").ValueKind);
    }

    [Fact]
    public async Task ADemoAccountsChosenSailingAndZoneComeBackAndARealAccountUsesItsOwnTrip()
    {
        SetNow(new DateTime(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc));
        var demo = await SignIn(Daniel);
        await Call(HttpMethod.Put, "/api/v1/demo/state", demo, new DemoStateDto(0, 1, [], 0, "sun-2026-12-06", "America/Belize"));
        var r = await Get("/api/v1/me/context", demo);
        Assert.Equal("sun-2026-12-06", r.Json.GetProperty("sailingId").GetString());
        Assert.Equal("America/Belize", r.Json.GetProperty("phoneZone").GetString());

        Stranger.IsDemo = false;   // SetNow makes everyone a demo user; this one is a real account
        var real = await SignIn(Stranger);
        var s = await Get("/api/v1/me/context", real);
        Assert.Equal(HttpStatusCode.OK, s.Status);
        Assert.False(s.Json.GetProperty("isDemo").GetBoolean());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, s.Json.GetProperty("phoneZone").ValueKind);
        Assert.Equal("PC179254", s.Json.GetProperty("booking").GetProperty("number").GetString());   // their own trip, not the demo's chosen sailing
    }

    [Fact]
    public async Task TheContextNeedsASignIn() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/v1/me/context", null)).Status);

    [Fact]
    public async Task TheContextSaysWhichStageTheGuestIsInAndWhy()
    {
        SetNow(new DateTime(2027, 3, 5, 17, 0, 0, DateTimeKind.Utc));
        var token = await SignIn(Daniel);
        var booked = await Get("/api/v1/me/context", token);
        Assert.Equal("manage", booked.Json.GetProperty("stage").GetString());
        Assert.Equal("bookingConfirmed", booked.Json.GetProperty("stageReason").GetString());

        Stranger.IsDemo = false;
        var real = await SignIn(Stranger);
        Assert.Equal("manage", (await Get("/api/v1/me/context", real)).Json.GetProperty("stage").GetString());   // 16 days out and not paid in full
    }

    [Fact]
    public async Task APersonWithNoTripIsDreamingUntilTheyPriceASailing()
    {
        SetNow(new DateTime(2027, 1, 5, 17, 0, 0, DateTimeKind.Utc));
        F.Journey.Sailings.Add(new Princess.Api.Data.SailingRow { Id = "sun-2027-03-21", Departure = new DateTime(2027, 3, 21), Nights = 7 });
        var token = await SignIn(Paul);
        var dream = await Get("/api/v1/me/context", token);
        Assert.Equal("dream", dream.Json.GetProperty("stage").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, dream.Json.GetProperty("focusSailingId").ValueKind);

        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/me/journey/events", token, new JourneyEventRequest("browse", "sun-2027-03-21"))).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await Call(HttpMethod.Post, "/api/v1/me/journey/events", token, new JourneyEventRequest("lookCloser", "sun-2027-03-21"))).Status);
        var discover = await Get("/api/v1/me/context", token);
        Assert.Equal("discover", discover.Json.GetProperty("stage").GetString());
        Assert.Equal("sun-2027-03-21", discover.Json.GetProperty("focusSailingId").GetString());
        Assert.Equal("lookCloser", discover.Json.GetProperty("stageReason").GetString());
    }
}
