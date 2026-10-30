using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The pure Phase 8b rules, mirroring <c>care.test.ts</c> (tickets, queue, waitlist) and <c>ahead.test.ts</c> so the two copies cannot drift.</summary>
public class AheadRulesTests
{
    private const long Min = 60_000;
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static Guid G(int n) => new(n, 0, 0, [0, 0, 0, 0, 0, 0, 0, 0]);

    // ---- Tickets ----

    private static ShowEvent Show(string id = "stage-show", string age = "all", int minutes = 60) =>
        new(id, 2, "Show", "arena", new DateTime(2027, 3, 22, 0, 0, 0, DateTimeKind.Utc).AddMinutes(minutes), age);

    [Fact]
    public void KnowsWhichEventsHaveSeatsAndLeavesTheSameNumberEveryTime()
    {
        Assert.True(ShowRules.IsTicketed("stage-show"));
        Assert.False(ShowRules.IsTicketed("trivia"));
        Assert.Equal(ShowRules.TakenByOthers("wine", 2), ShowRules.TakenByOthers("wine", 2));
        Assert.Equal(900, ShowRules.TakenByOthers("welcome-show", 1) + ShowRules.SeatsLeft("welcome-show", 1, 0));
    }

    [Fact]
    public void SubtractsHeldSeatsAndNeverGoesBelowZero()
    {
        var left = ShowRules.SeatsLeft("spa-tour", 2, 0);
        Assert.Equal(Math.Max(0, left - 2), ShowRules.SeatsLeft("spa-tour", 2, 2));
        Assert.Equal(0, ShowRules.SeatsLeft("spa-tour", 2, 999));
    }

    [Fact]
    public void SomeEventsAreSoldOutAndSomeHaveRoomSoBothStatesCanBeSeen()
    {
        var all = new[] { "welcome-show", "cooking", "dome-show", "wine", "spa-tour", "stage-show" }.SelectMany(id => Enumerable.Range(1, 7).Select(d => ShowRules.SeatsLeft(id, d, 0))).ToList();
        Assert.Contains(all, n => n == 0);
        Assert.Contains(all, n => n > 5);
        Assert.Equal(0, ShowRules.SeatsLeft("wine", 6, 0));
    }

    [Fact]
    public void RefusesASeatForTheRightReason()
    {
        var now = new DateTime(2027, 3, 21, 0, 0, 0, DateTimeKind.Utc);
        var adult = new[] { (G(1), 40) };
        Assert.Null(ShowRules.Problem(Show(), now, adult, []));
        Assert.Equal("notTicketed", ShowRules.Problem(Show("trivia"), now, adult, []));
        Assert.Equal("started", ShowRules.Problem(Show(), Show().StartAt, adult, []));
        Assert.Equal("party", ShowRules.Problem(Show(), now, [], []));
        Assert.Equal("party", ShowRules.Problem(Show(), now, Enumerable.Range(1, 9).Select(i => (G(i), 40)).ToArray(), []));
        Assert.Null(ShowRules.Problem(Show(), now, Enumerable.Range(1, 8).Select(i => (G(i), 40)).ToArray(), []));
        Assert.Equal("age", ShowRules.Problem(Show(age: "adults"), now, [(G(2), 12)], []));
        Assert.Equal("duplicate", ShowRules.Problem(Show(), now, adult, [G(1)]));
        Assert.True(ShowRules.CanReturn(Show(), Show().StartAt.AddMinutes(-1)));
        Assert.False(ShowRules.CanReturn(Show(), Show().StartAt));
    }

    [Fact]
    public void PlacesShowsOnTheShipsClockAndListsPortNightShowsOnlyOnceTheShipIsBack()
    {
        var day2 = ShowRules.On(Departure, 2);
        Assert.Equal(day2.OrderBy(e => e.StartAt).Select(e => e.Id), day2.Select(e => e.Id));
        Assert.Equal(["cooking", "spa-tour", "art-talk", "wine", "stage-early", "stage-show", "dome-show"], day2.Select(e => e.Id));
        Assert.Equal(new DateTime(2027, 3, 23, 0, 30, 0, DateTimeKind.Utc), ShowRules.Find(Departure, "stage-show", 2)!.StartAt);   // 20:30 Eastern (UTC-4)
        // Belize time (UTC-6) on day 4: the 20:30 show is 02:30 UTC the next day.
        Assert.Equal(new DateTime(2027, 3, 25, 2, 30, 0, DateTimeKind.Utc), ShowRules.Find(Departure, "port-show", 4)!.StartAt);
        Assert.Null(ShowRules.Find(Departure, "port-show", 2));
        Assert.Empty(ShowRules.On(Departure, 9));
    }

    // ---- Queue and waitlist ----

    [Fact]
    public void MovesUpAsTimePassesThenHoldsTheTableThenLetsItGo()
    {
        var start = WaitRules.StartingPosition("alfredo", 0);
        Assert.InRange(start, 3, 10);
        Assert.Equal(WaitRules.StartingPosition("alfredo", 29 * Min), start);
        var first = WaitRules.QueueAt(0, 5, 0);
        Assert.Equal(("waiting", 5), (first.Stage, first.Position));
        Assert.Equal(3, WaitRules.QueueAt(0, 5, 12 * Min).Position);
        Assert.Equal("ready", WaitRules.QueueAt(0, 5, 30 * Min).Stage);
        Assert.Equal("expired", WaitRules.QueueAt(0, 5, (30 + WaitRules.HoldMin) * Min).Stage);
        Assert.Equal(1, WaitRules.QueueAt(0, 5, 29 * Min).WaitMinutes);
        Assert.Equal(1, WaitRules.QueueAt(0, 5, 29 * Min).Position);
    }

    [Fact]
    public void OffersAWaitlistedTableWithADeadlineBeforeTheSlot()
    {
        var slot = 600 * Min;
        var waiting = WaitRules.WaitlistAt(0, slot, 0, 2);
        Assert.Equal(("waiting", 2), (waiting.Stage, waiting.Position));
        Assert.Equal(180 * Min, waiting.OfferAt);                                                  // three hours after joining
        Assert.Equal("offered", WaitRules.WaitlistAt(0, slot, 180 * Min, 2).Stage);
        Assert.Equal("expired", WaitRules.WaitlistAt(0, slot, 300 * Min, 2).Stage);                // the offer lasts two hours
        var near = WaitRules.WaitlistAt(0, 100 * Min, 10 * Min, 2);                                // a near slot is offered halfway to it
        Assert.Equal(50 * Min, near.OfferAt);
        Assert.Equal(85 * Min, near.ExpiresAt);                                                    // and never later than 15 minutes before
        Assert.True(WaitRules.CanJoinWaitlist(slot, slot - WaitRules.WaitlistMinLeadMin * Min));
        Assert.False(WaitRules.CanJoinWaitlist(slot, slot - (WaitRules.WaitlistMinLeadMin * Min) + 1));
    }

    [Fact]
    public void WalkInPlacesOpenByTheirOwnHoursOnSeaAndPortDays()
    {
        var alfredo = WaitRules.VenueById("alfredo")!;
        Assert.True(WaitRules.OpenAt(alfredo, true, "11:30"));
        Assert.False(WaitRules.OpenAt(alfredo, true, "11:29"));
        Assert.False(WaitRules.OpenAt(alfredo, false, "15:59"));
        Assert.True(WaitRules.OpenAt(alfredo, false, "16:00"));
        Assert.False(WaitRules.OpenAt(alfredo, true, "22:00"));
        Assert.True(WaitRules.OpenAt(WaitRules.VenueById("intl-cafe")!, false, "03:00"));
        Assert.Null(WaitRules.VenueById("crown"));        // a reservable room has a waitlist, not a queue
        Assert.Null(WaitRules.VenueById("soleil"));
    }

    [Fact]
    public void KnowsWhereTheShipIsAndWhenItIsAboard()
    {
        Assert.False(Itinerary.Aboard(Departure, new DateTime(2027, 3, 21, 14, 59, 0, DateTimeKind.Utc)));      // before 11:00 Eastern
        Assert.True(Itinerary.Aboard(Departure, new DateTime(2027, 3, 21, 15, 0, 0, DateTimeKind.Utc)));
        Assert.False(Itinerary.Aboard(Departure, new DateTime(2027, 3, 28, 10, 0, 0, DateTimeKind.Utc)));       // 06:00 Eastern on the last morning
        Assert.True(Itinerary.AtSea(Departure, new DateTime(2027, 3, 22, 17, 0, 0, DateTimeKind.Utc)));         // a sea day
        Assert.False(Itinerary.AtSea(Departure, new DateTime(2027, 3, 23, 17, 0, 0, DateTimeKind.Utc)));        // in Cozumel (13:00 local)
        Assert.True(Itinerary.AtSea(Departure, new DateTime(2027, 3, 24, 1, 0, 0, DateTimeKind.Utc)));         // late the evening before, still at sea
        Assert.False(Itinerary.AtSea(Departure, new DateTime(2027, 3, 21, 17, 0, 0, DateTimeKind.Utc)));        // day 1 is a Fort Lauderdale day
        Assert.Equal("America/Belize", Itinerary.ShipZoneAt(Departure, new DateTime(2027, 3, 24, 12, 0, 0, DateTimeKind.Utc)));
        Assert.Equal("America/New_York", Itinerary.ShipZoneAt(Departure, new DateTime(2027, 3, 27, 12, 0, 0, DateTimeKind.Utc)));
    }

    // ---- Advisors ----

    [Fact]
    public void ChecksAnAdvisorRequest()
    {
        Assert.Null(AheadRules.AdvisorProblem("adv-ocean", "chat", "", "Which cabin is quietest?"));
        Assert.Equal("badAdvisor", AheadRules.AdvisorProblem("nobody", "chat", "", "Which cabin is quietest?"));
        Assert.Equal("badWay", AheadRules.AdvisorProblem("adv-ocean", "fax", "", "Which cabin is quietest?"));
        Assert.Equal("badPhone", AheadRules.AdvisorProblem("adv-ocean", "callback", "555", "Which cabin is quietest?"));
        Assert.Null(AheadRules.AdvisorProblem("adv-ocean", "callback", "(555) 010-0199", "Which cabin is quietest?"));
        Assert.Equal("noQuestion", AheadRules.AdvisorProblem("adv-ocean", "chat", "", "hi"));
        Assert.Contains("Renata", AheadRules.AdvisorReply("Renata Alvarez", "Short"));
    }

    // ---- Marketing consent ----

    [Fact]
    public void RequiresASecondStepWhereTheRegionAsksForIt()
    {
        foreach (var (region, two) in new[] { ("us", false), ("ca", true), ("uk", true), ("eu", true), ("au", false) }) Assert.Equal(two, AheadRules.DoubleOptIn[region]);
        Assert.False(AheadRules.IsRegion("xx"));
        Assert.Null(AheadRules.ContactProblem("email", "a@b.co"));
        Assert.Equal("badEmail", AheadRules.ContactProblem("email", "not an email"));
        Assert.Equal("badPhone", AheadRules.ContactProblem("sms", "123"));
        Assert.Null(AheadRules.ContactProblem("sms", "555-010-0199"));
    }

    [Fact]
    public void ACodeIsSixDigitsStableForThePersonAndContactAndNotGuessableFromTheContactAlone()
    {
        var code = AheadRules.ConsentCode("key-one-key-one-key-one-key-one-12", 7, "email", "A@b.co");
        Assert.Matches("^[0-9]{6}$", code);
        Assert.Equal(code, AheadRules.ConsentCode("key-one-key-one-key-one-key-one-12", 7, "email", " a@B.co "));
        Assert.NotEqual(code, AheadRules.ConsentCode("key-two-key-two-key-two-key-two-12", 7, "email", "a@b.co"));
        Assert.NotEqual(code, AheadRules.ConsentCode("key-one-key-one-key-one-key-one-12", 8, "email", "a@b.co"));
    }

    [Fact]
    public void ACodeLastsADayAndNoLonger()
    {
        var asked = new DateTime(2027, 3, 1, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal("pending", AheadRules.ConsentState(asked, null, asked.AddHours(24)));
        Assert.Equal("expired", AheadRules.ConsentState(asked, null, asked.AddHours(24).AddSeconds(1)));
        Assert.Equal("confirmed", AheadRules.ConsentState(asked, asked, asked.AddDays(9)));
        Assert.Equal("a***@b.co", AheadRules.MaskEmail("alex@b.co"));
        Assert.Equal("***-0199", AheadRules.MaskPhone("(555) 010-0199"));
    }

    // ---- Upgrades ----

    [Fact]
    public void OffersTheNextTwoRoomTypesWithAFloorAndABuyNowPrice()
    {
        var offers = AheadRules.UpgradeOffers("balcony", c => c == "miniSuite" ? 100_000 : c == "sanctuaryMiniSuite" ? 250_000 : 999);
        Assert.Equal(["miniSuite", "sanctuaryMiniSuite"], offers.Select(o => o.Category));
        Assert.Equal((40_000L, 90_000L), (offers[0].MinBid, offers[0].BuyNow));
        Assert.Empty(AheadRules.UpgradeOffers("signatureSuite", _ => 1_000));
        Assert.Empty(AheadRules.UpgradeOffers("balcony", _ => 0));
    }

    [Fact]
    public void ChecksABidAndDecidesItTheSameWayEveryTime()
    {
        var offer = new UpgradeOffer("miniSuite", 100_000, 40_000, 90_000);
        Assert.Null(AheadRules.BidProblem(offer, 60_000));
        Assert.Equal("badCategory", AheadRules.BidProblem(null, 60_000));
        Assert.Equal("tooLow", AheadRules.BidProblem(offer, 39_900));
        Assert.Equal("tooHigh", AheadRules.BidProblem(offer, 90_100));
        Assert.Equal("notWhole", AheadRules.BidProblem(offer, 60_050));
        Assert.True(AheadRules.BidWins(offer, 90_000, "any"));
        Assert.False(AheadRules.BidWins(offer, 40_000, "k"));
        Assert.Equal(AheadRules.BidWins(offer, 70_000, "k"), AheadRules.BidWins(offer, 70_000, "k"));
    }

    // ---- Clubs ----

    private static ClubForm Form(Action<ClubFormBuilder>? change = null)
    {
        var b = new ClubFormBuilder();
        change?.Invoke(b);
        return new ClubForm(G(1), b.Allergies, "", "", false, b.Pickups, b.SelfSignOut, b.Phone, b.Confirmed);
    }

    private sealed class ClubFormBuilder
    {
        public string Allergies = "";
        public List<Pickup> Pickups = [new("Priya Harper", "Mother", "5550100199")];
        public bool SelfSignOut;
        public string Phone = "5550100199";
        public bool Confirmed = true;
    }

    [Fact]
    public void PutsEachChildInAClubByAgeAndChecksTheRegistration()
    {
        Assert.Equal("firefly", AheadRules.ClubForAge(3)!.Id);
        Assert.Equal("neon", AheadRules.ClubForAge(12)!.Id);
        Assert.Equal("underground", AheadRules.ClubForAge(17)!.Id);
        Assert.Null(AheadRules.ClubForAge(2));
        Assert.Null(AheadRules.ClubForAge(18));
        Assert.Null(AheadRules.ClubProblem(Form(), 8));
        Assert.Equal("noClub", AheadRules.ClubProblem(Form(), 2));
        Assert.Equal("noEmergency", AheadRules.ClubProblem(Form(b => b.Phone = "12"), 8));
        Assert.Equal("noPickup", AheadRules.ClubProblem(Form(b => b.Pickups = []), 8));
        Assert.Equal("badPickup", AheadRules.ClubProblem(Form(b => b.Pickups = [new("A", "Mother", "5550100199")]), 8));
        Assert.Equal("tooMany", AheadRules.ClubProblem(Form(b => b.Pickups = [.. Enumerable.Repeat(new Pickup("Priya Harper", "Mother", "5550100199"), 5)]), 8));
        Assert.Equal("tooLong", AheadRules.ClubProblem(Form(b => b.Allergies = new string('x', 301)), 8));
        Assert.Equal("confirm", AheadRules.ClubProblem(Form(b => b.Confirmed = false), 8));
    }

    [Fact]
    public void OnlyATeenMaySignThemselvesOut()
    {
        Assert.Equal("selfSignOut", AheadRules.ClubProblem(Form(b => b.SelfSignOut = true), 12));
        Assert.Null(AheadRules.ClubProblem(Form(b => b.SelfSignOut = true), 13));
        Assert.Null(AheadRules.ClubProblem(Form(b => { b.SelfSignOut = true; b.Pickups = []; }), 15));       // a teen who signs out alone needs no pick-up person
        Assert.Equal("noPickup", AheadRules.ClubProblem(Form(b => b.Pickups = []), 15));
    }

    // ---- Medallion ----

    private static readonly DateTime DepartureAt = new(2027, 3, 21, 16, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void PostsTheMedallion14DaysOutAndDeliversItEightDaysOut()
    {
        var booked = DepartureAt.AddDays(-60);
        Assert.Equal("preparing", AheadRules.Medallion(DepartureAt, booked, DepartureAt.AddDays(-20), null, null).Stage);
        Assert.Equal("shipped", AheadRules.Medallion(DepartureAt, booked, DepartureAt.AddDays(-14), null, null).Stage);
        var delivered = AheadRules.Medallion(DepartureAt, booked, DepartureAt.AddDays(-8), null, null);
        Assert.Equal("delivered", delivered.Stage);
        Assert.True(delivered.CanActivate);
        Assert.Equal(["ordered", "shipped", "delivered"], delivered.Events.Select(e => e.Id));
        Assert.False(AheadRules.Medallion(DepartureAt, booked, DepartureAt.AddDays(-5), DepartureAt, null).CanActivate);
        var lost = AheadRules.Medallion(DepartureAt, booked, DepartureAt.AddDays(-5), null, DepartureAt);
        Assert.True(lost.Replacement);
        Assert.False(lost.CanActivate);
    }

    [Fact]
    public void ALateBookingCollectsTheMedallionAtTheTerminal()
    {
        var s = AheadRules.Medallion(DepartureAt, DepartureAt.AddDays(-10), DepartureAt.AddDays(-9), null, null);
        Assert.Equal("collect", s.Stage);
        Assert.False(s.CanActivate);
        Assert.Equal(["ordered"], s.Events.Select(e => e.Id));
    }

    // ---- Tags ----

    [Fact]
    public void TracksBagsFromTheMomentTheyAreHandedOver()
    {
        var at = DepartureAt;
        Assert.Equal("atHome", AheadRules.BagStage(null, at));
        Assert.Equal("handedOver", AheadRules.BagStage(at, at.AddMinutes(59)));
        Assert.Equal("onShip", AheadRules.BagStage(at, at.AddHours(1)));
        Assert.Equal("inCorridor", AheadRules.BagStage(at, at.AddHours(3)));
        Assert.Equal("delivered", AheadRules.BagStage(at, at.AddHours(5)));
    }

    [Fact]
    public void AMailedSetNeedsTwoWeeksNotice()
    {
        Assert.Null(AheadRules.TagProblem("order", 14));
        Assert.Equal("tooLate", AheadRules.TagProblem("order", 13));
        Assert.Null(AheadRules.TagProblem("print", 1));
        Assert.Equal("badWay", AheadRules.TagProblem("post", 30));
        Assert.Equal("HARPER/DANIEL", AheadRules.PassName("Daniel", "Harper"));
    }

    // ---- Assistance, fix-it, preparation ----

    [Fact]
    public void ChecksASupportRequestAndMovesItThroughReviewToADecision()
    {
        Assert.Null(AheadRules.AssistProblem("assistedBooking", "555-010-0199", "Please help me book", false));
        Assert.Equal("noBooking", AheadRules.AssistProblem("bereavement", "555-010-0199", "A death in the family", false));
        Assert.Null(AheadRules.AssistProblem("medical", "555-010-0199", "Surgery next week", true));
        Assert.Equal("badKind", AheadRules.AssistProblem("other", "555-010-0199", "Surgery next week", true));
        Assert.Equal("badPhone", AheadRules.AssistProblem("medical", "1", "Surgery next week", true));
        Assert.Equal("noNote", AheadRules.AssistProblem("medical", "555-010-0199", "no", true));
        var asked = DepartureAt;
        Assert.Equal("received", AheadRules.AssistStage(asked, asked.AddHours(3)));
        Assert.Equal("reviewing", AheadRules.AssistStage(asked, asked.AddHours(4)));
        Assert.Equal("decided", AheadRules.AssistStage(asked, asked.AddHours(48)));
    }

    [Fact]
    public void ACompassionateCancellationWaivesTheFeeAndOffersTenPercentMoreAsCredit()
    {
        var t = AheadRules.Compassion(245_300);
        Assert.Equal((0L, 245_300L, 269_800L), (t.Fee, t.Refund, t.Credit));
    }

    [Fact]
    public void FixCasesAreContactedWithinADay()
    {
        Assert.Equal("received", AheadRules.FixStage(DepartureAt, DepartureAt.AddHours(23)));
        Assert.Equal("contacted", AheadRules.FixStage(DepartureAt, DepartureAt.AddHours(24)));
        Assert.Equal("FX-10001", AheadRules.FixReference(1));
        Assert.Equal(11, AheadRules.PrepItems.Length);
    }
}
