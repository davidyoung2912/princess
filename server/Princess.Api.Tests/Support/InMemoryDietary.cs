using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>An in-memory <see cref="IDietaryStore"/>: one request per guest per reservation.</summary>
public sealed class InMemoryDietaryStore : IDietaryStore
{
    private long _next;
    public List<DietaryRequestRow> Rows { get; } = [];

    public Task<List<DietaryRequestRow>> ListAsync(IReadOnlyCollection<long> reservationIds, CancellationToken ct) =>
        Task.FromResult(Rows.Where(r => reservationIds.Contains(r.ReservationId)).OrderBy(r => r.SentAt).ThenBy(r => r.Id).ToList());

    public Task SaveAsync(long bookingId, long reservationId, long userId, string kind, string note, DateTime acknowledgedAt, DateTime sentAt, CancellationToken ct)
    {
        Rows.RemoveAll(r => r.ReservationId == reservationId && r.UserId == userId);
        Rows.Add(new DietaryRequestRow { Id = ++_next, PublicId = Guid.NewGuid(), ReservationId = reservationId, UserId = userId, Kind = kind, Note = note, AcknowledgedAt = acknowledgedAt, SentAt = sentAt });
        return Task.CompletedTask;
    }

    public Task DeleteAsync(long bookingId, long reservationId, long userId, CancellationToken ct)
    {
        Rows.RemoveAll(r => r.ReservationId == reservationId && r.UserId == userId);
        return Task.CompletedTask;
    }
}
