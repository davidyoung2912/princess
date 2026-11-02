using System.Net;
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
}
