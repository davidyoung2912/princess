using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The spa appointments in memory, over the same bookings as the Phase 6 world so rooms are shared across bookings on a sailing.</summary>
public sealed class InMemorySpaStore(InMemoryJourney world) : ISpaStore
{
    public List<(long BookingId, SpaRow Row, string Status)> Rows { get; } = [];
    private long _next = 7000;

    private string SailingOf(long bookingId) => world.Bookings.First(b => b.BookingId == bookingId).SailingId;

    public Task<List<SpaRow>> ListAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Rows.Where(r => r.BookingId == bookingId && r.Status == "booked").Select(r => r.Row).OrderBy(r => r.Day).ThenBy(r => r.Time, StringComparer.Ordinal).ToList());

    public Task<int> CountAsync(string sailingId, string treatmentId, int day, string time, long? exceptId, CancellationToken ct) =>
        Task.FromResult(Rows.Count(r => SailingOf(r.BookingId) == sailingId && r.Status == "booked" && r.Row.TreatmentId == treatmentId && r.Row.Day == day && r.Row.Time == time && r.Row.Id != exceptId));

    public Task<SpaRow> AddAsync(long bookingId, NewSpa n, CancellationToken ct)
    {
        var row = new SpaRow { Id = _next++, PublicId = Guid.NewGuid(), VenueId = n.VenueId, TreatmentId = n.TreatmentId, Day = n.Day, Time = n.Time, Minutes = n.Minutes, PriceCents = n.PriceCents, Note = n.Note, At = n.At, GuestIds = [.. n.GuestIds] };
        Rows.Add((bookingId, row, "booked"));
        return Task.FromResult(row);
    }

    public Task MoveAsync(long bookingId, long id, int day, string time, CancellationToken ct)
    {
        var r = Rows.First(x => x.BookingId == bookingId && x.Row.Id == id).Row;
        r.Day = day;
        r.Time = time;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(long bookingId, long id, List<long> guestIds, string note, CancellationToken ct)
    {
        var r = Rows.First(x => x.BookingId == bookingId && x.Row.Id == id).Row;
        r.GuestIds = [.. guestIds];
        r.Note = note;
        return Task.CompletedTask;
    }

    public Task CancelAsync(long bookingId, long id, long feeCents, CancellationToken ct)
    {
        var i = Rows.FindIndex(x => x.BookingId == bookingId && x.Row.Id == id);
        Rows[i] = (Rows[i].BookingId, Rows[i].Row, "cancelled");
        return Task.CompletedTask;
    }
}
