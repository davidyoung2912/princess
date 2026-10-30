using Princess.Api.Data;
using Princess.Api.Services;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 8 store in memory, over the same bookings as the Phase 6 world so spots and tables are shared across bookings on a sailing.</summary>
public sealed class InMemoryPlanStore(InMemoryJourney world) : IPlanStore
{
    public List<(long BookingId, NewBookingPayment Payment)> Payments { get; } = [];
    public List<(long BookingId, TourRow Row)> Tours { get; } = [];
    public List<(long BookingId, CartLineRow Row)> Cart { get; } = [];
    public List<(long BookingId, TableRow Row, string Status)> Tables { get; } = [];
    public List<(long BookingId, PurchaseRow Row)> Purchases { get; } = [];
    public Dictionary<(long, string, string), bool> Ticks { get; } = [];
    public Dictionary<long, TravelRow> Travel { get; } = [];
    public List<(long BookingId, AssistRow Row, bool Cancelled)> Assists { get; } = [];
    private long _next = 9000;

    private string SailingOf(long bookingId) => world.Bookings.First(b => b.BookingId == bookingId).SailingId;

    private static List<string> MethodsOf(NewBookingPayment? p) =>
        p is null ? [] : [.. p.Parts.Select(x => x.Method == "wallet" ? "Device wallet" : $"{TripService.BrandName(x.CardBrand ?? "")} ending {x.Last4}")];

    private long Pay(long bookingId, NewBookingPayment? p)
    {
        if (p is not null) Payments.Add((bookingId, p));
        return p is null ? 0 : Payments.Count;
    }

    // ---- Excursions ----
    public Task<List<TourRow>> ListToursAsync(long bookingId, CancellationToken ct) => Task.FromResult(Tours.Where(t => t.BookingId == bookingId).Select(t => t.Row).OrderBy(t => t.At).ToList());

    public Task<int> CountTourGuestsAsync(string sailingId, string excursionId, long? exceptTourId, CancellationToken ct) =>
        Task.FromResult(Tours.Where(t => SailingOf(t.BookingId) == sailingId && t.Row.ExcursionId == excursionId && t.Row.Status == "booked" && t.Row.Id != exceptTourId).Sum(t => t.Row.GuestIds.Count));

    public Task<List<CartLineRow>> GetCartAsync(long bookingId, CancellationToken ct) => Task.FromResult(Cart.Where(c => c.BookingId == bookingId).Select(c => c.Row).ToList());

    public Task SetCartLineAsync(long bookingId, string excursionId, IReadOnlyList<long> guestIds, CancellationToken ct)
    {
        Cart.RemoveAll(c => c.BookingId == bookingId && c.Row.ExcursionId == excursionId);
        Cart.Add((bookingId, new CartLineRow { ExcursionId = excursionId, GuestIds = [.. guestIds] }));
        return Task.CompletedTask;
    }

    public Task RemoveCartLineAsync(long bookingId, string excursionId, CancellationToken ct)
    {
        Cart.RemoveAll(c => c.BookingId == bookingId && c.Row.ExcursionId == excursionId);
        return Task.CompletedTask;
    }

    public Task BookToursAsync(long bookingId, IReadOnlyList<NewTour> tours, NewBookingPayment? payment, DateTime at, CancellationToken ct)
    {
        Pay(bookingId, payment);
        foreach (var t in tours)
            Tours.Add((bookingId, new TourRow
            {
                Id = _next++, PublicId = Guid.NewGuid(), ExcursionId = t.ExcursionId, Day = t.Day, TotalCents = t.TotalCents, CreditCents = t.CreditCents, At = at.AddSeconds(Tours.Count),
                GuestIds = [.. t.GuestIds], Methods = MethodsOf(payment),
            }));
        Cart.RemoveAll(c => c.BookingId == bookingId);
        return Task.CompletedTask;
    }

    public Task ChangeTourAsync(long bookingId, TourChange change, NewBookingPayment? refund, CancellationToken ct)
    {
        var row = Tours.First(t => t.Row.Id == change.TourId).Row;
        row.GuestIds = [.. change.GuestIds];
        row.TotalCents = change.TotalCents;
        row.CreditCents = change.CreditCents;
        row.Status = change.Status;
        row.FeeCents = change.FeeCents;
        row.RefundCents = change.RefundCents;
        Pay(bookingId, refund);
        return Task.CompletedTask;
    }

    // ---- Dining ----
    public Task<List<TableRow>> ListTablesAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Tables.Where(t => t.BookingId == bookingId && t.Status == "booked").Select(t => t.Row).OrderBy(t => t.Day).ThenBy(t => t.Time, StringComparer.Ordinal).ToList());

    public Task<int> CountTablesAsync(string sailingId, string venueId, int day, string time, long? exceptTableId, CancellationToken ct) =>
        Task.FromResult(Tables.Count(t => SailingOf(t.BookingId) == sailingId && t.Status == "booked" && t.Row.VenueId == venueId && t.Row.Day == day && t.Row.Time == time && t.Row.Id != exceptTableId));

    public Task<TableRow> AddTableAsync(long bookingId, NewTable t, CancellationToken ct)
    {
        var row = new TableRow
        {
            Id = _next++, PublicId = Guid.NewGuid(), VenueId = t.VenueId, Day = t.Day, Time = t.Time, Note = t.Note, ChargeCents = t.ChargeCents, At = t.At,
            GuestIds = [.. t.GuestIds], CoveredIds = [.. t.CoveredIds],
        };
        Tables.Add((bookingId, row, "booked"));
        return Task.FromResult(row);
    }

    public Task MoveTableAsync(long bookingId, long tableId, int day, string time, CancellationToken ct)
    {
        var row = Tables.First(t => t.Row.Id == tableId).Row;
        row.Day = day;
        row.Time = time;
        row.LateMinutes = 0;
        return Task.CompletedTask;
    }

    public Task SetTableLateAsync(long bookingId, long tableId, int minutes, CancellationToken ct)
    {
        Tables.First(t => t.Row.Id == tableId).Row.LateMinutes = minutes;
        return Task.CompletedTask;
    }

    public Task CancelTableAsync(long bookingId, long tableId, CancellationToken ct)
    {
        var i = Tables.FindIndex(t => t.Row.Id == tableId);
        Tables[i] = Tables[i] with { Status = "cancelled" };
        return Task.CompletedTask;
    }

    // ---- Packages ----
    public Task<List<PurchaseRow>> ListPurchasesAsync(long bookingId, CancellationToken ct) => Task.FromResult(Purchases.Where(p => p.BookingId == bookingId).Select(p => p.Row).OrderBy(p => p.At).ToList());

    public Task AddPurchaseAsync(long bookingId, NewPurchase p, NewBookingPayment payment, CancellationToken ct)
    {
        Pay(bookingId, payment);
        Purchases.Add((bookingId, new PurchaseRow
        {
            Id = _next++, PublicId = Guid.NewGuid(), Kind = p.Kind, ItemId = p.ItemId, Units = p.Units, UnitCents = p.UnitCents, TotalCents = p.TotalCents, At = p.At,
            GuestIds = [.. p.GuestIds], Methods = MethodsOf(payment),
        }));
        return Task.CompletedTask;
    }

    public Task UpdatePurchaseAsync(long bookingId, long purchaseId, string status, long creditedCents, NewBookingPayment? refund, CancellationToken ct)
    {
        var row = Purchases.First(p => p.Row.Id == purchaseId).Row;
        row.Status = status;
        row.CreditedCents = creditedCents;
        Pay(bookingId, refund);
        return Task.CompletedTask;
    }

    // ---- Ticks, travel, assistance ----
    public Task<HashSet<string>> GetTicksAsync(long bookingId, string list, CancellationToken ct) =>
        Task.FromResult(Ticks.Where(t => t.Key.Item1 == bookingId && t.Key.Item2 == list && t.Value).Select(t => t.Key.Item3).ToHashSet());

    public Task SetTickAsync(long bookingId, string list, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        Ticks[(bookingId, list, itemId)] = done;
        return Task.CompletedTask;
    }

    public Task<TravelRow?> GetTravelAsync(long bookingId, CancellationToken ct) => Task.FromResult(Travel.GetValueOrDefault(bookingId));

    public Task SaveTravelAsync(long bookingId, TravelRow plan, CancellationToken ct)
    {
        Travel[bookingId] = plan;
        return Task.CompletedTask;
    }

    public Task<List<AssistRow>> ListAssistAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Assists.Where(a => a.BookingId == bookingId && !a.Cancelled).Select(a => a.Row).OrderByDescending(a => a.At).ToList());

    public Task<AssistRow> AddAssistAsync(long bookingId, long guestUserId, string kind, string note, DateTime at, CancellationToken ct)
    {
        var row = new AssistRow { Id = _next++, PublicId = Guid.NewGuid(), GuestUserId = guestUserId, Kind = kind, Note = note, At = at };
        Assists.Add((bookingId, row, false));
        return Task.FromResult(row);
    }

    public Task<bool> CancelAssistAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        var i = Assists.FindIndex(a => a.BookingId == bookingId && a.Row.PublicId == publicId && !a.Cancelled);
        if (i < 0) return Task.FromResult(false);
        Assists[i] = Assists[i] with { Cancelled = true };
        return Task.FromResult(true);
    }
}
