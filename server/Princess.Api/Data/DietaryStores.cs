using Dapper;

namespace Princess.Api.Data;

/// <summary>One guest's dietary request on one reservation.</summary>
public sealed class DietaryRequestRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long ReservationId { get; set; }
    public long UserId { get; set; }
    public string Kind { get; set; } = "";
    public string Note { get; set; } = "";
    /// <summary>When the guest agreed to follow the ship's allergy-confirmation process.</summary>
    public DateTime AcknowledgedAt { get; set; }
    public DateTime SentAt { get; set; }
}

/// <summary>Dietary requests attached to dining reservations (DIN-111, 119). One per guest per reservation; sending again replaces it and starts the review again.</summary>
public interface IDietaryStore
{
    Task<List<DietaryRequestRow>> ListAsync(IReadOnlyCollection<long> reservationIds, CancellationToken ct);
    Task SaveAsync(long bookingId, long reservationId, long userId, string kind, string note, DateTime acknowledgedAt, DateTime sentAt, CancellationToken ct);
    Task DeleteAsync(long bookingId, long reservationId, long userId, CancellationToken ct);
}

public sealed class DapperDietaryStore(IDbConnectionFactory db) : IDietaryStore
{
    public async Task<List<DietaryRequestRow>> ListAsync(IReadOnlyCollection<long> reservationIds, CancellationToken ct)
    {
        if (reservationIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<DietaryRequestRow>(Sql.Cmd(
            "SELECT Id, PublicId, ReservationId, UserId, Kind, Note, AcknowledgedAt, SentAt FROM dbo.DiningDietaryRequests WHERE ReservationId IN @reservationIds ORDER BY SentAt, Id", new { reservationIds }, null, ct))).ToList();
    }

    public async Task SaveAsync(long bookingId, long reservationId, long userId, string kind, string note, DateTime acknowledgedAt, DateTime sentAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.DiningDietaryRequests SET Kind = @kind, Note = @note, AcknowledgedAt = @acknowledgedAt, SentAt = @sentAt
            WHERE ReservationId = @reservationId AND UserId = @userId
            IF @@ROWCOUNT = 0
              INSERT INTO dbo.DiningDietaryRequests (ReservationId, BookingId, UserId, Kind, Note, AcknowledgedAt, SentAt)
              VALUES (@reservationId, @bookingId, @userId, @kind, @note, @acknowledgedAt, @sentAt)
            """, new { bookingId, reservationId, userId, kind, note, acknowledgedAt, sentAt }, null, ct));
    }

    public async Task DeleteAsync(long bookingId, long reservationId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.DiningDietaryRequests WHERE BookingId = @bookingId AND ReservationId = @reservationId AND UserId = @userId", new { bookingId, reservationId, userId }, null, ct));
    }
}
