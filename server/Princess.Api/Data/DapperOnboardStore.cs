using Dapper;

namespace Princess.Api.Data;

/// <summary>The Phase 10 store over SQL Server.</summary>
public sealed class DapperOnboardStore(IDbConnectionFactory db) : IOnboardStore
{
    public async Task<List<PlanEventRow>> ListPlanAsync(long userId, string sailingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<PlanEventRow>(Sql.Cmd(
            "SELECT EventId, [Day] FROM dbo.PlanEvents WHERE UserId = @userId AND SailingId = @sailingId ORDER BY [Day], CreatedAt", new { userId, sailingId }, null, ct))).ToList();
    }

    public async Task SetPlanAsync(long userId, string sailingId, string eventId, int day, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(on
            ? """
              IF NOT EXISTS (SELECT 1 FROM dbo.PlanEvents WHERE UserId = @userId AND SailingId = @sailingId AND EventId = @eventId AND [Day] = @day)
                INSERT INTO dbo.PlanEvents (UserId, SailingId, EventId, [Day]) VALUES (@userId, @sailingId, @eventId, @day);
              """
            : "DELETE FROM dbo.PlanEvents WHERE UserId = @userId AND SailingId = @sailingId AND EventId = @eventId AND [Day] = @day",
            new { userId, sailingId, eventId, day }, null, ct));
    }

    public async Task<Dictionary<long, DateTime>> ListMusterAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<(long UserId, DateTime ConfirmedAt)>(Sql.Cmd(
            "SELECT UserId, ConfirmedAt FROM dbo.MusterConfirmations WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToDictionary(r => r.UserId, r => r.ConfirmedAt);
    }

    public async Task SaveMusterAsync(long bookingId, IReadOnlyList<long> userIds, long byUserId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        foreach (var userId in userIds)
        {
            await c.ExecuteAsync(Sql.Cmd("""
                IF NOT EXISTS (SELECT 1 FROM dbo.MusterConfirmations WHERE BookingId = @bookingId AND UserId = @userId)
                  INSERT INTO dbo.MusterConfirmations (BookingId, UserId, ConfirmedAt, ByUserId) VALUES (@bookingId, @userId, @at, @byUserId);
                """, new { bookingId, userId, at, byUserId }, tx, ct));
        }
        await tx.CommitAsync(ct);
    }

    public async Task<List<FolioRow>> ListFolioAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<FolioRow>(Sql.Cmd(
            "SELECT PublicId, UserId, [Day], Category, Description, Cents, CoveredBy, [At] FROM dbo.FolioLines WHERE BookingId = @bookingId ORDER BY [At], Id", new { bookingId }, null, ct))).ToList();
    }

    public async Task<List<ServiceThreadRow>> ListThreadsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var threads = (await c.QueryAsync<(long Id, string Channel, string? EscalatedPhone, DateTime? EscalatedAt)>(Sql.Cmd(
            "SELECT Id, Channel, EscalatedPhone, EscalatedAt FROM dbo.ServiceThreads WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToList();
        if (threads.Count == 0) return [];
        var ids = threads.Select(t => t.Id).ToArray();
        var messages = (await c.QueryAsync<(long Id, long ThreadId, string Text, DateTime At)>(Sql.Cmd(
            "SELECT Id, ThreadId, [Text], [At] FROM dbo.ServiceMessages WHERE ThreadId IN @ids AND FromRole = 'me' ORDER BY [At], Id", new { ids }, null, ct))).ToList();
        return [.. threads.Select(t => new ServiceThreadRow
        {
            Channel = t.Channel, EscalatedPhone = t.EscalatedPhone, EscalatedAt = t.EscalatedAt,
            Messages = [.. messages.Where(m => m.ThreadId == t.Id).Select(m => new ServiceMessageRow { Id = m.Id, Text = m.Text, At = m.At })],
        })];
    }

    private static async Task<long> ThreadIdAsync(System.Data.Common.DbConnection c, System.Data.Common.DbTransaction tx, long bookingId, string channel, CancellationToken ct) =>
        await c.ExecuteScalarAsync<long>(Sql.Cmd("""
            DECLARE @id BIGINT = (SELECT Id FROM dbo.ServiceThreads WHERE BookingId = @bookingId AND Channel = @channel);
            IF @id IS NULL
            BEGIN
              INSERT INTO dbo.ServiceThreads (BookingId, Channel) VALUES (@bookingId, @channel);
              SET @id = SCOPE_IDENTITY();
            END
            SELECT @id;
            """, new { bookingId, channel }, tx, ct));

    public async Task AddServiceMessageAsync(long bookingId, string channel, string text, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var threadId = await ThreadIdAsync(c, tx, bookingId, channel, ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ServiceMessages (ThreadId, FromRole, [Text], [At]) VALUES (@threadId, 'me', @text, @at)", new { threadId, text, at }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ServiceThreads SET UpdatedAt = SYSUTCDATETIME() WHERE Id = @threadId", new { threadId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task EscalateAsync(long bookingId, string channel, string phone, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var threadId = await ThreadIdAsync(c, tx, bookingId, channel, ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ServiceThreads SET EscalatedPhone = @phone, EscalatedAt = @at, UpdatedAt = SYSUTCDATETIME() WHERE Id = @threadId", new { threadId, phone, at }, tx, ct));
        await tx.CommitAsync(ct);
    }
}
