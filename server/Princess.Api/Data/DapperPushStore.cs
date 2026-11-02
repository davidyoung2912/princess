using Dapper;

namespace Princess.Api.Data;

public sealed class DapperPushStore(IDbConnectionFactory db) : IPushStore
{
    private sealed record DeliveryDb(string NoticeKey, string Kind, bool Bypass, string Outcome, string? Reason, int Devices, string Params, DateTime At, DateTime? ReadAt);

    public async Task<List<PushSubscriptionRow>> ListSubscriptionsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<PushSubscriptionRow>(Sql.Cmd(
            "SELECT Endpoint, P256dh, Auth, CAST(Budget AS INT) AS Budget, Calm, Watch FROM dbo.PushSubscriptions WHERE UserId = @userId ORDER BY Id", new { userId }, null, ct))).ToList();
    }

    public async Task<bool> SaveSubscriptionAsync(long userId, PushSubscriptionRow row, int maxDevices, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var updated = await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.PushSubscriptions SET P256dh = @P256dh, Auth = @Auth, Budget = @Budget, Calm = @Calm, Watch = @Watch, UpdatedAt = @now
            WHERE UserId = @userId AND Endpoint = @Endpoint
            """, new { userId, row.Endpoint, row.P256dh, row.Auth, row.Budget, row.Calm, row.Watch, now }, null, ct));
        if (updated > 0) return true;
        if (await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.PushSubscriptions WHERE UserId = @userId", new { userId }, null, ct)) >= maxDevices) return false;
        // The same phone address under another person (a shared phone) moves to this one.
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.PushSubscriptions WHERE Endpoint = @Endpoint", new { row.Endpoint }, null, ct));
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.PushSubscriptions (UserId, Endpoint, P256dh, Auth, Budget, Calm, Watch, CreatedAt, UpdatedAt)
            VALUES (@userId, @Endpoint, @P256dh, @Auth, @Budget, @Calm, @Watch, @now, @now)
            """, new { userId, row.Endpoint, row.P256dh, row.Auth, row.Budget, row.Calm, row.Watch, now }, null, ct));
        return true;
    }

    public async Task RemoveSubscriptionAsync(long userId, string endpoint, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.PushSubscriptions WHERE UserId = @userId AND Endpoint = @endpoint", new { userId, endpoint }, null, ct));
    }

    public async Task RemoveEndpointAsync(string endpoint, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.PushSubscriptions WHERE Endpoint = @endpoint", new { endpoint }, null, ct));
    }

    public async Task<List<PushDeliveryRow>> ListDeliveriesAsync(long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<DeliveryDb>(Sql.Cmd("""
            SELECT TOP (@max) NoticeKey, Kind, Bypass, Outcome, Reason, CAST(Devices AS INT) AS Devices, Params, [At], ReadAt
            FROM dbo.PushDeliveries WHERE UserId = @userId ORDER BY [At] DESC, Id DESC
            """, new { userId, max }, null, ct));
        return [.. rows.Select(r => new PushDeliveryRow(r.NoticeKey, r.Kind, r.Bypass, r.Outcome, r.Reason, r.Devices, r.Params, r.At, r.ReadAt is not null))];
    }

    public async Task AddDeliveryAsync(long userId, PushDeliveryRow row, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.PushDeliveries (UserId, NoticeKey, Kind, Bypass, Outcome, Reason, Devices, Params, [At])
            VALUES (@userId, @NoticeKey, @Kind, @Bypass, @Outcome, @Reason, @Devices, @ParamsJson, @now)
            """, new { userId, row.NoticeKey, row.Kind, row.Bypass, row.Outcome, row.Reason, row.Devices, row.ParamsJson, now }, null, ct));
        // Keep the log short: the newest 200 per person.
        await c.ExecuteAsync(Sql.Cmd("""
            DELETE FROM dbo.PushDeliveries WHERE UserId = @userId AND Id NOT IN (SELECT TOP (200) Id FROM dbo.PushDeliveries WHERE UserId = @userId ORDER BY [At] DESC, Id DESC)
            """, new { userId }, null, ct));
    }

    public async Task MarkDeliveriesReadAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.PushDeliveries SET ReadAt = @now WHERE UserId = @userId AND ReadAt IS NULL AND Outcome = 'sent'", new { userId, now }, null, ct));
    }

    public async Task<string?> GetFeedHashAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<string>(Sql.Cmd("SELECT TokenHash FROM dbo.CalendarFeeds WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task SaveFeedHashAsync(long userId, string hash, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.CalendarFeeds SET TokenHash = @hash, CreatedAt = @now WHERE UserId = @userId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.CalendarFeeds (UserId, TokenHash, CreatedAt) VALUES (@userId, @hash, @now);
            """, new { userId, hash, now }, null, ct));
    }

    public async Task DeleteFeedAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.CalendarFeeds WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task<long?> FindFeedUserAsync(string hash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<long?>(Sql.Cmd("SELECT UserId FROM dbo.CalendarFeeds WHERE TokenHash = @hash", new { hash }, null, ct));
    }
}
