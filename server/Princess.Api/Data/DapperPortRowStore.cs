using Dapper;

namespace Princess.Api.Data;

public sealed class DapperPortRowStore(IDbConnectionFactory db) : IPortRowStore
{
    public async Task<List<PortRowRow>> ListAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<PortRowRow>(Sql.Cmd(
            "SELECT Kind, RowKey AS [Key], Json, [At], Deleted FROM dbo.PortRows WHERE BookingId = @bookingId ORDER BY Kind, RowKey", new { bookingId }, null, ct))).ToList();
    }

    public async Task ApplyAsync(long bookingId, IReadOnlyList<PortRowRow> ops, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        foreach (var o in ops)
        {
            var args = new { bookingId, o.Kind, o.Key, o.Json, o.At, o.Deleted, now };
            var n = await c.ExecuteAsync(Sql.Cmd(
                "UPDATE dbo.PortRows SET Json = @Json, [At] = @At, Deleted = @Deleted, UpdatedAt = @now WHERE BookingId = @bookingId AND Kind = @Kind AND RowKey = @Key AND [At] < @At", args, tx, ct));
            if (n > 0) continue;
            // No row, or a newer one: add only when there is none (the lock stops two devices adding the same row at once).
            await c.ExecuteAsync(Sql.Cmd("""
                IF NOT EXISTS (SELECT 1 FROM dbo.PortRows WITH (UPDLOCK, HOLDLOCK) WHERE BookingId = @bookingId AND Kind = @Kind AND RowKey = @Key)
                  INSERT INTO dbo.PortRows (BookingId, Kind, RowKey, Json, [At], Deleted, CreatedAt, UpdatedAt) VALUES (@bookingId, @Kind, @Key, @Json, @At, @Deleted, @now, @now)
                """, args, tx, ct));
        }
        await tx.CommitAsync(ct);
    }

    public async Task<int> PurgeAsync(long bookingId, long beforeAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.PortRows WHERE BookingId = @bookingId AND Deleted = 1 AND [At] < @beforeAt", new { bookingId, beforeAt }, null, ct));
    }
}
