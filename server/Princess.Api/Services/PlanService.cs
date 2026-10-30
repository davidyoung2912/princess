using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The pre-cruise plan: excursions, dining, packages and add-ons, checklist, packing, travel to the port and special assistance. Ports <c>src/api/planMock.ts</c>.
/// Reads are open to anyone on the booking; writes need an adult guest on it (data model section 7). Entitlements, price protection, places left and table
/// capacity are worked out here (D15), so two bookings on the same sailing really do compete for the same spots and tables.
/// </summary>
public sealed class PlanService(AccessService access, ITripStore trips, IAccountStore accounts, IPlanStore plan, TripService tripService, IUserClock clock, IPaymentGateway gateway)
{
    private static DateOnly D(DateTime d) => DateOnly.FromDateTime(d);
    private static string Str(string? v, int max) => v is null ? "" : v.Trim() is var t && t.Length > max ? t[..max] : v.Trim();

    private sealed record Person(Guid Id, long UserId, string Name, int Age, bool Child, string Tier);

    private sealed class Ctx
    {
        public UserRecord Actor = null!;
        public BookingRow Booking = null!;
        public DateTime Now;
        public DateOnly Today;
        public DateOnly Departure;
        public int Days;
        public List<Person> Party = [];
        public bool Sanctuary;

        public Person? PersonByUser(long userId) => Party.FirstOrDefault(p => p.UserId == userId);
        public Person? PersonById(Guid id) => Party.FirstOrDefault(p => p.Id == id);
        public PartyMemberDto[] Members => [.. Party.Select(p => new PartyMemberDto(p.Id, p.Name, p.Age, p.Child))];
        public List<Guid> Ids(IEnumerable<long> userIds) => [.. userIds.Select(PersonByUser).OfType<Person>().Select(p => p.Id)];
    }

    private async Task<Ctx> LoadAsync(UserRecord actor, string? number, bool write, CancellationToken ct)
    {
        var m = write ? await access.RequireAdultMemberAsync(actor, number, ct) : await access.RequireMemberAsync(actor, number, ct);
        var booking = await trips.GetAsync(m.BookingId, ct) ?? throw ApiException.NotFound();
        var now = await clock.NowAsync(actor, ct);
        var departure = D(booking.Departure);
        var today = TripRules.Today(now);
        var party = (await accounts.GetPartyAsync(m.BookingId, ct))
            .Select(g => new Person(g.PublicId, g.UserId, AccountService.FullName(g), AccountRules.AgeOn(D(g.Dob), departure), g.IsSupervised, g.Tier)).ToList();
        return new Ctx
        {
            Actor = actor, Booking = booking, Now = now, Today = today, Departure = departure, Days = TripRules.DaysBetween(today, departure), Party = party,
            Sanctuary = Pricing.FareIncluded(booking.CategoryId) is not null,
        };
    }

    /// <summary>Booking, adding and paying close on sailing day (less than one day to go), and are never open on a cancelled booking.</summary>
    private static void RequireOpen(Ctx c)
    {
        if (c.Days < 1 || c.Booking.Status != "confirmed") throw ApiException.Conflict("closed");
    }

    /// <summary>Dining stays open on board, until the last night has passed.</summary>
    private static void RequireDiningOpen(Ctx c)
    {
        if (c.Today > c.Departure.AddDays(Pricing.Nights) || c.Booking.Status != "confirmed") throw ApiException.Conflict("closed");
    }

    private static List<Person> GuestsIn(Ctx c, IReadOnlyCollection<Guid>? raw)
    {
        var ids = (raw ?? []).Distinct().ToList();
        var people = ids.Select(c.PersonById).ToList();
        if (people.Count == 0 || people.Any(p => p is null)) throw ApiException.Invalid("guests");
        return people!;
    }

    // ---- Purchases and entitlements ----

    private sealed record PurchaseCalc(PurchaseRow Row, PurchaseViewDto View, string? From);

    private static (string? From, string To) ItemOf(PurchaseRow r) =>
        r.Kind == "upgrade" ? (r.ItemId.Contains('>') ? (r.ItemId[..r.ItemId.IndexOf('>')], r.ItemId[(r.ItemId.IndexOf('>') + 1)..]) : ("none", r.ItemId)) : (null, r.ItemId);

    private static List<PurchaseCalc> BuildPurchases(Ctx c, IEnumerable<PurchaseRow> rows) =>
        rows.Select(r =>
        {
            var (from, to) = ItemOf(r);
            var nowUnit = r.Kind == "addOn"
                ? PackageRules.AddOnPrice(PackageRules.AddOn(r.ItemId)!, c.Days)
                : PackageRules.UpgradePrice(new PackageUpgrade(from!, to, PackageRules.UpgradeBase(from!, to), PackageRules.UpgradeRiseDays, PackageRules.UpgradeRiseShare), c.Days);
            var p = PackageRules.PriceState(r.UnitCents, nowUnit);
            var view = new PurchaseViewDto(
                r.PublicId, r.Kind, to, c.Ids(r.GuestIds), r.UnitCents, r.Units, r.UnitCents * r.Units, TripRules.ToMs(r.At), r.Methods, r.Status,
                new PurchasePriceDto(p.State, p.PerUnit, p.PerUnit * r.Units), r.CreditedCents, r.Status == "active" && PackageRules.CanCancelPurchase(c.Days));
            return new PurchaseCalc(r, view, from);
        }).ToList();

    private static string Effective(Ctx c, Person p, IEnumerable<PurchaseCalc> ps)
    {
        var basePackage = c.Booking.FareId is "plus" or "premier" ? c.Booking.FareId : "none";
        return ps.Where(x => x.Row.Kind == "upgrade" && x.Row.Status == "active" && x.Row.GuestIds.Contains(p.UserId)).Aggregate(basePackage, (best, x) => PackageRules.BestPackage(best, x.View.Item));
    }

    private Entitlements EntitlementsFor(Ctx c, Person p, IReadOnlyList<PurchaseCalc> ps)
    {
        var e = EntitlementRules.Compute(p.Tier, Effective(c, p, ps), c.Sanctuary);
        foreach (var x in ps.Where(x => x.Row.Kind == "addOn" && x.Row.Status == "active" && x.Row.GuestIds.Contains(p.UserId)))
            e = x.Row.ItemId switch
            {
                "drinks" => e with { DrinkCapUsd = Math.Max(e.DrinkCapUsd, 15) },
                "wifi" => e with { WifiDevices = e.WifiDevices + 1 },
                "specialtyPass" => e with { SpecialtyMeals = e.SpecialtyMeals + 3 },
                "laundry" when !e.Perks.Contains("freeLaundry") => e with { Perks = [.. e.Perks, "freeLaundry"] },
                _ => e,
            };
        return e;
    }

    private static int MealsUsed(IEnumerable<TableRow> tables, Person p) => tables.Count(t => t.CoveredIds.Contains(p.UserId));

    private (long Total, long Used, long Remaining) CreditOf(Ctx c, IReadOnlyList<PurchaseCalc> ps, IEnumerable<TourRow> tours)
    {
        var total = c.Party.Sum(g => EntitlementsFor(c, g, ps).ExcursionCreditUsd * 100L);
        var used = tours.Sum(t => t.CreditCents);
        return (total, used, Math.Max(0, total - used));
    }

    // ---- Overview ----

    public async Task<PlanOverviewDto> OverviewAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, false, ct);
        var tours = (await plan.ListToursAsync(c.Booking.BookingId, ct)).Where(t => t.Status == "booked").Select(t => (t.PublicId.ToString(), t.ExcursionId, c.Ids(t.GuestIds)));
        var tables = (await plan.ListTablesAsync(c.Booking.BookingId, ct)).Select(t => (t.PublicId.ToString(), t.VenueId, t.Day, t.Time, c.Ids(t.GuestIds)));
        return new PlanOverviewDto(PlanRules.BuildPlan(c.Departure, tours, tables), c.Days, PlanRules.Iso(c.Departure));
    }

    // ---- Excursions ----

    private static long PriceFor(Ctx c, Excursion x, IEnumerable<Person> guests) => guests.Sum(g => ExcursionRules.GuestPrice(x, g.Age));

    private async Task<List<(string ExcursionId, List<Person> Guests)>> CartAsync(Ctx c, CancellationToken ct)
    {
        var lines = new List<(string, List<Person>)>();
        foreach (var l in await plan.GetCartAsync(c.Booking.BookingId, ct))
        {
            var guests = l.GuestIds.Select(c.PersonByUser).OfType<Person>().ToList();
            if (ExcursionRules.ById(l.ExcursionId) is not null && guests.Count > 0 && guests.Count == l.GuestIds.Count) lines.Add((l.ExcursionId, guests));
        }
        return lines;
    }

    private async Task<ExcursionsViewDto> ExcursionsViewAsync(Ctx c, CancellationToken ct)
    {
        var tours = await plan.ListToursAsync(c.Booking.BookingId, ct);
        var ps = BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct));
        var cart = await CartAsync(c, ct);
        var credit = CreditOf(c, ps, tours);
        var cartLines = cart.Select(l => new CartLineDto(l.ExcursionId, [.. l.Guests.Select(g => g.Id)], PriceFor(c, ExcursionRules.ById(l.ExcursionId)!, l.Guests))).ToList();
        var cartTotal = cartLines.Sum(l => l.Total);

        var booked = tours.Select(t =>
        {
            var x = ExcursionRules.ById(t.ExcursionId)!;
            var cancel = t.Status == "booked"
                ? ExcursionRules.Refund(t.TotalCents, ExcursionRules.DaysToTour(c.Today, c.Departure, x))
                : new TourRefund(t.FeeCents ?? 0, t.RefundCents ?? 0, (t.FeeCents ?? 0) == 0);
            return new TourBookingDto(t.PublicId, x.Id, c.Ids(t.GuestIds), t.TotalCents, t.CreditCents, t.Methods, TripRules.ToMs(t.At), t.Status, cancel);
        }).OrderBy(t => t.At).ToList();

        var offers = new List<ExcursionOfferDto>();
        foreach (var x in ExcursionRules.Catalogue)
        {
            var day = ExcursionRules.DayOf(c.Departure, x);
            var here = await plan.CountTourGuestsAsync(c.Booking.SailingId, x.Id, null, ct);
            offers.Add(new ExcursionOfferDto(x, PlanRules.Iso(day.Date), day.Day, ExcursionRules.SpotsLeft(x, c.Booking.SailingId, here), ExcursionRules.TimingProblem(x, day),
                ExcursionRules.BackBy(x, day), ExcursionRules.DaysToTour(c.Today, c.Departure, x), ExcursionRules.NeedsTender(x)));
        }
        return new ExcursionsViewDto(offers, booked, cartLines, cartTotal, credit.Remaining, Math.Min(credit.Remaining, cartTotal), [.. c.Members], !c.Actor.IsSupervised && c.Days >= 1 && c.Booking.Status == "confirmed", c.Days);
    }

    public async Task<ExcursionsViewDto> ExcursionsAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ExcursionsViewAsync(await LoadAsync(actor, number, false, ct), ct);

    /// <summary>Checks one tour for a set of guests against what is booked or in the cart. Throws a conflict that names the problem.</summary>
    private async Task CheckTourAsync(Ctx c, Excursion x, List<Person> guests, IEnumerable<BookedTour> others, long? ignoreTourId, CancellationToken ct)
    {
        var day = ExcursionRules.DayOf(c.Departure, x);
        if (ExcursionRules.DaysToTour(c.Today, c.Departure, x) < 0 || c.Days < 1) throw ApiException.Conflict("closed");
        if (guests.Any(g => g.Age < ExcursionRules.MinAge(x)) || !guests.Any(g => g.Age >= ExcursionRules.AdultAge)) throw ApiException.Conflict("age");
        if (ExcursionRules.TimingProblem(x, day) is not null) throw ApiException.Conflict("timing");
        var here = await plan.CountTourGuestsAsync(c.Booking.SailingId, x.Id, ignoreTourId, ct);
        if (ExcursionRules.SpotsLeft(x, c.Booking.SailingId, here) < guests.Count) throw ApiException.Conflict("soldOut");
        var ids = guests.Select(g => g.Id).ToList();
        var others2 = others.ToList();
        if (others2.Any(o => o.ExcursionId == x.Id && o.Guests.Any(ids.Contains))) throw ApiException.Conflict("duplicate");
        if (ExcursionRules.ConflictingGuests(others2, x, ids).Count > 0) throw ApiException.Conflict("overlap");
    }

    private static IEnumerable<BookedTour> BookedOf(Ctx c, IEnumerable<TourRow> tours, long? ignore = null) =>
        tours.Where(t => t.Status == "booked" && t.Id != ignore).Select(t => new BookedTour(t.ExcursionId, c.Ids(t.GuestIds)));

    public async Task<ExcursionsViewDto> AddToCartAsync(UserRecord actor, string? number, string? excursionId, CartRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var x = ExcursionRules.ById(excursionId) ?? throw ApiException.Invalid("tour");
        var who = GuestsIn(c, body?.Guests);
        var lines = await CartAsync(c, ct);
        var others = BookedOf(c, await plan.ListToursAsync(c.Booking.BookingId, ct)).Concat(lines.Where(l => l.ExcursionId != x.Id).Select(l => new BookedTour(l.ExcursionId, [.. l.Guests.Select(g => g.Id)])));
        await CheckTourAsync(c, x, who, others, null, ct);
        await plan.SetCartLineAsync(c.Booking.BookingId, x.Id, [.. who.Select(g => g.UserId)], ct);
        return await ExcursionsViewAsync(c, ct);
    }

    public async Task<ExcursionsViewDto> RemoveFromCartAsync(UserRecord actor, string? number, string? excursionId, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        await plan.RemoveCartLineAsync(c.Booking.BookingId, excursionId ?? "", ct);
        return await ExcursionsViewAsync(c, ct);
    }

    /// <summary>Books everything in the cart. The excursion credit is used first, the rest is paid by card or wallet.</summary>
    public async Task<ExcursionsViewDto> CheckoutAsync(UserRecord actor, string? number, CheckoutRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var lines = await CartAsync(c, ct);
        if (lines.Count == 0) throw ApiException.Invalid("emptyCart");
        var tours = await plan.ListToursAsync(c.Booking.BookingId, ct);
        var added = new List<BookedTour>();
        foreach (var l in lines)
        {
            await CheckTourAsync(c, ExcursionRules.ById(l.ExcursionId)!, l.Guests, BookedOf(c, tours).Concat(added), null, ct);
            added.Add(new BookedTour(l.ExcursionId, [.. l.Guests.Select(g => g.Id)]));
        }
        var priced = lines.Select(l => (l.ExcursionId, l.Guests, Total: PriceFor(c, ExcursionRules.ById(l.ExcursionId)!, l.Guests))).ToList();
        var total = priced.Sum(l => l.Total);
        var credit = CreditOf(c, BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct)), tours);
        var applied = Math.Min(credit.Remaining, total);
        var due = total - applied;

        NewBookingPayment? payment = null;
        if (due > 0)
        {
            var parts = await PaymentPlumbing.ResolvePartsAsync(trips, actor, body?.Parts, due, c.Today, ct);
            var reference = $"TOUR-{c.Booking.Number}-{c.Now:yyMMddHHmmss}";
            payment = PaymentPlumbing.PaymentOf(actor, "tour", reference, c.Now, await gateway.ChargeAsync(reference, parts, body?.Challenge, ct));
        }

        var left = applied;
        var newTours = new List<NewTour>();
        foreach (var l in priced)
        {
            var useCredit = Math.Min(left, l.Total);
            left -= useCredit;
            var x = ExcursionRules.ById(l.ExcursionId)!;
            newTours.Add(new NewTour(x.Id, ExcursionRules.DayOf(c.Departure, x).Day, [.. l.Guests.Select(g => g.UserId)], l.Total, useCredit));
        }
        await plan.BookToursAsync(c.Booking.BookingId, newTours, payment, c.Now, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "tour", string.Join(", ", priced.Select(l => ExcursionRules.ById(l.ExcursionId)!.Name)), c.Now, ct);
        return await ExcursionsViewAsync(c, ct);
    }

    private async Task<TourRow> FindTourAsync(Ctx c, Guid id, CancellationToken ct) =>
        (await plan.ListToursAsync(c.Booking.BookingId, ct)).FirstOrDefault(t => t.PublicId == id && t.Status == "booked") ?? throw ApiException.NotFound();

    /// <summary>Removes guests from a tour (all of them cancels it). A refund goes to the card first, then back to the excursion credit; any fee is kept.</summary>
    private async Task ShrinkAsync(Ctx c, TourRow t, Excursion x, List<Person> keep, CancellationToken ct)
    {
        var removedGuests = t.GuestIds.Select(c.PersonByUser).OfType<Person>().Where(g => !keep.Contains(g)).ToList();
        var removed = PriceFor(c, x, removedGuests);
        var rule = ExcursionRules.Refund(removed, ExcursionRules.DaysToTour(c.Today, c.Departure, x));
        var cash = Math.Min(Math.Max(0, t.TotalCents - t.CreditCents), rule.Refund);
        var creditBack = rule.Refund - cash;
        var cancelled = keep.Count == 0;
        var change = new TourChange(
            t.Id, cancelled ? t.GuestIds : [.. keep.Select(g => g.UserId)], cancelled ? 0 : t.TotalCents - removed, t.CreditCents - creditBack, cancelled ? "cancelled" : "booked",
            (t.FeeCents ?? 0) + rule.Fee, (t.RefundCents ?? 0) + rule.Refund, c.Now);
        var refund = cash > 0 ? PaymentPlumbing.RefundOf(c.Actor, $"RFD-{c.Booking.Number}-T{c.Now:yyMMddHHmmss}", cash, c.Now) : null;
        await plan.ChangeTourAsync(c.Booking.BookingId, change, refund, ct);
    }

    public async Task<ExcursionsViewDto> ChangeTourGuestsAsync(UserRecord actor, string? number, Guid id, ChangeGuestsRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var t = await FindTourAsync(c, id, ct);
        var x = ExcursionRules.ById(t.ExcursionId)!;
        var keep = GuestsIn(c, body?.Guests);
        if (!keep.All(g => t.GuestIds.Contains(g.UserId))) throw ApiException.Invalid("guests");
        if (keep.Count == t.GuestIds.Count) return await ExcursionsViewAsync(c, ct);
        if (!keep.Any(g => g.Age >= ExcursionRules.AdultAge)) throw ApiException.Conflict("age");
        await ShrinkAsync(c, t, x, keep, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "tour", $"{x.Name}: guests changed", c.Now, ct);
        return await ExcursionsViewAsync(c, ct);
    }

    public async Task<ExcursionsViewDto> CancelTourAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var t = await FindTourAsync(c, id, ct);
        var x = ExcursionRules.ById(t.ExcursionId)!;
        await ShrinkAsync(c, t, x, [], ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "tour", $"{x.Name}: cancelled", c.Now, ct);
        return await ExcursionsViewAsync(c, ct);
    }

    // ---- Dining ----

    private Person Booker(Ctx c) => c.PersonByUser(c.Booking.BookerUserId) ?? c.Party[0];

    private async Task<DiningViewDto> DiningViewAsync(Ctx c, CancellationToken ct)
    {
        var trip = await tripService.BuildAsync(c.Booking, true, c.Now, ct);
        var ps = BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct));
        var tables = await plan.ListTablesAsync(c.Booking.BookingId, ct);
        var needs = new Dictionary<long, string[]>();
        foreach (var g in c.Party) needs[g.UserId] = [.. (await accounts.GetProfileAsync(g.UserId, ct))?.Dietary ?? []];
        var meals = c.Party.Sum(g => Math.Max(0, EntitlementsFor(c, g, ps).SpecialtyMeals - MealsUsed(tables, g)));
        var reservations = tables.Select(t => new ReservationDto(
            t.PublicId, t.VenueId, t.Day, t.Time, c.Ids(t.GuestIds), t.Note,
            [.. t.GuestIds.Select(c.PersonByUser).OfType<Person>().Where(g => needs.GetValueOrDefault(g.UserId, []).Length > 0).Select(g => new DietaryNoteDto(g.Name.Split(' ')[0], needs[g.UserId]))],
            c.Ids(t.CoveredIds), t.ChargeCents, TripRules.ToMs(t.At), PlanRules.Iso(c.Departure.AddDays(t.Day - 2)), t.LateMinutes))
            .OrderBy(r => r.Day).ThenBy(r => r.Time, StringComparer.Ordinal).ToList();
        var dining = c.Booking.Dining;
        return new DiningViewDto(
            DiningRules.Window(EntitlementsFor(c, Booker(c), ps).DiningWindow, trip.Payment, trip.Plan.FinalDue), dining, DiningRules.Seating(dining), reservations, [.. c.Members], meals,
            !c.Actor.IsSupervised && c.Booking.Status == "confirmed" && c.Today <= c.Departure.AddDays(Pricing.Nights), c.Days);
    }

    public async Task<DiningViewDto> DiningAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await DiningViewAsync(await LoadAsync(actor, number, false, ct), ct);

    public async Task<List<Slot>> SlotsAsync(UserRecord actor, string? number, string? venueId, int day, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, false, ct);
        var v = DiningRules.VenueById(venueId);
        if (v is null || v.WalkIn || !DiningRules.DinnerDays.Contains(day)) throw ApiException.Invalid("venue");
        var slots = DiningRules.SlotsFor(v.Id, c.Booking.SailingId, day);
        var result = new List<Slot>();
        foreach (var s in slots) result.Add(s with { Tables = Math.Max(0, s.Tables - await plan.CountTablesAsync(c.Booking.SailingId, v.Id, day, s.Time, null, ct)) });
        return result;
    }

    public async Task<DiningViewDto> ReserveAsync(UserRecord actor, string? number, ReserveRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        RequireDiningOpen(c);
        var v = DiningRules.VenueById(body?.VenueId);
        if (v is null || v.WalkIn || !DiningRules.DinnerDays.Contains(body!.Day) || body.Time is null || !DiningRules.DinnerTimes.Contains(body.Time)) throw ApiException.Invalid("venue");
        var who = GuestsIn(c, body.Guests);
        if (who.Count > DiningRules.MaxParty) throw ApiException.Invalid("partySize");
        if (!who.Any(g => g.Age >= ExcursionRules.AdultAge)) throw ApiException.Conflict("age");
        var view = await DiningViewAsync(c, ct);
        if (!view.Window.Open) throw ApiException.Conflict("notOpen");
        if (v.Kind == "main" && view.Plan != "anytime") throw ApiException.Conflict("fixedSeating");
        if (DiningRules.DinnerPast(c.Departure, body.Day, body.Time, c.Now)) throw ApiException.Conflict("closed");

        var existing = await plan.ListTablesAsync(c.Booking.BookingId, ct);
        var grid = DiningRules.SlotsFor(v.Id, c.Booking.SailingId, body.Day).First(s => s.Time == body.Time);
        if (grid.Tables - await plan.CountTablesAsync(c.Booking.SailingId, v.Id, body.Day, body.Time, null, ct) <= 0) throw ApiException.Conflict("full");
        var ids = who.Select(g => g.Id).ToList();
        if (DiningRules.TableClash(Reserved(c, existing), body.Day, body.Time, ids).Count > 0) throw ApiException.Conflict("clash");

        var ps = BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct));
        var covered = v.Kind == "specialty" ? who.Where(g => EntitlementsFor(c, g, ps).SpecialtyMeals - MealsUsed(existing, g) > 0).ToList() : [];
        var charge = DiningRules.ChargeFor(v, who.Count, covered.Count).Charge;
        await plan.AddTableAsync(c.Booking.BookingId, new NewTable(v.Id, body.Day, body.Time, [.. who.Select(g => g.UserId)], [.. covered.Select(g => g.UserId)], Str(body.Note, 200), charge, c.Now), ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "dining", $"{v.Name}, night {body.Day}, {body.Time}", c.Now, ct);
        return await DiningViewAsync(c, ct);
    }

    private static List<ReservedTable> Reserved(Ctx c, IEnumerable<TableRow> tables, long? except = null) =>
        [.. tables.Where(t => t.Id != except).Select(t => new ReservedTable(t.VenueId, t.Day, t.Time, c.Ids(t.GuestIds)))];

    private async Task<TableRow> FindTableAsync(Ctx c, Guid id, CancellationToken ct) =>
        (await plan.ListTablesAsync(c.Booking.BookingId, ct)).FirstOrDefault(t => t.PublicId == id) ?? throw ApiException.NotFound();

    public async Task<DiningViewDto> CancelTableAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var t = await FindTableAsync(c, id, ct);
        await plan.CancelTableAsync(c.Booking.BookingId, t.Id, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "dining", $"{DiningRules.VenueById(t.VenueId)?.Name ?? t.VenueId}, night {t.Day}: cancelled", c.Now, ct);
        return await DiningViewAsync(c, ct);
    }

    /// <summary>Moves a table to another night or time. Everything about the new table is checked first, so a refusal leaves the original as it was.</summary>
    public async Task<DiningViewDto> MoveTableAsync(UserRecord actor, string? number, Guid id, MoveRequest? to, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        RequireDiningOpen(c);
        var old = await FindTableAsync(c, id, ct);
        var v = DiningRules.VenueById(old.VenueId)!;
        if (to is null || !DiningRules.DinnerDays.Contains(to.Day) || to.Time is null || !DiningRules.DinnerTimes.Contains(to.Time)) throw ApiException.Invalid("slot");
        if (to.Day == old.Day && to.Time == old.Time) throw ApiException.Conflict("unchanged");
        if (DiningRules.DinnerPast(c.Departure, old.Day, old.Time, c.Now) || DiningRules.DinnerPast(c.Departure, to.Day, to.Time, c.Now)) throw ApiException.Conflict("closed");
        var existing = await plan.ListTablesAsync(c.Booking.BookingId, ct);
        var grid = DiningRules.SlotsFor(v.Id, c.Booking.SailingId, to.Day).First(s => s.Time == to.Time);
        if (grid.Tables - await plan.CountTablesAsync(c.Booking.SailingId, v.Id, to.Day, to.Time, old.Id, ct) <= 0) throw ApiException.Conflict("full");
        if (DiningRules.TableClash(Reserved(c, existing, old.Id), to.Day, to.Time, c.Ids(old.GuestIds)).Count > 0) throw ApiException.Conflict("clash");
        await plan.MoveTableAsync(c.Booking.BookingId, old.Id, to.Day, to.Time, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "dining", $"{v.Name}: night {old.Day}, {old.Time} moved to night {to.Day}, {to.Time}", c.Now, ct);
        return await DiningViewAsync(c, ct);
    }

    public async Task<DiningViewDto> RunningLateAsync(UserRecord actor, string? number, Guid id, LateRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var t = await FindTableAsync(c, id, ct);
        if (body is null || body.Minutes < DiningRules.MinLateMinutes || body.Minutes > DiningRules.MaxLateMinutes) throw ApiException.Invalid("minutes");
        await plan.SetTableLateAsync(c.Booking.BookingId, t.Id, body.Minutes, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "dining", $"{DiningRules.VenueById(t.VenueId)?.Name ?? t.VenueId}, night {t.Day}: running {body.Minutes} minutes late", c.Now, ct);
        return await DiningViewAsync(c, ct);
    }

    // ---- Packages ----

    private async Task<PackagesViewDto> PackagesViewAsync(Ctx c, CancellationToken ct)
    {
        var all = BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct));
        var tours = await plan.ListToursAsync(c.Booking.BookingId, ct);
        var tables = await plan.ListTablesAsync(c.Booking.BookingId, ct);
        var active = all.Where(p => p.Row.Status == "active").ToList();
        string ChangeOn(int atDays, double share) => PackageRules.ChangeOn(c.Departure, atDays, share);

        var addOns = PackageRules.AddOns.Select(a =>
        {
            var after = PackageRules.UnitPrice(a.Base, a.ChangeAtDays, a.ChangeShare, a.ChangeAtDays - 1);
            var eligible = c.Party.Where(g => g.Age >= a.MinAge && !active.Any(p => p.Row.Kind == "addOn" && p.Row.ItemId == a.Id && p.Row.GuestIds.Contains(g.UserId))).Select(g => new PartyMemberDto(g.Id, g.Name, g.Age, g.Child)).ToList();
            return new AddOnOfferDto(a.Id, a.Unit, PackageRules.AddOnPrice(a, c.Days), a.Base, ChangeOn(a.ChangeAtDays, a.ChangeShare), after, eligible);
        }).ToList();

        var upgrades = c.Party.SelectMany(g =>
        {
            var from = Effective(c, g, all);
            var options = PackageRules.UpgradesFrom(from).Select(u =>
                new UpgradeOptionDto(u.To, PackageRules.UpgradePrice(u, c.Days), ChangeOn(u.ChangeAtDays, u.ChangeShare), PackageRules.UnitPrice(u.Base, u.ChangeAtDays, u.ChangeShare, u.ChangeAtDays - 1))).ToList();
            return options.Count > 0 ? new[] { new UpgradeOfferDto(g.Id, g.Name, from, options) } : [];
        }).ToList();

        var people = c.Party.Select(g =>
        {
            var e = EntitlementsFor(c, g, all);
            return new PersonEntitlementsDto(g.Id, g.Name, Effective(c, g, all), e, EntitlementRules.BalancesOf(e, MealsUsed(tables, g)));
        }).ToList();
        var credit = CreditOf(c, all, tours);
        return new PackagesViewDto(addOns, upgrades, [.. all.Select(p => p.View).OrderByDescending(p => p.At)], people, new PooledDto(credit.Total, credit.Used, credit.Remaining), [.. c.Members],
            c.Days, !c.Actor.IsSupervised && c.Days >= 1 && c.Booking.Status == "confirmed");
    }

    public async Task<PackagesViewDto> PackagesAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await PackagesViewAsync(await LoadAsync(actor, number, false, ct), ct);

    public async Task<PackagesViewDto> BuyAsync(UserRecord actor, string? number, BuyRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var all = BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct));
        var active = all.Where(p => p.Row.Status == "active").ToList();
        var who = GuestsIn(c, body?.Guests);
        NewPurchase purchase;
        string label;
        string what;
        if (body!.Kind == "addOn")
        {
            var a = PackageRules.AddOn(body.Item) ?? throw ApiException.Invalid("item");
            if (who.Any(g => g.Age < a.MinAge)) throw ApiException.Invalid("age");
            if (who.Any(g => active.Any(p => p.Row.Kind == "addOn" && p.Row.ItemId == a.Id && p.Row.GuestIds.Contains(g.UserId)))) throw ApiException.Conflict("held");
            var unit = PackageRules.AddOnPrice(a, c.Days);
            var n = PackageRules.Units(a.Unit, who.Count);
            purchase = new NewPurchase("addOn", a.Id, [.. who.Select(g => g.UserId)], n, unit, unit * n, c.Now);
            label = "purchase";
            what = a.Id;
        }
        else if (body.Kind == "upgrade")
        {
            if (body.To is not ("plus" or "premier")) throw ApiException.Invalid("item");
            var froms = who.Select(g => Effective(c, g, all)).ToList();
            if (froms.Any(f => !PackageRules.UpgradesFrom(f).Any(u => u.To == body.To))) throw ApiException.Invalid("alreadyHeld");
            if (froms.Distinct().Count() > 1) throw ApiException.Invalid("mixedStart");
            var u = PackageRules.UpgradesFrom(froms[0]).First(x => x.To == body.To);
            var unit = PackageRules.UpgradePrice(u, c.Days);
            purchase = new NewPurchase("upgrade", $"{froms[0]}>{u.To}", [.. who.Select(g => g.UserId)], who.Count, unit, unit * who.Count, c.Now);
            label = "upgrade";
            what = $"{u.To} package";
        }
        else throw ApiException.Invalid("kind");

        if (purchase.TotalCents <= 0) throw ApiException.Invalid("nothingToPay");
        var parts = await PaymentPlumbing.ResolvePartsAsync(trips, actor, body.Parts, purchase.TotalCents, c.Today, ct);
        var reference = $"PUR-{c.Booking.Number}-{c.Now:yyMMddHHmmss}";
        var payment = PaymentPlumbing.PaymentOf(actor, label, reference, c.Now, await gateway.ChargeAsync(reference, parts, body.Challenge, ct));
        await plan.AddPurchaseAsync(c.Booking.BookingId, purchase, payment, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "purchase", what, c.Now, ct);
        return await PackagesViewAsync(c, ct);
    }

    private async Task<PurchaseCalc> FindPurchaseAsync(Ctx c, Guid id, CancellationToken ct) =>
        BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct)).FirstOrDefault(p => p.Row.PublicId == id) ?? throw ApiException.NotFound();

    /// <summary>Takes the credit owed after a price drop. Taken once: a second claim finds nothing more owed.</summary>
    public async Task<PackagesViewDto> ClaimDropAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var p = await FindPurchaseAsync(c, id, ct);
        if (p.Row.Status != "active" || p.View.Price.State != "dropped" || p.View.Price.Total <= p.Row.CreditedCents) throw ApiException.Conflict("nothing");
        await plan.UpdatePurchaseAsync(c.Booking.BookingId, p.Row.Id, "active", p.View.Price.Total, null, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "purchase", $"{p.View.Item}: price drop credit", c.Now, ct);
        return await PackagesViewAsync(c, ct);
    }

    public async Task<PackagesViewDto> CancelPurchaseAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var p = await FindPurchaseAsync(c, id, ct);
        if (!p.View.CanCancel) throw ApiException.Conflict("locked");
        var back = p.View.Total - p.Row.CreditedCents;
        var refund = back > 0 ? PaymentPlumbing.RefundOf(actor, $"RFD-{c.Booking.Number}-P{c.Now:yyMMddHHmmss}", back, c.Now) : null;
        await plan.UpdatePurchaseAsync(c.Booking.BookingId, p.Row.Id, "cancelled", p.Row.CreditedCents, refund, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "purchase", $"{p.View.Item}: cancelled", c.Now, ct);
        return await PackagesViewAsync(c, ct);
    }

    // ---- Assistance ----

    private async Task<List<AssistRequestDto>> RequestsAsync(Ctx c, CancellationToken ct) =>
        (await plan.ListAssistAsync(c.Booking.BookingId, ct))
            .Where(r => c.PersonByUser(r.GuestUserId) is not null && PlanRules.AssistKindOf(r.Kind) is not null)
            .Select(r => new AssistRequestDto(r.PublicId, r.Kind, c.PersonByUser(r.GuestUserId)!.Id, r.Note, TripRules.ToMs(r.At),
                PlanRules.RequestStatus(PlanRules.AssistKindOf(r.Kind)!, c.Departure, TripRules.Today(r.At), r.At, c.Now)))
            .OrderByDescending(r => r.At).ToList();

    private async Task<AssistanceViewDto> AssistanceViewAsync(Ctx c, CancellationToken ct)
    {
        var needs = new Dictionary<Guid, string[]>();
        foreach (var g in c.Party)
            if ((await accounts.GetProfileAsync(g.UserId, ct))?.Needs is { Count: > 0 } n) needs[g.Id] = [.. n];
        return new AssistanceViewDto(
            [.. PlanRules.AssistKinds.Select(k => new DeadlineEntryDto(k.Id, PlanRules.DeadlineOf(k, c.Departure, c.Today)))], await RequestsAsync(c, ct), [.. c.Members],
            !c.Actor.IsSupervised && c.Days >= 1 && c.Booking.Status == "confirmed", c.Days, needs);
    }

    public async Task<AssistanceViewDto> AssistanceAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await AssistanceViewAsync(await LoadAsync(actor, number, false, ct), ct);

    public async Task<AssistanceViewDto> RequestAssistanceAsync(UserRecord actor, string? number, AssistRequestInput? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var kind = PlanRules.AssistKindOf(body?.Kind) ?? throw ApiException.Invalid("kind");
        var guest = body!.Guest is { } gid ? c.PersonById(gid) : null;
        if (guest is null) throw ApiException.Invalid("guest");
        var note = Str(body.Note, 300);
        if (kind.NoteRequired && note.Length == 0) throw ApiException.Invalid("note");
        if ((await RequestsAsync(c, ct)).Any(r => r.Kind == kind.Id && r.Guest == guest.Id)) throw ApiException.Conflict("duplicate");
        await plan.AddAssistAsync(c.Booking.BookingId, guest.UserId, kind.Id, note, c.Now, ct);

        // Asking for help records the need on the guest's profile, so the rest of the app plans around it.
        if (kind.Need is { } need && await accounts.GetProfileAsync(guest.UserId, ct) is { } profile && !profile.Needs.Contains(need))
        {
            profile.Needs = [.. profile.Needs, need];
            await accounts.SaveProfileAsync(profile, updateEmail: false, c.Now, ct);
        }
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "assistance", $"{guest.Name.Split(' ')[0]}: {kind.Id}", c.Now, ct);
        return await AssistanceViewAsync(c, ct);
    }

    public async Task<AssistanceViewDto> CancelAssistanceAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var mine = (await RequestsAsync(c, ct)).FirstOrDefault(r => r.Id == id) ?? throw ApiException.NotFound();
        await plan.CancelAssistAsync(c.Booking.BookingId, id, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "assistance", $"{c.PersonById(mine.Guest)!.Name.Split(' ')[0]}: {mine.Kind} withdrawn", c.Now, ct);
        return await AssistanceViewAsync(c, ct);
    }

    // ---- Travel, checklist, packing ----

    private bool Priority(Ctx c, IReadOnlyList<PurchaseCalc> ps) => EntitlementRules.HasPriority(EntitlementsFor(c, Booker(c), ps));

    private async Task<TravelViewDto> TravelViewAsync(Ctx c, bool canEdit, CancellationToken ct)
    {
        var priority = Priority(c, BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct)));
        var stored = await plan.GetTravelAsync(c.Booking.BookingId, ct);
        var current = PlanRules.Normalize(stored is null ? null : new TravelPlan(stored.Window, stored.Mode, stored.Hotel), priority);
        return new TravelViewDto(current, PlanRules.ArrivalWindows(priority), priority, PlanRules.SuggestedWindow(priority), canEdit);
    }

    public async Task<TravelViewDto> TravelAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await TravelViewAsync(await LoadAsync(actor, number, false, ct), !actor.IsSupervised, ct);

    public async Task<TravelViewDto> SaveTravelAsync(UserRecord actor, string? number, SaveTravelRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var priority = Priority(c, BuildPurchases(c, await plan.ListPurchasesAsync(c.Booking.BookingId, ct)));
        if (body is null || (body.Window is not null && !PlanRules.IsWindow(body.Window, priority)) || (body.Mode is not null && !PlanRules.IsMode(body.Mode)) || (body.Hotel is not null && !PlanRules.IsHotel(body.Hotel)))
            throw ApiException.Invalid("choices");
        await plan.SaveTravelAsync(c.Booking.BookingId, new TravelRow { Window = body.Window, Mode = body.Mode, Hotel = body.Hotel }, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "travel", body.Window is null ? "Travel plan" : $"Arrive {body.Window}", c.Now, ct);
        return await TravelViewAsync(c, true, ct);
    }

    private async Task<ChecklistViewDto> ChecklistViewAsync(Ctx c, CancellationToken ct)
    {
        var trip = await tripService.BuildAsync(c.Booking, true, c.Now, ct);
        var auto = new Dictionary<string, bool>
        {
            ["paid"] = trip.Payment == "paid",
            ["documents"] = trip.Documents is null || (trip.Documents.Missing == 0 && trip.Documents.PassportProblems == 0),
            ["tours"] = (await plan.ListToursAsync(c.Booking.BookingId, ct)).Any(t => t.Status == "booked"),
            ["dining"] = (await plan.ListTablesAsync(c.Booking.BookingId, ct)).Count > 0,
            ["assistance"] = (await plan.ListAssistAsync(c.Booking.BookingId, ct)).Count > 0,
            ["travel"] = (await plan.GetTravelAsync(c.Booking.BookingId, ct))?.Window is { } w && PlanRules.IsWindow(w, true),
            ["checkin"] = trip.Checkin.State == "done",
        };
        var entries = PlanRules.BuildChecklist(c.Departure, trip.DaysToDeparture, auto, await plan.GetTicksAsync(c.Booking.BookingId, "checklist", ct));
        var done = entries.Count(e => e.State == "done");
        return new ChecklistViewDto(entries, PlanRules.Milestones(entries), new ProgressDto(done, entries.Count), PlanRules.NextItem(entries), trip.DaysToDeparture);
    }

    public async Task<ChecklistViewDto> ChecklistAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ChecklistViewAsync(await LoadAsync(actor, number, false, ct), ct);

    public async Task<ChecklistViewDto> TickChecklistAsync(UserRecord actor, string? number, string? id, TickRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var known = (await ChecklistViewAsync(c, ct)).Entries.Where(e => !e.Automatic).Select(e => e.Id);
        if (id is null || !known.Contains(id)) throw ApiException.Invalid("item");
        await plan.SetTickAsync(c.Booking.BookingId, "checklist", id, body?.Done ?? true, c.Now, ct);
        return await ChecklistViewAsync(c, ct);
    }

    private async Task<(List<PackItem> Items, HashSet<string> Ticked)> PackingAsync(Ctx c, CancellationToken ct)
    {
        var needs = new HashSet<string>();
        foreach (var g in c.Party) foreach (var n in (await accounts.GetProfileAsync(g.UserId, ct))?.Needs ?? []) needs.Add(n);
        foreach (var r in await RequestsAsync(c, ct)) if (PlanRules.AssistKindOf(r.Kind)?.Need is { } n) needs.Add(n);
        var tours = (await plan.ListToursAsync(c.Booking.BookingId, ct)).Where(t => t.Status == "booked").Select(t => t.ExcursionId);
        var items = PlanRules.BuildPackingList(c.Departure, Pricing.Nights, tours, [.. c.Party.Select(g => g.Age)], needs, true, PlanRules.ElegantNights(Pricing.Nights));
        var known = items.Select(i => i.Id).ToHashSet();
        return (items, [.. (await plan.GetTicksAsync(c.Booking.BookingId, "packing", ct)).Where(known.Contains)]);
    }

    public async Task<PackingViewDto> PackingAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, false, ct);
        var (items, ticked) = await PackingAsync(c, ct);
        return new PackingViewDto(items, [.. ticked], PlanRules.WeatherFor(c.Departure), Pricing.Nights, c.Days);
    }

    public async Task<PackingViewDto> TickPackingAsync(UserRecord actor, string? number, string? id, TickRequest? body, CancellationToken ct)
    {
        var c = await LoadAsync(actor, number, true, ct);
        var (items, _) = await PackingAsync(c, ct);
        if (id is null || items.All(i => i.Id != id)) throw ApiException.Invalid("item");
        await plan.SetTickAsync(c.Booking.BookingId, "packing", id, body?.Done ?? true, c.Now, ct);
        var (after, ticked) = await PackingAsync(c, ct);
        return new PackingViewDto(after, [.. ticked], PlanRules.WeatherFor(c.Departure), Pricing.Nights, c.Days);
    }
}
