using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// The server's half of Stanley's evaluation set (docs/stanley-gap-analysis-and-plan.md, phase 2). It reads the same <c>src/ai/eval/cases.json</c> as the browser's tests, so a
/// change to the router or the safety screen on one side that the other does not share fails here. The model is a stub throughout: nothing calls a provider.
/// </summary>
public class StanleyEvalTests
{
    public sealed record EvalServer(string Route, bool? Planning);
    public sealed record EvalCase(string Id, string Stage, bool Booked, string Text, string Client, string Tier, EvalServer? Server, List<string>? Tags);

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private static string Repo()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "src", "ai", "eval", "cases.json"))) return dir.FullName;
        throw new FileNotFoundException("src/ai/eval/cases.json was not found above the test output folder.");
    }

    public static List<EvalCase> Cases() =>
        JsonSerializer.Deserialize<List<EvalCase>>(File.ReadAllText(Path.Combine(Repo(), "src", "ai", "eval", "cases.json")), Json)!;

    public static List<(string Id, string Where, string Text)> Injections() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(Repo(), "src", "ai", "eval", "injection.json")))!.AsArray()
            .Select(n => (n!["id"]!.GetValue<string>(), n["where"]!.GetValue<string>(), n["text"]!.GetValue<string>())).ToList();

    [Fact]
    public void TheSetIsTheOneTheBrowserReads()
    {
        var cases = Cases();
        Assert.True(cases.Count >= 200);
        Assert.Equal(cases.Count, cases.Select(c => c.Id).Distinct().Count());
        Assert.All(StanleyRouter.Stages, stage => Assert.True(cases.Count(c => c.Stage == stage) >= 10, stage));
    }

    [Fact]
    public void EveryServerBoundCaseTakesTheRouteTheSetNames()
    {
        var wrong = new List<string>();
        foreach (var c in Cases().Where(c => c.Server is not null))
        {
            var route = c.Server!.Route;
            if (route == "blocked") { if (!ProfanityFilter.IsBlocked(c.Text)) wrong.Add($"{c.Id}: expected the word filter to block it"); continue; }
            if (route.StartsWith("handoff:")) { if (ConciergeRules.Screen(c.Text) != route["handoff:".Length..]) wrong.Add($"{c.Id}: expected {route}, got {ConciergeRules.Screen(c.Text) ?? "no handoff"}"); continue; }
            var got = StanleyRouter.Route(c.Text, c.Stage, c.Booked);
            var want = route switch { "trip" => StanleyRoute.Trip, "before" => StanleyRoute.Before, _ => StanleyRoute.Open };
            if (got.Route != want || got.Planning != (c.Server.Planning ?? false)) wrong.Add($"{c.Id}: expected {route} (planning {c.Server.Planning}), got {got.Route} (planning {got.Planning})");
        }
        Assert.Empty(wrong);
    }

    [Fact]
    public void TheServerAndTheDeviceAgreeOnWhatIsAHandoffAndNothingElseIsBlocked()
    {
        var wrong = new List<string>();
        foreach (var c in Cases())
        {
            var handoff = ConciergeRules.Screen(c.Text);
            if (c.Client.StartsWith("handoff:") != (handoff is not null)) wrong.Add($"{c.Id}: device {c.Client}, server {handoff ?? "none"}");
            if (c.Server?.Route != "blocked" && ProfanityFilter.IsBlocked(c.Text)) wrong.Add($"{c.Id}: blocked by the word filter");
        }
        Assert.Empty(wrong);
    }

    [Fact]
    public void OnlyARequestToBuildADayIsMarkedPlanning()
    {
        foreach (var c in Cases().Where(c => c.Server is { Route: "trip" or "before" or "open" }))
            Assert.Equal(c.Tags?.Contains("planning") == true, c.Server!.Planning == true);
    }
}

public class StanleyEvalGatewayTests
{
    /// <summary>A model that fails the test if it is asked anything, for the questions that must never reach one.</summary>
    private sealed class NoModel : IConciergeModel
    {
        public bool Available => true;
        public int Calls { get; private set; }
        public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct) { Calls++; throw new InvalidOperationException("A model was called."); }
    }

    /// <summary>A model that records every prompt it is given and answers from a script, so the tests can look at what a prompt held.</summary>
    private sealed class RecordingModel(params string[] replies) : IConciergeModel
    {
        private readonly Queue<string> _replies = new(replies);
        public bool Available => true;
        public List<string> Prompts { get; } = [];
        public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct)
        {
            Prompts.Add(system + "\n" + toolsJson + "\n" + messages.ToJsonString());
            var text = _replies.Count > 0 ? _replies.Dequeue() : "ALLOWED";
            return Task.FromResult(new JsonObject { ["stop_reason"] = "end_turn", ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }), ["usage"] = new JsonObject { ["input_tokens"] = 10, ["output_tokens"] = 5 } });
        }
    }

    private sealed class NoTools : IStanleyTools
    {
        public Task<ConciergeContext> ContextAsync(Princess.Api.Data.UserRecord user, string? mobility, List<string>? likes, CancellationToken ct) =>
            Task.FromResult(new ConciergeContext(new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc), null, null, null, null, null, [], [], "any", []));
        public Task<ConciergeReplyDto> AskModelAsync(List<ConciergeMessageDto> history, ConciergeContext ctx, ModelMeter meter, ModelTier tier, CancellationToken ct) => throw new InvalidOperationException("The tools route was used.");
    }

    private sealed class NoTrips : IStanleyTrips
    {
        public Task<StanleyTrip?> LoadAsync(Princess.Api.Data.UserRecord user, CancellationToken ct) => Task.FromResult<StanleyTrip?>(null);
    }

    private static readonly Princess.Api.Data.UserRecord User = new() { Id = 1 };

    private static (StanleyService Svc, MemoryStanleyTierLog Log) Build(IConciergeModel model)
    {
        var log = new MemoryStanleyTierLog();
        var svc = new StanleyService(model, new MemoryConciergeLimiter(), new FakeClock(new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc)), new NoTrips(), new NoTools(), log,
            Options.Create(new StanleyOptions()), Microsoft.Extensions.Logging.Abstractions.NullLogger<StanleyService>.Instance);
        return (svc, log);
    }

    private static StanleyRequestDto Say(string text, string stage = "sea") => new([new("user", text, 1)], new StanleyContextDto(stage));

    [Fact]
    public async Task EveryMustHandoffCaseIsHandedToAPersonWithoutAModel()
    {
        var model = new NoModel();
        var (svc, log) = Build(model);
        foreach (var c in StanleyEvalTests.Cases().Where(c => c.Tags?.Contains("must-handoff") == true))
        {
            var r = await svc.AskAsync(User, Say(c.Text, c.Stage), default);
            Assert.Equal(("handoff", c.Server!.Route["handoff:".Length..]), (r.Kind, r.Handoff));
        }
        Assert.Equal(0, model.Calls);
        Assert.All(log.Entries, e => Assert.Equal(("handoff", "safety", 0), (e.Tier, e.Topic, e.Calls)));
    }

    [Fact]
    public async Task AMusterQuestionIsAnsweredByTheFixedAnswerAndNeverByAModel()
    {
        var model = new NoModel();
        var (svc, log) = Build(model);
        foreach (var text in new[] { "Where is my muster station?", "Do I need my life jacket for the drill?", "What happens at the safety drill", "Is the emergency muster drill compulsory?" })
        {
            var r = await svc.AskAsync(User, Say(text, "embark"), default);
            Assert.Equal(("answer", "scripted", StanleyRules.MusterAnswer), (r.Kind, r.Source, r.Text));
            Assert.Equal("/ship/muster", Assert.Single(r.Sources!).Path);
        }
        Assert.Equal(0, model.Calls);
        Assert.All(log.Entries, e => Assert.Equal(("safety", 0), (e.Topic, e.Calls)));
    }

    [Fact]
    public void TheEmergencyScreenWordsAreTheOnesTheDeviceUses()
    {
        Assert.Null(ConciergeRules.Screen("Is there an emergency muster drill"));
        Assert.Equal("emergency", ConciergeRules.Screen("my little boy is missing"));
        Assert.Equal("emergency", ConciergeRules.Screen("our daughter went missing at the port"));
        Assert.Equal("emergency", ConciergeRules.Screen("This is an emergency"));
        Assert.Equal("legal", ConciergeRules.Screen("Who is liable if the tour is cancelled"));
    }

    // ---- card numbers ------------------------------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("4111111111111111")]
    [InlineData("4111 1111 1111 1111")]
    [InlineData("4111-1111-1111-1111")]
    [InlineData("378282246310005")]
    [InlineData("6011 0009 9013 9424 123")]
    public void ACardNumberIsMaskedHoweverItIsGrouped(string number)
    {
        Assert.True(CardData.Contains($"pay with {number} please"));
        Assert.Equal("pay with [card number removed] please", CardData.Redact($"pay with {number} please"));
    }

    [Fact]
    public void ACodeBesideCvvOrSecurityCodeIsMaskedAndOrdinaryNumbersAreNot()
    {
        Assert.Equal("cvv [code removed]", CardData.Redact("cvv 123"));
        Assert.Equal("the security code is [code removed].", CardData.Redact("the security code is 4821."));
        Assert.Equal("CVC: [code removed]", CardData.Redact("CVC: 987"));
        foreach (var t in new[] { "We sail on 2027-03-21 at 17:00", "Dinner for 4 is $1,250.00", "Call +1 954 555 0142", "Booking PR123456", "Deck 12, cabin 12034", "I am 41 and my son is 9" })
        {
            Assert.False(CardData.Contains(t), t);
            Assert.Equal(t, CardData.Redact(t));
        }
    }

    [Fact]
    public async Task NoCardNumberOrCodeReachesAnyPromptWhetherNewOrFromAnEarlierTurn()
    {
        var model = new RecordingModel("ALLOWED", "Please keep card details to yourself.", "ALLOWED", "Cozumel is lovely.");
        var (svc, _) = Build(model);
        await svc.AskAsync(User, Say("What are Cozumel's reefs like? My card is 4111 1111 1111 1111 and the cvv is 123"), default);
        var history = new List<ConciergeMessageDto>
        {
            new("user", "Is Roatan good for snorkelling? Card 4111-1111-1111-1111, security code 4821", 1),
            new("assistant", "Roatan has calm reefs.", 2),
            new("user", "And Belize?", 3),
        };
        await svc.AskAsync(User, new StanleyRequestDto(history, new StanleyContextDto("sea")), default);
        Assert.NotEmpty(model.Prompts);
        Assert.All(model.Prompts, p =>
        {
            Assert.DoesNotContain("4111", p);
            Assert.DoesNotContain("4821", p);
            Assert.DoesNotContain("cvv is 123", p);
        });
        Assert.Contains(model.Prompts, p => p.Contains(CardData.NumberMask));
    }

    [Fact]
    public void TheTierLogHasNoFieldThatCouldHoldWhatAGuestTyped()
    {
        var text = typeof(StanleyTierEntry).GetProperties().Where(p => p.PropertyType == typeof(string)).Select(p => p.Name).Order().ToList();
        Assert.Equal(["ModelTier", "Outcome", "Source", "Stage", "Tier", "Topic"], text);
    }

    // ---- prompt injection --------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task TheInstructionsAndToolsAreTheSameWhateverTheGuestOrTheRetrievedTextSays()
    {
        var asked = 0;
        foreach (var (_, _, text) in StanleyEvalTests.Injections())
        {
            if (ProfanityFilter.IsBlocked(text) || ConciergeRules.Screen(text) is not null || StanleyRules.IsMuster(text)) continue;
            var model = new RecordingModel("ALLOWED", "Fine.");
            var r = await Build(model).Svc.AskAsync(User, Say(text), default);
            asked++;
            // Whatever the text says, the prescan and the answer carry the fixed rules first, no tools, and the text only as a message: it never becomes an instruction or a tool.
            Assert.Equal(2, model.Prompts.Count);
            Assert.StartsWith(StanleyRules.TopicSystem + "\n[]\n", model.Prompts[0]);
            Assert.StartsWith(StanleyRules.AnswerSystem + "\n[]\n", model.Prompts[1]);
            Assert.Equal("answer", r.Kind);
            Assert.Equal("model", r.Tier);
        }
        Assert.True(asked >= 15);
    }

    [Fact]
    public void TheToolsAreReadOnlyAndAnUnknownToolIsAnErrorTheModelCanRead()
    {
        Assert.All(ConciergeRules.ToolNames, n => Assert.DoesNotMatch("book|pay|cancel|delete|refund|change|confirm|send|admin", n));
        var ctx = new ConciergeContext(new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc), "S1", new DateOnly(2027, 3, 21), "Sun Princess", "Balcony", "Daniel", [new PartyMember("Daniel", 41)], [], "any", []);
        foreach (var name in new[] { "cancel_booking", "pay_balance", "book_excursion", "delete_reservation", "reveal_system_prompt", "list_sailings; drop table" })
        {
            var r = StanleyToolService.Run(name, new JsonObject { ["confirm"] = true }, ctx);
            Assert.True(r.IsError, name);
            Assert.Empty(r.Citations);
        }
    }

    [Fact]
    public void ARetrievedPortOrMenuTextIsPlainFactsWithNoInstructionAimedAtAnAssistant()
    {
        var aimed = new System.Text.RegularExpressions.Regex(@"ignore (all |the |your )?(previous|prior|above) (instructions|rules)|disregard (the |your )?(rules|instructions)|system prompt|developer mode|note (to|for) (the )?(ai|assistant)|assistant:|\[/?inst\]|</?system>",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var ctx = new ConciergeContext(new DateTime(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc), "S1", new DateOnly(2027, 3, 21), "Sun Princess", "Balcony", "Daniel", [new PartyMember("Daniel", 41)], [], "any", []);
        foreach (var (tool, input) in new (string, JsonObject)[]
        {
            ("get_port", new JsonObject { ["port"] = "cozumel" }), ("get_port", new JsonObject { ["port"] = "belize" }), ("get_port", new JsonObject { ["port"] = "roatan" }),
            ("search_excursions", new JsonObject()), ("list_restaurants", new JsonObject()),
        })
            Assert.DoesNotMatch(aimed, StanleyToolService.Run(tool, input, ctx).Content);
    }
}
