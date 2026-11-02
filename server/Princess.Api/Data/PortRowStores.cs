namespace Princess.Api.Data;

/// <summary>One row of a booking's port-day record. <c>At</c> is the device's clock in ms and decides a clash; a deleted row keeps its place (and <c>Json</c> is null) so other devices learn of the delete.</summary>
public sealed record PortRowRow(string Kind, string Key, string? Json, long At, bool Deleted);

/// <summary>The port day's shared record as rows (multi-device plan 2, Phase 6): presence, the day's plan, meeting places and the split ledger.</summary>
public interface IPortRowStore
{
    /// <summary>Every row of the booking, deleted ones included.</summary>
    Task<List<PortRowRow>> ListAsync(long bookingId, CancellationToken ct);

    /// <summary>Applies each change whose <c>At</c> is later than the stored row's (a tie keeps the stored row), or adds it when there is none. All or nothing.</summary>
    Task ApplyAsync(long bookingId, IReadOnlyList<PortRowRow> ops, DateTime now, CancellationToken ct);

    /// <summary>Removes deleted rows older than <paramref name="beforeAt"/> (ms); returns how many.</summary>
    Task<int> PurgeAsync(long bookingId, long beforeAt, CancellationToken ct);
}
