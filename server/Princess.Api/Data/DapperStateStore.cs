using Dapper;
using Microsoft.Data.SqlClient;

namespace Princess.Api.Data;

public sealed class DapperStateStore(IDbConnectionFactory db) : IStateStore
{
    // Table and owner column come from these two constants only, never from input.
    private static (string Table, string Owner) Where(bool booking) => booking ? ("dbo.BookingState", "BookingId") : ("dbo.UserState", "UserId");

    public async Task<List<StateRow>> ListAsync(bool booking, long ownerId, CancellationToken ct)
    {
        var (t, o) = Where(booking);
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StateRow>(Sql.Cmd($"SELECT StateKey AS [Key], Version, Json, UpdatedAt FROM {t} WHERE {o} = @ownerId ORDER BY StateKey", new { ownerId }, null, ct))).ToList();
    }

    public async Task<StateRow?> GetAsync(bool booking, long ownerId, string key, CancellationToken ct)
    {
        var (t, o) = Where(booking);
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<StateRow>(Sql.Cmd($"SELECT StateKey AS [Key], Version, Json, UpdatedAt FROM {t} WHERE {o} = @ownerId AND StateKey = @key", new { ownerId, key }, null, ct));
    }

    public async Task<Dictionary<long, StateRow>> GetManyAsync(bool booking, IReadOnlyCollection<long> ownerIds, string key, CancellationToken ct)
    {
        if (ownerIds.Count == 0) return [];
        var (t, o) = Where(booking);
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long Owner, string Key, int Version, string Json, DateTime UpdatedAt)>(Sql.Cmd(
            $"SELECT {o} AS Owner, StateKey AS [Key], Version, Json, UpdatedAt FROM {t} WHERE {o} IN @ownerIds AND StateKey = @key", new { ownerIds = ownerIds.Distinct().ToArray(), key }, null, ct));
        return rows.ToDictionary(r => r.Owner, r => new StateRow(r.Key, r.Version, r.Json, r.UpdatedAt));
    }

    public async Task<StateRow?> SaveAsync(bool booking, long ownerId, string key, string json, int baseVersion, DateTime now, CancellationToken ct)
    {
        var (t, o) = Where(booking);
        await using var c = await db.OpenAsync(ct);
        // Rows start at version 1, so a base of 0 never matches the update and goes on to the insert.
        var n = await c.ExecuteAsync(Sql.Cmd($"UPDATE {t} SET Json = @json, Version = Version + 1, UpdatedAt = @now WHERE {o} = @ownerId AND StateKey = @key AND Version = @baseVersion",
            new { ownerId, key, json, baseVersion, now }, null, ct));
        if (n == 0 && baseVersion == 0)
        {
            try
            {
                n = await c.ExecuteAsync(Sql.Cmd($"INSERT INTO {t} ({o}, StateKey, Json, Version, UpdatedAt) VALUES (@ownerId, @key, @json, 1, @now)", new { ownerId, key, json, now }, null, ct));
            }
            catch (SqlException e) when (e.Number is 2627 or 2601)
            {
                n = 0;   // another device inserted first
            }
        }
        if (n == 0) return null;
        return await c.QuerySingleOrDefaultAsync<StateRow>(Sql.Cmd($"SELECT StateKey AS [Key], Version, Json, UpdatedAt FROM {t} WHERE {o} = @ownerId AND StateKey = @key", new { ownerId, key }, null, ct));
    }

    public async Task DeleteAsync(bool booking, long ownerId, string key, CancellationToken ct)
    {
        var (t, o) = Where(booking);
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd($"DELETE FROM {t} WHERE {o} = @ownerId AND StateKey = @key", new { ownerId, key }, null, ct));
    }

    public async Task<int> DeleteAllAsync(bool booking, long ownerId, CancellationToken ct)
    {
        var (t, o) = Where(booking);
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd($"DELETE FROM {t} WHERE {o} = @ownerId", new { ownerId }, null, ct));
    }
}
