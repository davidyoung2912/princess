using Dapper;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Data;

public sealed class DapperStaffTicketStore(IDbConnectionFactory db) : IStaffTicketStore
{
    public async Task AddAsync(long userId, StaffTicketDto t, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.StaffTickets (PublicId, UserId, Kind, Reason, RequestedAtMs, Position, ReadyAtMs, Source) VALUES (@Id, @userId, @Kind, @Reason, @At, @Position, @ReadyAt, @Source)",
            new { t.Id, userId, t.Kind, t.Reason, t.At, t.Position, t.ReadyAt, t.Source }, null, ct));
    }

    public async Task<List<StaffTicketDto>> ListAsync(long userId, long sinceMs, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StaffTicketDto>(Sql.Cmd("SELECT PublicId AS Id, Kind, Reason, RequestedAtMs AS [At], Position, ReadyAtMs AS ReadyAt, Source FROM dbo.StaffTickets WHERE UserId = @userId AND CancelledAt IS NULL AND RequestedAtMs >= @sinceMs ORDER BY RequestedAtMs DESC",
            new { userId, sinceMs }, null, ct))).ToList();
    }

    public async Task<bool> CancelAsync(long userId, Guid id, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.StaffTickets SET CancelledAt = @now WHERE PublicId = @id AND UserId = @userId AND CancelledAt IS NULL", new { id, userId, now }, null, ct)) > 0;
    }
}

/// <summary>The hourly concierge limit kept in <c>dbo.ConciergeUses</c>, so it survives restarts and is shared by every instance.</summary>
public sealed class DapperConciergeLimiter(IDbConnectionFactory db) : IConciergeLimiter
{
    public async Task<bool> TryTakeAsync(long userId, DateTime now, int limit, CancellationToken ct)
    {
        var since = now.AddHours(-1);
        await using var c = await db.OpenAsync(ct);
        // One batch: forget what is over an hour old, then record this question only if the person is under the limit (the lock hint stops two instances both slipping in).
        var taken = await c.QuerySingleAsync<int>(Sql.Cmd(
            "DELETE FROM dbo.ConciergeUses WHERE UserId = @userId AND UsedAt <= @since; " +
            "INSERT INTO dbo.ConciergeUses (UserId, UsedAt) SELECT @userId, @now WHERE (SELECT COUNT(*) FROM dbo.ConciergeUses WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @userId) < @limit; SELECT @@ROWCOUNT",
            new { userId, since, now, limit }, null, ct));
        return taken > 0;
    }
}
