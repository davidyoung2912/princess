using Princess.Api.Domain;
using Princess.Api.Services;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>
/// Stanley's travel-day, port and onward-travel intelligence (docs/stanley-gap-analysis-and-plan.md, phase 10). Entry rules never come from a model; every time names its clock; a delay moves the onward check
/// to the new time; a shore plan never passes the back-by time; nothing is machine-translated.
/// </summary>
public class StanleyTravelTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static readonly Timeline T = Timeline.Legacy(Departure);
    private static readonly DateTime Now = new(2027, 3, 28, 5, 0, 0, DateTimeKind.Utc);
    private static readonly TagGroup Group = DisembarkRules.TagGroups[1];

    private static TravelFlightDto Flight(FlightStatusDto? status, string flightAt = "15:00", string mode = "rideshare", string option = "selfAssist") =>
        StanleyTravelRules.Flight(T, new OnwardPlan(mode, flightAt, "AA123", ""), option, Group, status, Now);

    // ---- Flight ----

    [Fact]
    public void ANoPlanAndAnUnknownStatusAreSaidPlainlyAndNothingIsAssumed()
    {
        Assert.Equal("noPlan", StanleyTravelRules.Flight(T, new OnwardPlan("", "", "", ""), "tagged", Group, new FlightStatusDto("onTime", 0, "x"), Now).State);
        var none = Flight(null);
        Assert.Equal("unknown", none.State);
        Assert.Equal("none", none.Confidence);
    }

    [Fact]
    public void ADelayMovesTheCheckToTheNewTimeAndNamesTheClock()
    {
        var late = Flight(new FlightStatusDto("delayed", 75, "x"), "09:00");
        Assert.Equal("10:15", late.NewFlightAt);
        Assert.Equal(75, late.DelayMinutes);
        Assert.Contains("airport time", late.Clock);
        Assert.Contains("10:15", late.Message);
        var onTime = Flight(new FlightStatusDto("onTime", 0, "x"), "09:00");
        Assert.True(late.Spare > onTime.Spare);
    }

    [Fact]
    public void ACancelledFlightIsNeverRebookedAndOffersNoAlternatives()
    {
        var f = Flight(new FlightStatusDto("cancelled", 0, "x"));
        Assert.Equal("cancelled", f.Verdict);
        Assert.Empty(f.Alternatives);
        Assert.Contains("cannot do that", f.Message);
    }

    [Fact]
    public void ATightConnectionOffersOnlyWaysThatReallyWork()
    {
        // 07:30 off the ship, a 45 minute clearance and a 15 minute ride, then three hours: a 11:00 flight is too early.
        var f = Flight(new FlightStatusDto("onTime", 0, "x"), "11:00", "rideshare", "selfAssist");
        Assert.NotEqual("ok", f.Verdict);
        foreach (var a in f.Alternatives)
        {
            Assert.True(a.Spare >= DisembarkRules.TightMinutes);
            var plan = new OnwardPlan(a.Mode, "11:00", "AA123", "");
            Assert.Equal("ok", DisembarkRules.CheckOnward(T, plan, DisembarkRules.OffAt(T, a.OffOption, Group)).Status);
        }
    }

    [Fact]
    public void ATimePastMidnightIsCappedAndSaidSo()
    {
        var f = Flight(new FlightStatusDto("delayed", 160, "x"), "23:00");
        Assert.Equal("23:59", f.NewFlightAt);
        Assert.Contains(f.Notes, n => n.Contains("midnight"));
    }

    // ---- Traffic ----

    [Fact]
    public void TrafficLeavesEarlierOnlyWhenTheRoadsAreSlow()
    {
        var slow = StanleyTravelRules.Traffic(new RouteConditionsDto("heavy", "storm", 45, "x"), Now);
        Assert.Contains("45 minutes earlier", slow.Message);
        var clear = StanleyTravelRules.Traffic(new RouteConditionsDto("light", "clear", 0, "x"), Now);
        Assert.Contains("planned time", clear.Message);
        Assert.Equal(StanleyTravelRules.TrafficProvider, clear.Provider);
    }

    // ---- Port itinerary ----

    private static int Min(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..]);

    [Fact]
    public void AShorePlanStaysInsideTheWindowAndNeverPastBackBy()
    {
        for (var day = 1; day <= T.Days.Count; day++)
            foreach (var mode in StanleyTravelRules.Modes)
                foreach (var minutes in new[] { 60, 240, 720 })
                {
                    var plan = StanleyTravelRules.PortPlan(T, day, [], mode, minutes, false, "any");
                    if (plan is null) { Assert.False(T.IsCall(T.Days[day - 1])); continue; }
                    var back = Min(plan.Return.BackBy);
                    Assert.Equal("port time", plan.Clock);
                    foreach (var s in plan.Stops)
                    {
                        Assert.True(Min(s.Start) >= Min(plan.AshoreFrom));
                        Assert.True(Min(s.End) <= back, $"{s.Title} ends after back-by on day {day}");
                        Assert.True(Min(s.Start) >= Min(s.Opens) && Min(s.End) <= Min(s.Closes));
                    }
                }
    }

    [Fact]
    public void AWalkingOrNearPlanHasNoTaxiAndNoStopWithSteps()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.IsCall(T.Days[d - 1]) && T.Days[d - 1].Port == "cozumel");
        var walk = StanleyTravelRules.PortPlan(T, call, ["beach"], "walk", 480, false, "any")!;
        Assert.DoesNotContain(walk.Stops, s => s.Mode == "taxi");
        var near = StanleyTravelRules.PortPlan(T, call, [], "taxi", 480, true, "any")!;
        Assert.DoesNotContain(near.Stops, s => s.Mode == "taxi");
        var none = StanleyTravelRules.PortPlan(T, 1, [], "walk", 240, false, "any");
        Assert.Null(none);
    }

    [Fact]
    public void TheReturnBriefStatesTheBufferAndAllAboard()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.IsCall(T.Days[d - 1]));
        var plan = StanleyTravelRules.PortPlan(T, call, [], "walk", 240, false, "any")!;
        var d = T.Days[call - 1];
        var (_, back) = ExcursionRules.LandingBuffer(d.Port);
        Assert.Equal(back, plan.Return.BufferMinutes);
        Assert.Equal(d.AllAboard!.Value.ToString("HH:mm"), plan.Return.AllAboard);
        Assert.Contains("port time", plan.Return.Text);
    }

    [Fact]
    public void FoodIsPlannedOnlyFromListedStopsInsideTheirHours()
    {
        foreach (var day in Enumerable.Range(1, T.Days.Count).Where(d => T.IsCall(T.Days[d - 1])))
        {
            var plan = StanleyTravelRules.PortPlan(T, day, ["food"], "taxi", 480, false, "any")!;
            var foods = plan.Stops.Where(s => s.Kind == "food").ToList();
            Assert.NotEmpty(foods);
            Assert.All(foods, f => { Assert.True(Min(f.Start) >= Min(f.Opens) && Min(f.End) <= Min(f.Closes)); Assert.Equal("authored", f.Hours); });
        }
    }

    [Fact]
    public void AuthoredHoursReplaceTheTypicalOnesWhereTheyExist()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.Days[d - 1].Port == "cozumel");
        var plan = StanleyTravelRules.PortPlan(T, call, ["shopping"], "walk", 480, false, "any")!;
        var market = plan.Stops.Single(s => s.Id == "shop-mercado-municipal-stalls");
        Assert.Equal("08:00", market.Opens);
        Assert.Equal("authored", market.Hours);
    }

    // ---- Phrases ----

    [Fact]
    public void EveryPhraseIsReviewedAndAnUnknownRequestIsNotMachineTranslated()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.IsCall(T.Days[d - 1]) && T.Days[d - 1].Port == "cozumel");
        var all = StanleyTravelRules.Phrases(T, call, null)!;
        Assert.NotEmpty(all.Phrases);
        Assert.All(all.Phrases, p => Assert.Equal("reviewed", p.Label));
        var odd = StanleyTravelRules.Phrases(T, call, "my hovercraft is full of eels")!;
        Assert.Empty(odd.Phrases);
        Assert.Equal("Not translated", odd.ShowPerson!.Label);
        Assert.Equal("my hovercraft is full of eels", odd.ShowPerson.Text);
        Assert.Null(StanleyTravelRules.Phrases(T, 2, null));
    }

    [Fact]
    public void AMachineTranslationIsLabelledCarriesAConfidenceAndTheShowPersonCard()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.Days[d - 1].Port == "cozumel");
        var r = StanleyTravelRules.Phrases(T, call, "where is the pier", new SimTranslationProvider().Translate)!;
        var m = Assert.Single(r.Phrases);
        Assert.Equal("machine", m.Label);
        Assert.Equal("medium", m.Confidence);
        Assert.Contains("muelle", m.Say);
        Assert.Equal("Not translated", r.ShowPerson!.Label);
    }

    [Theory]
    [InlineData("I am allergic to nuts")]
    [InlineData("I need a doctor")]
    [InlineData("call the police")]
    [InlineData("where is the hospital")]
    public void SensitiveWordsAreNeverMachineTranslated(string query)
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.Days[d - 1].Port == "cozumel");
        var r = StanleyTravelRules.Phrases(T, call, query, (_, _) => new MachineTranslation("x", "high"))!;
        Assert.DoesNotContain(r.Phrases, p => p.Label == "machine");
        Assert.NotNull(r.ShowPerson);
    }

    [Fact]
    public void ATranslatorThatCannotAnswerLeavesOnlyTheFallback()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.Days[d - 1].Port == "cozumel");
        var r = StanleyTravelRules.Phrases(T, call, "my hovercraft is full of eels", new SimTranslationProvider().Translate)!;
        Assert.Empty(r.Phrases);
        Assert.NotNull(r.ShowPerson);
    }

    // ---- Reading a sign or menu ----

    [Fact]
    public void ADocumentIsRefusedAndNothingOfItIsShown()
    {
        var r = StanleyTravelRules.Reading(new ImageReading("document", [new("PASSPORT 123", "PASSPORT 123", 0.99)]));
        Assert.Equal("refused", r.State);
        Assert.Empty(r.Lines);
    }

    [Fact]
    public void ReadingsShowConfidenceAndAMenuAlwaysCautionsAboutAllergies()
    {
        var menu = StanleyTravelRules.Reading(new ImageReading("menu", [new("Pollo", "Chicken", 0.91), new("Algo", "Something", 0.65), new("???", "?", 0.2)]));
        Assert.Equal("read", menu.State);
        Assert.Equal(["high", "medium", "low"], menu.Lines.Select(l => l.Confidence));
        Assert.Contains(menu.Cautions, c => c.Contains("allergy"));
        Assert.Equal("unclear", StanleyTravelRules.Reading(new ImageReading("sign", [new("x", "y", 0.3)])).State);
        Assert.Equal("unclear", StanleyTravelRules.Reading(new ImageReading("unknown", [])).State);
        Assert.DoesNotContain(StanleyTravelRules.Reading(new ImageReading("sign", [new("Salida", "Exit", 0.9)])).Cautions, c => c.Contains("allergy"));
    }

    [Fact]
    public void TheSimulatedReaderGivesTheSameReadingForTheSamePhoto()
    {
        var reader = new SimImageTextReader();
        var photo = new byte[] { 1, 2, 3, 4 };
        Assert.Equal(reader.Read(photo, "image/png", "Spanish").Kind, reader.Read(photo, "image/png", "Spanish").Kind);
    }

    // ---- Train, ferry or flight connection ----

    [Fact]
    public void AConnectionCountsTheBufferForItsKindAndSaysTooEarlyWhenItCannotBeMade()
    {
        Assert.Equal(180, StanleyTravelRules.ArriveBefore("flight"));
        Assert.Equal(60, StanleyTravelRules.ArriveBefore("ferry"));
        Assert.Equal(45, StanleyTravelRules.ArriveBefore("train"));
        var early = StanleyTravelRules.Connection(T, "train", "07:30", "rideshare", "selfAssist", Group)!;
        Assert.Equal("tooEarly", early.Verdict);
        var late = StanleyTravelRules.Connection(T, "train", "14:00", "rideshare", "selfAssist", Group)!;
        Assert.Equal("ok", late.Verdict);
        Assert.True(late.Spare >= DisembarkRules.TightMinutes);
        Assert.Contains("port time", late.Clock);
        Assert.Contains(late.Notes, n => n.Contains("no live status") || n.Contains("No live status") || n.Contains("Stanley has no live status"));
    }

    [Fact]
    public void ATrainNeedsLessTimeThanAFlightForTheSameDeparture()
    {
        var flight = StanleyTravelRules.Connection(T, "flight", "11:00", "rideshare", "selfAssist", Group)!;
        var train = StanleyTravelRules.Connection(T, "train", "11:00", "rideshare", "selfAssist", Group)!;
        Assert.True(train.Spare > flight.Spare);
        Assert.Equal(flight.Spare + 135, train.Spare);
    }

    [Fact]
    public void ABadConnectionRequestIsRefused()
    {
        Assert.Null(StanleyTravelRules.Connection(T, "rocket", "11:00", "rideshare", "selfAssist", Group));
        Assert.Null(StanleyTravelRules.Connection(T, "train", "25:00", "rideshare", "selfAssist", Group));
        Assert.Null(StanleyTravelRules.Connection(T, "train", "11:00", "unicycle", "selfAssist", Group));
        Assert.Null(StanleyTravelRules.Connection(T, "train", "11:00", "rideshare", "nope", Group));
    }

    // ---- Port pack ----

    [Fact]
    public void ThePortPackNamesTheClockAndItsVersionChangesWithItsContent()
    {
        var call = Enumerable.Range(1, T.Days.Count).First(d => T.IsCall(T.Days[d - 1]) && T.Days[d - 1].Port == "cozumel");
        var a = StanleyTravelRules.PortPack(T, call)!;
        var b = StanleyTravelRules.PortPack(T, call)!;
        Assert.Equal(a.Version, b.Version);
        Assert.Equal("port time", a.Clock);
        Assert.NotNull(a.BackBy);
        Assert.NotEqual(a.Version, StanleyTravelRules.PortPack(T, Enumerable.Range(1, T.Days.Count).First(d => T.IsCall(T.Days[d - 1]) && T.Days[d - 1].Port != "cozumel"))!.Version);
        Assert.Null(StanleyTravelRules.PortPack(T, 2));
    }

    // ---- Packing ----

    [Fact]
    public void PackingExtrasComeFromTheSkyAtEachCallAndSayWhy()
    {
        var rainy = StanleyTravelRules.PackingExtras(T, (_, _) => new SkyDto(11, 90, "14:00", "17:00", "x"), ["Reef snorkel by boat"]);
        Assert.Contains(rainy, i => i.Id == "fcRain");
        Assert.Contains(rainy, i => i.Id == "fcSun");
        Assert.Contains(rainy, i => i.Id == "fcHeat");
        Assert.Contains(rainy, i => i.Id == "fcSwimTour");
        Assert.All(rainy, i => Assert.False(string.IsNullOrWhiteSpace(i.Why)));
        var mild = StanleyTravelRules.PackingExtras(T, (_, _) => new SkyDto(5, 75, null, null, "x"), []);
        Assert.DoesNotContain(mild, i => i.Id is "fcRain" or "fcSun" or "fcHeat");
    }

    // ---- Embark tour ----

    [Fact]
    public void TheEmbarkTourFollowsTheGoalsInAWalkingOrderOfAtMostEightStops()
    {
        var tour = StanleyTravelRules.Embark("sun-princess", ["essentials", "family", "dining", "quiet", "access"], "any")!;
        Assert.InRange(tour.Steps.Count, 1, 8);
        Assert.All(tour.Steps, s => Assert.Contains(s.Goal, tour.Goals));
        Assert.Contains(tour.Notes, n => n.StartsWith("Muster"));
        var step = StanleyTravelRules.Embark("sun-princess", ["access"], "wheelchair")!;
        Assert.All(step.Steps, s => Assert.True(s.StepFree));
        Assert.Equal(["essentials"], StanleyTravelRules.Embark("sun-princess", [], "any")!.Goals);
    }

    // ---- Entry: never a model ----

    [Theory]
    [InlineData("Do I need a visa for Mexico?")]
    [InlineData("what are the customs rules")]
    [InlineData("Is my passport good enough?")]
    [InlineData("what documents do I need to bring")]
    [InlineData("can I bring fruit through customs")]
    [InlineData("immigration at the pier")]
    public void EntryQuestionsAreRecognised(string message) => Assert.True(StanleyTravelRules.IsEntryQuestion(message));

    [Theory]
    [InlineData("What time is dinner?")]
    [InlineData("Where is the pool?")]
    [InlineData("Can I add a tour on Tuesday?")]
    public void OtherQuestionsAreNot(string message) => Assert.False(StanleyTravelRules.IsEntryQuestion(message));

    [Fact]
    public void EntryAnswersAreOfficialSourcesWithAJurisdictionAndNoRuleOfStanleysOwn()
    {
        var entry = StanleyTravelRules.Entry(T);
        Assert.False(entry.ModelAnswers);
        Assert.NotEmpty(entry.Sources);
        Assert.All(entry.Sources, s => Assert.False(string.IsNullOrWhiteSpace(s.Jurisdiction)));
        Assert.All(entry.Sources.SelectMany(s => s.Links), l => Assert.StartsWith("https://", l.Url));
        Assert.NotEmpty(StanleyTravelRules.Entry(Timeline.Legacy(Departure)).Sources.Where(s => s.Jurisdiction == "Mexico").SelectMany(s => s.Links));
        var answer = StanleyTravelRules.EntryAnswer(entry);
        Assert.Contains("can't answer", answer);
        Assert.DoesNotContain("six months", answer);
    }
}
