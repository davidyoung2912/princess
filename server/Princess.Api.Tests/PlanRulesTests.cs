using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure pre-cruise rules, mirroring <c>src/domain/prebook.test.ts</c> so the two copies cannot drift.</summary>
public class PlanRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private const string Sailing = "sun-2027-03-21";
    private static Excursion Tour(string id) => ExcursionRules.ById(id)!;
    private static ItineraryDay Day(int n) => Itinerary.Days(Departure)[n - 1];
    private static Guid G(int n) => new(n, 0, 0, [0, 0, 0, 0, 0, 0, 0, 0]);

    // ---- Itinerary ----

    [Fact]
    public void EveryDayHasADateAndTheShipClockMovesOnTheBelizeDays()
    {
        Assert.Equal(new DateOnly(2027, 3, 28), Itinerary.Days(Departure)[7].Date);
        Assert.Equal("America/New_York", Itinerary.ShipZoneOnDate(Departure, Departure.AddDays(2)));
        Assert.Equal("America/Belize", Itinerary.ShipZoneOnDate(Departure, Departure.AddDays(3)));
        Assert.Equal("America/Belize", Itinerary.ShipZoneOnDate(Departure, Departure.AddDays(5)));
        Assert.Equal("America/New_York", Itinerary.ShipZoneOnDate(Departure, Departure.AddDays(6)));
    }

    // ---- Excursions ----

    [Fact]
    public void EveryTourFitsTheShipsDayAndTheBackByTimeAllowsForTenderLanding()
    {
        foreach (var x in ExcursionRules.Catalogue) Assert.Null(ExcursionRules.TimingProblem(x, ExcursionRules.DayOf(Departure, x)));
        Assert.Equal("15:45", ExcursionRules.BackBy(Tour("coz-snorkel"), Day(3)));
        Assert.Equal("14:30", ExcursionRules.BackBy(Tour("bze-cave"), Day(4)));
    }

    [Fact]
    public void RefusesATourThatStartsBeforeGuestsAreAshoreOrEndsTooLate()
    {
        var early = Tour("bze-altunha") with { Start = "07:30" };
        var late = Tour("coz-beach") with { Start = "11:00" };
        Assert.Equal("tooEarly", ExcursionRules.TimingProblem(early, Day(4)));
        Assert.Equal("tooLate", ExcursionRules.TimingProblem(late, Day(3)));
        Assert.Equal(17 * 60, ExcursionRules.EndMinutes(late));
    }

    [Fact]
    public void ChargesChildrenUnderTwelveLessAndKeepsPlacesLeftSteady()
    {
        var x = Tour("coz-ruins");
        Assert.Equal(6_900, ExcursionRules.GuestPrice(x, 40));
        Assert.Equal(4_800, ExcursionRules.GuestPrice(x, 8));
        Assert.Equal(0, ExcursionRules.SpotsLeft(Tour("rtb-zip"), Sailing));
        Assert.True(ExcursionRules.SpotsLeft(x, Sailing) >= 5);
        Assert.Equal(ExcursionRules.SpotsLeft(x, Sailing), ExcursionRules.SpotsLeft(x, Sailing));
        Assert.Equal(ExcursionRules.SpotsLeft(x, Sailing) - 3, ExcursionRules.SpotsLeft(x, Sailing, 3));
        Assert.Equal(12, ExcursionRules.MinAge(Tour("bze-cave")));
        Assert.Equal(0, ExcursionRules.MinAge(x));
    }

    [Fact]
    public void FindsGuestsWhoWouldBeOnTwoToursAtOnce()
    {
        var snorkel = Tour("coz-snorkel");
        Assert.True(ExcursionRules.Overlaps(snorkel, Tour("coz-ruins")));
        Assert.False(ExcursionRules.Overlaps(snorkel, Tour("coz-glass")));
        Assert.False(ExcursionRules.Overlaps(snorkel, Tour("bze-reef")));
        Assert.Equal([G(2)], ExcursionRules.ConflictingGuests([new("coz-ruins", [G(1), G(2)])], snorkel, [G(2), G(3)]));
        Assert.Empty(ExcursionRules.ConflictingGuests([new("coz-snorkel", [G(1)])], snorkel, [G(1)]));
        Assert.Empty(ExcursionRules.ConflictingGuests([new("coz-glass", [G(1)])], snorkel, [G(1)]));
    }

    [Fact]
    public void RefundsInFullUntilTwoDaysBeforeThePortDay()
    {
        Assert.Equal(new TourRefund(0, 7_900, true), ExcursionRules.Refund(7_900, 10));
        Assert.True(ExcursionRules.Refund(7_900, 2).Free);
        Assert.Equal(new TourRefund(7_900, 0, false), ExcursionRules.Refund(7_900, 1));
        Assert.Equal(2, ExcursionRules.DaysToTour(new DateOnly(2027, 3, 21), Departure, Tour("coz-snorkel")));
    }

    // ---- Entitlements ----

    [Fact]
    public void AddsNumbersAcrossSourcesAndTheBestDiningWindowWins()
    {
        var e = EntitlementRules.Compute("elite", "premier", sanctuary: true);
        Assert.Equal(20, e.DrinkCapUsd);
        Assert.Equal(4 + 2, e.WifiDevices);
        Assert.Equal(3 + 1, e.SpecialtyMeals);
        Assert.Equal(100, e.ExcursionCreditUsd);
        Assert.True(e.GratuitiesIncluded);
        Assert.Equal("atBooking", e.DiningWindow);
        Assert.Contains("suiteLounge", e.Perks);
        Assert.Equal(e.Perks.Length, e.Perks.Distinct().Count());     // priority perks from the tier and the suite appear once

        var gold = EntitlementRules.Compute("gold", "none", false);
        Assert.Equal("afterFullPayment", gold.DiningWindow);
        Assert.Equal(0, gold.WifiDevices);
        Assert.Equal("atBooking", EntitlementRules.Compute("platinum", "none", false).DiningWindow);
    }

    [Fact]
    public void BalancesNeverGoBelowZero()
    {
        var b = EntitlementRules.BalancesOf(EntitlementRules.Compute("none", "plus", false), specialtyMealsUsed: 5);
        Assert.Equal(new Balance(2, 2, 0), b.SpecialtyMeals);
        Assert.Equal(new Balance(1, 0, 1), b.WifiDevices);
    }

    // ---- Dining ----

    [Fact]
    public void OpensDiningAtBookingForPlatinumAndEliteAndAfterFullPaymentForOthers()
    {
        Assert.Equal(new DiningWindowResult(true, null, null), DiningRules.Window("atBooking", "upcoming", "2027-02-19"));
        Assert.Equal(new DiningWindowResult(true, null, null), DiningRules.Window("afterFullPayment", "paid", "2027-02-19"));
        Assert.Equal(new DiningWindowResult(false, "awaitingPayment", "2027-02-19"), DiningRules.Window("afterFullPayment", "dueSoon", "2027-02-19"));
    }

    [Fact]
    public void MakesTheSameGridForTheSameNightWithPeakTimesFillingFirst()
    {
        var a = DiningRules.SlotsFor("crown", Sailing, 3);
        Assert.Equal(a, DiningRules.SlotsFor("crown", Sailing, 3));
        Assert.Equal(DiningRules.DinnerTimes, a.Select(s => s.Time));
        int Full(string time) => DiningRules.DinnerDays.SelectMany(n => new[] { "crown", "sabatini", "catch", "love" }.Select(v => DiningRules.SlotsFor(v, Sailing, n).First(s => s.Time == time))).Count(s => s.Tables == 0);
        Assert.True(Full("19:00") + Full("19:30") > Full("17:30") + Full("18:00"));
        Assert.Contains(a, s => s.Tables > 0);
    }

    [Fact]
    public void TheGridAndPlacesLeftMatchTheScreensNumberForNumber()
    {
        // Worked out by the TypeScript originals (djb2 over the same key text), so both sides show the same sold-out times.
        Assert.Equal([0, 0, 2, 0, 0, 4, 0], DiningRules.SlotsFor("crown", Sailing, 3).Select(s => s.Tables));
        Assert.Equal([4, 2, 1, 3, 2, 3, 2], DiningRules.SlotsFor("love", "sun-2026-11-08", 6).Select(s => s.Tables));
        Assert.Equal([25, 7, 15], new[] { "coz-snorkel", "bze-cave", "rtb-wildlife" }.Select(id => ExcursionRules.SpotsLeft(Tour(id), "sun-2026-12-27")));
    }

    [Fact]
    public void CoversSpecialtyDinnersWhileMealsLastAndChargesTheRest()
    {
        var crown = DiningRules.VenueById("crown")!;
        Assert.Equal(new MealCharge(2, 2, 9_000), DiningRules.ChargeFor(crown, 4, 2));
        Assert.Equal(new MealCharge(0, 2, 9_000), DiningRules.ChargeFor(crown, 2, 0));
        Assert.Equal(0, DiningRules.ChargeFor(DiningRules.VenueById("eclipse")!, 4, 3).Charge);
        Assert.Equal(["alfredo"], DiningRules.Venues.Where(v => v.WalkIn).Select(v => v.Id));
        Assert.Equal("17:00", DiningRules.Seating("early"));
        Assert.Null(DiningRules.Seating("anytime"));
    }

    [Fact]
    public void StopsOnePersonBeingAtTwoTablesWithinASitting()
    {
        ReservedTable[] held = [new("crown", 3, "19:00", [G(1), G(2)])];
        Assert.Equal([G(2)], DiningRules.TableClash(held, 3, "20:00", [G(2), G(3)]));
        Assert.Empty(DiningRules.TableClash(held, 3, "21:00", [G(2)]));
        Assert.Empty(DiningRules.TableClash(held, 4, "19:00", [G(2)]));
        Assert.Empty(DiningRules.TableClash(held, 3, "20:00", [G(2)], ignoreVenue: "crown"));
    }

    [Fact]
    public void ADinnerIsPastOnceItsStartHasGoneByOnTheShipsClock()
    {
        // Night 4 is on Belize time (UTC-6): 18:00 there is midnight UTC.
        var start = new DateTime(2027, 3, 25, 0, 0, 0, DateTimeKind.Utc);
        Assert.False(DiningRules.DinnerPast(Departure, 4, "18:00", start.AddMinutes(-1)));
        Assert.True(DiningRules.DinnerPast(Departure, 4, "18:00", start));
        // Night 1 is on Eastern time (UTC-4 in late March): 18:00 there is 22:00 UTC.
        Assert.True(DiningRules.DinnerPast(Departure, 1, "18:00", new DateTime(2027, 3, 21, 22, 0, 0, DateTimeKind.Utc)));
    }

    // ---- Packages ----

    [Fact]
    public void PricesTheMoveUpNetOfTheGratuitiesAlreadyPaid()
    {
        Assert.Equal((6_000 - 1_650) * 7, PackageRules.UpgradeBase("none", "plus"));
        Assert.Equal(3_000 * 7, PackageRules.UpgradeBase("plus", "premier"));
        Assert.Equal(["plus", "premier"], PackageRules.UpgradesFrom("none").Select(u => u.To));
        Assert.Equal(["premier"], PackageRules.UpgradesFrom("plus").Select(u => u.To));
        Assert.Empty(PackageRules.UpgradesFrom("premier"));
        Assert.Equal("plus", PackageRules.BestPackage("plus", "none"));
        Assert.Equal("premier", PackageRules.BestPackage("plus", "premier"));
    }

    [Fact]
    public void HoldsThePriceUntilTheChangeDateThenMovesIt()
    {
        long Price(string id, int days) => PackageRules.AddOnPrice(PackageRules.AddOn(id)!, days);
        Assert.Equal(5_200, Price("drinks", 20));
        Assert.Equal(5_200, Price("drinks", 15));
        Assert.Equal(5_900, Price("drinks", 14));
        Assert.Equal(14_900, Price("photo", 10));
        Assert.Equal(11_900, Price("photo", 9));                  // a fall, rounded to whole dollars
        Assert.Equal(9_900, Price("laundry", 0));
        var u = PackageRules.UpgradesFrom("none")[0];
        Assert.Equal(u.Base, PackageRules.UpgradePrice(u, 15));
        Assert.True(PackageRules.UpgradePrice(u, 14) > u.Base);
        Assert.Equal(1_500, PackageRules.UnitPrice(1_000, 5, 0.5, 4));
    }

    [Fact]
    public void PriceProtectionSaysLockedAfterARiseAndDroppedAfterAFall()
    {
        Assert.Equal(new PriceStateResult("locked", 700), PackageRules.PriceState(5_200, 5_900));
        Assert.Equal(new PriceStateResult("dropped", 3_000), PackageRules.PriceState(14_900, 11_900));
        Assert.Equal(new PriceStateResult("same", 0), PackageRules.PriceState(100, 100));
    }

    [Fact]
    public void CountsUnitsByPersonNightOrRoomAndLetsPurchasesBeCancelledUntilThreeDaysOut()
    {
        Assert.Equal(14, PackageRules.Units("personNight", 2));
        Assert.Equal(3, PackageRules.Units("person", 3));
        Assert.Equal(1, PackageRules.Units("room", 4));
        Assert.Equal(21, PackageRules.AddOn("drinks")!.MinAge);
        Assert.True(PackageRules.CanCancelPurchase(3));
        Assert.False(PackageRules.CanCancelPurchase(2));
        Assert.Equal("2027-03-07", PackageRules.ChangeOn(Departure, 15, 0.1));      // the day after the last day on the old price
        Assert.Equal("", PackageRules.ChangeOn(Departure, 0, 0));
    }

    // ---- Checklist ----

    private static readonly Dictionary<string, bool> NoAuto = new() { ["paid"] = false, ["documents"] = false, ["tours"] = false, ["dining"] = false, ["assistance"] = false, ["travel"] = false, ["checkin"] = false };

    [Fact]
    public void PutsEveryChecklistItemOnAMilestone()
    {
        var entries = PlanRules.BuildChecklist(Departure, 14, NoAuto, []);
        Assert.Equal([90, 60, 30, 14, 7, 1], PlanRules.Milestones(entries).Select(m => m.DaysBefore));
        Assert.Equal("2026-12-21", PlanRules.Milestones(entries)[0].Due);
    }

    [Fact]
    public void MarksWhatTheAppSeesAsDoneAndWhatIsLateAsOverdue()
    {
        var entries = PlanRules.BuildChecklist(Departure, 14, new Dictionary<string, bool>(NoAuto) { ["paid"] = true, ["travel"] = true }, ["names"]);
        string State(string id) => entries.First(e => e.Id == id).State;
        Assert.Equal("done", State("pay"));
        Assert.True(entries.First(e => e.Id == "pay").Automatic);
        Assert.Equal("done", State("names"));
        Assert.False(entries.First(e => e.Id == "names").Automatic);
        Assert.Equal("overdue", State("documents"));
        Assert.Equal("done", State("travel"));
        Assert.Equal("dueSoon", State("packages"));
        Assert.Equal("upcoming", PlanRules.BuildChecklist(Departure, 60, NoAuto, []).First(e => e.Id == "bags").State);
        Assert.Equal("documents", PlanRules.NextItem(entries)!.Id);               // overdue first
    }

    // ---- Assistance ----

    [Fact]
    public void WorksOutTheLastDayToAskAndHowCloseItIs()
    {
        var wheelchair = PlanRules.AssistKindOf("wheelchair")!;
        Assert.Equal(new Deadline("2027-02-19", 5, "soon"), PlanRules.DeadlineOf(wheelchair, Departure, new DateOnly(2027, 2, 14)));
        Assert.Equal("late", PlanRules.DeadlineOf(wheelchair, Departure, new DateOnly(2027, 2, 20)).State);
        Assert.Equal("open", PlanRules.DeadlineOf(wheelchair, Departure, new DateOnly(2026, 12, 1)).State);
    }

    [Fact]
    public void ARequestMadeAfterItsCutoffIsLateAndOthersConfirmADayLater()
    {
        var tender = PlanRules.AssistKindOf("tender")!;
        var at = new DateTime(2027, 3, 1, 12, 0, 0);
        Assert.Equal("received", PlanRules.RequestStatus(tender, Departure, new DateOnly(2027, 3, 1), at, at.AddHours(23)));
        Assert.Equal("confirmed", PlanRules.RequestStatus(tender, Departure, new DateOnly(2027, 3, 1), at, at.AddHours(24)));
        Assert.Equal("late", PlanRules.RequestStatus(tender, Departure, new DateOnly(2027, 3, 15), at, at.AddHours(48)));
        Assert.Equal(["cpap", "oxygen"], PlanRules.AssistKinds.Where(k => k.Group == "medical" && k.Need is "cpap" or "oxygen").Select(k => k.Id));
    }

    // ---- Travel ----

    [Fact]
    public void OffersTheFirstArrivalWindowOnlyToPriorityGuestsAndKeepsOnlyValidChoices()
    {
        Assert.Equal(6, PlanRules.ArrivalWindows(true).Count);
        Assert.DoesNotContain(PlanRules.ArrivalWindows(false), w => w.Start == "10:30");
        Assert.Equal("10:30", PlanRules.SuggestedWindow(true));
        Assert.Equal("11:00", PlanRules.SuggestedWindow(false));
        Assert.Equal(new TravelPlan(null, "drive", "harbour"), PlanRules.Normalize(new TravelPlan("10:30", "drive", "harbour"), priority: false));
        Assert.Equal(new TravelPlan("10:30", null, null), PlanRules.Normalize(new TravelPlan("10:30", "plane", "ritz"), priority: true));
        Assert.Equal("w-1130", PlanRules.WindowId("11:30"));
        Assert.Equal("11:30", PlanRules.WindowFromId("w-1130"));
    }

    // ---- Packing ----

    [Fact]
    public void BuildsThePackingListFromTheSeasonToursAgesAndNeeds()
    {
        var plain = PlanRules.BuildPackingList(Departure, 7, [], [40], [], tender: false, elegantNights: 0);
        Assert.DoesNotContain(plain, i => i.Id is "elegant" or "waterShoes" or "cpap" or "tenderBag" or "games" or "rain");
        var full = PlanRules.BuildPackingList(Departure, 7, ["coz-snorkel", "bze-cave", "coz-ruins"], [40, 15, 1], ["cpap", "mobility"], tender: true, elegantNights: 2);
        var ids = full.Select(i => i.Id).ToList();
        Assert.All(new[] { "elegant", "waterShoes", "ruinsShoes", "closedShoes", "cpap", "mobility", "tenderBag", "swimDiapers", "games", "teenClothes" }, id => Assert.Contains(id, ids));
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.Contains(PlanRules.BuildPackingList(new DateOnly(2026, 11, 8), 7, [], [40], [], false, 0), i => i.Id == "rain");     // wetter month
        Assert.Equal(2, PlanRules.ElegantNights(7));
        Assert.Equal(0, PlanRules.ElegantNights(3));
    }

    [Fact]
    public void PlansTheDayByDayOverviewWithGapsWhereNothingIsBooked()
    {
        var plan = PlanRules.BuildPlan(Departure, [("t1", "coz-snorkel", [G(1)])], [("d1", "crown", 3, "19:00", [G(1)])]);
        var day3 = plan[2];
        Assert.Equal(["tour", "allAboard", "dinner"], day3.Entries.Select(e => e.Kind));          // by time of day
        Assert.Empty(day3.Gaps);
        Assert.Equal(["tour", "dinner"], plan[3].Gaps);                    // Belize: no tour, no dinner
        Assert.Equal(["dinner"], plan[1].Gaps);                            // at sea: dinner only
        Assert.Empty(plan[7].Gaps);                                        // the last morning
    }
}
