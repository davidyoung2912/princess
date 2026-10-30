using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Virtual queues for walk-in places, waitlists for full tables, and tickets for shows. Ports the <c>waits</c> and <c>shows</c> groups of <c>src/api/careMock.ts</c>.
/// Reads are open to any guest on the booking; writes need an adult guest. A waitlisted table is booked through <see cref="PlanService.ReserveFromWaitlistAsync"/>,
/// the same reservation <c>dining.reserve</c> makes, so the booking window, fixed seating, clash, entitlement and charge rules are not copied.
/// </summary>
public sealed class WaitService(ScopeLoader scopes, IAheadStore store, IPlanStore plan, PlanService planService)
{
    private static long Ms(DateTime utc) => TripRules.ToMs(utc);
    private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);

    private static bool DiningOpen(Scope c) => c.Confirmed && c.Today <= c.Departure.AddDays(Pricing.Nights);

    private static DateTime SlotAt(Scope c, int day, string time)
    {
        var date = c.Departure.AddDays(day - 1);
        return Itinerary.LocalToUtc(date, TimeOnly.ParseExact(time, "HH:mm"), Itinerary.ShipZoneOnDate(c.Departure, date));
    }

    // ---- Queues and waitlists (DIN-02) ----

    private static List<string> OpenNow(Scope c)
    {
        if (!Itinerary.Aboard(c.Departure, c.Now)) return [];
        var sea = Itinerary.AtSea(c.Departure, c.Now);
        var time = Itinerary.LocalAt(c.Now, Itinerary.ShipZoneAt(c.Departure, c.Now)).Time.ToString("HH:mm");
        return [.. WaitRules.Venues.Where(v => WaitRules.OpenAt(v, sea, time)).Select(v => v.Id)];
    }

    private async Task<WaitsViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var nowMs = Ms(c.Now);
        // A table the guest asked to have booked is booked the moment it is offered (PRE-14). If it cannot be booked they keep the offer and can take it by hand.
        foreach (var w in (await store.ListWaitlistAsync(c.Booking.BookingId, ct)).Where(w => w.Stage == "waiting" && w.Auto))
        {
            if (WaitRules.WaitlistAt(Ms(Utc(w.JoinedAt)), Ms(SlotAt(c, w.Day, w.Time)), nowMs, w.Start).Stage != "offered") continue;
            try
            {
                await planService.ReserveFromWaitlistAsync(c.Actor, c.Booking.Number, new ReserveRequest(w.VenueId, w.Day, w.Time, c.Ids(w.GuestIds), "Booked automatically from the waitlist"), ct);
                await store.MarkWaitlistBookedAsync(c.Booking.BookingId, w.Id, true, c.Now, ct);
            }
            catch (ApiException)
            {
            }
        }
        var queues = (await store.ListQueuesAsync(c.Booking.BookingId, ct)).Select(q =>
        {
            var joined = Ms(Utc(q.JoinedAt));
            var s = WaitRules.QueueAt(joined, q.Start, nowMs);
            return new QueueDto(q.PublicId, q.VenueId, joined, s.Stage, s.Position, s.WaitMinutes, s.ReadyAt, s.ExpiresAt);
        }).OrderBy(q => q.JoinedAt).ToList();
        var all = await store.ListWaitlistAsync(c.Booking.BookingId, ct);
        var waitlist = all.Where(w => w.Stage != "booked").Select(w =>
        {
            var slot = Ms(SlotAt(c, w.Day, w.Time));
            var s = WaitRules.WaitlistAt(Ms(Utc(w.JoinedAt)), slot, nowMs, w.Start);
            return new WaitlistDto(w.PublicId, w.VenueId, w.Day, w.Time, slot, c.Named(w.GuestIds), s.Stage, s.Position, s.OfferAt, s.ExpiresAt, w.Auto);
        }).OrderBy(w => w.SlotAt).ToList();
        var autoBooked = all.Where(w => w is { Stage: "booked", Auto: true }).Select(w => new AutoBookedDto(w.PublicId, w.VenueId, w.Day, w.Time)).ToList();
        return new WaitsViewDto(OpenNow(c), queues, waitlist, autoBooked);
    }

    public async Task<WaitsViewDto> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, false, ct), ct);

    public async Task<WaitsViewDto> JoinQueueAsync(UserRecord actor, string? number, JoinQueueRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var venue = WaitRules.VenueById(body?.VenueId) ?? throw ApiException.Invalid("venue");
        if (!c.Confirmed || !OpenNow(c).Contains(venue.Id)) throw ApiException.Conflict("closed");
        var nowMs = Ms(c.Now);
        var mine = (await store.ListQueuesAsync(c.Booking.BookingId, ct)).Where(q => q.VenueId == venue.Id).ToList();
        if (mine.Any(q => WaitRules.QueueAt(Ms(Utc(q.JoinedAt)), q.Start, nowMs).Stage != "expired")) throw ApiException.Conflict("duplicate");
        foreach (var old in mine) await store.DeleteQueueAsync(c.Booking.BookingId, old.Id, ct);
        await store.AddQueueAsync(c.Booking.BookingId, venue.Id, WaitRules.StartingPosition(venue.Id, nowMs), c.Now, ct);
        return await ViewAsync(c, ct);
    }

    public async Task<WaitsViewDto> LeaveQueueAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var q = (await store.ListQueuesAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id) ?? throw ApiException.NotFound();
        await store.DeleteQueueAsync(c.Booking.BookingId, q.Id, ct);
        return await ViewAsync(c, ct);
    }

    public async Task<WaitsViewDto> JoinWaitlistAsync(UserRecord actor, string? number, JoinWaitlistRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var v = DiningRules.VenueById(body?.VenueId);
        if (v is null || v.WalkIn || !DiningRules.DinnerDays.Contains(body!.Day) || body.Time is null || !DiningRules.DinnerTimes.Contains(body.Time)) throw ApiException.Invalid("venue");
        var who = c.GuestsIn(body.Guests);
        if (who.Count > DiningRules.MaxParty) throw ApiException.Invalid("partySize");
        if (!DiningOpen(c)) throw ApiException.Conflict("closed");
        var grid = DiningRules.SlotsFor(v.Id, c.Booking.SailingId, body.Day).First(s => s.Time == body.Time);
        if (grid.Tables - await plan.CountTablesAsync(c.Booking.SailingId, v.Id, body.Day, body.Time, null, ct) > 0) throw ApiException.Conflict("notFull");
        if (!WaitRules.CanJoinWaitlist(Ms(SlotAt(c, body.Day, body.Time)), Ms(c.Now))) throw ApiException.Conflict("tooLate");
        var have = (await store.ListWaitlistAsync(c.Booking.BookingId, ct)).Where(w => w.Stage != "booked").ToList();
        if (have.Any(w => w.VenueId == v.Id && w.Day == body.Day && w.Time == body.Time)) throw ApiException.Conflict("duplicate");
        var ids = who.Select(g => g.Id).ToList();
        var reserved = (await plan.ListTablesAsync(c.Booking.BookingId, ct)).Select(t => new ReservedTable(t.VenueId, t.Day, t.Time, c.Ids(t.GuestIds))).ToList();
        if (DiningRules.TableClash(reserved, body.Day, body.Time, ids).Count > 0) throw ApiException.Conflict("clash");
        await store.AddWaitlistAsync(c.Booking.BookingId, v.Id, body.Day, body.Time, [.. who.Select(g => g.UserId)], WaitRules.WaitlistStart(Ms(c.Now)), body.Auto, c.Now, ct);
        return await ViewAsync(c, ct);
    }

    public async Task<WaitsViewDto> LeaveWaitlistAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var w = (await store.ListWaitlistAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id && x.Stage != "booked") ?? throw ApiException.NotFound();
        await store.DeleteWaitlistAsync(c.Booking.BookingId, w.Id, ct);
        return await ViewAsync(c, ct);
    }

    /// <summary>Takes an offered table. The reservation itself is <c>dining.reserve</c>'s, so its refusals (<c>notOpen</c>, <c>fixedSeating</c>, <c>clash</c>, <c>age</c>, <c>closed</c>) come back unchanged.</summary>
    public async Task<DiningViewDto> AcceptAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var w = (await store.ListWaitlistAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id && x.Stage != "booked") ?? throw ApiException.NotFound();
        var state = WaitRules.WaitlistAt(Ms(Utc(w.JoinedAt)), Ms(SlotAt(c, w.Day, w.Time)), Ms(c.Now), w.Start);
        if (state.Stage == "waiting") throw ApiException.Conflict("notOffered");
        if (state.Stage == "expired") throw ApiException.Conflict("expired");
        var view = await planService.ReserveFromWaitlistAsync(actor, number, new ReserveRequest(w.VenueId, w.Day, w.Time, c.Ids(w.GuestIds), "From the waitlist"), ct);
        await store.MarkWaitlistBookedAsync(c.Booking.BookingId, w.Id, false, c.Now, ct);
        return view;
    }

    // ---- Shows (ENT-01) ----

    /// <summary>Seats can be reserved before sailing too (PRE-04), and on board until the last morning.</summary>
    private static void RequireShowsOpen(Scope c)
    {
        if (!c.Confirmed || c.Now >= Itinerary.LocalToUtc(c.Departure.AddDays(7), new TimeOnly(6, 0), Itinerary.ShipHomeZone)) throw ApiException.Conflict("closed");
    }

    public async Task<List<ShowSeatsDto>> SeatsAsync(UserRecord actor, string? number, int day, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, false, ct);
        if (day is < 1 or > 8) throw ApiException.Invalid("day");
        var list = new List<ShowSeatsDto>();
        foreach (var e in ShowRules.On(c.Departure, day))
            list.Add(new ShowSeatsDto(e.Id, ShowRules.SeatsLeft(e.Id, day, await store.CountSeatsAsync(c.Booking.SailingId, e.Id, day, ct))));
        return list;
    }

    private async Task<List<ShowTicketDto>> TicketsViewAsync(Scope c, CancellationToken ct)
    {
        var list = new List<(DateTime Start, ShowTicketDto Dto)>();
        foreach (var t in await store.ListTicketsAsync(c.Booking.BookingId, ct))
        {
            var e = ShowRules.Find(c.Departure, t.EventId, t.Day);
            if (e is null) continue;
            list.Add((e.StartAt, new ShowTicketDto(t.PublicId, e.Id, e.Title, e.Day, Ms(e.StartAt), e.PlaceId, "on", c.Named(t.GuestIds), ShowRules.CanReturn(e, c.Now))));
        }
        return [.. list.OrderBy(x => x.Start).Select(x => x.Dto)];
    }

    public async Task<List<ShowTicketDto>> TicketsAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await TicketsViewAsync(await scopes.LoadAsync(actor, number, false, ct), ct);

    public async Task<List<ShowTicketDto>> ReserveTicketsAsync(UserRecord actor, string? number, ReserveTicketsRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        RequireShowsOpen(c);
        if (body is null || !ShowRules.Exists(body.EventId) || body.Day is < 1 or > 8) throw ApiException.Invalid("show");
        var who = c.GuestsIn(body.Guests);
        var e = ShowRules.Find(c.Departure, body.EventId!, body.Day) ?? throw ApiException.Invalid("day");
        var mine = (await store.ListTicketsAsync(c.Booking.BookingId, ct)).Where(t => t.EventId == e.Id && t.Day == body.Day).ToList();
        var problem = ShowRules.Problem(e, c.Now, [.. who.Select(g => (g.Id, g.Age))], [.. mine.SelectMany(t => c.Ids(t.GuestIds))]);
        if (problem is not null) throw ApiException.Conflict(problem);
        if (ShowRules.SeatsLeft(e.Id, body.Day, await store.CountSeatsAsync(c.Booking.SailingId, e.Id, body.Day, ct)) < who.Count) throw ApiException.Conflict("soldOut");
        await store.AddTicketAsync(c.Booking.BookingId, e.Id, body.Day, [.. who.Select(g => g.UserId)], c.Now, ct);
        return await TicketsViewAsync(c, ct);
    }

    public async Task<List<ShowTicketDto>> CancelTicketAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, true, ct);
        var t = (await store.ListTicketsAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id) ?? throw ApiException.NotFound();
        var e = ShowRules.Find(c.Departure, t.EventId, t.Day);
        if (e is not null && !ShowRules.CanReturn(e, c.Now)) throw ApiException.Conflict("started");
        await store.DeleteTicketAsync(c.Booking.BookingId, t.Id, ct);
        return await TicketsViewAsync(c, ct);
    }
}
