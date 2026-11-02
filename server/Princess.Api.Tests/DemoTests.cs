using System.Net;
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

public class DemoApiTests : JourneyWorld
{
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
