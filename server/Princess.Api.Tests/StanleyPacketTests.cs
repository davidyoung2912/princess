using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;
using Princess.Api.Services;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// Stanley's context packet, party and child permission model and typed read tools (docs/stanley-gap-analysis-and-plan.md, phase 4). The cross-party fixtures (family, guardian, helper, revoked) are
/// the acceptance test: the model cannot obtain another traveller's data even if told to, and every tool is read-only and inside the call caps.
/// </summary>
public class StanleyPacketTests
{
    // ---- the permission model --------------------------------------------------------------------------------------------------------

    private static AccessFacts Facts(bool self = false, bool actorChild = false, bool actorBooks = false, bool travellerChild = false, bool actorBooksTraveller = false, bool same = true, bool helperTrip = false, bool helperFolio = false) =>
        new(self, actorChild, actorBooks, travellerChild, actorBooksTraveller, same, helperTrip, helperFolio);

    [Fact]
    public void FamilyGuardianHelperAndRevokedFixturesGetTheAccessTheyShould()
    {
        Assert.Equal(TravellerAccess.Self, StanleyPermissions.AccessFor(Facts(self: true)));
        Assert.Equal(TravellerAccess.Guardian, StanleyPermissions.AccessFor(Facts(actorBooks: true, travellerChild: true, actorBooksTraveller: true)));
        Assert.Equal(TravellerAccess.Booker, StanleyPermissions.AccessFor(Facts(actorBooks: true)));
        Assert.Equal(TravellerAccess.Party, StanleyPermissions.AccessFor(Facts()));
        Assert.Equal(TravellerAccess.Helper, StanleyPermissions.AccessFor(Facts(same: false, helperTrip: true)));
        Assert.Equal(TravellerAccess.HelperFolio, StanleyPermissions.AccessFor(Facts(same: false, helperTrip: true, helperFolio: true)));
        // A revoked, pending or expired grant arrives as false, and a stranger has none.
        Assert.Equal(TravellerAccess.None, StanleyPermissions.AccessFor(Facts(same: false)));
        // A folio grant alone, without the trip permission, reaches nothing.
        Assert.Equal(TravellerAccess.None, StanleyPermissions.AccessFor(Facts(same: false, helperFolio: true)));
    }

    [Fact]
    public void AChildSeesOnlyTheirOwnPlanAndNeverAnotherTraveller()
    {
        Assert.Equal(TravellerAccess.Self, StanleyPermissions.AccessFor(Facts(self: true, actorChild: true)));
        Assert.Equal(TravellerAccess.None, StanleyPermissions.AccessFor(Facts(actorChild: true)));
        Assert.Equal(TravellerAccess.None, StanleyPermissions.AccessFor(Facts(actorChild: true, travellerChild: true)));
        Assert.True(StanleyPermissions.Allows(TravellerAccess.Self, StanleyScope.Plan, actorSupervised: true));
        Assert.False(StanleyPermissions.Allows(TravellerAccess.Self, StanleyScope.Cases, actorSupervised: true));
    }

    [Theory]
    [InlineData(TravellerAccess.Self, true, true)]
    [InlineData(TravellerAccess.Guardian, true, true)]
    [InlineData(TravellerAccess.Booker, true, true)]
    [InlineData(TravellerAccess.Party, true, false)]
    [InlineData(TravellerAccess.Helper, true, false)]
    [InlineData(TravellerAccess.HelperFolio, true, true)]
    [InlineData(TravellerAccess.None, false, false)]
    public void EachAccessReachesOnlyItsScopes(TravellerAccess access, bool plan, bool cases)
    {
        Assert.Equal(plan, StanleyPermissions.Allows(access, StanleyScope.Plan));
        Assert.Equal(cases, StanleyPermissions.Allows(access, StanleyScope.Cases));
    }

    // ---- a family: Daniel (booker), Maria (another adult), Leo (a supervised child Daniel booked) --------------------------------------

    private static readonly StanleyVoyage Voyage = new("S1", new DateOnly(2027, 3, 20), "Sun Princess", 7);
    private static readonly DateTime Now = new(2027, 3, 5, 12, 0, 0, DateTimeKind.Utc);

    private static StanleyReadData Family(string actor)
    {
        var all = new (string Ref, string Name, int Age, bool Child)[] { ("t1", "Daniel", 41, false), ("t2", "Maria", 39, false), ("t3", "Leo", 9, true) };
        var travellers = new List<StanleyTraveller>();
        foreach (var (r, name, age, child) in all)
        {
            var access = StanleyPermissions.AccessFor(actor switch
            {
                "Daniel" => Facts(self: r == "t1", actorBooks: true, travellerChild: child, actorBooksTraveller: child),
                "Maria" => Facts(self: r == "t2", travellerChild: child),
                _ => Facts(self: r == "t3", actorChild: true, travellerChild: child),
            });
            if (access != TravellerAccess.None) travellers.Add(new StanleyTraveller(r, name, age, child, access == TravellerAccess.Self, access));
        }
        var packet = new StanleyPacket("gabc", "guest", Voyage, "sea", "", ["trip"], StanleyReadTools.Names, travellers, actor == "Leo");
        var sabatini = ShipDining.VenuesOf("sun-princess").First(v => v.Kind == "specialty").Id;
        return new StanleyReadData(packet, Now,
            [new("coz-snorkel", 3, ["t1", "t2"]), new("coz-ruins", 3, ["t1"])],
            [new(sabatini, 2, "18:00", ["t1", "t2", "t3"]), new(sabatini, 2, "18:30", ["t1"])],
            [new("drinks", 1, ["t1"])],
            [new("t2", "billing", "C-100", "inReview", null, Now.AddDays(3)), new("t3", "lostItem", "C-200", "received", null, Now.AddDays(3))]);
    }

    private static JsonObject Obj(ToolOutcome r) => JsonNode.Parse(r.Content)!.AsObject();
    private static ToolOutcome Run(StanleyReadData d, string tool, string json = "{}") => StanleyReadTools.Run(tool, JsonNode.Parse(json)!.AsObject(), d);

    [Fact]
    public void TheBookerSeesTheWholePartyAndTheChildCases()
    {
        var d = Family("Daniel");
        var r = Run(d, "get_case_status", """{"traveller":"all"}""");
        Assert.False(r.IsError);
        Assert.Equal(["C-100", "C-200"], Obj(r)["cases"]!.AsArray().Select(c => c!["number"]!.GetValue<string>()).Order());
    }

    [Fact]
    public void AnotherAdultSeesTheSharedPlanButNeverAnotherTravellersCases()
    {
        var d = Family("Maria");
        Assert.True(Run(d, "get_guest_visible_plan", """{"traveller":"Daniel"}""") is { IsError: false });
        var own = Obj(Run(d, "get_case_status", """{"traveller":"me"}"""));
        Assert.Equal(["C-100"], own["cases"]!.AsArray().Select(c => c!["number"]!.GetValue<string>()));
        foreach (var asked in new[] { "Leo", "t3", "Daniel", "t1" })
        {
            var r = Run(d, "get_case_status", $$"""{"traveller":"{{asked}}"}""");
            Assert.True(r.IsError);
            Assert.DoesNotContain("C-200", r.Content);
        }
        // "all" returns only what she may read, and says how many were left out without naming them.
        var all = Obj(Run(d, "get_case_status", """{"traveller":"all"}"""));
        Assert.Equal(["C-100"], all["cases"]!.AsArray().Select(c => c!["number"]!.GetValue<string>()));
        Assert.Equal(2, all["withheld_travellers"]!.GetValue<int>());
    }

    [Fact]
    public void ASupervisedChildCannotReadAnyoneElseOrOpenCases()
    {
        var d = Family("Leo");
        Assert.Equal(["Leo"], d.Packet.Travellers.Select(t => t.FirstName));
        foreach (var asked in new[] { "Daniel", "t1", "Maria", "all" })
            Assert.Equal(asked == "all", Run(d, "get_guest_visible_plan", $$"""{"traveller":"{{asked}}"}""") is { IsError: false });
        Assert.True(Run(d, "get_case_status").IsError);
        Assert.DoesNotContain("C-100", Run(d, "get_case_status", """{"traveller":"all"}""").Content);
    }

    [Fact]
    public void AnAbsentTravellerAndAForbiddenOneGiveTheSameAnswer()
    {
        var d = Family("Maria");
        Assert.Equal(Run(d, "get_case_status", """{"traveller":"Leo"}""").Content, Run(d, "get_case_status", """{"traveller":"Nobody"}""").Content);
    }

    [Fact]
    public void TwoTravellersWithOneNameAskForTheReference()
    {
        var d = Family("Daniel");
        d = d with { Packet = d.Packet with { Travellers = [.. d.Packet.Travellers, new StanleyTraveller("t4", "Maria", 20, false, false, TravellerAccess.Booker)] } };
        var r = Run(d, "get_guest_visible_plan", """{"traveller":"Maria"}""");
        Assert.True(r.IsError);
        Assert.Contains("reference", r.Content);
        Assert.False(Run(d, "get_guest_visible_plan", """{"traveller":"t4"}""").IsError);
    }

    [Fact]
    public void ThePlanShowsOnlyTravellersTheGuestMayReadAndHidesTheirNames()
    {
        var d = Family("Maria");
        // Maria shares the snorkel with Daniel, and the ruins are Daniel's alone. She reads Daniel's plan as a party member, so both show; Leo is a party member too.
        var all = Obj(Run(d, "get_guest_visible_plan", """{"traveller":"all"}"""));
        Assert.Equal(4, all["items"]!.AsArray().Count);
        // A packet that cannot read Daniel does not show his tour at all.
        var narrowed = d with { Packet = d.Packet with { Travellers = [.. d.Packet.Travellers.Where(t => t.Ref == "t2")] } };
        var mine = Obj(Run(narrowed, "get_guest_visible_plan"));
        var items = mine["items"]!.AsArray().Select(i => i!.AsObject()).ToList();
        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.Equal(["Maria"], i["travellers"]!.AsArray().Select(n => n!.GetValue<string>())));
        Assert.Contains(items, i => i["with_others"]!.GetValue<bool>());
        Assert.DoesNotContain("Leo", mine.ToJsonString());
    }

    [Fact]
    public void ConflictsFindOverlappingToursAndDinners()
    {
        var d = Family("Daniel");
        var kinds = Obj(Run(d, "check_plan_conflicts", """{"traveller":"Daniel"}"""))["conflicts"]!.AsArray().Select(c => c!["kind"]!.GetValue<string>()).ToList();
        Assert.Contains("tourOverlap", kinds);
        Assert.Contains("dinnerOverlap", kinds);
        // Maria has the snorkel and one dinner and no overlap.
        Assert.DoesNotContain("tourOverlap", Obj(Run(d, "check_plan_conflicts", """{"traveller":"Maria"}"""))["conflicts"]!.ToJsonString());
    }

    [Fact]
    public void PackageValueCountsTheTravellersOldEnoughAndSaysWhoHasIt()
    {
        var d = Family("Daniel");
        var r = Obj(Run(d, "calculate_package_value", """{"item_id":"drinks","traveller":"all"}"""));
        Assert.Equal(["Leo"], r["too_young"]!.AsArray().Select(n => n!.GetValue<string>()));
        Assert.Equal(["Daniel"], r["already_has"]!.AsArray().Select(n => n!.GetValue<string>()));
        Assert.Equal(2 * Voyage.Nights, r["units"]!.GetValue<int>());
        Assert.True(Run(d, "calculate_package_value", """{"item_id":"yacht"}""").IsError);
    }

    [Fact]
    public void TheShipAndScheduleToolsAnswerFromPublishedFacts()
    {
        var d = Family("Daniel");
        var venue = ShipDining.VenuesOf("sun-princess").First();
        Assert.NotEmpty(Obj(Run(d, "search_ship_venues"))["venues"]!.AsArray());
        Assert.Equal(venue.Name, Obj(Run(d, "get_venue_hours_and_menu", $$"""{"venue_id":"{{venue.Id}}"}"""))["name"]!.GetValue<string>());
        Assert.True(Run(d, "get_venue_hours_and_menu", """{"venue_id":"nowhere"}""").IsError);
        var aboard = Obj(Run(d, "get_verified_all_aboard_details"));
        Assert.True(aboard["provisional"]!.GetValue<bool>());
        Assert.NotEmpty(aboard["stops"]!.AsArray());
    }

    [Fact]
    public void TheRouteChangesDecksAndHonoursStepFree()
    {
        var steps = StanleyReadTools.RouteBetween(new("Allegro", 6, "aft"), new("Eatery", 16, "midship"), stepFree: true);
        Assert.Contains("up 10 decks", steps[1]);
        Assert.DoesNotContain("stairs", steps[0]);
        Assert.Contains("stairs", StanleyReadTools.RouteBetween(new("A", 6, "aft"), new("B", 7, "aft"), false)[0]);
        Assert.Single(StanleyReadTools.RouteBetween(new("A", 6, "aft"), new("B", 6, "aft"), false));
        Assert.True(Run(Family("Daniel"), "get_route", """{"from":"deck 6","to":"nowhere"}""").IsError);
        Assert.False(Run(Family("Daniel"), "get_route", """{"from":"deck 6","to":"deck 9"}""").IsError);
    }

    [Fact]
    public void TheToolsAreReadOnlyAndAnUnlistedToolIsRefused()
    {
        Assert.All(StanleyReadTools.Names, n => Assert.DoesNotMatch("book|pay|cancel|delete|refund|change|confirm|send|admin|set_|update|add_", n));
        var d = Family("Daniel");
        Assert.True(Run(d, "book_tour").IsError);
        var narrowed = d with { Packet = d.Packet with { AllowedTools = ["search_ship_venues"] } };
        Assert.True(Run(narrowed, "get_case_status").IsError);
    }

    [Fact]
    public void EveryDeclaredToolHasASchemaAndEveryPersonalToolTakesATraveller()
    {
        var declared = JsonNode.Parse(StanleyReadTools.ToolsJson)!.AsArray().Select(t => t!["name"]!.GetValue<string>()).ToList();
        Assert.Equal(StanleyReadTools.Names, declared);
        foreach (var name in StanleyReadTools.PersonalNames)
            Assert.NotNull(JsonNode.Parse(StanleyReadTools.ToolsJson)!.AsArray().First(t => t!["name"]!.GetValue<string>() == name)!["input_schema"]!["properties"]!["traveller"]);
        Assert.Equal(ConciergeRules.ToolNames.Count + StanleyReadTools.Names.Count, JsonNode.Parse(StanleyReadTools.AllToolsJson(ConciergeRules.ToolsJson))!.AsArray().Count);
    }

    // ---- the packet --------------------------------------------------------------------------------------------------------------------

    [Fact]
    public void TheGuestReferenceIsStableKeyedAndNotTheAccount()
    {
        var id = Guid.NewGuid();
        var a = StanleyPacket.RefFor(id, "k1");
        Assert.Equal(a, StanleyPacket.RefFor(id, "k1"));
        Assert.NotEqual(a, StanleyPacket.RefFor(id, "k2"));
        Assert.NotEqual(a, StanleyPacket.RefFor(Guid.NewGuid(), "k1"));
        Assert.DoesNotContain(id.ToString("N")[..8], a);
        Assert.Equal(13, a.Length);
    }

    [Fact]
    public void ThePromptBlockCarriesReferencesAndFirstNamesOnly()
    {
        var block = Family("Daniel").Packet.Block();
        Assert.Contains("t3 Leo", block);
        Assert.Contains("gabc", block);
        Assert.DoesNotContain("@", block);
    }

    [Fact]
    public void TheVoyageIsTheNamedOneTheOnlyOneOrAQuestion()
    {
        var a = new StanleyVoyage("S1", new DateOnly(2027, 3, 20), "Sun Princess", 7);
        var b = new StanleyVoyage("S2", new DateOnly(2027, 9, 4), "Sun Princess", 7);
        Assert.Null(StanleyVoyageChoice.Pick([], null).Chosen);
        Assert.Equal(a, StanleyVoyageChoice.Pick([a], null).Chosen);
        Assert.Equal(b, StanleyVoyageChoice.Pick([a, b], "S2").Chosen);
        var asked = StanleyVoyageChoice.Pick([a, b], null);
        Assert.True(asked.MustAsk);
        Assert.Null(asked.Chosen);
        // A sailing the guest is not on is never taken as named.
        Assert.True(StanleyVoyageChoice.Pick([a, b], "S9").MustAsk);
        Assert.Equal(a, StanleyVoyageChoice.Pick([a], "S9").Chosen);
    }

    // ---- the gateway and the caps ------------------------------------------------------------------------------------------------------

    /// <summary>A model that calls a read tool on every step until it is stopped, then (optionally) answers.</summary>
    private sealed class LoopModel(string tool, string input, int stopAfter = int.MaxValue) : IConciergeModel
    {
        public bool Available => true;
        public List<JsonArray> Seen { get; } = [];
        public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct)
        {
            Seen.Add((JsonArray)messages.DeepClone());
            var usage = new JsonObject { ["input_tokens"] = 10, ["output_tokens"] = 5 };
            if (Seen.Count > stopAfter) return Task.FromResult(new JsonObject { ["stop_reason"] = "end_turn", ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = "Done." }), ["usage"] = usage });
            return Task.FromResult(new JsonObject
            {
                ["stop_reason"] = "tool_use",
                ["content"] = new JsonArray(new JsonObject { ["type"] = "tool_use", ["id"] = "u" + Seen.Count, ["name"] = tool, ["input"] = JsonNode.Parse(input) }),
                ["usage"] = usage,
            });
        }
    }

    private static StanleyToolService Tools() => new(null!, null!, null!, NullLogger<StanleyToolService>.Instance);
    private static readonly ConciergeContext Ctx = new(Now, "S1", new DateOnly(2027, 3, 20), "Sun Princess", "Balcony", "Daniel", [], [], "any", []);
    private static List<ConciergeMessageDto> Thread(string text) => [new("user", text, 1)];

    [Fact]
    public async Task ARequestThatKeepsCallingATooCannotPassItsCallCap()
    {
        foreach (var tool in StanleyReadTools.Names)
        {
            var model = new LoopModel(tool, "{}");
            var meter = new ModelMeter(model, _ => Task.FromResult(true), 3);
            var e = await Assert.ThrowsAsync<ConciergeModelException>(() => Tools().AskModelAsync(Thread("x"), Ctx, meter, ModelTier.Default, Family("Daniel"), default));
            Assert.Equal("limit", e.Code);
            Assert.Equal(3, model.Seen.Count);
            Assert.Equal(3, meter.Calls);
            Assert.Equal(3, meter.ToolCalls);
        }
    }

    [Fact]
    public async Task AModelToldToReadAnotherTravellersCasesGetsARefusalNotTheData()
    {
        var model = new LoopModel("get_case_status", """{"traveller":"Leo"}""", stopAfter: 1);
        var meter = new ModelMeter(model, _ => Task.FromResult(true), 3);
        var reply = await Tools().AskModelAsync(Thread("What is the status of Leo's lost item case?"), Ctx, meter, ModelTier.Default, Family("Maria"), default);
        Assert.Equal("Done.", reply.Text);
        Assert.Equal((1, 1), (meter.ToolCalls, meter.ToolDenials));
        var result = model.Seen[1].Last()!["content"]!.AsArray()[0]!.AsObject();
        Assert.True(result["is_error"]!.GetValue<bool>());
        Assert.DoesNotContain("C-200", result.ToJsonString());
        Assert.DoesNotContain("lostItem", result.ToJsonString());
    }

    [Fact]
    public async Task ToolCallsAreLoggedByNameAndOutcomeNeverByContent()
    {
        var log = new ListLogger<StanleyToolService>();
        var model = new LoopModel("get_case_status", """{"traveller":"Leo"}""", stopAfter: 1);
        await new StanleyToolService(null!, null!, null!, log).AskModelAsync(Thread("Leo's case"), Ctx, new ModelMeter(model, _ => Task.FromResult(true), 3), ModelTier.Default, Family("Maria"), default);
        var line = Assert.Single(log.Lines);
        Assert.Contains("get_case_status", line);
        Assert.Contains("refused", line);
        Assert.DoesNotContain("Leo", line);
        Assert.DoesNotContain("C-200", line);
    }

    private sealed class ListLogger<T> : Microsoft.Extensions.Logging.ILogger<T>
    {
        public List<string> Lines { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => true;
        public void Log<TState>(Microsoft.Extensions.Logging.LogLevel logLevel, Microsoft.Extensions.Logging.EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Lines.Add(formatter(state, exception));
    }

    private sealed class TwoVoyages(bool named) : IStanleyPackets
    {
        public Task<StanleyPacketResult> BuildAsync(Princess.Api.Data.UserRecord user, StanleyContext context, CancellationToken ct)
        {
            var a = new StanleyVoyage("S1", new DateOnly(2027, 3, 20), "Sun Princess", 7);
            var b = new StanleyVoyage("S2", new DateOnly(2027, 9, 4), "Sun Princess", 7);
            return Task.FromResult(new StanleyPacketResult(StanleyVoyageChoice.Pick([a, b], named ? "S2" : null), null));
        }
    }

    private sealed class OneTrip : IStanleyTrips
    {
        public int Loads { get; private set; }
        public Task<StanleyTrip?> LoadAsync(Princess.Api.Data.UserRecord user, CancellationToken ct) { Loads++; return Task.FromResult<StanleyTrip?>(new StanleyTrip(new DateOnly(2027, 3, 5), new DateOnly(2027, 3, 20), 7, "Sun Princess", "Balcony", "late", [41], [], [], [], "S1", Now)); }
    }

    private sealed class NeverModel : IConciergeModel
    {
        public bool Available => false;
        public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct) => throw new InvalidOperationException("A model was called.");
    }

    private sealed class NoTools : IStanleyTools
    {
        public Task<ConciergeContext> ContextAsync(Princess.Api.Data.UserRecord user, string? mobility, List<string>? likes, CancellationToken ct) => Task.FromResult(Ctx);
        public Task<ConciergeReplyDto> AskModelAsync(List<ConciergeMessageDto> history, ConciergeContext ctx, ModelMeter meter, ModelTier tier, CancellationToken ct) => throw new InvalidOperationException("The tools route was used.");
    }

    private static StanleyService Gateway(IStanleyPackets packets) => new(new NeverModel(), new MemoryConciergeLimiter(), new FakeClock(Now), new OneTrip(), new NoTools(), new MemoryStanleyTierLog(),
        Options.Create(new StanleyOptions()), NullLogger<StanleyService>.Instance, packets);

    private static StanleyRequestDto Say(string text, string? sailing = null) => new([new("user", text, 1)], new StanleyContextDto("manage", null, sailing));
    private static readonly Princess.Api.Data.UserRecord User = new() { Id = 1 };

    [Fact]
    public async Task WithTwoVoyagesAndNoneNamedStanleyAsksAndNeverPicks()
    {
        var r = await Gateway(new TwoVoyages(false)).AskAsync(User, Say("What do I have booked on my plan?"), default);
        Assert.Equal(("answer", "resolver", "whichTrip"), (r.Kind, r.Tier, r.Card!.Id));
        Assert.Equal(2, r.Card.Lines.Count(l => l.Contains("Sun Princess")));
        Assert.Contains(r.Card.Links!, l => l.Path == "/me/trips");
    }

    [Fact]
    public async Task AQuestionThatIsNotAboutTheTripIsNotHeldUpByTheChoice()
    {
        // No model is set up in this fake, so the scripted answer replies. The point is that it does not stop to ask.
        var r = await Gateway(new TwoVoyages(false)).AskAsync(User, Say("hello"), default);
        Assert.NotEqual("whichTrip", r.Card?.Id);
    }

    [Fact]
    public async Task ANamedVoyageIsNotAsked()
    {
        var r = await Gateway(new TwoVoyages(true)).AskAsync(User, Say("When is all aboard?", "S2"), default);
        Assert.NotEqual("whichTrip", r.Card?.Id);
    }
}
