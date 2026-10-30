using System.Net;
using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>
/// The on-board day over the real pipeline. The Harpers (Balcony, Princess Plus) sail 21 March 2027: embarkation on the 21st, Cozumel on the 23rd, Belize on the 24th, Roatán on the 25th.
/// The drill is at 14:00 Eastern (18:00 UTC) on the 21st. Every test user is a demo user, so "now" and the scenarios are set per person.
/// </summary>
public class OnboardApiTests : JourneyWorld
{
    private const string Base = "/api/v1/bookings/PC243902";
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);

    private static readonly DateTime BeforeSailing = Utc(20, 16);
    private static readonly DateTime DrillTime = Utc(21, 18);
    private static readonly DateTime SeaDay = Utc(22, 16);
    private static readonly DateTime CozumelAfternoon = Utc(23, 17);      // 12:00 in Cozumel, all aboard at 21:30 UTC
    private static readonly DateTime BelizeAfternoon = Utc(24, 15);
    private static readonly DateTime RoatanAfternoon = Utc(25, 15);

    public OnboardApiTests() => SetNow(SeaDay);

    private async Task<string> DanielToken() => await SignIn(Daniel);

    private void Scenario(UserRecord u, params string[] ids) => F.Journey.Scenarios[u.Id] = [.. ids];

    // ---- Access ----

    [Fact]
    public async Task AnyGuestMayReadAndStrangersGetNotFound()
    {
        foreach (var path in new[] { "onboard/today", "onboard/port", "onboard/program/2", "onboard/port-day", "onboard/muster", "onboard/emergency", "entitlements", "service/channels", "service/dining" })
        {
            Assert.Equal(HttpStatusCode.OK, (await Get($"{Base}/{path}", await SignIn(Priya))).Status);
            Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Base}/{path}", await SignIn(Stranger))).Status);
        }
    }

    [Fact]
    public async Task ASupervisedChildCanLookButNotChangeOrSeeTheAccount()
    {
        var maya = MayaToken();
        Assert.Equal(HttpStatusCode.OK, (await Get($"{Base}/onboard/today", maya)).Status);
        Assert.False((await Get($"{Base}/onboard/program/2", maya)).Json.GetProperty("canEdit").GetBoolean());
        Assert.False((await Get($"{Base}/onboard/muster", maya)).Json.GetProperty("canConfirm").GetBoolean());
        foreach (var (verb, url, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Put, "onboard/plan/trivia", new { on = true, day = 2 }),
            (HttpMethod.Post, "onboard/muster", new { guests = new[] { Maya.PublicId } }),
            (HttpMethod.Get, "onboard/folio", null),
            (HttpMethod.Post, "service/dining", new { text = "hello" }),
            (HttpMethod.Post, "service/dining/escalate", new { phone = "555-0142" }),
        })
        {
            var r = await Call(verb, $"{Base}/{url}", maya, body);
            Assert.Equal(HttpStatusCode.Forbidden, r.Status);
            Assert.Equal("supervised", r.ProblemTitle);
        }
    }

    // ---- Today ----

    [Fact]
    public async Task BeforeSailingNobodyIsAboard()
    {
        SetNow(BeforeSailing);
        var t = (await Get($"{Base}/onboard/today", await DanielToken())).Json;
        Assert.False(t.GetProperty("aboard").GetBoolean());
        Assert.Equal(JsonValueKind.Null, t.GetProperty("day").ValueKind);
        Assert.Equal(JsonValueKind.Null, t.GetProperty("weather").ValueKind);
        Assert.Equal(JsonValueKind.Null, t.GetProperty("portDay").ValueKind);
        Assert.False(t.GetProperty("muster").GetProperty("required").GetBoolean());
        Assert.Equal(TripRules.ToMs(Utc(21, 19)), t.GetProperty("sailAwayAt").GetInt64());      // 15:00 Eastern
    }

    [Fact]
    public async Task OnSailingDayTheDrillIsRequiredUntilEveryoneHasCheckedIn()
    {
        SetNow(DrillTime);
        var token = await DanielToken();
        var t = (await Get($"{Base}/onboard/today", token)).Json;
        Assert.True(t.GetProperty("aboard").GetBoolean());
        Assert.Equal(1, t.GetProperty("day").GetInt32());
        Assert.Equal("fll", t.GetProperty("port").GetString());
        Assert.Equal("America/New_York", t.GetProperty("shipZone").GetString());
        Assert.Equal("2027-03-21", t.GetProperty("date").GetString());
        Assert.Equal(84, t.GetProperty("weather").GetProperty("highF").GetInt32());
        Assert.True(t.GetProperty("muster").GetProperty("required").GetBoolean());
        Assert.Equal(TripRules.ToMs(DrillTime), t.GetProperty("muster").GetProperty("at").GetInt64());
        Assert.Equal(3, t.GetProperty("portDay").GetProperty("day").GetInt32());

        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Daniel.PublicId, Priya.PublicId, Maya.PublicId } })).Status);
        t = (await Get($"{Base}/onboard/today", token)).Json;
        Assert.False(t.GetProperty("muster").GetProperty("required").GetBoolean());
        Assert.True(t.GetProperty("muster").GetProperty("done").GetBoolean());
        Assert.Equal(TripRules.ToMs(Utc(21, 19)), t.GetProperty("sailAwayAt").GetInt64());      // sail-away is an hour after the drill
    }

    [Fact]
    public async Task TheClockChangeIsAnnouncedTheDayBefore()
    {
        SetNow(CozumelAfternoon);
        var change = (await Get($"{Base}/onboard/today", await DanielToken())).Json.GetProperty("clockChange");
        Assert.Equal(-2, change.GetProperty("hours").GetInt32());
        Assert.Equal(TripRules.ToMs(Utc(24, 6)), change.GetProperty("at").GetInt64());

        SetNow(SeaDay);
        Assert.Equal(JsonValueKind.Null, (await Get($"{Base}/onboard/today", await DanielToken())).Json.GetProperty("clockChange").ValueKind);
    }

    [Fact]
    public async Task TheShipsClockAndPortFollowTheDay()
    {
        var token = await DanielToken();
        SetNow(BelizeAfternoon);
        var t = (await Get($"{Base}/onboard/today", token)).Json;
        Assert.Equal(("belize", "America/Belize", 4), (t.GetProperty("port").GetString(), t.GetProperty("shipZone").GetString(), t.GetProperty("day").GetInt32()));
        var port = (await Get($"{Base}/onboard/port", token)).Json;
        Assert.Equal(("belize", 4), (port.GetProperty("port").GetString(), port.GetProperty("day").GetInt32()));

        SetNow(SeaDay);
        port = (await Get($"{Base}/onboard/port", token)).Json;
        Assert.Equal(("sea", 2), (port.GetProperty("port").GetString(), port.GetProperty("day").GetInt32()));
    }

    [Fact]
    public async Task TheCountdownToAllAboardMovesWithTheClock()
    {
        var token = await DanielToken();
        SetNow(CozumelAfternoon);
        var state = (await Get($"{Base}/onboard/today", token)).Json.GetProperty("portDay").GetProperty("state");
        Assert.Equal("plenty", state.GetProperty("level").GetString());
        Assert.InRange(state.GetProperty("minutesLeft").GetInt32(), 270, 271);          // the demo clock is set to the second, a moment before the request
        SetNow(Utc(23, 20));
        state = (await Get($"{Base}/onboard/today", token)).Json.GetProperty("portDay").GetProperty("state");
        Assert.Equal("soon", state.GetProperty("level").GetString());
        Assert.Equal(60, state.GetProperty("nextReminder").GetInt32());
    }

    [Fact]
    public async Task TheRoughSeaScenarioShowsInTheWeather()
    {
        SetNow(BelizeAfternoon);
        var token = await DanielToken();
        Assert.DoesNotContain("rougher", (await Get($"{Base}/onboard/today", token)).Json.GetProperty("weather").GetProperty("sea").GetString());
        Scenario(Daniel, "belizeTender");
        Assert.Contains("rougher", (await Get($"{Base}/onboard/today", token)).Json.GetProperty("weather").GetProperty("sea").GetString());
    }

    [Fact]
    public async Task AScenarioOnlyAppliesToADemoUser()
    {
        Scenario(Daniel, "planChange");
        Daniel.IsDemo = false;
        var token = await DanielToken();
        Assert.False((await Get($"{Base}/onboard/today", token)).Json.GetProperty("changes").GetBoolean());
        Daniel.IsDemo = true;
        Assert.True((await Get($"{Base}/onboard/today", token)).Json.GetProperty("changes").GetBoolean());
    }

    // ---- The programme ----

    [Fact]
    public async Task TheProgrammeListsADayInOrderWithTheCallersPlan()
    {
        var token = await DanielToken();
        var p = (await Get($"{Base}/onboard/program/2", token)).Json;
        Assert.Equal(("2027-03-22", "sea", false, true), (p.GetProperty("date").GetString(), p.GetProperty("port").GetString(), p.GetProperty("changed").GetBoolean(), p.GetProperty("canEdit").GetBoolean()));
        var events = p.GetProperty("events").EnumerateArray().ToList();
        Assert.Equal("stretch", events[0].GetProperty("id").GetString());
        Assert.Equal(events.Select(e => e.GetProperty("startAt").GetInt64()).Order(), events.Select(e => e.GetProperty("startAt").GetInt64()));
        Assert.Empty(p.GetProperty("mine").EnumerateArray());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(9)]
    public async Task AnUnknownDayIsInvalid(int day)
    {
        var r = await Get($"{Base}/onboard/program/{day}", await DanielToken());
        Assert.Equal((HttpStatusCode.BadRequest, "day"), (r.Status, r.ProblemTitle));
    }

    [Fact]
    public async Task TheMidDayChangesShowOnlyInTheScenario()
    {
        var token = await DanielToken();
        Assert.False((await Get($"{Base}/onboard/program/2", token)).Json.GetProperty("changed").GetBoolean());
        Scenario(Daniel, "planChange");
        var p = (await Get($"{Base}/onboard/program/2", token)).Json;
        Assert.True(p.GetProperty("changed").GetBoolean());
        var by = p.GetProperty("events").EnumerateArray().ToDictionary(e => e.GetProperty("id").GetString()!);
        Assert.Equal("moved", by["stage-show"].GetProperty("status").GetString());
        Assert.Equal("20:30", by["stage-show"].GetProperty("was").GetString());
        Assert.Equal("cancelled", by["trivia"].GetProperty("status").GetString());
    }

    [Fact]
    public async Task APlanIsKeptPerPersonAndPerDay()
    {
        var token = await DanielToken();
        var on = await Call(HttpMethod.Put, $"{Base}/onboard/plan/trivia", token, new { on = true, day = 2 });
        Assert.Equal(["trivia"], on.Json.EnumerateArray().Select(e => e.GetString()));
        await Call(HttpMethod.Put, $"{Base}/onboard/plan/trivia", token, new { on = true, day = 6 });
        var more = await Call(HttpMethod.Put, $"{Base}/onboard/plan/bingo", token, new { on = true, day = 2 });
        Assert.Equal(["trivia", "bingo"], more.Json.EnumerateArray().Select(e => e.GetString()).OrderByDescending(x => x == "trivia"));

        Assert.Equal(["bingo", "trivia"], (await Get($"{Base}/onboard/program/2", token)).Json.GetProperty("mine").EnumerateArray().Select(e => e.GetString()).Order());
        Assert.Equal(["trivia"], (await Get($"{Base}/onboard/program/6", token)).Json.GetProperty("mine").EnumerateArray().Select(e => e.GetString()));
        Assert.Empty((await Get($"{Base}/onboard/program/7", token)).Json.GetProperty("mine").EnumerateArray());
        Assert.Empty((await Get($"{Base}/onboard/program/2", await SignIn(Priya))).Json.GetProperty("mine").EnumerateArray());

        var off = await Call(HttpMethod.Put, $"{Base}/onboard/plan/trivia", token, new { on = false, day = 2 });
        Assert.Equal(["bingo"], off.Json.EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(["trivia"], (await Get($"{Base}/onboard/program/6", token)).Json.GetProperty("mine").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task TogglingTwiceIsHarmlessAndABadEventOrDayIsInvalid()
    {
        var token = await DanielToken();
        await Call(HttpMethod.Put, $"{Base}/onboard/plan/trivia", token, new { on = true, day = 2 });
        Assert.Equal(["trivia"], (await Call(HttpMethod.Put, $"{Base}/onboard/plan/trivia", token, new { on = true, day = 2 })).Json.EnumerateArray().Select(e => e.GetString()));
        var unknown = await Call(HttpMethod.Put, $"{Base}/onboard/plan/nope", token, new { on = true, day = 2 });
        Assert.Equal((HttpStatusCode.BadRequest, "event"), (unknown.Status, unknown.ProblemTitle));
        var wrongDay = await Call(HttpMethod.Put, $"{Base}/onboard/plan/trivia", token, new { on = true, day = 3 });   // trivia runs on sea days only
        Assert.Equal((HttpStatusCode.BadRequest, "day"), (wrongDay.Status, wrongDay.ProblemTitle));
    }

    // ---- The port day ----

    [Fact]
    public async Task ThePortDayHasTheCountdownAndYourShipTours()
    {
        SetNow(CozumelAfternoon);
        var tour = Guid.NewGuid();
        F.Plan.Tours.Add((10, new TourRow { Id = 1, PublicId = tour, ExcursionId = "coz-snorkel", Day = 3, Status = "booked", GuestIds = [Daniel.Id, Maya.Id], At = DateTime.UtcNow }));
        F.Plan.Tours.Add((10, new TourRow { Id = 2, PublicId = Guid.NewGuid(), ExcursionId = "bze-reef", Day = 4, Status = "booked", GuestIds = [Daniel.Id], At = DateTime.UtcNow }));       // another port
        F.Plan.Tours.Add((10, new TourRow { Id = 3, PublicId = Guid.NewGuid(), ExcursionId = "coz-ruins", Day = 3, Status = "cancelled", GuestIds = [Daniel.Id], At = DateTime.UtcNow }));
        var v = (await Get($"{Base}/onboard/port-day", await DanielToken())).Json;
        Assert.Equal(("cozumel", 3), (v.GetProperty("day").GetProperty("port").GetString(), v.GetProperty("day").GetProperty("day").GetInt32()));
        Assert.Equal("plenty", v.GetProperty("day").GetProperty("state").GetProperty("level").GetString());
        Assert.Equal(JsonValueKind.Null, v.GetProperty("tender").ValueKind);
        Assert.Equal((0, false), (v.GetProperty("delayMinutes").GetInt32(), v.GetProperty("skipped").GetBoolean()));

        var tours = v.GetProperty("tours").EnumerateArray().ToList();
        var t = Assert.Single(tours);
        Assert.Equal(("coz-snorkel", tour.ToString()), (t.GetProperty("excursionId").GetString(), t.GetProperty("id").GetString()));
        Assert.Matches(@"^\d\d:\d\d$", t.GetProperty("backBy").GetString());
        var guests = t.GetProperty("guests").EnumerateArray().ToList();
        Assert.Equal(2, guests.Count);
        var parts = guests[0].GetProperty("code").GetString()!.Split('|');
        Assert.Equal(5, parts.Length);
        Assert.Equal(("PCX1", "PC243902", tour.ToString()), (parts[0], parts[1], parts[2]));
        Assert.Equal(parts[4], BoardingRules.Sign("test-signing-key-test-signing-key-0123456789", string.Join('|', parts[..4])));
    }

    [Fact]
    public async Task OnATenderPortAShipTourGuestIsCalledFirst()
    {
        SetNow(BelizeAfternoon);
        var token = await DanielToken();
        var plain = (await Get($"{Base}/onboard/port-day", token)).Json.GetProperty("tender");
        Assert.Contains(plain.GetProperty("group").GetProperty("id").GetString(), new[] { "g1", "g2", "g3", "g4" });
        Assert.False(plain.GetProperty("mayTender").GetBoolean());

        F.Plan.Tours.Add((10, new TourRow { Id = 1, PublicId = Guid.NewGuid(), ExcursionId = "bze-reef", Day = 4, Status = "booked", GuestIds = [Daniel.Id], At = DateTime.UtcNow }));
        var withTour = (await Get($"{Base}/onboard/port-day", token)).Json.GetProperty("tender");
        Assert.Equal("tour", withTour.GetProperty("group").GetProperty("id").GetString());
        Assert.Equal(TripRules.ToMs(Utc(24, 13, 45)), withTour.GetProperty("callAt").GetInt64());      // 07:45 in Belize
        Assert.Equal(TripRules.ToMs(Utc(24, 21, 15)), withTour.GetProperty("lastTenderAt").GetInt64());
    }

    [Fact]
    public async Task AGuestNeedingStepFreeAccessIsCalledWithTheFirstPriorityGroup()
    {
        SetNow(BelizeAfternoon);
        F.Journey.Profiles[Daniel.Id].Needs = ["mobility"];
        var tender = (await Get($"{Base}/onboard/port-day", await DanielToken())).Json.GetProperty("tender");
        Assert.Equal("priority", tender.GetProperty("group").GetProperty("id").GetString());
        Assert.True(tender.GetProperty("assistance").GetBoolean());
    }

    [Fact]
    public async Task TheBelizeScenarioDelaysTheTenderAndRoatanMayTenderInsteadOfDocking()
    {
        var token = await DanielToken();
        Scenario(Daniel, "belizeTender");
        SetNow(BelizeAfternoon);
        var belize = (await Get($"{Base}/onboard/port-day", token)).Json;
        Assert.Equal(40, belize.GetProperty("delayMinutes").GetInt32());
        Assert.Equal(40, belize.GetProperty("tender").GetProperty("delayMinutes").GetInt32());

        SetNow(RoatanAfternoon);
        var roatan = (await Get($"{Base}/onboard/port-day", token)).Json;
        Assert.Equal("roatan", roatan.GetProperty("day").GetProperty("port").GetString());
        Assert.True(roatan.GetProperty("tender").GetProperty("mayTender").GetBoolean());
        Assert.Equal(0, roatan.GetProperty("delayMinutes").GetInt32());
    }

    [Fact]
    public async Task APortCanBeSkippedAndNoPortDayIsLeftAfterTheLastOne()
    {
        var token = await DanielToken();
        Scenario(Daniel, "portSkipped");
        SetNow(CozumelAfternoon);
        Assert.True((await Get($"{Base}/onboard/port-day", token)).Json.GetProperty("skipped").GetBoolean());
        SetNow(BelizeAfternoon);
        Assert.False((await Get($"{Base}/onboard/port-day", token)).Json.GetProperty("skipped").GetBoolean());

        SetNow(Utc(26, 12));
        var after = await Get($"{Base}/onboard/port-day", token);
        Assert.Equal(HttpStatusCode.OK, after.Status);
        Assert.Equal(JsonValueKind.Null, after.Json.ValueKind);
    }

    // ---- Muster ----

    [Fact]
    public async Task TheMusterViewNamesTheStationAndEveryGuest()
    {
        SetNow(DrillTime);
        var m = (await Get($"{Base}/onboard/muster", await DanielToken())).Json;
        Assert.Equal(TripRules.ToMs(DrillTime), m.GetProperty("at").GetInt64());
        Assert.Matches(@"^Station [A-F]$", m.GetProperty("station").GetString());
        var letter = m.GetProperty("station").GetString()![^1..];
        Assert.Equal(ProgramRules.MusterStations[letter].Name, m.GetProperty("stationName").GetString());
        Assert.Equal(ProgramRules.PlaceName(ProgramRules.MusterStations[letter].PlaceId), m.GetProperty("stationPlace").GetString());
        Assert.Equal(3, m.GetProperty("guests").GetArrayLength());
        Assert.All(m.GetProperty("guests").EnumerateArray(), g => Assert.Equal(JsonValueKind.Null, g.GetProperty("confirmedAt").ValueKind));
        Assert.True(m.GetProperty("required").GetBoolean());
        Assert.True(m.GetProperty("canConfirm").GetBoolean());
    }

    [Fact]
    public async Task CheckingInOnlySomeGuestsLeavesTheDrillRequired()
    {
        SetNow(DrillTime);
        var token = await DanielToken();
        var r = await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Daniel.PublicId, Priya.PublicId } });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.True(r.Json.GetProperty("required").GetBoolean());
        Assert.False(r.Json.GetProperty("done").GetBoolean());
        var confirmed = r.Json.GetProperty("guests").EnumerateArray().Where(g => g.GetProperty("confirmedAt").ValueKind == JsonValueKind.Number).Select(g => g.GetProperty("id").GetGuid()).ToHashSet();
        Assert.Equal(new HashSet<Guid> { Daniel.PublicId, Priya.PublicId }, confirmed);

        var rest = await Call(HttpMethod.Post, $"{Base}/onboard/muster", await SignIn(Priya), new { guests = new[] { Maya.PublicId } });
        Assert.True(rest.Json.GetProperty("done").GetBoolean());
        Assert.False(rest.Json.GetProperty("required").GetBoolean());
    }

    [Fact]
    public async Task ACheckInKeepsItsFirstTime()
    {
        SetNow(DrillTime);
        var token = await DanielToken();
        var first = (await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Daniel.PublicId } })).Json;
        var at = first.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == Daniel.PublicId).GetProperty("confirmedAt").GetInt64();
        SetNow(DrillTime.AddMinutes(20));
        var again = (await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Daniel.PublicId } })).Json;
        Assert.Equal(at, again.GetProperty("guests").EnumerateArray().Single(g => g.GetProperty("id").GetGuid() == Daniel.PublicId).GetProperty("confirmedAt").GetInt64());
    }

    [Fact]
    public async Task TheMusterOpensAnHourBeforeTheDrillAndClosesEighteenHoursAfter()
    {
        var token = await DanielToken();
        var body = new { guests = new[] { Daniel.PublicId } };
        SetNow(DrillTime.AddMinutes(-90));
        var early = await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, body);
        Assert.Equal((HttpStatusCode.Conflict, "notOpen"), (early.Status, early.ProblemTitle));
        SetNow(DrillTime.AddMinutes(-50));
        Assert.Equal(HttpStatusCode.OK, (await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, body)).Status);
        SetNow(DrillTime.AddHours(19));
        var late = await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Priya.PublicId } });
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (late.Status, late.ProblemTitle));
    }

    [Fact]
    public async Task AStrangerAnEmptyListOrACancelledBookingCannotCheckIn()
    {
        SetNow(DrillTime);
        var token = await DanielToken();
        var outsider = await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Stranger.PublicId } });
        Assert.Equal((HttpStatusCode.BadRequest, "guests"), (outsider.Status, outsider.ProblemTitle));
        var none = await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = Array.Empty<Guid>() });
        Assert.Equal((HttpStatusCode.BadRequest, "guests"), (none.Status, none.ProblemTitle));
        Harper.Status = "cancelled";
        var cancelled = await Call(HttpMethod.Post, $"{Base}/onboard/muster", token, new { guests = new[] { Daniel.PublicId } });
        Assert.Equal((HttpStatusCode.Conflict, "closed"), (cancelled.Status, cancelled.ProblemTitle));
    }

    // ---- The emergency card ----

    [Fact]
    public async Task TheEmergencyCardIsPersonalToTheCaller()
    {
        var daniel = (await Get($"{Base}/onboard/emergency", await DanielToken())).Json;
        var priya = (await Get($"{Base}/onboard/emergency", await SignIn(Priya))).Json;
        Assert.StartsWith("This is Daniel Harper. I need help in stateroom ", daniel.GetProperty("script").GetString());
        Assert.StartsWith("This is Priya Harper.", priya.GetProperty("script").GetString());
        Assert.Equal(daniel.GetProperty("stateroom").GetString(), priya.GetProperty("stateroom").GetString());
        Assert.Equal(4, daniel.GetProperty("contacts").GetArrayLength());
        Assert.Equal(daniel.GetProperty("muster").GetString()![^1..], daniel.GetProperty("musterPlace").GetProperty("letter").GetString());
    }

    [Fact]
    public async Task TheStationOnTheEmergencyCardIsTheOneOnTheMusterView()
    {
        var token = await DanielToken();
        Assert.Equal((await Get($"{Base}/onboard/muster", token)).Json.GetProperty("station").GetString(), (await Get($"{Base}/onboard/emergency", token)).Json.GetProperty("muster").GetString());
    }

    // ---- The account ----

    private static IEnumerable<JsonElement> Lines(JsonElement folio) => folio.GetProperty("lines").EnumerateArray();

    [Fact]
    public async Task BeforeTheCruiseTheAccountIsEmpty()
    {
        SetNow(BeforeSailing);
        var f = (await Get($"{Base}/onboard/folio", await DanielToken())).Json;
        Assert.Empty(Lines(f));
        Assert.Equal(0, f.GetProperty("throughDay").GetInt32());
        Assert.Equal(0, f.GetProperty("totals").GetProperty("balance").GetInt64());
        Assert.Equal(3, f.GetProperty("guests").GetArrayLength());
    }

    [Fact]
    public async Task ThePlusFareCoversTheDailyGratuityForEveryoneAndAChildPaysNothingElse()
    {
        SetNow(CozumelAfternoon);
        var f = (await Get($"{Base}/onboard/folio", await DanielToken())).Json;
        Assert.Equal(3, f.GetProperty("throughDay").GetInt32());
        var tips = Lines(f).Where(l => l.GetProperty("category").GetString() == "gratuities").ToList();
        Assert.Equal(9, tips.Count);
        Assert.All(tips, l => Assert.Equal(("package", 0L), (l.GetProperty("coveredBy").GetString(), l.GetProperty("cents").GetInt64())));
        Assert.All(Lines(f).Where(l => l.GetProperty("guest").GetGuid() == Maya.PublicId), l => Assert.Equal("gratuities", l.GetProperty("category").GetString()));
        var at = Lines(f).Select(l => l.GetProperty("at").GetInt64()).ToList();
        Assert.Equal(at.Order(), at);
        Assert.All(at, a => Assert.True(a <= TripRules.ToMs(CozumelAfternoon)));
    }

    [Fact]
    public async Task AWelcomeGiftIsACreditForARubyGuest()
    {
        SetNow(CozumelAfternoon);
        GuestOf(Daniel).Tier = "ruby";
        var f = (await Get($"{Base}/onboard/folio", await DanielToken())).Json;
        var credit = Lines(f).Single(l => l.GetProperty("category").GetString() == "credit");
        Assert.Equal((-5000L, Daniel.PublicId), (credit.GetProperty("cents").GetInt64(), credit.GetProperty("guest").GetGuid()));
        Assert.Equal(5000, f.GetProperty("totals").GetProperty("credits").GetInt64());
    }

    [Fact]
    public async Task StoredChargesSitBesideTheGeneratedOnesAndFutureOnesWait()
    {
        SetNow(CozumelAfternoon);
        F.Onboard.Folio.Add((10, new FolioRow { PublicId = Guid.NewGuid(), UserId = Priya.Id, Day = 2, Category = "photos", Description = "Portrait print", Cents = 2495, At = Utc(22, 20) }));
        F.Onboard.Folio.Add((10, new FolioRow { PublicId = Guid.NewGuid(), UserId = null, Day = 3, Category = "laundry", Description = "Laundry bag", Cents = 1500, At = Utc(23, 16) }));
        F.Onboard.Folio.Add((10, new FolioRow { PublicId = Guid.NewGuid(), UserId = Priya.Id, Day = 3, Category = "shops", Description = "Not yet", Cents = 900, At = Utc(23, 18) }));
        var f = (await Get($"{Base}/onboard/folio", await DanielToken())).Json;
        var portrait = Lines(f).Single(l => l.GetProperty("description").GetString() == "Portrait print");
        Assert.Equal(Priya.PublicId, portrait.GetProperty("guest").GetGuid());
        Assert.Equal(Daniel.PublicId, Lines(f).Single(l => l.GetProperty("description").GetString() == "Laundry bag").GetProperty("guest").GetGuid());      // no person: the booker's
        Assert.DoesNotContain(Lines(f), l => l.GetProperty("description").GetString() == "Not yet");
        var totals = f.GetProperty("totals");
        Assert.Equal(totals.GetProperty("charges").GetInt64() - totals.GetProperty("credits").GetInt64(), totals.GetProperty("balance").GetInt64());
        Assert.True(totals.GetProperty("charges").GetInt64() >= 2495 + 1500);
    }

    [Fact]
    public async Task ADinnerReservedWithTheSpecialtyChargeIsOnTheAccount()
    {
        SetNow(BelizeAfternoon);
        F.Plan.Tables.Add((10, new TableRow { Id = 700, PublicId = Guid.NewGuid(), VenueId = "crown", Day = 3, Time = "18:30", ChargeCents = 6000, GuestIds = [Daniel.Id, Priya.Id, Maya.Id], CoveredIds = [Maya.Id], At = DateTime.UtcNow }, "booked"));
        var f = (await Get($"{Base}/onboard/folio", await DanielToken())).Json;
        var dining = Lines(f).Where(l => l.GetProperty("category").GetString() == "dining").ToList();
        Assert.Equal(3, dining.Count);
        Assert.Equal([0L, 3000L, 3000L], dining.Select(l => l.GetProperty("cents").GetInt64()).Order());
        Assert.StartsWith("Cover charge, ", dining.First(l => l.GetProperty("cents").GetInt64() > 0).GetProperty("description").GetString());
    }

    [Fact]
    public async Task AfterTheLastDayTheAccountCoversTheWholeCruise()
    {
        SetNow(Utc(29, 12));
        var f = (await Get($"{Base}/onboard/folio", await DanielToken())).Json;
        Assert.Equal(8, f.GetProperty("throughDay").GetInt32());
        Assert.Equal(21, Lines(f).Count(l => l.GetProperty("category").GetString() == "gratuities"));
    }

    [Fact]
    public async Task EntitlementsShowThePackageAndWhatIsLeft()
    {
        var e = (await Get($"{Base}/entitlements", await DanielToken())).Json;
        Assert.Equal(15, e.GetProperty("entitlements").GetProperty("drinkCapUsd").GetInt32());
        Assert.True(e.GetProperty("entitlements").GetProperty("gratuitiesIncluded").GetBoolean());
        Assert.Equal(2, e.GetProperty("balances").GetProperty("specialtyMeals").GetProperty("remaining").GetInt32());
        F.Plan.Tables.Add((10, new TableRow { Id = 701, PublicId = Guid.NewGuid(), VenueId = "crown", Day = 3, Time = "18:30", GuestIds = [Daniel.Id], CoveredIds = [Daniel.Id], At = DateTime.UtcNow }, "booked"));
        e = (await Get($"{Base}/entitlements", await DanielToken())).Json;
        Assert.Equal((2, 1, 1), (e.GetProperty("balances").GetProperty("specialtyMeals").GetProperty("total").GetInt32(), e.GetProperty("balances").GetProperty("specialtyMeals").GetProperty("used").GetInt32(), e.GetProperty("balances").GetProperty("specialtyMeals").GetProperty("remaining").GetInt32()));
    }

    // ---- Guest Services chat ----

    private Task<Reply> Say(string channel, string text, string token) => Call(HttpMethod.Post, $"{Base}/service/{channel}", token, new { text });

    [Fact]
    public async Task ThereAreFiveChannelsAndTheMedicalOneIsFast()
    {
        var channels = (await Get($"{Base}/service/channels", await DanielToken())).Json.EnumerateArray().ToList();
        Assert.Equal(["guestServices", "housekeeping", "dining", "medical", "excursions"], channels.Select(c => c.GetProperty("id").GetString()));
        Assert.Equal([5, 10, 8, 5, 12], channels.Select(c => c.GetProperty("minutes").GetInt32()));
        Assert.All(channels, c => Assert.False(c.GetProperty("unanswered").GetBoolean()));
    }

    [Fact]
    public async Task AMessageWaitsForItsReplyAndTheCrewAnswersOnceTheTimeHasCome()
    {
        var token = await DanielToken();
        var sent = await Say("housekeeping", "  More towels please  ", token);
        Assert.Equal(HttpStatusCode.OK, sent.Status);
        var first = sent.Json.GetProperty("messages").EnumerateArray().ToList();
        var mine = Assert.Single(first);
        Assert.Equal(("me", "More towels please"), (mine.GetProperty("from").GetString(), mine.GetProperty("text").GetString()));
        Assert.Equal("waiting", sent.Json.GetProperty("state").GetProperty("status").GetString());
        Assert.Equal(4, sent.Json.GetProperty("state").GetProperty("queue").GetInt32());
        Assert.True((await Get($"{Base}/service/channels", token)).Json.EnumerateArray().Single(c => c.GetProperty("id").GetString() == "housekeeping").GetProperty("unanswered").GetBoolean());

        SetNow(SeaDay.AddMinutes(11));
        var later = (await Get($"{Base}/service/housekeeping", token)).Json;
        var messages = later.GetProperty("messages").EnumerateArray().ToList();
        Assert.Equal(["me", "crew"], messages.Select(m => m.GetProperty("from").GetString()));
        Assert.Equal("Marlon, Housekeeping", messages[1].GetProperty("crew").GetString());
        Assert.Equal("answered", later.GetProperty("state").GetProperty("status").GetString());
        Assert.False((await Get($"{Base}/service/channels", token)).Json.EnumerateArray().Single(c => c.GetProperty("id").GetString() == "housekeeping").GetProperty("unanswered").GetBoolean());

        SetNow(SeaDay.AddMinutes(31));
        Assert.Equal("resolved", (await Get($"{Base}/service/housekeeping", token)).Json.GetProperty("state").GetProperty("status").GetString());
    }

    [Fact]
    public async Task EveryGuestOnTheBookingSharesTheConversation()
    {
        await Say("dining", "Is our table held?", await DanielToken());
        var priya = (await Get($"{Base}/service/dining", await SignIn(Priya))).Json;
        Assert.Equal("Is our table held?", Assert.Single(priya.GetProperty("messages").EnumerateArray()).GetProperty("text").GetString());
        var maya = (await Get($"{Base}/service/dining", MayaToken())).Json;
        Assert.Equal(1, maya.GetProperty("messages").GetArrayLength());
        Assert.Equal(0, (await Get($"{Base}/service/medical", await DanielToken())).Json.GetProperty("messages").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, (await Get($"{Base}/service/medical", await DanielToken())).Json.GetProperty("state").ValueKind);
    }

    [Fact]
    public async Task ANewMessageAfterTheWindowGetsAFreshReply()
    {
        var token = await DanielToken();
        await Say("guestServices", "First question", token);
        SetNow(SeaDay.AddMinutes(30));
        await Say("guestServices", "Second question", token);
        SetNow(SeaDay.AddMinutes(36));
        var messages = (await Get($"{Base}/service/guestServices", token)).Json.GetProperty("messages").EnumerateArray().Select(m => m.GetProperty("from").GetString()).ToList();
        Assert.Equal(["me", "crew", "me", "crew"], messages);
    }

    [Fact]
    public async Task ASlowChatScenarioMakesEveryReplyFiveTimesAsLongAndOffersACallAtOnce()
    {
        var token = await DanielToken();
        Scenario(Daniel, "chatSlow");
        var channels = (await Get($"{Base}/service/channels", token)).Json.EnumerateArray().ToList();
        Assert.Equal([25, 50, 40, 25, 60], channels.Select(c => c.GetProperty("minutes").GetInt32()));
        Assert.All(channels, c => Assert.True(c.GetProperty("slow").GetBoolean()));
        var sent = await Say("guestServices", "Anyone there?", token);
        Assert.True(sent.Json.GetProperty("slow").GetBoolean());
        Assert.True(sent.Json.GetProperty("state").GetProperty("canEscalate").GetBoolean());
        SetNow(SeaDay.AddMinutes(10));
        Assert.Equal(1, (await Get($"{Base}/service/guestServices", token)).Json.GetProperty("messages").GetArrayLength());
    }

    [Fact]
    public async Task AskingForACallPutsTheNumberInTheThreadAndLogsACallbackTicket()
    {
        var token = await DanielToken();
        await Say("medical", "My daughter has a fever", token);
        SetNow(SeaDay.AddMinutes(2));
        var r = await Call(HttpMethod.Post, $"{Base}/service/medical/escalate", token, new { phone = " 555-0142 " });
        Assert.Equal(HttpStatusCode.OK, r.Status);
        Assert.Equal("escalated", r.Json.GetProperty("state").GetProperty("status").GetString());
        var call = r.Json.GetProperty("messages").EnumerateArray().Last();
        Assert.Equal(("call-medical", "crew"), (call.GetProperty("id").GetString(), call.GetProperty("from").GetString()));
        Assert.Contains("555-0142", call.GetProperty("text").GetString());
        var ticket = Assert.Single(F.Journey.Tickets, t => t.UserId == Daniel.Id);
        Assert.Equal(("callback", "555-0142"), (ticket.Ticket.Kind, ticket.Ticket.Detail));
    }

    [Fact]
    public async Task EmptyMessagesBadChannelsAndBadNumbersAreInvalid()
    {
        var token = await DanielToken();
        var empty = await Say("dining", "   ", token);
        Assert.Equal((HttpStatusCode.BadRequest, "text"), (empty.Status, empty.ProblemTitle));
        var channel = await Say("spa", "hello", token);
        Assert.Equal((HttpStatusCode.BadRequest, "channel"), (channel.Status, channel.ProblemTitle));
        Assert.Equal("channel", (await Get($"{Base}/service/spa", token)).ProblemTitle);
        var phone = await Call(HttpMethod.Post, $"{Base}/service/dining/escalate", token, new { phone = "12" });
        Assert.Equal((HttpStatusCode.BadRequest, "phone"), (phone.Status, phone.ProblemTitle));
        Assert.Empty(F.Journey.Tickets);
    }

    [Fact]
    public async Task ALongMessageIsCutAtAThousandCharacters()
    {
        var sent = await Say("dining", new string('a', 1500), await DanielToken());
        Assert.Equal(1000, sent.Json.GetProperty("messages")[0].GetProperty("text").GetString()!.Length);
    }
}
