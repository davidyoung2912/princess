using Microsoft.Extensions.Options;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The on-board day: today, the programme, the port day, the muster drill, the emergency card and the account. Ports the <c>onboard</c> and <c>ports</c> groups of <c>src/api/onboardMock.ts</c>.
/// Any guest on the booking reads; an adult guest writes. "Now" is the person's own clock (D4). Weather is a mocked service (data model section 8); scenarios apply only to demo users.
/// </summary>
public sealed class OnboardService(
    ScopeLoader scopes, IOnboardStore store, IPlanStore plan, IAccountStore accounts, IDemoStore demo, PlanService planService, IOptions<JwtOptions> jwt)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    private async Task<HashSet<string>> ScenariosAsync(UserRecord actor, CancellationToken ct) => actor.IsDemo ? await demo.GetScenariosAsync(actor.Id, ct) : [];

    // ---- Today ----

    public async Task<OnboardTodayDto> TodayAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var scenarios = await ScenariosAsync(actor, ct);
        var aboard = Itinerary.Aboard(c.Departure, c.Now);
        var zone = Itinerary.ShipZoneAt(c.Departure, c.Now);
        var day = FolioRules.CruiseDay(c.Departure, c.Now);
        var (date, _) = Itinerary.LocalAt(c.Now, zone);
        var portDay = aboard ? AboardRules.PortDayAt(c.Departure, c.Now) : null;
        var done = await store.ListMusterAsync(c.Booking.BookingId, ct);
        var all = c.Party.All(p => done.ContainsKey(p.UserId));
        var sail = Itinerary.LocalToUtc(c.Departure, Itinerary.Days(c.Departure)[0].Depart!.Value, Itinerary.ShipHomeZone);
        var change = Itinerary.ShipClockChanges(c.Departure).FirstOrDefault(x => x.At > c.Now && x.At - c.Now < TimeSpan.FromHours(24));
        return new OnboardTodayDto(
            aboard, day is >= 1 and <= 8 ? day : null, Iso(date), Itinerary.PortAt(c.Departure, c.Now).Port, zone,
            aboard ? AboardRules.WeatherOn(date, scenarios.Contains("belizeTender")) : null,
            portDay is null ? null : AboardRules.WithState(portDay, c.Now),
            new MusterBriefDto(aboard && !all, all, Ms(AboardRules.DrillAt(c.Departure))),
            c.Now < sail ? Ms(sail) : null, scenarios.Contains("planChange"), change is null ? null : new ClockChangeDto(Ms(change.At), change.Hours));
    }

    public async Task<PortTodayDto> PortTodayAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var (port, day) = Itinerary.PortAt(c.Departure, c.Now);
        return new PortTodayDto(port, day);
    }

    // ---- The programme ----

    public async Task<ProgramViewDto> ProgramAsync(UserRecord actor, string? number, int day, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        if (day is < 1 or > 8) throw ApiException.Invalid("day");
        var changes = (await ScenariosAsync(actor, ct)).Contains("planChange");
        var events = ProgramRules.On(c.Departure, day, changes);
        var x = Itinerary.Days(c.Departure)[day - 1];
        var mine = (await store.ListPlanAsync(actor.Id, c.Booking.SailingId, ct)).Where(r => r.Day == day).Select(r => r.EventId).ToHashSet();
        return new ProgramViewDto(day, Iso(x.Date), x.Port, events, [.. events.Select(e => e.Id).Where(mine.Contains)], events.Any(e => e.Status != "on"), !actor.IsSupervised);
    }

    public async Task<List<string>> TogglePlanAsync(UserRecord actor, string? number, string? eventId, PlanToggleRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var ev = ProgramRules.ById(eventId) ?? throw ApiException.Invalid("event");
        if (body is null || !ev.Days.Contains(body.Day)) throw ApiException.Invalid("day");
        await store.SetPlanAsync(actor.Id, c.Booking.SailingId, ev.Id, body.Day, body.On, ct);
        return [.. (await store.ListPlanAsync(actor.Id, c.Booking.SailingId, ct)).Where(r => r.Day == body.Day).Select(r => r.EventId)];
    }

    // ---- The port day ----

    public async Task<PortDayViewDto?> PortDayAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var scenarios = await ScenariosAsync(actor, ct);
        var day = AboardRules.PortDayAt(c.Departure, c.Now);
        if (day is null) return null;
        var withState = AboardRules.WithState(day, c.Now);
        var days = Itinerary.Days(c.Departure);

        var tours = new List<TourTodayDto>();
        foreach (var t in (await plan.ListToursAsync(c.Booking.BookingId, ct)).Where(t => t.Status == "booked"))
        {
            var x = ExcursionRules.ById(t.ExcursionId);
            if (x is null || x.Port != day.Port) continue;
            var guests = t.GuestIds.Select(c.PersonByUser).OfType<ScopePerson>().ToList();
            if (guests.Count == 0) continue;
            tours.Add(new TourTodayDto(
                t.PublicId.ToString(), x.Id, x.Name, x.Meeting, x.Start, ExcursionRules.BackBy(x, days[day.Day - 1]), day.Tender,
                [.. guests.Select(g => new TourGuestDto(g.Id, g.Name, TourCode(c.Booking.Number, t.PublicId, g.Id)))]));
        }

        var rough = scenarios.Contains("belizeTender");
        var mayTender = AboardRules.MayTenderInstead(day.Port, rough);
        var delay = rough && day.Port == "belize" ? 40 : 0;
        var assistance = (await accounts.GetProfileAsync(c.Booking.BookerUserId, ct))?.Needs.Contains("mobility") == true;
        var priority = await planService.HasPriorityAsync(actor, c.Booking, ct);
        TenderInfoDto? tender = null;
        if (day.Tender || mayTender)
        {
            var group = AboardRules.TenderGroupFor(tours.Count > 0, priority, assistance, $"{c.Booking.Number}|{day.Date}");
            var v = AboardRules.TenderViewOf(day, group, c.Now, delay);
            tender = new TenderInfoDto(v.Group, v.CallAt, v.Status, v.DelayMinutes, v.WaitMinutes, v.LastTenderAt, mayTender, assistance);
        }
        return new PortDayViewDto(withState, tender, tours, delay, scenarios.Contains("portSkipped") && day.Port == "cozumel");
    }

    /// <summary>The text of a ship-tour QR code, signed so a code cannot be made up.</summary>
    private string TourCode(string booking, Guid tour, Guid guest)
    {
        var body = $"PCX1|{booking}|{tour}|{guest}";
        return $"{body}|{BoardingRules.Sign(jwt.Value.SigningKey, body)}";
    }

    // ---- Muster ----

    private async Task<MusterViewDto> MusterViewAsync(Scope c, CancellationToken ct)
    {
        var done = await store.ListMusterAsync(c.Booking.BookingId, ct);
        var needsStepFree = (await accounts.GetProfileAsync(c.Booking.BookerUserId, ct))?.Needs.Contains("mobility") == true;
        var place = BoardingRules.AssignmentFor(c.Booking.Number, c.Booking.SailingId, c.Booking.CategoryId, c.Booking.CabinNumber, needsStepFree);
        var letter = place.Muster[^1..];
        var station = ProgramRules.MusterStations.GetValueOrDefault(letter);
        var all = c.Party.All(p => done.ContainsKey(p.UserId));
        return new MusterViewDto(
            Ms(AboardRules.DrillAt(c.Departure)), !all, all, place.Muster, station?.Name ?? place.Muster, station is null ? "" : ProgramRules.PlaceName(station.PlaceId), station?.Deck ?? 7,
            [.. c.Party.Select(p => new MusterGuestDto(p.Id, p.Name, done.TryGetValue(p.UserId, out var at) ? Ms(at) : null))], !c.Actor.IsSupervised);
    }

    public async Task<MusterViewDto> MusterAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await MusterViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<MusterViewDto> ConfirmMusterAsync(UserRecord actor, string? number, MusterConfirmRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!c.Confirmed) throw ApiException.Conflict("closed");
        var guests = c.GuestsIn(body?.Guests);
        var at = AboardRules.DrillAt(c.Departure);
        if (c.Now < at.AddMinutes(-AboardRules.MusterOpensMinutes)) throw ApiException.Conflict("notOpen");
        if (c.Now > at.AddHours(AboardRules.MusterClosesHours)) throw ApiException.Conflict("closed");
        await store.SaveMusterAsync(c.Booking.BookingId, [.. guests.Select(g => g.UserId)], actor.Id, c.Now, ct);
        return await MusterViewAsync(c, ct);
    }

    // ---- Emergency card ----

    public async Task<EmergencyCard> EmergencyAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var needsStepFree = (await accounts.GetProfileAsync(c.Booking.BookerUserId, ct))?.Needs.Contains("mobility") == true;
        var place = BoardingRules.AssignmentFor(c.Booking.Number, c.Booking.SailingId, c.Booking.CategoryId, c.Booking.CabinNumber, needsStepFree);
        var me = c.PersonByUser(actor.Id)?.Name ?? c.Party.FirstOrDefault()?.Name ?? "";
        return AboardRules.EmergencyCardOf(me, place.Number, place.Deck, place.Muster);
    }

    // ---- The onboard account ----

    public async Task<FolioViewDto> FolioAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var day = FolioRules.CruiseDay(c.Departure, c.Now);
        var throughDay = day >= 9 ? 8 : Math.Max(0, day);
        var entitlements = await planService.PartyEntitlementsAsync(actor, c.Booking, ct);
        var suite = Pricing.Category(c.Booking.CategoryId)?.Suite == true;
        var guests = c.Party.Select(p => new FolioGuest(p.Id, p.First, p.Age, entitlements[p.UserId], suite)).ToList();
        var dining = (await plan.ListTablesAsync(c.Booking.BookingId, ct)).Select(t => new DiningCharge(
            t.PublicId.ToString(), t.Day, t.Time, DiningRules.VenueById(t.VenueId)?.Name ?? t.VenueId, c.Ids(t.GuestIds), t.ChargeCents, c.Ids(t.CoveredIds))).ToList();
        var welcome = guests.Count > 0 && guests[0].Entitlements.Perks.Contains("welcomeGift");
        var generated = throughDay == 0 ? [] : FolioRules.Build(c.Booking.SailingId, c.Departure, throughDay, guests, dining, welcome);
        var booker = c.PersonByUser(c.Booking.BookerUserId)?.Id ?? c.Party.FirstOrDefault()?.Id ?? Guid.Empty;
        var stored = (await store.ListFolioAsync(c.Booking.BookingId, ct)).Select(r => new FolioLine(
            r.PublicId.ToString(), r.Day, Ms(r.At), r.Category, r.Description, r.UserId is { } u ? c.PersonByUser(u)?.Id ?? booker : booker, r.Cents, null, r.CoveredBy));
        var lines = FolioRules.Sorted(generated.Concat(stored).Where(l => l.At <= Ms(c.Now)));
        return new FolioViewDto(lines, FolioRules.Totals(lines), [.. c.Party.Select(p => new GuestDto(p.Id, p.Name))], throughDay);
    }
}
