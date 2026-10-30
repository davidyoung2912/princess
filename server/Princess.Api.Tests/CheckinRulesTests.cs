using System.Text.Json;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure check-in and boarding rules, mirroring <c>checkin.test.ts</c>. A cruise returning on 28 March 2027 needs a passport valid to 28 September 2027.</summary>
public class CheckinRulesTests
{
    private static readonly DateOnly Return = new(2027, 3, 28);
    private const string Key = "test-signing-key-test-signing-key-0123456789";

    // ---- Document ----

    [Theory]
    [InlineData("passport", "United States", "X1234567", "2030-02-01", "us", null)]
    [InlineData("passport", "United States", "x-123 4567", "2030-02-01", "us", null)]
    [InlineData("passport", "United States", "X1234567", "2027-09-28", "us", null)]
    [InlineData("passport", "United States", "X1234567", "2027-09-27", "us", "tooSoon")]
    [InlineData("passport", "United States", "X1234567", "2027-03-27", "us", "expired")]
    [InlineData("passport", "United States", "X12", "2030-02-01", "us", "number")]
    [InlineData("passport", "U", "X1234567", "2030-02-01", "us", "country")]
    [InlineData("passport", "United States", "X1234567", "01/02/2030", "us", "expiry")]
    [InlineData("passport", "United States", "X1234567", "2030-13-01", "us", "expiry")]
    [InlineData("birthCertificate", "", "", "", "us", null)]
    [InlineData("birthCertificate", "", "", "", "other", "notAllowed")]
    [InlineData("licence", "", "", "", "us", "kind")]
    [InlineData(null, "", "", "", "us", "kind")]
    public void ValidatesTheTravelDocument(string? kind, string country, string number, string expires, string citizenship, string? expected) =>
        Assert.Equal(expected, CheckinRules.ValidateDocument(kind, country, number, expires, citizenship, Return));

    [Fact]
    public void OnlyTheLastFourOfAPassportNumberAreEverReadBack() =>
        Assert.Equal("4567", CheckinRules.NormalizePassportNumber(" x-123 4567 ")[^4..]);

    // ---- Photo ----

    private static PhotoMetrics Photo(double w = 1200, double h = 1500, double b = 135, double s = 28) => new(w, h, b, s);

    [Fact]
    public void AGoodPhotoHasNoProblems() => Assert.Empty(CheckinRules.JudgePhoto(Photo()));

    [Fact]
    public void ReportsEveryPhotoProblemAtOnce()
    {
        Assert.Equal(["small"], CheckinRules.JudgePhoto(Photo(300, 375)));
        Assert.Equal(["shape"], CheckinRules.JudgePhoto(Photo(2400, 1000)));
        Assert.Equal(["dark"], CheckinRules.JudgePhoto(Photo(b: 38)));
        Assert.Equal(["bright"], CheckinRules.JudgePhoto(Photo(b: 230)));
        Assert.Equal(["blurry"], CheckinRules.JudgePhoto(Photo(s: 5)));
        Assert.Equal(["dark", "blurry"], CheckinRules.JudgePhoto(Photo(b: 40, s: 3)));
    }

    [Fact]
    public void MissingOrNonFiniteMeasurementsAreSmall()
    {
        Assert.Equal(["small"], CheckinRules.JudgePhoto(null));
        Assert.Equal(["small"], CheckinRules.JudgePhoto(new PhotoMetrics(1200, 1500, null, 28)));
        Assert.Equal(["small"], CheckinRules.JudgePhoto(new PhotoMetrics(double.NaN, 1500, 135, 28)));
        Assert.Equal(["small"], CheckinRules.JudgePhoto(new PhotoMetrics(double.PositiveInfinity, 1500, 135, 28)));
    }

    // ---- Emergency contact ----

    [Theory]
    [InlineData("Sam Example", "555-0104", "Friend", null)]
    [InlineData("S", "555-0104", "Friend", "name")]
    [InlineData("Sam Example", "12", "Friend", "phone")]
    [InlineData("Sam Example", "555-0104", "  ", "relationship")]
    [InlineData("  priya harper ", "555-0104", "Wife", "travelling")]
    public void ValidatesTheEmergencyContact(string name, string phone, string relationship, string? expected) =>
        Assert.Equal(expected, CheckinRules.ValidateEmergency(name, phone, relationship, ["Daniel Harper", "Priya Harper"]));

    // ---- Health ----

    private static Dictionary<string, JsonElement> Answers(string json) => JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json)!;

    [Fact]
    public void HealthNeedsEveryAnswerAndAYesOnlyFlags()
    {
        var no = CheckinRules.ValidateHealth(Answers("""{"symptoms":false,"positive":false,"contact":false}"""));
        Assert.False(no!.Value.Flagged);
        var yes = CheckinRules.ValidateHealth(Answers("""{"symptoms":true,"positive":false,"contact":false}"""));
        Assert.True(yes!.Value.Flagged);
        Assert.Null(CheckinRules.ValidateHealth(Answers("""{"symptoms":false,"positive":false}""")));
        Assert.Null(CheckinRules.ValidateHealth(Answers("""{"symptoms":"no","positive":false,"contact":false}""")));
        Assert.Null(CheckinRules.ValidateHealth(null));
    }

    // ---- Progress ----

    [Fact]
    public void ProgressFindsTheNextStepInOrder()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var none = CheckinRules.GuestProgressOf(new HashSet<string>());
        var some = CheckinRules.GuestProgressOf(new HashSet<string> { "confirm", "document" });
        var p = CheckinRules.ProgressOf([(a, some), (b, none)], paymentDone: false, arrivalDone: false);
        Assert.Equal((2, 14, false), (p.Done, p.Total, p.Complete));
        Assert.Equal(new NextStep("confirm", b), p.Next);

        var allDone = CheckinRules.GuestProgressOf(new HashSet<string>(CheckinRules.GuestSteps));
        var photoLeft = CheckinRules.GuestProgressOf(new HashSet<string>(CheckinRules.GuestSteps.Where(s => s != "photo")));
        Assert.Equal(new NextStep("photo", b), CheckinRules.ProgressOf([(a, allDone), (b, photoLeft)], false, false).Next);
        Assert.Equal(new NextStep("payment", null), CheckinRules.ProgressOf([(a, allDone)], false, false).Next);   // payment comes before contract and health, so it is next only when those are done
        Assert.Equal(new NextStep("arrival", null), CheckinRules.ProgressOf([(a, allDone)], true, false).Next);
        var complete = CheckinRules.ProgressOf([(a, allDone)], true, true);
        Assert.True(complete.Complete);
        Assert.Null(complete.Next);
        Assert.Equal((8, 8), (complete.Done, complete.Total));
    }

    [Fact]
    public void StateIsDoneOnceFinishedWhateverTheClock()
    {
        var opens = new DateTime(2027, 3, 18, 4, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2027, 3, 21, 14, 0, 0, DateTimeKind.Utc);
        Assert.Equal("notOpen", CheckinRules.State(false, opens.AddSeconds(-1), opens, closes));
        Assert.Equal("open", CheckinRules.State(false, opens, opens, closes));
        Assert.Equal("closed", CheckinRules.State(false, closes, opens, closes));
        Assert.Equal("done", CheckinRules.State(true, closes.AddDays(2), opens, closes));
    }

    // ---- Boarding ----

    [Theory]
    [InlineData("forward", "port", "Station A")]
    [InlineData("forward", "starboard", "Station B")]
    [InlineData("midship", "port", "Station C")]
    [InlineData("midship", "starboard", "Station D")]
    [InlineData("aft", "port", "Station E")]
    [InlineData("aft", "starboard", "Station F")]
    public void MusterStationFollowsThePositionAndSide(string position, string side, string expected) => Assert.Equal(expected, BoardingRules.MusterStation(position, side));

    [Fact]
    public void BoardingGroupFollowsPriorityThenTheArrivalWindow()
    {
        Assert.Equal("Priority", BoardingRules.BoardingGroup(true, "11:00"));
        Assert.Equal("Not set", BoardingRules.BoardingGroup(false, null));
        Assert.Equal("Not set", BoardingRules.BoardingGroup(false, "10:30"));
        Assert.Equal("Group 1", BoardingRules.BoardingGroup(false, "11:00"));
        Assert.Equal("Group 5", BoardingRules.BoardingGroup(false, "13:00"));
    }

    [Fact]
    public void TheStateroomIsStableAndStepFreeWhenNeeded()
    {
        var a = BoardingRules.AssignmentFor("PC243902", "sun-2027-03-21", "balcony", null, false);
        Assert.Equal(a, BoardingRules.AssignmentFor("PC243902", "sun-2027-03-21", "balcony", null, false));
        Assert.False(a.Accessible);
        Assert.True(BoardingRules.AssignmentFor("PC243902", "sun-2027-03-21", "balcony", null, true).Accessible);
    }

    [Fact]
    public void AChosenSampleStateroomIsKept()
    {
        var chosen = CabinRules.CabinsFor("sun-2027-03-21", "balcony").First(c => c.Available && !c.Accessible);
        var a = BoardingRules.AssignmentFor("PC243902", "sun-2027-03-21", "balcony", chosen.Number, false);
        Assert.Equal((chosen.Number, chosen.Deck), (a.Number, a.Deck));
        Assert.Equal(BoardingRules.MusterStation(chosen.Position, chosen.Side), a.Muster);
        Assert.Equal("TBA", BoardingRules.AssignmentFor("PC1", "no-such-sailing", "nonsense", null, false).Number);
    }

    [Fact]
    public void ThePassCodeRoundTripsAndSpotsEdits()
    {
        var pass = new PassData("PC243902", 2, BoardingRules.PassName("Priya", "Harper"), "2027-03-21", "10101", "Group 1");
        var code = BoardingRules.EncodePass(Key, pass);
        Assert.StartsWith("PCP1|PC243902|2|HARPER/PRIYA|2027-03-21|10101|Group 1|", code);
        Assert.Equal(pass, BoardingRules.DecodePass(Key, code));
        Assert.Null(BoardingRules.DecodePass(Key, code.Replace("10101", "10102")));
        Assert.Null(BoardingRules.DecodePass("another-key-another-key-another-key", code));
        Assert.Null(BoardingRules.DecodePass(Key, "PCP2" + code[4..]));
        Assert.Null(BoardingRules.DecodePass(Key, "nonsense"));
        Assert.Null(BoardingRules.DecodePass(Key, ""));
    }

    [Fact]
    public void APipeInANameCannotBreakTheCode()
    {
        var code = BoardingRules.EncodePass(Key, new PassData("PC1", 1, "O'NEIL|X/ANN", "2027-03-21", "10101", "Group|1"));
        Assert.Equal(8, code.Split('|').Length);
        Assert.NotNull(BoardingRules.DecodePass(Key, code));
    }

    [Fact]
    public void LuggageArrivesThreeHoursAfterDropAndNotBeforeTheStateroomIsReady()
    {
        var ready = new DateTime(2027, 3, 21, 17, 0, 0, DateTimeKind.Utc);
        Assert.Equal("notDropped", BoardingRules.LuggageStatus(null, ready, ready));
        var early = ready.AddHours(-2);                                                         // due an hour after the staterooms open
        Assert.Equal("dropped", BoardingRules.LuggageStatus(early, ready.AddHours(-1), ready));
        Assert.Equal("dropped", BoardingRules.LuggageStatus(early, ready, ready));              // the stateroom is ready but three hours are not up
        Assert.Equal("delivered", BoardingRules.LuggageStatus(early, ready.AddHours(1), ready));
        var late = ready.AddHours(1);
        Assert.Equal("dropped", BoardingRules.LuggageStatus(late, ready.AddHours(3), ready));
        Assert.Equal("delivered", BoardingRules.LuggageStatus(late, ready.AddHours(4), ready));
    }

    [Fact]
    public void TheCompanionIsInOrderAndWaitsAndTrafficFollowTheCrowd()
    {
        Assert.Equal("terminal", BoardingRules.CurrentCompanion(new HashSet<string>()));
        Assert.Equal("photo", BoardingRules.CurrentCompanion(new HashSet<string> { "terminal", "security" }));
        Assert.Equal("security", BoardingRules.CurrentCompanion(new HashSet<string> { "terminal", "photo" }));
        Assert.Null(BoardingRules.CurrentCompanion(new HashSet<string>(BoardingRules.Companion)));
        Assert.Equal([10, 25, 40], new[] { "quiet", "busy", "busiest" }.Select(BoardingRules.WaitMinutes));
        Assert.Equal(["light", "moderate", "heavy"], new[] { "quiet", "busy", "busiest" }.Select(BoardingRules.TrafficFor));
    }

    [Fact]
    public void ATerminalMoveNamesTheOneItReplaced()
    {
        Assert.Equal(new TerminalInfo("Terminal 2", null), BoardingRules.TerminalFor(null));
        Assert.Equal(new TerminalInfo("Terminal 2", null), BoardingRules.TerminalFor(""));
        Assert.Equal(new TerminalInfo("Terminal 4", "Terminal 2"), BoardingRules.TerminalFor("Terminal 4"));
        Assert.Equal(("green", "blue"), (BoardingRules.LaneFor(true), BoardingRules.LaneFor(false)));
    }

    [Fact]
    public void EmbarkationTimesAreOnTheShipsHomeClock()
    {
        var day = new DateOnly(2027, 3, 21);                                                                // Eastern daylight time, UTC-4
        Assert.Equal(new DateTime(2027, 3, 21, 17, 0, 0, DateTimeKind.Utc), BoardingRules.DepartureAt(day, BoardingRules.Staterooms));
        Assert.Equal(new DateTime(2027, 3, 21, 14, 30, 0, DateTimeKind.Utc), BoardingRules.DepartureAt(day, BoardingRules.PriorityOpens));
    }
}
