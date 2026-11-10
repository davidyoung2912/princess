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

/// <summary>Stanley's model-call limit kept in <c>dbo.ConciergeUses</c> (one row per call), so it survives restarts and is shared by every instance.</summary>
public sealed class DapperConciergeLimiter(IDbConnectionFactory db) : IConciergeLimiter
{
    public Task<bool> TryTakeAsync(long userId, DateTime now, int limit, CancellationToken ct) => TryTakeAsync(userId, now, limit, TimeSpan.FromHours(1), ct);

    public async Task<bool> TryTakeAsync(long userId, DateTime now, int limit, TimeSpan window, CancellationToken ct)
    {
        var since = now - window;
        await using var c = await db.OpenAsync(ct);
        // One batch: forget what is older than the window, then record this call only if the person is under the limit (the lock hint stops two instances both slipping in).
        var taken = await c.QuerySingleAsync<int>(Sql.Cmd(
            "DELETE FROM dbo.ConciergeUses WHERE UserId = @userId AND UsedAt <= @since; " +
            "INSERT INTO dbo.ConciergeUses (UserId, UsedAt) SELECT @userId, @now WHERE (SELECT COUNT(*) FROM dbo.ConciergeUses WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @userId) < @limit; SELECT @@ROWCOUNT",
            new { userId, since, now, limit }, null, ct));
        return taken > 0;
    }
}

/// <summary>The gateway's tier log in <c>dbo.StanleyTierLog</c>: one row per reply, counts and token use only, never message text.</summary>
public sealed class DapperStanleyTierLog(IDbConnectionFactory db) : IStanleyTierLog
{
    public async Task RecordAsync(StanleyTierEntry e, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.StanleyTierLog (At, Tier, Source, Stage, Topic, Outcome, ModelTier, Calls, InputTokens, OutputTokens, CardId, Abstained) VALUES (@At, @Tier, @Source, @Stage, @Topic, @Outcome, @ModelTier, @Calls, @InputTokens, @OutputTokens, @CardId, @Abstained)",
            e, null, ct));
    }

    public async Task<StanleyTierSummary> SummaryAsync(DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<StanleyTierRow>(Sql.Cmd(
            "SELECT Tier, Source, Stage, Topic, Outcome, ModelTier, COUNT(*) AS Replies, SUM(Calls) AS Calls, SUM(CAST(InputTokens AS BIGINT)) AS InputTokens, SUM(CAST(OutputTokens AS BIGINT)) AS OutputTokens " +
            "FROM dbo.StanleyTierLog WHERE At >= @since GROUP BY Tier, Source, Stage, Topic, Outcome, ModelTier ORDER BY Replies DESC",
            new { since }, null, ct))).ToList();
        var cards = (await c.QueryAsync<StanleyCardCount>(Sql.Cmd(
            "SELECT TOP (@top) CardId, COUNT(*) AS Replies, SUM(CAST(Abstained AS INT)) AS Abstained FROM dbo.StanleyTierLog WHERE At >= @since AND CardId <> N'' " +
            "GROUP BY CardId HAVING COUNT(*) >= 2 ORDER BY Replies DESC, CardId",
            new { since, top = StanleyTierSummary.MaxCards }, null, ct))).ToList();
        return StanleyTierSummary.Of(since, rows, cards);
    }
}

/// <summary>Stanley's prepared and confirmed actions in <c>dbo.StanleyActions</c> (phase 5). A row is the preview, then the receipt; it holds the typed intent, never the guest's chat messages.</summary>
public sealed class DapperStanleyActionStore(IDbConnectionFactory db) : IStanleyActionStore
{
    private const string Columns = "Id, PublicId, UserId, Kind, Status, CreatedAt, ExpiresAt, UpdatedAt, Fingerprint, IdemKey, Data, Ref, Reason, DoneAt, UndoUntil";

    public async Task AddAsync(StanleyActionRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.StanleyActions (PublicId, UserId, Kind, Status, CreatedAt, ExpiresAt, UpdatedAt, Fingerprint, IdemKey, Data, Ref, Reason, DoneAt, UndoUntil) " +
            "VALUES (@PublicId, @UserId, @Kind, @Status, @CreatedAt, @ExpiresAt, @UpdatedAt, @Fingerprint, @IdemKey, @Data, @Ref, @Reason, @DoneAt, @UndoUntil)", r, null, ct));
    }

    public async Task<StanleyActionRow?> GetAsync(Guid publicId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<StanleyActionRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.StanleyActions WHERE PublicId = @publicId AND UserId = @userId", new { publicId, userId }, null, ct));
    }

    public async Task<StanleyActionRow?> FindByKeyAsync(long userId, string key, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<StanleyActionRow>(Sql.Cmd($"SELECT TOP 1 {Columns} FROM dbo.StanleyActions WHERE UserId = @userId AND IdemKey = @key", new { userId, key }, null, ct));
    }

    public async Task<bool> TryBeginAsync(Guid publicId, long userId, string key, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.StanleyActions SET Status = N'executing', IdemKey = @key, UpdatedAt = @now WHERE PublicId = @publicId AND UserId = @userId AND Status = N'prepared'",
            new { publicId, userId, key, now }, null, ct)) > 0;
    }

    public async Task UpdateAsync(StanleyActionRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.StanleyActions SET Status = @Status, UpdatedAt = @UpdatedAt, IdemKey = @IdemKey, Ref = @Ref, Reason = @Reason, DoneAt = @DoneAt, UndoUntil = @UndoUntil WHERE PublicId = @PublicId AND UserId = @UserId", r, null, ct));
    }

    public async Task<List<StanleyActionRow>> ListAsync(long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StanleyActionRow>(Sql.Cmd($"SELECT TOP (@max) {Columns} FROM dbo.StanleyActions WHERE UserId = @userId ORDER BY CreatedAt DESC, Id DESC", new { userId, max }, null, ct))).ToList();
    }
}

/// <summary>Stanley's handoffs in <c>dbo.StanleyHandoffs</c> (phase 6): a case reference with the text the guest agreed to send.</summary>
public sealed class DapperStanleyHandoffStore(IDbConnectionFactory db) : IStanleyHandoffStore
{
    public async Task AddAsync(StanleyHandoffRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.StanleyHandoffs (PublicId, UserId, Topic, Reference, Issue, Outcome, BookingRef, Tried, Attachment, Role, OpenedAt, Source) VALUES (@PublicId, @UserId, @Topic, @Reference, @Issue, @Outcome, @BookingRef, @Tried, @Attachment, @Role, @OpenedAt, @Source)", r, null, ct));
    }

    public async Task<List<StanleyHandoffRow>> ListAsync(long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StanleyHandoffRow>(Sql.Cmd(
            "SELECT TOP (@max) Id, PublicId, UserId, Topic, Reference, Issue, Outcome, BookingRef, Tried, Attachment, Role, OpenedAt, Source FROM dbo.StanleyHandoffs WHERE UserId = @userId ORDER BY OpenedAt DESC, Id DESC",
            new { userId, max }, null, ct))).ToList();
    }

    public async Task<List<StanleyHandoffRow>> SinceAsync(DateTime since, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // Topic and time only: the aggregate never reads a guest or the words of a case.
        return (await c.QueryAsync<StanleyHandoffRow>(Sql.Cmd(
            "SELECT TOP (@max) Topic, OpenedAt FROM dbo.StanleyHandoffs WHERE OpenedAt >= @since ORDER BY OpenedAt DESC",
            new { since, max }, null, ct))).ToList();
    }
}

/// <summary>What Stanley remembers, in <c>dbo.StanleyMemory</c> and <c>dbo.StanleyMemorySettings</c> (phase 7). Every statement is scoped to one user id.</summary>
public sealed class DapperStanleyMemoryStore(IDbConnectionFactory db) : IStanleyMemoryStore
{
    private const string Columns = "Id, PublicId, UserId, Kind, Value, Scope, SailingId, Source, Share, UpdatedAt";

    public async Task<List<StanleyMemoryRow>> ListAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StanleyMemoryRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.StanleyMemory WHERE UserId = @userId ORDER BY Id", new { userId }, null, ct))).ToList();
    }

    public async Task AddAsync(StanleyMemoryRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.StanleyMemory (PublicId, UserId, Kind, Value, Scope, SailingId, Source, Share, UpdatedAt) VALUES (@PublicId, @UserId, @Kind, @Value, @Scope, @SailingId, @Source, @Share, @UpdatedAt)", r, null, ct));
    }

    public async Task UpdateAsync(StanleyMemoryRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.StanleyMemory SET Kind = @Kind, Value = @Value, Scope = @Scope, SailingId = @SailingId, Source = @Source, Share = @Share, UpdatedAt = @UpdatedAt WHERE Id = @Id AND UserId = @UserId", r, null, ct));
    }

    public async Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyMemory WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct)) > 0;
    }

    public async Task DeleteAllAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyMemory WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task<bool> GetEnabledAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<bool?>(Sql.Cmd("SELECT Enabled FROM dbo.StanleyMemorySettings WHERE UserId = @userId", new { userId }, null, ct)) ?? true;
    }

    public async Task SetEnabledAsync(long userId, bool enabled, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.StanleyMemorySettings AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET Enabled = @enabled
            WHEN NOT MATCHED THEN INSERT (UserId, Enabled) VALUES (@userId, @enabled);
            """, new { userId, enabled }, null, ct));
    }

    public async Task<string?> GetLevelAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<string?>(Sql.Cmd("SELECT Level FROM dbo.StanleyMemorySettings WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task SetLevelAsync(long userId, string level, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.StanleyMemorySettings AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET Level = @level
            WHEN NOT MATCHED THEN INSERT (UserId, Enabled, Level) VALUES (@userId, 1, @level);
            """, new { userId, level }, null, ct));
    }
}

/// <summary>The decision brief, in <c>dbo.StanleyBriefs</c> (phase 8): one JSON row per guest. Every statement is scoped to one user id.</summary>
public sealed class DapperStanleyBriefStore(IDbConnectionFactory db) : IStanleyBriefStore
{
    public async Task<(string Json, DateTime UpdatedAt)?> GetAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QueryFirstOrDefaultAsync<BriefRow>(Sql.Cmd("SELECT Json, UpdatedAt FROM dbo.StanleyBriefs WHERE UserId = @userId", new { userId }, null, ct));
        return row is null ? null : (row.Json, row.UpdatedAt);
    }

    private sealed class BriefRow { public string Json { get; set; } = ""; public DateTime UpdatedAt { get; set; } }

    public async Task PutAsync(long userId, string json, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.StanleyBriefs AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET Json = @json, UpdatedAt = @at
            WHEN NOT MATCHED THEN INSERT (UserId, Json, UpdatedAt) VALUES (@userId, @json, @at);
            """, new { userId, json, at }, null, ct));
    }

    public async Task DeleteAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyBriefs WHERE UserId = @userId", new { userId }, null, ct));
    }
}

public sealed class DapperStanleyChangeStore(IDbConnectionFactory db) : IStanleyChangeStore
{
    public async Task<string?> GetAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<string>(Sql.Cmd("SELECT Json FROM dbo.StanleyChanges WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task PutAsync(long userId, string json, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.StanleyChanges AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET Json = @json, UpdatedAt = @at
            WHEN NOT MATCHED THEN INSERT (UserId, Json, UpdatedAt) VALUES (@userId, @json, @at);
            """, new { userId, json, at }, null, ct));
    }
}

public sealed class DapperStanleyTravellerStore(IDbConnectionFactory db) : IStanleyTravellerStore
{
    public async Task<string?> GetAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<string>(Sql.Cmd("SELECT Json FROM dbo.StanleyTravellers WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task PutAsync(long userId, string json, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.StanleyTravellers AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET Json = @json, UpdatedAt = @at
            WHEN NOT MATCHED THEN INSERT (UserId, Json, UpdatedAt) VALUES (@userId, @json, @at);
            """, new { userId, json, at }, null, ct));
    }
}
