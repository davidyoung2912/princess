using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure on-board rules, mirroring <c>allaboard.test.ts</c>, <c>program.test.ts</c>, <c>chat.test.ts</c>, <c>folio.test.ts</c> and <c>safety.test.ts</c>. A sailing leaves on 21 March 2027 (Eastern daylight time, UTC-4).</summary>
public class OnboardRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);

    // ---- The itinerary helpers ----

    [Theory]
    [InlineData(21, 12, 0, "fll", 1)]
    [InlineData(22, 15, 0, "sea", 2)]
    [InlineData(23, 15, 0, "cozumel", 3)]
    [InlineData(23, 23, 0, "sea", 3)]      // 18:00 in Cozumel, an hour after sailing
    [InlineData(24, 15, 0, "belize", 4)]
    [InlineData(28, 12, 0, "fll", 8)]
    public void ThePortFollowsTheDayAndTheHours(int day, int hour, int minute, string port, int cruiseDay)
    {
        var (p, d) = Itinerary.PortAt(Departure, Utc(day, hour, minute));
        Assert.Equal(port, p);
        Assert.Equal(cruiseDay, d);
    }

    [Fact]
    public void TheShipIsAtSeaWithNoDayLongBeforeAndAfter()
    {
        Assert.Equal(("sea", (int?)null), Itinerary.PortAt(Departure, Utc(10, 12)));
        Assert.Equal(("sea", (int?)null), Itinerary.PortAt(Departure, new DateTime(2027, 4, 10, 12, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void TheClockMovesBackTwoHoursThenForwardTwo()
    {
        var changes = Itinerary.ShipClockChanges(Departure);
        Assert.Equal(Utc(24, 6), changes[0].At);     // 02:00 Eastern on day 4
        Assert.Equal(-2, changes[0].Hours);          // Eastern daylight is UTC-4, Belize UTC-6
        Assert.Equal(Utc(27, 8), changes[1].At);     // 02:00 Belize on day 7
        Assert.Equal(2, changes[1].Hours);
    }

    [Theory]
    [InlineData(20, 12, 0, 0)]
    [InlineData(21, 18, 0, 1)]
    [InlineData(24, 3, 0, 3)]                        // still Eastern: 23:00 on the 23rd
    [InlineData(24, 7, 0, 4)]
    [InlineData(28, 15, 0, 8)]
    [InlineData(29, 12, 0, 9)]
    public void TheCruiseDayIsCountedOnTheShipsCalendar(int day, int hour, int minute, int expected) =>
        Assert.Equal(expected, FolioRules.CruiseDay(Departure, Utc(day, hour, minute)));

    // ---- All aboard ----

    private static readonly DateTime AllAboard = Utc(23, 21, 30);     // 16:30 in Cozumel

    [Theory]
    [InlineData(-180, "plenty", 180, new int[0], 120)]
    [InlineData(-90, "soon", 90, new[] { 120 }, 60)]
    [InlineData(-25, "now", 25, new[] { 120, 60, 30 }, null)]
    [InlineData(10, "late", 0, new int[0], null)]
    [InlineData(30, "gone", 0, new int[0], null)]
    public void TheCountdownMovesThroughItsLevels(int minutesFromAllAboard, string level, int left, int[] reminders, int? next)
    {
        var s = AboardRules.StateOf(AllAboard, AllAboard.AddMinutes(minutesFromAllAboard));
        Assert.Equal(level, s.Level);
        Assert.Equal(left, s.MinutesLeft);
        Assert.Equal(reminders, s.Reminders);
        Assert.Equal(next, s.NextReminder);
    }

    [Fact]
    public void ThePortDayShowsAllAboardInShipTimeAndLocalTime()
    {
        var d = AboardRules.PortDayAt(Departure, Utc(21, 18))!;
        Assert.Equal((3, "cozumel", "2027-03-23"), (d.Day, d.Port, d.Date));
        Assert.Equal("5:30 pm", d.AllAboardShip);      // the ship is still on Eastern time
        Assert.Equal("4:30 pm", d.AllAboardLocal);     // Cozumel is UTC-5
        Assert.False(d.Tender);

        var belize = AboardRules.PortDayAt(Departure, Utc(24, 15))!;
        Assert.Equal((4, "belize", true), (belize.Day, belize.Port, belize.Tender));
        Assert.Equal("4:00 pm", belize.AllAboardShip);
        Assert.Equal("4:00 pm", belize.AllAboardLocal);
    }

    [Fact]
    public void ThePortDayStaysUntilTheShipHasLeftThenMovesOn()
    {
        Assert.Equal(3, AboardRules.PortDayAt(Departure, Utc(23, 21))!.Day);
        Assert.Equal(4, AboardRules.PortDayAt(Departure, Utc(23, 22, 30))!.Day);
        Assert.Equal(5, AboardRules.PortDayAt(Departure, Utc(25, 12))!.Day);
        Assert.Null(AboardRules.PortDayAt(Departure, Utc(26, 12)));
    }

    [Theory]
    [InlineData(9, 14, "9:14 am")]
    [InlineData(0, 5, "12:05 am")]
    [InlineData(12, 0, "12:00 pm")]
    [InlineData(23, 59, "11:59 pm")]
    public void ClockTimesReadLikeTheScreens(int hour, int minute, string expected) =>
        Assert.Equal(expected, AboardRules.ClockTime(new DateTime(2027, 3, 21, hour, minute, 0, DateTimeKind.Utc).AddHours(4), "America/New_York"));

    // ---- Tender ----

    [Fact]
    public void TenderGroupsGoTourPriorityThenFourSpreadGroups()
    {
        Assert.Equal("tour", AboardRules.TenderGroupFor(true, true, true, "x").Id);
        Assert.Equal("priority", AboardRules.TenderGroupFor(false, true, false, "x").Id);
        Assert.Equal("priority", AboardRules.TenderGroupFor(false, false, true, "x").Id);
        var plain = AboardRules.TenderGroupFor(false, false, false, "PC243902|2027-03-24");
        Assert.Contains(plain.Id, new[] { "g1", "g2", "g3", "g4" });
        Assert.Equal(plain, AboardRules.TenderGroupFor(false, false, false, "PC243902|2027-03-24"));
        var seen = Enumerable.Range(0, 40).Select(i => AboardRules.TenderGroupFor(false, false, false, $"seed{i}").Id).Distinct().Count();
        Assert.True(seen >= 3, "the other guests spread over the groups");
    }

    [Fact]
    public void TheTenderWalksFromBeforeToRunning()
    {
        var day = AboardRules.PortDayAt(Departure, Utc(24, 15))!;          // Belize: first call 07:45 local = 13:45 UTC
        var tour = AboardRules.TenderGroups[0];
        var g1 = AboardRules.TenderGroups[2];
        Assert.Equal("before", AboardRules.TenderViewOf(day, tour, Utc(24, 13, 14), 0).Status);
        Assert.Equal("waiting", AboardRules.TenderViewOf(day, tour, Utc(24, 13, 20), 0).Status);
        Assert.Equal("calling", AboardRules.TenderViewOf(day, tour, Utc(24, 13, 45), 0).Status);
        Assert.Equal("running", AboardRules.TenderViewOf(day, tour, Utc(24, 14, 30), 0).Status);
        Assert.Equal(15, AboardRules.TenderViewOf(day, tour, Utc(24, 13, 45), 0).WaitMinutes);
        var late = AboardRules.TenderViewOf(day, g1, Utc(24, 13, 50), 40);
        Assert.Equal("delayed", late.Status);
        Assert.Equal(40, late.DelayMinutes);
        Assert.Equal(TripRules.ToMs(Utc(24, 14, 55)), late.CallAt);         // 13:45 + 40 late + 30 for group 1
        Assert.Equal(TripRules.ToMs(Utc(24, 21, 15)), late.LastTenderAt);   // 45 minutes before all aboard at 22:00 UTC
        Assert.InRange(AboardRules.TenderViewOf(day, tour, Utc(24, 14, 30), 0).WaitMinutes, 10, 20);
    }

    [Fact]
    public void OnlyRoatanMayTenderInsteadAndOnlyInTheWeatherScenario()
    {
        Assert.True(AboardRules.MayTenderInstead("roatan", true));
        Assert.False(AboardRules.MayTenderInstead("roatan", false));
        Assert.False(AboardRules.MayTenderInstead("cozumel", true));
    }

    [Fact]
    public void TheRoughSeaScenarioChangesOnlyTheSeaLine()
    {
        var calm = AboardRules.WeatherOn(new DateOnly(2027, 3, 22), false);
        var rough = AboardRules.WeatherOn(new DateOnly(2027, 3, 22), true);
        Assert.Equal((84, 74, "Mostly sunny"), (calm.HighF, calm.LowF, calm.Summary));
        Assert.Contains("rougher", rough.Sea);
        Assert.DoesNotContain("rougher", calm.Sea);
        Assert.Equal(calm.Summary, rough.Summary);
    }

    // ---- The programme ----

    [Fact]
    public void ADayIsInTimeOrderAndStartsOnTheShipsClock()
    {
        var day = ProgramRules.On(Departure, 2, changes: false);
        Assert.Equal("stretch", day[0].Id);
        Assert.Equal(TripRules.ToMs(Utc(22, 12)), day[0].StartAt);          // 08:00 Eastern
        Assert.Equal(day[0].StartAt + 45 * 60_000, day[0].EndAt);
        Assert.Equal(day.OrderBy(e => e.StartAt).Select(e => e.Id), day.Select(e => e.Id));
        Assert.All(day, e => Assert.Equal("on", e.Status));
        Assert.All(day, e => Assert.Equal("2027-03-22", e.Date));
    }

    [Fact]
    public void TheEveningOnTheBelizeDayRunsOnBelizeTime()
    {
        var show = ProgramRules.On(Departure, 4, false).Single(e => e.Id == "port-show");
        Assert.Equal(TripRules.ToMs(new DateTime(2027, 3, 25, 2, 30, 0, DateTimeKind.Utc)), show.StartAt);   // 20:30 at UTC-6
    }

    [Fact]
    public void PortDayEventsNeverStartBeforeTheShipIsBackAboard()
    {
        foreach (var day in new[] { 3, 4, 5 })
        {
            var back = TripRules.ToMs(Itinerary.AllAboardAt(Departure, day)!.Value);
            Assert.All(ProgramRules.On(Departure, day, false).Where(e => e.AfterAllAboard), e => Assert.True(e.StartAt >= back, $"{e.Id} on day {day}"));
        }
    }

    [Fact]
    public void MidDayChangesMoveAndCancelWhenTheScenarioIsOn()
    {
        var day = ProgramRules.On(Departure, 2, changes: true);
        var show = day.Single(e => e.Id == "stage-show");
        Assert.Equal(("moved", "21:15", "20:30"), (show.Status, show.Start, show.Was));
        Assert.Equal(TripRules.ToMs(Utc(23, 1, 15)), show.StartAt);
        Assert.NotNull(show.Reason);
        Assert.Equal("cancelled", day.Single(e => e.Id == "trivia").Status);
        Assert.All(ProgramRules.On(Departure, 3, changes: true), e => Assert.Equal("on", e.Status));
    }

    [Fact]
    public void ADayOutsideTheCruiseHasNothingOn()
    {
        Assert.Empty(ProgramRules.On(Departure, 0, false));
        Assert.Empty(ProgramRules.On(Departure, 9, false));
        Assert.Equal("muster", ProgramRules.On(Departure, 1, false)[0].Id);
    }

    [Fact]
    public void EveryEventIsOnAtLeastOneDayOfTheCruise()
    {
        Assert.All(ProgramRules.Events, e => Assert.True(e.Days.Length > 0 && e.Days.All(d => d is >= 1 and <= 8), e.Id));
        Assert.Equal(ProgramRules.Events.Count, ProgramRules.Events.Select(e => e.Id).Distinct().Count());
    }

    // ---- Muster and the emergency card ----

    [Theory]
    [InlineData("Station C", "C", "The Piazza, port side")]
    [InlineData(" Station F ", "F", "Soleil Dining Room")]
    public void AStationLabelFindsItsStation(string label, string letter, string name)
    {
        var s = ProgramRules.MusterByLabel(label)!;
        Assert.Equal((letter, name), (s.Letter, s.Name));
    }

    [Theory]
    [InlineData("Station Z")]
    [InlineData("C")]
    [InlineData("")]
    public void ADoubtfulLabelFindsNothing(string label) => Assert.Null(ProgramRules.MusterByLabel(label));

    [Fact]
    public void TheDrillIsAtTwoOnSailingDay() => Assert.Equal(Utc(21, 18), AboardRules.DrillAt(Departure));

    [Fact]
    public void TheEmergencyCardHasTheWordsToSay()
    {
        var card = AboardRules.EmergencyCardOf("Gerald Whitfield", "8123", 8, "Station D");
        Assert.Equal("This is Gerald Whitfield. I need help in stateroom 8123, deck 8.", card.Script);
        Assert.Equal("D", card.MusterPlace!.Letter);
        Assert.Equal(["cabin", "mobile", "medical", "guestServices"], card.Contacts.Select(c => c.Label));
        Assert.Equal("911", card.Contacts[0].Number);
    }

    // ---- Guest Services chat ----

    private static readonly ServiceChannel Concierge = ServiceChatRules.ById("guestServices")!;       // replies in 5 minutes
    private static readonly DateTime Sent = Utc(22, 16);

    [Fact]
    public void AMessageWaitsThenIsAnsweredThenResolved()
    {
        var waiting = ServiceChatRules.StateOf(Concierge, Sent, Sent.AddMinutes(2), false, null);
        Assert.Equal(("waiting", 2, 3, 5, false), (waiting.Status, waiting.WaitedMinutes, waiting.Queue, waiting.ExpectedMinutes, waiting.CanEscalate));
        Assert.Equal("answered", ServiceChatRules.StateOf(Concierge, Sent, Sent.AddMinutes(5), false, null).Status);
        Assert.Equal("answered", ServiceChatRules.StateOf(Concierge, Sent, Sent.AddMinutes(14), false, null).Status);
        Assert.Equal("resolved", ServiceChatRules.StateOf(Concierge, Sent, Sent.AddMinutes(15), false, null).Status);
    }

    [Fact]
    public void ASlowDayMultipliesTheWaitAndOffersACallAtOnce()
    {
        var s = ServiceChatRules.StateOf(Concierge, Sent, Sent, slow: true, null);
        Assert.Equal(("waiting", 25, true), (s.Status, s.ExpectedMinutes, s.CanEscalate));
        Assert.Equal(Sent.AddMinutes(25), ServiceChatRules.ReplyAt(Concierge, Sent, true));
        Assert.Equal(Sent.AddMinutes(5), ServiceChatRules.ReplyAt(Concierge, Sent, false));
    }

    [Fact]
    public void ACallBeatsEveryOtherState()
    {
        var s = ServiceChatRules.StateOf(Concierge, Sent, Sent.AddMinutes(1), false, Sent.AddMinutes(1));
        Assert.Equal(("escalated", false), (s.Status, s.CanEscalate));
    }

    [Fact]
    public void TheFiveChannelsAreKnownAndMedicalCarriesTheUrgentNote()
    {
        Assert.Equal(["guestServices", "housekeeping", "dining", "medical", "excursions"], ServiceChatRules.Channels.Select(c => c.Id));
        Assert.True(ServiceChatRules.ById("medical")!.UrgentNote);
        Assert.Null(ServiceChatRules.ById("spa"));
        Assert.All(ServiceChatRules.Channels, c => Assert.False(string.IsNullOrWhiteSpace(ServiceChatRules.CrewReply(c.Id))));
    }

    [Fact]
    public void AMessageIsTrimmedAndCut()
    {
        Assert.Equal("hello", ServiceChatRules.Clean("  hello \n"));
        Assert.Equal("", ServiceChatRules.Clean("   "));
        Assert.Equal("", ServiceChatRules.Clean(null));
        Assert.Equal(1000, ServiceChatRules.Clean(new string('x', 1200)).Length);
    }

    // ---- The onboard account ----

    private static Entitlements Plain => EntitlementRules.Compute("none", "none", false);
    private static Entitlements Plus => EntitlementRules.Compute("none", "plus", false);

    private static List<FolioLine> Build(IReadOnlyList<FolioGuest> guests, int through = 8, IReadOnlyList<DiningCharge>? dining = null, bool welcome = false) =>
        FolioRules.Build("sun-2027-03-21", Departure, through, guests, dining ?? [], welcome);

    [Fact]
    public void TheSameBookingAlwaysGivesTheSameLines()
    {
        var g = new FolioGuest(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Gerald", 62, Plain, false);
        Assert.Equal(Build([g]).Select(l => (l.Id, l.At, l.Cents)), Build([g]).Select(l => (l.Id, l.At, l.Cents)));
    }

    [Fact]
    public void AChildIsOnlyEverChargedTheDailyGratuity()
    {
        var kid = new FolioGuest(Guid.NewGuid(), "Maya", 7, Plain, false);
        var lines = Build([kid]);
        Assert.Equal(7, lines.Count);
        Assert.All(lines, l => Assert.Equal(("gratuities", (long)Pricing.GratuityPerNight), (l.Category, l.Cents)));
    }

    [Fact]
    public void ASuiteGuestPaysTheHigherGratuityAndAPackageCoversIt()
    {
        var suite = new FolioGuest(Guid.NewGuid(), "Lin", 40, Plain, true);
        Assert.Equal(Pricing.GratuityPerNightSuite, Build([suite]).First(l => l.Category == "gratuities").Cents);
        var covered = Build([new FolioGuest(Guid.NewGuid(), "Lin", 40, Plus, false)]).First(l => l.Category == "gratuities");
        Assert.Equal((0L, (long?)Pricing.GratuityPerNight, "package"), (covered.Cents, covered.Value, covered.CoveredBy));
    }

    [Fact]
    public void NothingIsChargedBeforeTheCruiseStartsAndTheLastDayHasNoGratuity()
    {
        var g = new FolioGuest(Guid.NewGuid(), "Gerald", 62, Plain, false);
        Assert.Empty(Build([g], through: 0));
        Assert.Equal(7, Build([g]).Count(l => l.Category == "gratuities"));
        Assert.Equal(3, Build([g], through: 3).Count(l => l.Category == "gratuities"));
        Assert.All(Build([g]), l => Assert.InRange(l.Day, 1, 7));
    }

    [Fact]
    public void ADrinksCapCoversTheDrinkAndOnlyTheFirstWifiDeviceIsFree()
    {
        var plus = new FolioGuest(Guid.NewGuid(), "Gerald", 62, Plus with { DrinkCapUsd = 15, WifiDevices = 1 }, false);
        var all = Build([plus]);
        var drinks = all.Where(l => l.Category == "drinks").ToList();
        Assert.NotEmpty(drinks);
        Assert.All(drinks, l => Assert.True(l.CoveredBy == "package" && l.Cents <= 400, $"{l.Description}: {l.Cents}"));    // the dearest drink is $19, cap $15
        Assert.True(all.Count(l => l.Category == "internet" && l.CoveredBy == "package") <= 1);
    }

    [Fact]
    public void ADrinkOverTheCapAddsTheBarServiceCharge()
    {
        var capped = new FolioGuest(Guid.NewGuid(), "Gerald", 62, Plain with { DrinkCapUsd = 10 }, false);
        var all = Build([capped]);
        var over = all.Where(l => l.Category == "drinks" && l.Cents > 0).ToList();
        Assert.NotEmpty(over);
        foreach (var d in over)
        {
            var svc = all.Single(l => l.Id == $"{d.Id}-svc");
            Assert.Equal(("tips", Pricing.JsRound(d.Cents * 0.18), d.At + 1), (svc.Category, svc.Cents, svc.At));
        }
    }

    [Fact]
    public void ADinnerIsSplitBetweenThoseWhoPayAndCoveredGuestsHaveAZeroLine()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var c = Guid.NewGuid();
        var lines = Build([], dining: [new DiningCharge("t1", 3, "18:30", "Crown Grill", [a, b, c], 6000, [c])]);
        Assert.Equal([3000L, 3000L, 0L], lines.Where(l => l.Category == "dining").OrderBy(l => l.Cents == 0).ThenBy(l => l.Id).Select(l => l.Cents));
        var cover = lines.Single(l => l.Id == $"t1-{c}-cov");
        Assert.Equal(("package", 0L), (cover.CoveredBy, cover.Cents));
        Assert.Empty(Build([], through: 2, dining: [new DiningCharge("t1", 3, "18:30", "Crown Grill", [a], 6000, [])]));
    }

    [Fact]
    public void AWelcomeGiftIsACreditOnDayOne()
    {
        var g = new FolioGuest(Guid.NewGuid(), "Gerald", 62, Plain, false);
        var credit = Build([g], welcome: true).Single(l => l.Category == "credit");
        Assert.Equal((-5000L, 1), (credit.Cents, credit.Day));
        Assert.DoesNotContain(Build([g], welcome: false), l => l.Category == "credit");
    }

    [Fact]
    public void TotalsAreChargesLessCreditsAndWhatPackagesPaid()
    {
        var g = Guid.NewGuid();
        List<FolioLine> lines =
        [
            new("a", 2, 1, "drinks", "Cocktail", g, 400, 1900, "package"),
            new("b", 2, 2, "shops", "Tee", g, 3200, null, null),
            new("c", 1, 0, "credit", "Welcome", g, -5000, null, null),
            new("d", 2, 3, "dining", "Dinner", g, 0, 4000, "package"),
        ];
        var t = FolioRules.Totals(lines);
        Assert.Equal((3600L, 5000L, 5500L, -1400L), (t.Charges, t.Credits, t.Covered, t.Balance));
        Assert.Equal(["c", "a", "b", "d"], FolioRules.Sorted(lines).Select(l => l.Id));
    }
}
