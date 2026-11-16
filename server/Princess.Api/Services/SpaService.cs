using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Spa and salon appointments for the Spa Explorer: the time grid, booking, moving, changing who is in one, and cancelling with the policy shown first. Mirrors the dining reservations in
/// <see cref="PlanService"/>. Any guest on the booking reads; an adult guest writes. The treatments are authored per ship in <see cref="ExplorerCatalogue"/> and room counts are simulated
/// deterministically (the same every time), so a real booking system can replace both with no app change.
/// </summary>
public sealed class SpaService(ScopeLoader scopes, ISpaStore store, IPlanStore plan, IAccountStore accounts)
{
    /// <summary>How long a dinner on the guest's plan is taken to last when checking an appointment against it.</summary>
    private const int DinnerMinutes = 90;

    private static string Str(string? v, int max) => v is null ? "" : v.Trim() is var t && t.Length > max ? t[..max] : t;

    private static ShipExplorer ShipOf(Scope c) => ExplorerCatalogue.Of(AboardPlans.ShipOfSailing(c.Booking.SailingId));

    /// <summary>Spa stays open on board until the last night has passed.</summary>
    private static void RequireOpen(Scope c)
    {
        if (c.Today > c.LastDay || !c.Confirmed) throw ApiException.Conflict("closed");
    }

    private static long StartAt(Scope c, int day, string time)
    {
        var date = c.Timeline.Departure.AddDays(day - 1);
        return TripRules.ToMs(Itinerary.LocalToUtc(date, TimeOnly.ParseExact(time, "HH:mm"), c.Timeline.ShipZoneOnDate(date)));
    }

    private static bool Past(Scope c, int day, string time) => StartAt(c, day, time) <= TripRules.ToMs(c.Now);

    private static SpaTreatment TreatmentIn(Scope c, string? id) => ShipOf(c).TreatmentList.FirstOrDefault(t => t.Id == id) ?? throw ApiException.Invalid("treatment");

    private static ExplorerVenue VenueOf(Scope c, SpaTreatment t) => ShipOf(c).Venues.FirstOrDefault(v => v.Id == t.VenueId && v.Bookable == "spa") ?? throw ApiException.Invalid("treatment");

    /// <summary>The hours of the treatment's venue on a day, or an invalid-day error when the treatment does not run then.</summary>
    private static HoursDayDto HoursFor(Scope c, SpaTreatment t, int day)
    {
        if (day < 1 || day > c.Timeline.Days.Count) throw ApiException.Invalid("day");
        return DayKinds.Runs(c.Timeline, day, t.When) ? ExplorerRules.Hours(VenueOf(c, t).Hours, c.Timeline, day) : new([], [], "none");
    }

    private SpaAppointmentDto Dto(Scope c, SpaRow r)
    {
        var treatment = ShipOf(c).TreatmentList.FirstOrDefault(t => t.Id == r.TreatmentId);
        var total = r.PriceCents * r.GuestIds.Count;
        var startAt = StartAt(c, r.Day, r.Time);
        var now = TripRules.ToMs(c.Now);
        return new SpaAppointmentDto(r.PublicId, r.VenueId, r.TreatmentId, treatment?.Title ?? r.TreatmentId, r.Day, r.Time, r.Minutes, startAt, c.Ids(r.GuestIds), r.Note, total,
            startAt > now && !c.Actor.IsSupervised && c.Confirmed, SpaRules.CancelTerms(startAt, now, total), TripRules.ToMs(r.At));
    }

    private async Task<SpaViewDto> ViewOfAsync(Scope c, CancellationToken ct)
    {
        var rows = await store.ListAsync(c.Booking.BookingId, ct);
        return new SpaViewDto(
            [.. ShipOf(c).TreatmentList.Select(t => new SpaTreatmentDto(t.Id, t.VenueId, t.Title, t.Detail, t.Minutes, t.Price, t.MinAge, t.Rooms))],
            [.. rows.OrderBy(r => r.Day).ThenBy(r => r.Time, StringComparer.Ordinal).Select(r => Dto(c, r))],
            [.. c.Party.Select(p => new PartyMemberDto(p.Id, p.Name, p.Age, p.Child))],
            !c.Actor.IsSupervised && c.Confirmed && c.Today <= c.LastDay, SpaRules.CancelFreeHours, SpaRules.LateFeePercent, SpaRules.MaxParty);
    }

    public async Task<SpaViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewOfAsync(await scopes.LoadAsync(actor, number, false, ct), ct);

    /// <summary>The start times of a treatment on a day with the rooms left at each. <paramref name="except"/> is an appointment being moved, which does not count against itself.</summary>
    public async Task<List<SpaSlot>> SlotsAsync(UserRecord actor, string? number, string? treatmentId, int day, Guid? except, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, false, ct);
        var t = TreatmentIn(c, treatmentId);
        var exceptId = except is { } id ? (await store.ListAsync(c.Booking.BookingId, ct)).FirstOrDefault(r => r.PublicId == id)?.Id : null;
        var result = new List<SpaSlot>();
        foreach (var time in SpaRules.Times(HoursFor(c, t, day), t.Minutes))
        {
            var left = t.Rooms - SpaRules.TakenByOthers(t, c.Booking.SailingId, day, time) - await store.CountAsync(c.Booking.SailingId, t.Id, day, time, exceptId, ct);
            result.Add(new SpaSlot(time, Math.Max(0, left)));
        }
        return result;
    }

    /// <summary>Throws when any of these guests is already booked for something that overlaps: another treatment, a dinner or a tour that day.</summary>
    private async Task RequireFreeAsync(Scope c, long? exceptId, int day, string time, int minutes, IReadOnlyCollection<long> guestIds, CancellationToken ct)
    {
        foreach (var o in await store.ListAsync(c.Booking.BookingId, ct))
            if (o.Id != exceptId && o.Day == day && o.GuestIds.Any(g => guestIds.Contains(g)) && SpaRules.Overlaps(time, minutes, o.Time, o.Minutes)) throw ApiException.Conflict("clash");
        foreach (var d in await plan.ListTablesAsync(c.Booking.BookingId, ct))
            if (d.Day == day && d.GuestIds.Any(g => guestIds.Contains(g)) && SpaRules.Overlaps(time, minutes, d.Time, DinnerMinutes)) throw ApiException.Conflict("clash");
        if ((await plan.ListToursAsync(c.Booking.BookingId, ct)).Any(x => x.Status == "booked" && x.Day == day && x.GuestIds.Any(g => guestIds.Contains(g)))) throw ApiException.Conflict("tour");
    }

    private static void RequireGuests(SpaTreatment t, IReadOnlyList<ScopePerson> who)
    {
        if (who.Count > SpaRules.MaxParty) throw ApiException.Invalid("partySize");
        if (who.Any(g => g.Age < (t.MinAge ?? 0))) throw ApiException.Conflict("age");
        if (who.Any(g => g.Age < ExcursionRules.AdultAge) && !who.Any(g => g.Age >= ExcursionRules.AdultAge)) throw ApiException.Conflict("age");
    }

    public async Task<SpaViewDto> ReserveAsync(UserRecord actor, string? number, SpaReserveRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var t = TreatmentIn(c, body?.TreatmentId);
        var venue = VenueOf(c, t);
        if (!SpaRules.OnGrid(HoursFor(c, t, body!.Day), t.Minutes, body.Time)) throw ApiException.Invalid("slot");
        var who = c.GuestsIn(body.Guests);
        RequireGuests(t, who);
        if (Past(c, body.Day, body.Time!)) throw ApiException.Conflict("closed");
        var ids = who.Select(g => g.UserId).ToList();
        if (t.Rooms - SpaRules.TakenByOthers(t, c.Booking.SailingId, body.Day, body.Time!) - await store.CountAsync(c.Booking.SailingId, t.Id, body.Day, body.Time!, null, ct) <= 0) throw ApiException.Conflict("full");
        await RequireFreeAsync(c, null, body.Day, body.Time!, t.Minutes, ids, ct);
        await store.AddAsync(c.Booking.BookingId, new NewSpa(venue.Id, t.Id, body.Day, body.Time!, t.Minutes, t.Price, Str(body.Note, SpaRules.MaxNote), ids, c.Now), ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "purchase", $"{t.Title}, day {body.Day}, {body.Time}", c.Now, ct);
        return await ViewOfAsync(c, ct);
    }

    private async Task<SpaRow> FindAsync(Scope c, Guid id, CancellationToken ct) =>
        (await store.ListAsync(c.Booking.BookingId, ct)).FirstOrDefault(r => r.PublicId == id) ?? throw ApiException.NotFound();

    /// <summary>Moves an appointment to another day or time. Everything about the new time is checked first, so a refusal leaves the original as it was.</summary>
    public async Task<SpaViewDto> MoveAsync(UserRecord actor, string? number, Guid id, SpaMoveRequest? to, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var old = await FindAsync(c, id, ct);
        var t = TreatmentIn(c, old.TreatmentId);
        if (to is null || !SpaRules.OnGrid(HoursFor(c, t, to.Day), old.Minutes, to.Time)) throw ApiException.Invalid("slot");
        if (to.Day == old.Day && to.Time == old.Time) throw ApiException.Conflict("unchanged");
        if (Past(c, old.Day, old.Time) || Past(c, to.Day, to.Time!)) throw ApiException.Conflict("closed");
        if (t.Rooms - SpaRules.TakenByOthers(t, c.Booking.SailingId, to.Day, to.Time!) - await store.CountAsync(c.Booking.SailingId, t.Id, to.Day, to.Time!, old.Id, ct) <= 0) throw ApiException.Conflict("full");
        await RequireFreeAsync(c, old.Id, to.Day, to.Time!, old.Minutes, old.GuestIds, ct);
        await store.MoveAsync(c.Booking.BookingId, old.Id, to.Day, to.Time!, ct);
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "purchase", $"{t.Title}: day {old.Day}, {old.Time} moved to day {to.Day}, {to.Time}", c.Now, ct);
        return await ViewOfAsync(c, ct);
    }

    /// <summary>Changes who is in an appointment and the note to the therapist. A guest may not be added if they are busy at that time.</summary>
    public async Task<SpaViewDto> UpdateAsync(UserRecord actor, string? number, Guid id, SpaUpdateRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        RequireOpen(c);
        var old = await FindAsync(c, id, ct);
        if (body is null || (body.Guests is null && body.Note is null)) throw ApiException.Invalid("update");
        if (Past(c, old.Day, old.Time)) throw ApiException.Conflict("closed");
        var t = TreatmentIn(c, old.TreatmentId);
        var ids = old.GuestIds;
        if (body.Guests is not null)
        {
            var who = c.GuestsIn(body.Guests);
            RequireGuests(t, who);
            ids = [.. who.Select(g => g.UserId)];
            await RequireFreeAsync(c, old.Id, old.Day, old.Time, old.Minutes, ids, ct);
        }
        await store.UpdateAsync(c.Booking.BookingId, old.Id, ids, body.Note is null ? old.Note : Str(body.Note, SpaRules.MaxNote), ct);
        return await ViewOfAsync(c, ct);
    }

    /// <summary>Cancels an appointment. Within the free window it costs nothing; later the policy's share of the price is kept (the app shows this before asking).</summary>
    public async Task<SpaViewDto> CancelAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var old = await FindAsync(c, id, ct);
        if (Past(c, old.Day, old.Time)) throw ApiException.Conflict("closed");
        var terms = SpaRules.CancelTerms(StartAt(c, old.Day, old.Time), TripRules.ToMs(c.Now), old.PriceCents * old.GuestIds.Count);
        await store.CancelAsync(c.Booking.BookingId, old.Id, terms.Fee, ct);
        var title = ShipOf(c).TreatmentList.FirstOrDefault(t => t.Id == old.TreatmentId)?.Title ?? old.TreatmentId;
        await accounts.AddHistoryAsync(actor.Id, actor.Id, "purchase", $"{title}, day {old.Day}: cancelled", c.Now, ct);
        return await ViewOfAsync(c, ct);
    }
}
