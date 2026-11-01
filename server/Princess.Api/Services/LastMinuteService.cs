using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Last-minute shore tours on the day the ship is in port (POR-05). Ports <c>lastMinute</c> of <c>src/api/aboardMock.ts</c>.
/// A tour can be booked until two hours before it leaves; the charge goes on the onboard account (the tour is stored with <c>Source = onboard</c>), so the cart and card of the pre-cruise screens are not used.
/// </summary>
public sealed class LastMinuteService(ScopeLoader scopes, IAboardStore store, IPlanStore plan)
{
    private static (string Port, int Day, DateOnly Date)? InPort(Scope c)
    {
        if (!Shipboard.IsAboard(c)) return null;
        var (port, day) = Itinerary.PortAt(c.Departure, c.Now);
        if (day is not { } d || port is "sea" or "fll") return null;
        return (port, d, Itinerary.Days(c.Departure)[d - 1].Date);
    }

    private async Task<LastMinuteViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var guests = c.Party.Select(p => new LastMinuteGuestDto(p.Id, p.Name, p.Age)).ToList();
        if (InPort(c) is not { } here) return new LastMinuteViewDto(null, [], guests);
        var mine = (await plan.ListToursAsync(c.Booking.BookingId, ct)).Where(t => t.Status == "booked").Select(t => t.ExcursionId).ToHashSet();
        var zone = Itinerary.Ports[here.Port].Zone;
        var tours = new List<LastMinuteTourDto>();
        foreach (var x in ExcursionRules.Catalogue.Where(x => x.Port == here.Port))
        {
            var leaves = Itinerary.LocalToUtc(here.Date, TimeOnly.Parse(x.Start), zone);
            var left = ExcursionRules.SpotsLeft(x, c.Booking.SailingId, await plan.CountTourGuestsAsync(c.Booking.SailingId, x.Id, null, ct));
            var closed = mine.Contains(x.Id) ? "booked" : left <= 0 ? "soldOut" : c.Now >= leaves ? "started" : leaves - c.Now < TimeSpan.FromMinutes(ServiceRules.LastMinuteLeadMin) ? "tooLate" : null;
            tours.Add(new LastMinuteTourDto(x.Id, x.Start, Shipboard.Ms(leaves), left, x.Price, closed));
        }
        return new LastMinuteViewDto(here.Port, tours, guests);
    }

    public async Task<LastMinuteViewDto> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<LastMinuteViewDto> BookAsync(UserRecord actor, string? number, string excursionId, BookLastMinuteRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var x = ExcursionRules.ById(excursionId) ?? throw ApiException.Invalid("badTour");
        var people = c.GuestsIn(body?.Guests);
        var view = await ViewAsync(c, ct);
        var row = view.Tours.FirstOrDefault(t => t.ExcursionId == x.Id) ?? throw ApiException.Conflict("closed");
        if (row.Closed == "booked") throw ApiException.Conflict("duplicate");
        if (row.Closed is { } closed) throw ApiException.Conflict(closed);
        if (people.Any(p => p.Age < ExcursionRules.MinAge(x)) || !people.Any(p => p.Age >= 18)) throw ApiException.Conflict("age");
        if (row.Left < people.Count) throw ApiException.Conflict("soldOut");
        var total = people.Sum(p => ExcursionRules.GuestPrice(x, p.Age));
        var day = InPort(c)!.Value.Day;
        var folio = new FolioWrite(people[0].UserId, Shipboard.DayAt(c, c.Now), "excursions", $"{x.Name} (booked on board)", total, null, c.Now);
        await store.BookLastMinuteAsync(c.Booking.BookingId, new NewTour(x.Id, day, [.. people.Select(p => p.UserId)], total, 0), [folio], c.Now, ct);
        return await ViewAsync(c, ct);
    }
}
