using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What the push check needs from the dining, spa and galley sides: the guest's tables and appointments, tables on offer from a waitlist, and their own orders on the move.</summary>
public sealed record DiningFeedData(IReadOnlyList<BookedSlot> Booked, IReadOnlyList<WaitlistReady> Waitlist, IReadOnlyList<OrderUpdate> Orders)
{
    public static readonly DiningFeedData Empty = new([], [], []);
}

/// <summary>
/// Where the push check reads the dining reminders from (DIN-245..251). A real galley or waitlist system replaces <see cref="DiningFeed"/> behind this interface with no change to the rules or the push service.
/// </summary>
public interface IDiningFeed
{
    Task<DiningFeedData> ReadAsync(UserRecord actor, BookingRow booking, CancellationToken ct);
}

/// <summary>
/// The simulated feed: tables and appointments come from the guest's own bookings, a waitlist offer and an order's stage come from the ship's clock rules (<see cref="WaitRules"/>, <see cref="OrderRules"/>),
/// the same ones the Dining and Order screens use, so the phone and the screen always agree.
/// </summary>
public sealed class DiningFeed(ScopeLoader scopes, IPlanStore plan, ISpaStore spa, IShipboardStore shipboard, WaitService waits, OrderService orders) : IDiningFeed
{
    /// <summary>A booking this far ahead or less is read; a reminder lead is at most an hour.</summary>
    private static readonly TimeSpan Horizon = TimeSpan.FromHours(3);

    /// <summary>An order that arrived this long ago or less is still worth saying so.</summary>
    private static readonly TimeSpan DeliveredFor = TimeSpan.FromMinutes(30);

    public async Task<DiningFeedData> ReadAsync(UserRecord actor, BookingRow booking, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, booking.Number, write: false, ct);
        if (!c.Confirmed || c.Today > c.LastDay) return DiningFeedData.Empty;
        var now = c.Now;
        var ship = AboardPlans.ShipOfSailing(booking.SailingId);
        DateTime StartOf(int day, string time)
        {
            var date = c.Departure.AddDays(day - 1);
            return Itinerary.LocalToUtc(date, TimeOnly.ParseExact(time, "HH:mm"), c.Timeline.ShipZoneOnDate(date));
        }
        bool Soon(DateTime start) => start > now && start - now <= Horizon;

        var booked = new List<BookedSlot>();
        foreach (var t in await plan.ListTablesAsync(booking.BookingId, ct))
        {
            var start = StartOf(t.Day, t.Time);
            if (!t.GuestIds.Contains(actor.Id) || !Soon(start)) continue;
            var venue = DiningRules.VenueById(t.VenueId);
            booked.Add(new($"dining:{t.PublicId}", "dining", "Your table", venue?.Name ?? "the restaurant", "/dining-today", TripRules.ToMs(start)));
        }
        foreach (var s in await spa.ListAsync(booking.BookingId, ct))
        {
            var start = StartOf(s.Day, s.Time);
            if (!s.GuestIds.Contains(actor.Id) || !Soon(start)) continue;
            var venue = ExplorerCatalogue.VenueOn(ship, s.VenueId);
            booked.Add(new($"spa:{s.PublicId}", "spa", ExplorerCatalogue.TreatmentOn(ship, s.TreatmentId)?.Title ?? "Your appointment", venue?.Title ?? "the spa",
                venue is null ? "/spa-explorer" : ExplorerCatalogue.VenuePath(venue), TripRules.ToMs(start)));
        }

        var offers = (await waits.ListAsync(actor, booking.Number, ct)).Waitlist.Where(w => w.Stage == "offered")
            .Select(w => new WaitlistReady(w.Id.ToString(), DiningRules.VenueById(w.VenueId)?.Name ?? "the restaurant", w.ExpiresAt)).ToList();

        var mine = (await shipboard.ListOrdersAsync(booking.BookingId, ct)).Where(o => o.PlacedByUserId == actor.Id).Select(o => o.PublicId).ToHashSet();
        var moving = mine.Count == 0 ? [] : (await orders.ListAsync(actor, booking.Number, ct)).Where(o => mine.Contains(o.Id) && (o.Stage == "onTheWay" || (o.Stage == "delivered" && o.EtaAt is { } eta && now - Shipboard.FromMs(eta) <= DeliveredFor)))
            .Select(o => new OrderUpdate(o.Id.ToString(), o.Stage)).ToList();
        return new(booked, offers, moving);
    }
}
