using Dapper;
using Princess.Api.Domain;

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
