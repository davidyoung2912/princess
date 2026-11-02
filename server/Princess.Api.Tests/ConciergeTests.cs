using System.Text.Json;
using System.Net;
using System.Text.Json.Nodes;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The concierge's rules and service (multi-device plan 2, Phase 2), mirroring <c>src/ai/ai.test.ts</c> from before the model moved to the server.</summary>
public class ConciergeRulesTests
{
    private static readonly DateTime Now = new(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);

    private static ConciergeContext Ctx(bool booked = true) => new(
        Now, booked ? "S1" : null, booked ? new DateOnly(2027, 3, 21) : null, "Sun Princess", "Balcony", booked ? "Daniel" : null,
        booked ? [new PartyMember("Daniel", 41), new PartyMember("Maya", 8)] : [],
        [new SailingRow { Id = "S1", Departure = new DateTime(2027, 3, 21), Nights = 7, BookingOpen = true }], "any", []);

    private static JsonObject Json(ToolOutcome r) => JsonNode.Parse(r.Content)!.AsObject();

    [Theory]
    [InlineData("There is a fire in the corridor", "emergency")]
    [InlineData("What dose of ibuprofen is safe?", "medical")]
    [InlineData("I want to sue about the delay", "legal")]
    [InlineData("Can I talk to a real person", "person")]
    public void MessagesNeedingAPersonAreHandedOff(string message, string kind) => Assert.Equal(kind, ConciergeRules.Screen(message));

    [Fact]
    public void OrdinaryQuestionsAreNotHandedOffAndEmergencyWinsOverTheRest()
    {
        Assert.Null(ConciergeRules.Screen("What snorkelling is there in Cozumel?"));
        Assert.Equal("emergency", ConciergeRules.Screen("I have chest pain and need a doctor"));
    }

    [Fact]
    public void OnlyAThreadEndingWithTheGuestWithinTheLimitsIsAnswered()
    {
        ConciergeMessageDto U(string t) => new("user", t, 1);
        Assert.Null(ConciergeRules.Usable(null));
        Assert.Null(ConciergeRules.Usable([]));
        Assert.Null(ConciergeRules.Usable([new("assistant", "hi", 1)]));
        Assert.Null(ConciergeRules.Usable([U("   ")]));
        Assert.Null(ConciergeRules.Usable([U(new string('x', ConciergeRules.MaxMessage + 1))]));
        Assert.Null(ConciergeRules.Usable([new("system", "x", 1), U("hi")]));
        var many = Enumerable.Range(0, 30).Select(i => i % 2 == 0 ? U($"q{i}") : new ConciergeMessageDto("assistant", $"a{i}", i)).Append(U("last")).ToList();
        var used = ConciergeRules.Usable(many)!;
        Assert.Equal(ConciergeRules.MaxContext, used.Count);
        Assert.Equal("last", used[^1].Text);
    }

    [Fact]
    public void EveryToolInTheSchemaCanRunAndUnknownOnesAnswerWithAnErrorNotAThrow()
    {
        var declared = JsonNode.Parse(ConciergeRules.ToolsJson)!.AsArray().Select(t => t!["name"]!.GetValue<string>()).ToList();
        Assert.Equal(ConciergeRules.ToolNames, declared);
        foreach (var name in declared.Where(n => n != "get_port" && n != "build_day"))
            Assert.False(ConciergeRules.RunTool(name, new JsonObject(), Ctx()).IsError, name);
        Assert.True(ConciergeRules.RunTool("book_cruise", new JsonObject(), Ctx()).IsError);
        Assert.True(ConciergeRules.RunTool("get_port", new JsonObject { ["port"] = "mars" }, Ctx()).IsError);
        Assert.True(ConciergeRules.RunTool("build_day", new JsonObject { ["day"] = 99 }, Ctx()).IsError);
        Assert.True(ConciergeRules.RunTool("my_trip", new JsonObject(), Ctx(false)).IsError);
    }

    [Fact]
    public void ToolsAnswerFromTheCatalogueAndCiteTheScreen()
    {
        var sailings = ConciergeRules.RunTool("list_sailings", new JsonObject(), Ctx());
        Assert.Single(Json(sailings)["sailings"]!.AsArray());
        Assert.Equal("/home/sailings/S1", sailings.Citations.Single().Path);
        var tours = Json(ConciergeRules.RunTool("search_excursions", new JsonObject { ["port"] = "roatan", ["wheelchair"] = true }, Ctx()))["excursions"]!.AsArray();
        Assert.NotEmpty(tours);
        Assert.All(tours, t => Assert.True(t!["wheelchair"]!.GetValue<bool>()));
        var trip = Json(ConciergeRules.RunTool("my_trip", new JsonObject(), Ctx()));
        Assert.Equal(["Daniel", "Maya"], trip["party"]!.AsArray().Select(p => p!["name"]!.GetValue<string>()));
    }

    [Fact]
    public void ADayFitsAToursTimingAndHasNoDinnerOnTheLastMorning()
    {
        var port = Json(ConciergeRules.RunTool("build_day", new JsonObject { ["day"] = 3 }, Ctx()));
        Assert.Contains(port["items"]!.AsArray(), i => i!["kind"]!.GetValue<string>() == "tour");
        Assert.NotNull(port["back_on_ship_by"]);
        var sea = Json(ConciergeRules.RunTool("build_day", new JsonObject { ["day"] = 2 }, Ctx()));
        Assert.DoesNotContain(sea["items"]!.AsArray(), i => i!["kind"]!.GetValue<string>() == "tour");
        var last = Json(ConciergeRules.RunTool("build_day", new JsonObject { ["day"] = 8 }, Ctx()));
        Assert.Empty(last["items"]!.AsArray());
    }

    [Fact]
    public void TheScriptedConciergeIsGroundedHonestAndNeverBooks()
    {
        Assert.Contains("$", ConciergeRules.ScriptedReply("How much does it cost?", Ctx()).Text);
        Assert.Contains("one cruise", ConciergeRules.ScriptedReply("Is there an Alaska cruise?", Ctx()).Text);
        var book = ConciergeRules.ScriptedReply("Book it for me", Ctx());
        Assert.Contains("cannot book", book.Text);
        Assert.Equal("/book", book.Citations.Single().Path);
        Assert.Contains("Here is a day", ConciergeRules.ScriptedReply("Plan my day in Belize", Ctx()).Text);
        Assert.Contains("pass you to a person", ConciergeRules.ScriptedReply("What is the meaning of life?", Ctx()).Text);
        Assert.All(new[] { "dinner?", "ruins tours", "tell me about Cozumel", "my trip" }, q => Assert.Equal("scripted", ConciergeRules.ScriptedReply(q, Ctx()).Source));
    }

    [Fact]
    public void TheHourlyLimitCountsPerPersonAndForgetsOldQuestions()
    {
        var limiter = new ConciergeLimiter();
        var me = Guid.NewGuid();
        for (var i = 0; i < 3; i++) Assert.True(limiter.TryTake(me, Now, 3));
        Assert.False(limiter.TryTake(me, Now.AddMinutes(30), 3));
        Assert.True(limiter.TryTake(Guid.NewGuid(), Now, 3));
        Assert.True(limiter.TryTake(me, Now.AddMinutes(61), 3));
    }
}

public class ConciergeApiTests : JourneyWorld
{
    private static ConciergeRequestDto Ask(string text) => new([new("user", text, 1)], null, null);

    [Fact]
    public async Task WithNoModelSetUpTheScriptedConciergeAnswers()
    {
        var token = await SignIn(Daniel);
        var r = await Call(HttpMethod.Post, "/api/v1/me/concierge", token, Ask("How much does a cruise cost?"));
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("scripted", r.Json.GetProperty("source").GetString());
        Assert.Equal(JsonValueKind.Null, r.Json.GetProperty("fallback").ValueKind);
    }

    [Fact]
    public async Task AnEmergencyIsHandedToPeopleAndABadThreadIsRefused()
    {
        var token = await SignIn(Daniel);
        var h = await Call(HttpMethod.Post, "/api/v1/me/concierge", token, Ask("Someone is not breathing"));
        Assert.Equal("handoff", h.Json.GetProperty("source").GetString());
        Assert.Equal("emergency", h.Json.GetProperty("handoff").GetString());
        var bad = await Call(HttpMethod.Post, "/api/v1/me/concierge", token, new ConciergeRequestDto([], null, null));
        Assert.Equal(HttpStatusCode.BadRequest, bad.Status);
        Assert.Equal("badConcierge", bad.ProblemTitle);
        var signedOut = await Call(HttpMethod.Post, "/api/v1/me/concierge", null, Ask("hi"));
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.Status);
    }
}

public class StaffQueueTests : JourneyWorld
{
    [Fact]
    public void OnlyKnownRequestsAreAccepted()
    {
        Assert.True(StaffRules.Valid(new("callback", "health"), out var k, out var r));
        Assert.Equal(("callback", "health"), (k, r));
        Assert.True(StaffRules.Valid(new("callback", null), out _, out var other));
        Assert.Equal("other", other);
        Assert.True(StaffRules.Valid(new("kit", null), out _, out _));
        Assert.False(StaffRules.Valid(new("kit", "x"), out _, out _));
        Assert.False(StaffRules.Valid(new("callback", "gossip"), out _, out _));
        Assert.False(StaffRules.Valid(new("pizza", null), out _, out _));
        Assert.False(StaffRules.Valid(null, out _, out _));
    }

    [Fact]
    public async Task ARequestGetsAPlaceInTheQueueAndABadOneIsRefused()
    {
        var token = await SignIn(Daniel);
        var ok = await Call(HttpMethod.Post, "/api/v1/me/staff-requests", token, new StaffRequestDto("callback", "urgent"));
        Assert.Equal(HttpStatusCode.OK, ok.Status);
        Assert.InRange(ok.Json.GetProperty("position").GetInt32(), 1, 6);
        Assert.True(ok.Json.GetProperty("readyAt").GetInt64() > ok.Json.GetProperty("at").GetInt64());
        var bad = await Call(HttpMethod.Post, "/api/v1/me/staff-requests", token, new StaffRequestDto("pizza", null));
        Assert.Equal("badStaffRequest", bad.ProblemTitle);
    }
}
