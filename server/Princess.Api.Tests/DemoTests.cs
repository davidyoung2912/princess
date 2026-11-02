using System.Net;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class DemoRulesTests
{
    [Fact]
    public void OnlyKnownScenariosAndSaneClocksAreAccepted()
    {
        Assert.Null(DemoRules.Problem(new DemoStateDto(3600, 60, ["planChange"])));
        Assert.Equal("badScenario", DemoRules.Problem(new DemoStateDto(0, 1, ["nope"])));
        Assert.Equal("badSpeed", DemoRules.Problem(new DemoStateDto(0, 7200, [])));
        Assert.Equal("badOffset", DemoRules.Problem(new DemoStateDto(DemoRules.MaxOffsetSeconds + 1, 1, [])));
    }

    [Fact]
    public void AStoppedClockIsKeptAsSpeedOneAndScenariosAreDeduplicated()
    {
        var c = DemoRules.Clean(new DemoStateDto(5, 0, ["planChange", "belizeTender", "planChange"]));
        Assert.Equal(1, c.ClockSpeed);
        Assert.Equal(["belizeTender", "planChange"], c.Scenarios);
    }
}

public class DemoClockTests
{
    private static readonly DateTime Saved = new(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void AFastClockKeepsGainingBetweenSavesAndANormalOneDoesNot()
    {
        Assert.Equal(7200, DemoRules.OffsetAt(new DemoStateRow(7200, 1, [], Saved), Saved.AddHours(5)));
        Assert.Equal(7200 + 60 * 59, DemoRules.OffsetAt(new DemoStateRow(7200, 60, [], Saved), Saved.AddMinutes(1)));
        Assert.Equal(7200, DemoRules.OffsetAt(new DemoStateRow(7200, 3600, []), Saved.AddHours(1)));   // no save time: the plain offset
        Assert.Equal(DemoRules.MaxOffsetSeconds, DemoRules.OffsetAt(new DemoStateRow(0, 3600, [], Saved), Saved.AddDays(30)));
    }

    [Fact]
    public void TheSailingAndPhoneZoneAreCheckedAndKept()
    {
        Assert.Null(DemoRules.Problem(new DemoStateDto(0, 1, [], 0, "sun-2026-11-22", "America/New_York")));
        Assert.Equal("badSailing", DemoRules.Problem(new DemoStateDto(0, 1, [], 0, "../etc", null)));
        Assert.Equal("badZone", DemoRules.Problem(new DemoStateDto(0, 1, [], 0, null, "not a zone!")));
        var clean = DemoRules.Clean(new DemoStateDto(0, 1, [], 0, "sun-2026-11-22", "America/Belize"));
        Assert.Equal("sun-2026-11-22", clean.SailingId);
        Assert.Equal("America/Belize", clean.PhoneZone);
    }

    [Fact]
    public void AJumpIsMeasuredAgainstTheServersClockAndAFarMomentIsRefused()
    {
        var at = new DateTimeOffset(Saved.AddHours(3)).ToUnixTimeMilliseconds();
        Assert.Equal(10_800, DemoRules.OffsetForMoment(at, Saved));
        Assert.Null(DemoRules.OffsetForMoment(new DateTimeOffset(Saved.AddDays(400)).ToUnixTimeMilliseconds(), Saved));
    }
}

public class DemoApiTests : JourneyWorld
{
    [Fact]
    public async Task JumpKeepsSpeedAndScenariosAndResetClearsEverything()
    {
        var now = new DateTime(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc);
        SetNow(now);
        var token = await SignIn(Daniel);
        Assert.Equal(0, (await Get("/api/v1/demo/state", token)).Json.GetProperty("savedAt").GetInt64());   // never touched: a new device keeps its own controls
        await Call(HttpMethod.Put, "/api/v1/demo/state", token, new DemoStateDto(0, 60, ["planChange"]));

        var at = new DateTimeOffset(now.AddDays(-14)).ToUnixTimeMilliseconds();
        var jumped = await Call(HttpMethod.Post, "/api/v1/demo/jump", token, new DemoJumpDto(at));
        Assert.Equal(HttpStatusCode.OK, jumped.Status);
        Assert.Equal(-14 * 86_400, jumped.Json.GetProperty("clockOffsetSeconds").GetInt64());
        Assert.Equal(60, jumped.Json.GetProperty("clockSpeed").GetInt32());
        Assert.Equal("planChange", jumped.Json.GetProperty("scenarios")[0].GetString());
        Assert.Equal(new DateTimeOffset(now).ToUnixTimeMilliseconds(), (await Get("/api/v1/demo/state", token)).Json.GetProperty("savedAt").GetInt64());

        var far = new DateTimeOffset(now.AddDays(500)).ToUnixTimeMilliseconds();
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Post, "/api/v1/demo/jump", token, new DemoJumpDto(far))).Status);

        var reset = await Call(HttpMethod.Post, "/api/v1/demo/reset", token);
        Assert.Equal(HttpStatusCode.OK, reset.Status);
        Assert.Equal(0, reset.Json.GetProperty("clockOffsetSeconds").GetInt64());
        Assert.Equal(1, reset.Json.GetProperty("clockSpeed").GetInt32());
        Assert.Equal(0, reset.Json.GetProperty("scenarios").GetArrayLength());
    }

    [Fact]
    public async Task ARealAccountCannotJumpOrReset()
    {
        var real = await SignIn(Stranger);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Post, "/api/v1/demo/jump", real, new DemoJumpDto(0))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Post, "/api/v1/demo/reset", real)).Status);
    }

    [Fact]
    public async Task ADemoUserSavesAndReadsTheirControlsAndTheServerClockFollows()
    {
        SetNow(new DateTime(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc));
        var token = await SignIn(Daniel);
        var saved = await Call(HttpMethod.Put, "/api/v1/demo/state", token, new DemoStateDto(7200, 60, ["planChange"]));
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        var read = await Get("/api/v1/demo/state", token);
        Assert.Equal(7200, read.Json.GetProperty("clockOffsetSeconds").GetInt64());
        Assert.Equal(60, read.Json.GetProperty("clockSpeed").GetInt32());
        Assert.Equal(7200, F.Journey.ClockOffsets[Daniel.Id]);
    }

    [Fact]
    public async Task ARealAccountGetsNotFoundAndABadBodyIsRejected()
    {
        var real = await SignIn(Stranger);
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/v1/demo/state", real)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await Call(HttpMethod.Put, "/api/v1/demo/state", real, new DemoStateDto(0, 1, []))).Status);
        SetNow(new DateTime(2027, 3, 21, 12, 0, 0, DateTimeKind.Utc));
        var demo = await SignIn(Daniel);
        Assert.Equal(HttpStatusCode.BadRequest, (await Call(HttpMethod.Put, "/api/v1/demo/state", demo, new DemoStateDto(0, 1, ["nope"]))).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/v1/demo/state", null)).Status);
    }
}
