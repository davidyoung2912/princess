using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure rules of Phase 10b, mirroring <c>orders.test.ts</c>, <c>family.test.ts</c>, <c>health.test.ts</c>, <c>room.test.ts</c>, <c>photos.test.ts</c>, <c>laundry.test.ts</c>, <c>wifi.test.ts</c> and <c>disruption.test.ts</c>. A sailing leaves on 21 March 2027 (Eastern daylight time, UTC-4).</summary>
public class ShipboardRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static DateTime Utc(int day, int hour, int minute = 0) => new(2027, 3, day, hour, minute, 0, DateTimeKind.Utc);
    private static readonly Guid Dan = Guid.NewGuid(), Kid = Guid.NewGuid();
    private const long Min = 60_000;

    private static OrderLineIn Line(string item, int qty = 1, Guid? guest = null, params string[] extras) => new(item, qty, extras, guest ?? Dan, null);

    private static readonly OrderLocation Cabin = new("cabin");
    private static readonly OrderLocation Deck = new("zone", PlaceId: "lido-pool");

    private static List<OrderGuestInfo> Guests(int cap = 0) => [new(Dan, 40, cap), new(Kid, 8, cap)];

    // ---- Orders: the menu and the checks ----

    [Fact]
    public void TheMenusAreSplitByKind()
    {
        Assert.Contains(OrderRules.MenuFor("room"), m => m.Id == "club-sandwich");
        Assert.DoesNotContain(OrderRules.MenuFor("delivery"), m => m.Id == "club-sandwich");
        Assert.All(OrderRules.MenuFor("breakfast"), m => Assert.Equal("breakfast", m.Group));
        Assert.DoesNotContain(OrderRules.MenuFor("room"), m => m.Group == "breakfast");
    }

    [Theory]
    [InlineData("pool", true)]
    [InlineData("lido-pool", false)]
    public void ADeckPlaceMustBeOneTheCrewDeliverTo(string place, bool bad)
    {
        Assert.Equal(bad ? "badLocation" : null, OrderRules.LocationProblem(new OrderLocation("zone", PlaceId: place)));
    }

    [Theory]
    [InlineData("ab", true)]
    [InlineData("by the pool", false)]
    public void WordsForAPlaceNeedThreeCharacters(string text, bool bad)
    {
        Assert.Equal(bad ? "badLocation" : null, OrderRules.LocationProblem(new OrderLocation("other", Text: text)));
        Assert.Equal("badLocation", OrderRules.LocationProblem(new OrderLocation("other", Text: new string('x', 81))));
        Assert.Equal("badLocation", OrderRules.LocationProblem(new OrderLocation("beach")));
        Assert.Equal("badLocation", OrderRules.LocationProblem(null));
    }

    [Fact]
    public void AnOrderIsCheckedLineByLine()
    {
        string? Problem(string kind, OrderLineIn[] lines, long tip = 0, long? at = null, string[]? out_ = null) => OrderRules.OrderProblem(kind, lines, Cabin, tip, at, Guests(), out_ ?? []);

        Assert.Null(Problem("delivery", [Line("cheeseburger")]));
        Assert.Equal("empty", Problem("delivery", []));
        Assert.Equal("tooMany", Problem("delivery", [.. Enumerable.Repeat(Line("fries"), 13)]));
        Assert.Equal("badTip", Problem("delivery", [Line("fries")], tip: 300));
        Assert.Equal("badKind", Problem("curbside", [Line("fries")]));
        Assert.Equal("noTime", Problem("breakfast", [Line("continental")]));
        Assert.Equal("unknownItem", Problem("delivery", [Line("sushi")]));
        Assert.Equal("wrongMenu", Problem("delivery", [Line("club-sandwich")]));
        Assert.Equal("wrongMenu", Problem("room", [Line("margherita")]));
        Assert.Equal("badQuantity", Problem("delivery", [Line("fries", 0)]));
        Assert.Equal("badQuantity", Problem("delivery", [Line("fries", 11)]));
        Assert.Equal("unknownExtra", Problem("delivery", [Line("cheeseburger", 1, null, "caviar")]));
        Assert.Null(Problem("delivery", [Line("cheeseburger", 1, null, "bacon")]));
        Assert.Equal("noGuest", Problem("delivery", [Line("fries", 1, Guid.NewGuid())]));
        Assert.Equal("underage", Problem("delivery", [Line("beer", 1, Kid)]));
        Assert.Null(Problem("delivery", [Line("soda", 1, Kid)]));
        Assert.Equal("unavailable", Problem("delivery", [Line("fish-tacos")], out_: OrderRules.OutAtMenu));
    }

    // ---- Orders: the price ----

    [Fact]
    public void DeliveryToADeckSpotCostsAFeeButTheStateroomDoesNot()
    {
        var p = OrderRules.Price([Line("cheeseburger", 2)], "delivery", Deck, 0, Guests(), false);
        Assert.Equal(1900, p.Lines[0].Gross);
        Assert.Equal(200, p.Fee);
        Assert.Equal(2100, p.Total);
        Assert.Equal(0, OrderRules.Price([Line("cheeseburger", 2)], "delivery", Cabin, 0, Guests(), false).Fee);
        Assert.Equal(0, OrderRules.Price([Line("club-sandwich")], "room", Deck, 0, Guests(), false).Fee);        // room service has no fee
    }

    [Fact]
    public void ExtrasAreAddedAndATipIsCharged()
    {
        var p = OrderRules.Price([Line("cheeseburger", 1, null, "bacon", "gf-bun")], "delivery", Cabin, 500, Guests(), false);
        Assert.Equal(950 + 250 + 150, p.Lines[0].Gross);
        Assert.Equal(1350 + 500, p.Total);
    }

    [Fact]
    public void ADrinksPackagePaysForADrinkUpToItsCapAndTheServiceChargeStillApplies()
    {
        var p = OrderRules.Price([Line("wine"), Line("premium-cocktail")], "delivery", Cabin, 0, Guests(15), false);
        Assert.Equal("package", p.Lines[0].CoveredBy);
        Assert.Equal(0, p.Lines[0].Charge);                          // 11.00 is under the 15.00 cap
        Assert.Equal(700, p.Lines[1].Charge);                        // 22.00 less the cap
        Assert.Equal(594, p.Service);                                // 18% of 1100 + 2200
        Assert.Equal(700 + 594, p.Total);
        Assert.Equal(1100 + 1500, p.Covered);
    }

    [Fact]
    public void AGuestWithNoPackagePaysForDrinksAndAnUnpackagedDrinkIsNeverCovered()
    {
        Assert.Equal(1100, OrderRules.Price([Line("wine")], "delivery", Cabin, 0, Guests(0), false).Lines[0].Charge);
        Assert.Null(OrderRules.Price([Line("water")], "delivery", Cabin, 0, Guests(20), false).Lines[0].CoveredBy);
    }

    [Fact]
    public void WhileIsolatingFoodAndDeliveryAreFreeButAlcoholIsNot()
    {
        var p = OrderRules.Price([Line("cheeseburger"), Line("beer")], "delivery", Deck, 200, Guests(), true);
        Assert.Equal("fare", p.Lines[0].CoveredBy);
        Assert.Equal(0, p.Lines[0].Charge);
        Assert.Equal(800, p.Lines[1].Charge);
        Assert.Equal(0, p.Fee);
        Assert.Equal(800 + 144 + 200, p.Total);
    }

    [Fact]
    public void ASubstituteReplacesTheItemAndDropsItsExtrasAndARemovedLineCostsNothing()
    {
        var lines = new[] { Line("cheeseburger", 1, null, "bacon"), Line("lava-cake") };
        var p = OrderRules.Price(lines, "delivery", Cabin, 200, Guests(), false, new Dictionary<int, string> { [0] = "substitute", [1] = "remove" });
        Assert.Equal("veggie-burger", p.Lines[0].ItemId);
        Assert.Equal("cheeseburger", p.Lines[0].SubstitutedFor);
        Assert.Equal(950, p.Lines[0].Gross);
        Assert.True(p.Lines[1].Removed);
        Assert.Equal(950 + 200, p.Total);
        var gone = OrderRules.Price(lines, "delivery", Deck, 500, Guests(), false, new Dictionary<int, string> { [0] = "remove", [1] = "remove" });
        Assert.Equal(0, gone.Total);                                 // no fee and no tip on an empty order
    }

    // ---- Orders: progress ----

    [Theory]
    [InlineData(0, "received")]
    [InlineData(4, "received")]
    [InlineData(5, "preparing")]
    [InlineData(19, "preparing")]
    [InlineData(20, "onTheWay")]
    [InlineData(29, "onTheWay")]
    [InlineData(30, "delivered")]
    public void ADeliveryOrderMovesThroughItsStages(int minutes, string stage)
    {
        var p = OrderRules.ProgressOf("delivery", 0, null, null, false, null, minutes * Min);
        Assert.Equal(stage, p.Stage);
        Assert.Equal(30 * Min, p.EtaAt);
    }

    [Fact]
    public void RoomServiceTakesFiveMinutesLongerToArrive()
    {
        Assert.Equal("onTheWay", OrderRules.ProgressOf("room", 0, null, null, false, null, 25 * Min).Stage);
        Assert.Equal("onTheWay", OrderRules.ProgressOf("room", 0, null, null, false, null, 34 * Min).Stage);
        Assert.Equal("delivered", OrderRules.ProgressOf("room", 0, null, null, false, null, 35 * Min).Stage);
    }

    [Fact]
    public void TheClockStopsWhenSomethingRunsOutAndRestartsWhenTheGuestChooses()
    {
        Assert.Equal("received", OrderRules.ProgressOf("delivery", 0, null, null, true, null, 4 * Min).Stage);
        var waiting = OrderRules.ProgressOf("delivery", 0, null, null, true, null, 40 * Min);
        Assert.Equal("needsChoice", waiting.Stage);
        Assert.Null(waiting.EtaAt);

        var resumed = OrderRules.ProgressOf("delivery", 0, null, null, false, 15 * Min, 15 * Min);      // chose ten minutes after the kitchen stalled at five
        Assert.Equal("preparing", resumed.Stage);
        Assert.Equal((10 + 30) * Min, resumed.EtaAt);
        Assert.Equal("delivered", OrderRules.ProgressOf("delivery", 0, null, null, false, 15 * Min, 40 * Min).Stage);
    }

    [Fact]
    public void ACancelledOrderStaysCancelled()
    {
        var p = OrderRules.ProgressOf("delivery", 0, null, 3 * Min, false, null, 90 * Min);
        Assert.Equal("cancelled", p.Stage);
        Assert.Null(p.EtaAt);
    }

    [Fact]
    public void BreakfastStartsAnHourAndAHalfBeforeItIsDueAndWaitsTillThen()
    {
        var due = 8 * 60 * Min;
        Assert.Equal("scheduled", OrderRules.ProgressOf("breakfast", 0, due, null, false, null, 60 * Min).Stage);
        Assert.Equal("received", OrderRules.ProgressOf("breakfast", 0, due, null, false, null, due - 35 * Min).Stage);
        Assert.Equal("delivered", OrderRules.ProgressOf("breakfast", 0, due, null, false, null, due).Stage);
        Assert.Equal(due, OrderRules.ProgressOf("breakfast", 0, due, null, false, null, 60 * Min).EtaAt);
    }

    [Theory]
    [InlineData("scheduled", true, true)]
    [InlineData("received", true, true)]
    [InlineData("needsChoice", true, true)]
    [InlineData("preparing", false, true)]
    [InlineData("onTheWay", false, true)]
    [InlineData("delivered", false, false)]
    [InlineData("cancelled", false, false)]
    public void WhatCanStillBeChanged(string stage, bool cancel, bool move)
    {
        Assert.Equal(cancel, OrderRules.CanCancel(stage));
        Assert.Equal(move, OrderRules.CanMove(stage));
    }

    // ---- Orders: breakfast mornings ----

    [Fact]
    public void BreakfastNeedsTwoHoursNoticeAndIsOfferedInShipTime()
    {
        var m = OrderRules.BreakfastMornings(Departure, Utc(21, 12));      // 08:00 Eastern on sailing day: today's 09:30 is under two hours away
        Assert.Equal(["2027-03-22", "2027-03-23", "2027-03-24"], m.Select(x => x.Date));
        Assert.Equal(["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30"], m[0].Slots.Select(s => s.Time));
        Assert.Equal(TripRules.ToMs(Utc(22, 10, 30)), m[0].Slots[0].At);
        Assert.Equal(TripRules.ToMs(Utc(24, 12, 30)), m[2].Slots[0].At);                  // Belize time, UTC-6, from day 4

        var today = OrderRules.BreakfastMornings(Departure, Utc(21, 8), 1)[0];          // 04:00 Eastern: every slot has two hours' notice
        Assert.Equal("2027-03-21", today.Date);
        Assert.Equal(7, today.Slots.Count);
        Assert.Equal(["08:30", "09:00", "09:30"], OrderRules.BreakfastMornings(Departure, Utc(21, 10, 30), 1)[0].Slots.Select(s => s.Time));
    }

    // ---- Orders: the account ----

    [Fact]
    public void AnOrderPutsItsChargesOnTheAccountAndACancelledOneAddsTheRefund()
    {
        var p = OrderRules.Price([Line("cheeseburger", 2), Line("wine")], "delivery", Deck, 200, Guests(15), false);
        var lines = OrderRules.FolioLinesOf(p, 1000, 2, null, Dan);
        Assert.Equal(["dining", "drinks", "tips", "dining", "tips"], lines.Select(l => l.Category));
        Assert.Equal("2 × Cheeseburger (order)", lines[0].Description);
        Assert.Equal(("package", 1100L, 0L), (lines[1].CoveredBy, lines[1].Value, lines[1].Cents));
        Assert.Equal(200, lines.Single(l => l.Description.StartsWith("Delivery")).Cents);

        var cancelled = OrderRules.FolioLinesOf(p, 1000, 2, 5000, Dan);
        var refund = cancelled[^1];
        Assert.Equal(("credit", -p.Total, 5000L), (refund.Category, refund.Cents, refund.At));
        Assert.Equal(lines.Sum(l => l.Cents) - p.Total, cancelled.Sum(l => l.Cents));
    }

    // ---- Family ----

    [Theory]
    [InlineData(2, null)]
    [InlineData(3, "firefly")]
    [InlineData(7, "firefly")]
    [InlineData(8, "neon-grove")]
    [InlineData(12, "neon-grove")]
    [InlineData(13, "underground")]
    [InlineData(17, "underground")]
    [InlineData(18, null)]
    public void EachAgeBelongsToOneClub(int age, string? club) => Assert.Equal(club, FamilyRules.ClubFor(age)?.Id);

    [Fact]
    public void AClubChecksAgeThenWhetherTheChildIsInThenTheHours()
    {
        var neon = FamilyRules.ClubById("neon-grove")!;
        Assert.Null(FamilyRules.CheckInProblem(neon, 8, "12:00", false));
        Assert.Equal("tooYoung", FamilyRules.CheckInProblem(neon, 7, "12:00", false));
        Assert.Equal("tooOld", FamilyRules.CheckInProblem(neon, 13, "12:00", false));
        Assert.Equal("alreadyIn", FamilyRules.CheckInProblem(neon, 9, "12:00", true));
        Assert.Equal("closed", FamilyRules.CheckInProblem(neon, 9, "08:59", false));
        Assert.Equal("closed", FamilyRules.CheckInProblem(neon, 9, "22:00", false));
        Assert.True(FamilyRules.ClubOpen(neon, "21:59"));
        Assert.True(FamilyRules.ClubOpen(FamilyRules.ClubById("underground")!, "23:58"));
    }

    [Fact]
    public void OnlyOlderChildrenMaySignThemselvesOut()
    {
        Assert.Null(FamilyRules.ClubById("firefly")!.AloneFrom);
        Assert.Equal(10, FamilyRules.ClubById("neon-grove")!.AloneFrom);
        Assert.Equal(13, FamilyRules.ClubById("underground")!.AloneFrom);
    }

    [Fact]
    public void TheDefaultPlacesGrowWithTheChild()
    {
        Assert.Equal(["firefly", "lido-pool", "americana", "eatery"], FamilyRules.DefaultZones(5));
        Assert.Contains("neon-grove", FamilyRules.DefaultZones(10));
        Assert.DoesNotContain("underground", FamilyRules.DefaultZones(10));
        Assert.Equal(FamilyRules.KidZones, FamilyRules.DefaultZones(15));
        Assert.Null(FamilyRules.ZonesProblem(["lido-pool"]));
        Assert.Equal("badZones", FamilyRules.ZonesProblem([]));
        Assert.Equal("badZones", FamilyRules.ZonesProblem(["casino"]));
    }

    [Fact]
    public void AChildInAClubIsSeenThereAndAChildWhoseBandIsSilentIsOverdue()
    {
        var now = 100 * 60 * Min;
        var inClub = FamilyRules.LastSeen("kid", 9, now, ("neon-grove", now - 20 * Min), false);
        Assert.Equal(("neon-grove", now - 20 * Min, "club"), (inClub.PlaceId, inClub.At, inClub.Source));
        Assert.Equal("inClub", FamilyRules.KidStatus(inClub, ["lido-pool"], now));

        var missing = FamilyRules.LastSeen("kid", 5, now, null, true);
        Assert.Equal("overdue", FamilyRules.KidStatus(missing, FamilyRules.DefaultZones(5), now));
    }

    [Fact]
    public void ABandSightingIsStableWithinAQuarterHourAndRaisesAnAlertOutsideTheAllowedPlaces()
    {
        var now = 40_000 * 15 * Min + 7 * Min;
        var a = FamilyRules.LastSeen("kid", 9, now, null, false);
        Assert.Equal(a, FamilyRules.LastSeen("kid", 9, now + 3 * Min, null, false) with { At = a.At });
        Assert.Equal("band", a.Source);
        Assert.InRange(a.At, now - 15 * Min, now);
        Assert.Equal("inZone", FamilyRules.KidStatus(a, [a.PlaceId], now));
        Assert.Equal("outOfZone", FamilyRules.KidStatus(a, ["firefly"], now));
    }

    [Fact]
    public void PickUpFallsBackToEveryAdultAndIgnoresPeopleWhoAreNotAdultsOnTheBooking()
    {
        var other = Guid.NewGuid();
        var adults = new List<Guid> { Dan, other };
        Assert.Equal(adults, FamilyRules.NormalizeAuth(null, adults).Pickup);
        Assert.Equal(adults, FamilyRules.NormalizeAuth("{}", adults).Pickup);
        Assert.Equal(adults, FamilyRules.NormalizeAuth("not json", adults).Pickup);

        var json = FamilyRules.AuthJson(new Authorisation([other, Kid], true, true));
        var back = FamilyRules.NormalizeAuth(json, adults);
        Assert.Equal([other], back.Pickup);
        Assert.True(back.SignOutAlone);
        Assert.True(back.Photos);
    }

    [Fact]
    public void TheMeetingPointMustBeTwoDifferentPlacesFromTheList()
    {
        Assert.Null(FamilyRules.MeetingProblem("guest-services", "piazza"));
        Assert.Equal("badMeeting", FamilyRules.MeetingProblem("piazza", "piazza"));
        Assert.Equal("badMeeting", FamilyRules.MeetingProblem("casino", "piazza"));
        Assert.Equal("badMeeting", FamilyRules.MeetingProblem(null, "piazza"));
        Assert.Equal(FamilyRules.DefaultReunion, FamilyRules.NormalizeReunion(null, "nowhere", null));
        Assert.Equal(200, FamilyRules.NormalizeReunion("piazza", "eatery", new string('x', 500)).Note.Length);
    }

    // ---- Health ----

    [Theory]
    [InlineData("sea", "08:00", true)]
    [InlineData("sea", "11:59", true)]
    [InlineData("sea", "12:00", false)]
    [InlineData("sea", "15:00", true)]
    [InlineData("sea", "19:00", false)]
    [InlineData("port", "09:00", true)]
    [InlineData("port", "12:00", false)]
    [InlineData("port", "17:30", true)]
    public void TheMedicalCenterKeepsItsHours(string day, string time, bool open) => Assert.Equal(open, HealthRules.MedicalOpen(day, time));

    [Fact]
    public void TheNextOpeningIsTodaysOrNone()
    {
        Assert.Equal("15:00", HealthRules.NextOpening("sea", "12:30"));
        Assert.Equal("08:00", HealthRules.NextOpening("sea", "07:00"));
        Assert.Equal("17:30", HealthRules.NextOpening("port", "10:00"));
        Assert.Null(HealthRules.NextOpening("port", "19:45"));
    }

    [Fact]
    public void AReportIsCheckedForGuestsSymptomsAndStart()
    {
        Assert.Null(HealthRules.ReportProblem(1, ["vomiting", "fever"], 6));
        Assert.Equal("noGuest", HealthRules.ReportProblem(0, ["fever"], 6));
        Assert.Equal("noSymptoms", HealthRules.ReportProblem(1, [], 6));
        Assert.Equal("badSymptom", HealthRules.ReportProblem(1, ["sneezing"], 6));
        Assert.Equal("badStart", HealthRules.ReportProblem(1, ["fever"], -1));
        Assert.Equal("badStart", HealthRules.ReportProblem(1, ["fever"], 97));
        Assert.Equal("badStart", HealthRules.ReportProblem(1, ["fever"], null));
        Assert.Null(HealthRules.ReportProblem(1, ["cough"], 96));
    }

    [Fact]
    public void AReportMakesTheBookingIsolatingForSeventyTwoHours()
    {
        var at = Utc(22, 12);
        Assert.True(HealthRules.Isolating([at], at.AddHours(1)));
        Assert.True(HealthRules.Isolating([at], at.AddHours(71)));
        Assert.False(HealthRules.Isolating([at], at.AddHours(72)));
        Assert.False(HealthRules.Isolating([at], at.AddHours(-1)));          // a report that has not been made yet
        Assert.False(HealthRules.Isolating([], at));
    }

    // ---- The stateroom ----

    [Theory]
    [InlineData("interior", false, "bed,bath,tv,safe")]
    [InlineData("oceanview", false, "bed,bath,tv,safe,window")]
    [InlineData("balcony", false, "bed,bath,tv,safe,balcony,fridge")]
    [InlineData("balcony", true, "bed,bath,tv,safe,balcony,fridge,accessible")]
    [InlineData("miniSuite", false, "bed,bath,tv,safe,balcony,fridge,sitting")]
    [InlineData("signatureSuite", false, "bed,bath,tv,safe,balcony,fridge,sitting")]
    public void AmenitiesFollowTheRoomType(string category, bool accessible, string list) => Assert.Equal(list.Split(','), RoomRules.AmenitiesFor(category, accessible));

    [Fact]
    public void OnlyAnInteriorHasNoView()
    {
        Assert.False(RoomRules.HasView("interior"));
        Assert.All(new[] { "oceanview", "balcony", "miniSuite", "sanctuaryMiniSuite", "signatureSuite" }, c => Assert.True(RoomRules.HasView(c)));
    }

    [Fact]
    public void AStewardIsStableForACabinAndFromTheCrewList()
    {
        Assert.Equal(RoomRules.StewardFor("8012"), RoomRules.StewardFor("8012"));
        Assert.All(new[] { "8012", "9100", "11204" }, c => Assert.Contains(RoomRules.StewardFor(c), RoomRules.Stewards));
    }

    [Fact]
    public void StoredSettingsReadBackWithDefaultsAndTheTemperatureClamped()
    {
        Assert.Equal(RoomRules.DefaultHousekeeping, RoomRules.NormalizeHousekeeping(null));
        Assert.Equal(RoomRules.DefaultDevices, RoomRules.NormalizeDevices("garbage"));
        Assert.Equal(new Housekeeping("none", "any", true, null), RoomRules.NormalizeHousekeeping("""{"mode":"party","window":"never"}"""));
        Assert.Equal(new Housekeeping("dnd", "morning", false, 5), RoomRules.NormalizeHousekeeping("""{"mode":"dnd","window":"morning","turndown":false,"since":5}"""));
        Assert.Equal(78, RoomRules.NormalizeDevices("""{"tempF":99}""").TempF);
        Assert.Equal(62, RoomRules.NormalizeDevices("""{"tempF":10}""").TempF);
        Assert.Equal("closed", RoomRules.NormalizeDevices("""{"shades":"closed"}""").Shades);
        var d = new Devices("dim", 70, true, "closed");
        Assert.Equal(d, RoomRules.NormalizeDevices(RoomRules.ToJson(d)));
        var h = new Housekeeping("makeUp", "evening", false, 12);
        Assert.Equal(h, RoomRules.NormalizeHousekeeping(RoomRules.ToJson(h)));
    }

    [Fact]
    public void ChangesAreCheckedBeforeTheyAreSaved()
    {
        Assert.Null(RoomRules.HousekeepingProblem(new HousekeepingPatch("dnd", "morning", true)));
        Assert.Equal("badMode", RoomRules.HousekeepingProblem(new HousekeepingPatch("sleep", null, null)));
        Assert.Equal("badWindow", RoomRules.HousekeepingProblem(new HousekeepingPatch(null, "night", null)));
        Assert.Null(RoomRules.DevicesProblem(new DevicesPatch("dim", 70, true, "closed"), true));
        Assert.Equal("badLights", RoomRules.DevicesProblem(new DevicesPatch("disco", null, null, null), true));
        Assert.Equal("badTemp", RoomRules.DevicesProblem(new DevicesPatch(null, 61.9, null, null), true));
        Assert.Equal("badTemp", RoomRules.DevicesProblem(new DevicesPatch(null, 78.1, null, null), true));
        Assert.Equal("noView", RoomRules.DevicesProblem(new DevicesPatch(null, null, null, "closed"), false));
        Assert.Null(RoomRules.DevicesProblem(new DevicesPatch(null, null, null, "open"), false));
        Assert.Equal("noView", RoomRules.DevicesProblem(new DevicesPatch(null, null, null, "half"), true));
    }

    [Fact]
    public void ADayOfDoNotDisturbBringsTheStewardToCheck()
    {
        var hk = new Housekeeping("dnd", "any", true, 1000);
        Assert.False(RoomRules.DndCheckDue(hk, 1000 + 24 * 3_600_000L - 1));
        Assert.True(RoomRules.DndCheckDue(hk, 1000 + 24 * 3_600_000L));
        Assert.False(RoomRules.DndCheckDue(hk with { Mode = "makeUp" }, 1000 + 48 * 3_600_000L));
        Assert.False(RoomRules.DndCheckDue(hk with { Since = null }, 1000 + 48 * 3_600_000L));
    }

    // ---- Photos ----

    [Fact]
    public void PhotosAppearAsTheCruiseGoesOn()
    {
        var party = new List<Guid> { Dan, Kid };
        var week = Timeline.Legacy(new DateOnly(2027, 3, 6));
        Assert.Empty(PhotoRules.PhotosFor(week, party, 0));
        Assert.Equal(["gangway"], PhotoRules.PhotosFor(week, party, 1).Select(p => p.Id));
        Assert.Equal(["gangway", "formal-2"], PhotoRules.PhotosFor(week, party, 2).Select(p => p.Id));
        Assert.Equal(["gangway", "formal-2", "port-3-cozumel", "port-4-belize", "port-5-roatan", "pool-6", "dining-6", "formal-7", "pool-7", "dining-7"], PhotoRules.PhotosFor(week, party, 8).Select(p => p.Id));
        Assert.All(PhotoRules.PhotosFor(week, party, 8), p => Assert.Equal(party, p.People));
    }

    [Fact]
    public void PhotoSpotsFollowTheLengthOfTheSailing()
    {
        Assert.Equal([], PhotoRules.FormalDays(4));
        Assert.Equal([2], PhotoRules.FormalDays(6));
        Assert.Equal([2, 7], PhotoRules.FormalDays(7));
        Assert.Equal(4, PhotoRules.FormalDays(14).Count);
        Assert.Equal(14, PhotoRules.FormalDays(14)[^1]);
        var seven = PhotoRules.SpotsFor(Timeline.Legacy(new DateOnly(2027, 3, 6)));
        Assert.Equal(seven.Select(s => s.Id).Distinct().Count(), seven.Count);
        Assert.Equal("the tender pier", PhotoRules.SpotsFor(Timeline.Legacy(new DateOnly(2027, 3, 6))).First(s => s.Id == "port-4-belize").Title.Split(", ")[1]);
        Assert.Equal(4, PhotoRules.PhotographersFor(Timeline.Legacy(new DateOnly(2027, 3, 6))).Count(s => s.PlaceId == "landing"));
    }

    [Theory]
    [InlineData(2, 0, 2, 0, "each")]
    [InlineData(3, 0, 3, 0, "each")]
    [InlineData(4, 0, 4, 0, "each")]
    [InlineData(5, 0, 5, 0, "five")]
    [InlineData(6, 0, 6, 0, "each")]
    [InlineData(8, 0, 8, 0, "all")]
    [InlineData(2, 12, 0, 2, "each")]
    public void TheCheapestWayDependsOnHowManyAreChosen(int selected, int includedLeft, int paid, int included, string cheapest)
    {
        var q = PhotoRules.Options(selected, includedLeft);
        Assert.Equal((paid, included), (q.Paid, q.Included));
        Assert.Equal(cheapest, PhotoRules.Cheapest(q.Options));
    }

    [Fact]
    public void EachOptionIsPricedForTheChoiceAfterTheIncludedPhotos()
    {
        var q = PhotoRules.Options(7, 0);
        Assert.Equal([7 * 1995L, 2 * 7995L, 14995L], q.Options.Select(o => o.Total));
        var some = PhotoRules.Options(14, 12);
        Assert.Equal((12, 2), (some.Included, some.Paid));
        Assert.Equal([2 * 1995L, 7995L, 14995L], some.Options.Select(o => o.Total));
        Assert.All(PhotoRules.Options(3, 3).Options, o => Assert.Equal(0, o.Total));       // everything included: nothing to pay
    }

    // ---- Laundry ----

    [Fact]
    public void TheFirstWashAndFoldBagIsFreeForAGuestWithThePerk()
    {
        var wash = LaundryRules.ServiceById("washFold")!;
        Assert.Equal(new LaundryPrice(3600, 0), LaundryRules.Price(wash, 2, false));
        Assert.Equal(new LaundryPrice(1800, 1800), LaundryRules.Price(wash, 2, true));
        Assert.Equal(new LaundryPrice(900, 0), LaundryRules.Price(LaundryRules.ServiceById("press")!, 3, true));
    }

    [Fact]
    public void PickUpWindowsNeedAnHoursNoticeAndALaterReturnThanTheLastMorning()
    {
        var press = LaundryRules.ServiceById("press")!;
        var first = LaundryRules.PickupOptions(Departure, Utc(22, 16), press);              // 12:00 Eastern on day 2
        Assert.Equal(("2027-03-22", "13:00"), (first[0].Date, first[0].Time));
        Assert.Equal(TripRules.ToMs(Utc(22, 17)), first[0].At);
        Assert.Equal(6, first.Count);
        Assert.Equal("18:00", LaundryRules.PickupOptions(Departure, Utc(22, 16, 30), press)[0].Time);     // 12:30: 13:00 is under an hour away

        var lastMorning = TripRules.ToMs(Utc(28, 11));                                       // 07:00 Eastern on the last day
        foreach (var s in LaundryRules.Services)
            Assert.All(LaundryRules.PickupOptions(Departure, Utc(21, 12), s, 100), p => Assert.True(p.At + s.Hours * 3_600_000L <= lastMorning));
        Assert.True(LaundryRules.PickupOptions(Departure, Utc(21, 12), LaundryRules.ServiceById("dryClean")!, 100).Count < LaundryRules.PickupOptions(Departure, Utc(21, 12), press, 100).Count);
        Assert.Empty(LaundryRules.PickupOptions(Departure, Utc(27, 23), press));
    }

    [Fact]
    public void ARequestIsCollectedThenCleanedThenReturnedAndCanOnlyBeCancelledBeforeCollection()
    {
        var pickup = TripRules.ToMs(Utc(22, 17));
        Assert.Equal(("requested", pickup + 24 * 3_600_000L), LaundryRules.Stage(pickup, 24, false, pickup - 1));
        Assert.Equal("cleaning", LaundryRules.Stage(pickup, 24, false, pickup).Stage);
        Assert.Equal("returned", LaundryRules.Stage(pickup, 24, false, pickup + 24 * 3_600_000L).Stage);
        Assert.Equal("cancelled", LaundryRules.Stage(pickup, 24, true, pickup - 1).Stage);
        Assert.True(LaundryRules.Cancellable("requested"));
        Assert.All(new[] { "cleaning", "returned", "cancelled" }, s => Assert.False(LaundryRules.Cancellable(s)));
    }

    // ---- Wi-Fi ----

    [Fact]
    public void ADeviceIsCheckedForNameDuplicatePlanDaysAndCount()
    {
        Assert.Null(WifiRules.AddProblem("Laptop", "surf", 3, []));
        Assert.Equal("badName", WifiRules.AddProblem("L", "surf", 3, []));
        Assert.Equal("badName", WifiRules.AddProblem(new string('x', 31), "surf", 3, []));
        Assert.Equal("badName", WifiRules.AddProblem(null, "surf", 3, []));
        Assert.Equal("duplicate", WifiRules.AddProblem(" LAPTOP ", "surf", 3, ["laptop"]));
        Assert.Equal("tooMany", WifiRules.AddProblem("Seventh", "surf", 3, [.. Enumerable.Range(1, 6).Select(i => $"device {i}")]));
        Assert.Equal("badPlan", WifiRules.AddProblem("Laptop", "turbo", 3, []));
        Assert.Equal("badDays", WifiRules.AddProblem("Laptop", "surf", 0, []));
        Assert.Equal("badDays", WifiRules.AddProblem("Laptop", "surf", 9, []));
        Assert.Equal("badDays", WifiRules.AddProblem("Laptop", "surf", null, []));
    }

    [Fact]
    public void AnUpgradeCostsTheDifferenceForTheDaysLeftRoundedUp()
    {
        const long day = 86_400_000;
        var surf = WifiRules.PlanById("surf")!;
        var stream = WifiRules.PlanById("stream")!;
        Assert.Equal(1000 * 2, WifiRules.UpgradeCost("messaging", 2 * day, surf, 0));
        Assert.Equal(1000 * 2, WifiRules.UpgradeCost("messaging", 2 * day, surf, 1));                 // 1.99 days is two
        Assert.Equal(1000, WifiRules.UpgradeCost("messaging", day / 2, surf, 0));                      // at least one day
        Assert.Equal(1000 * 3, WifiRules.UpgradeCost("surf", 3 * day, stream, 0));
        Assert.Equal(0, WifiRules.UpgradeCost("stream", day, surf, 0));
        Assert.Equal(3, WifiRules.PlanById("stream")!.Rank);
        Assert.Null(stream.CapMb);
    }

    [Fact]
    public void TheUsageMeterIsSteadyForADeviceAndNeverNegative()
    {
        var added = 10 * 86_400_000L;
        var a = WifiRules.UsedTodayMb("dev", added, added + 3_600_000);
        Assert.Equal(a, WifiRules.UsedTodayMb("dev", added, added + 3_600_000));
        Assert.True(a > 0);
        Assert.True(WifiRules.UsedTodayMb("dev", added, added + 7_200_000) > a);
        Assert.Equal(0, WifiRules.UsedTodayMb("dev", added, added));
        Assert.Equal(added + 8 * 86_400_000L, WifiRules.ExpiresAt(added, 8));
    }

    // ---- Updates ----

    [Fact]
    public void ChangesInForceAreListedMostSeriousFirst()
    {
        Assert.Equal(["portSkipped", "belizeTender", "planChange"], DisruptionRules.Active(new HashSet<string> { "planChange", "portSkipped", "belizeTender", "chatSlow" }).Select(d => d.Id));
        Assert.Empty(DisruptionRules.Active(new HashSet<string>()));
    }

    [Fact]
    public void AnAcknowledgementMustBeOneOfTheOptionsOnOffer()
    {
        Assert.True(DisruptionRules.ValidOption(DisruptionRules.ById("portSkipped")!, "credit"));
        Assert.False(DisruptionRules.ValidOption(DisruptionRules.ById("portSkipped")!, "ok"));
        Assert.True(DisruptionRules.ValidOption(DisruptionRules.ById("planChange")!, "ok"));
        Assert.False(DisruptionRules.ValidOption(DisruptionRules.ById("planChange")!, null));
        Assert.Null(DisruptionRules.ById("chatSlow"));
    }

    // ---- Text help (N5.6) ----

    [Theory]
    [InlineData("seasick", "", null)]
    [InlineData("textHelp", "I cannot hear. Someone is ill in cabin 8123.", null)]
    [InlineData("textHelp", "", "badNote")]
    [InlineData("textHelp", "   ", "badNote")]
    [InlineData("textHelp", null, "badNote")]
    [InlineData("spa", "", "badKind")]
    [InlineData(null, "x", "badKind")]
    public void ATextHelpMessageNeedsWordsAndOtherKindsStayAsTheyWere(string? kind, string? note, string? expected) =>
        Assert.Equal(expected, HealthRules.RequestProblem(kind, note));

    [Fact]
    public void ATextHelpMessageHasTheSameLengthLimitAsANote()
    {
        Assert.Null(HealthRules.RequestProblem("textHelp", new string('a', HealthRules.NoteMax)));
        Assert.Equal("badNote", HealthRules.RequestProblem("textHelp", new string('a', HealthRules.NoteMax + 1)));
    }
}
