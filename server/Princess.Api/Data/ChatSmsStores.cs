using Dapper;

namespace Princess.Api.Data;

/// <summary>A guest's text-bridge choices (docs/chat-plan.md, 4.9): the bridge is on, and idle time also counts as ashore.</summary>
public sealed record ChatSmsSettingsRow(bool On, bool Idle);

/// <summary>Where a guest's unnumbered replies go and when they last said BACK.</summary>
public sealed record ChatSmsStateRow(long? LastGroupId, DateTime? BackAt);

/// <summary>The text bridge's own data: choices, reply routing, and the log the caps are counted from. Nothing here holds message text or a phone number.</summary>
public interface IChatSmsStore
{
    Task<ChatSmsSettingsRow> GetSettingsAsync(long userId, CancellationToken ct);
    Task SetSettingsAsync(long userId, bool on, bool idle, CancellationToken ct);
    /// <summary>The choices of each person asked about; anyone with no row is off.</summary>
    Task<Dictionary<long, ChatSmsSettingsRow>> ListSettingsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);
    Task<ChatSmsStateRow> GetStateAsync(long userId, CancellationToken ct);
    Task SetLastGroupAsync(long userId, long groupId, DateTime now, CancellationToken ct);
    Task SetBackAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>How many texts in this direction since <paramref name="since"/>, over every conversation or (with <paramref name="groupId"/>) one.</summary>
    Task<int> CountAsync(long userId, string direction, long? groupId, DateTime since, CancellationToken ct);
    Task LogAsync(long userId, long? groupId, string direction, string outcome, DateTime at, CancellationToken ct);
    /// <summary>Of the people asked about, the ones whose bridge is on.</summary>
    Task<List<long>> ListOnAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);
}

public sealed class DapperChatSmsStore(IDbConnectionFactory db) : IChatSmsStore
{
    public async Task<ChatSmsSettingsRow> GetSettingsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatSmsSettingsRow>(Sql.Cmd("SELECT ChatSmsOn AS [On], ChatSmsIdle AS Idle FROM dbo.UserPrefs WHERE UserId = @userId", new { userId }, null, ct)) ?? new(false, false);
    }

    public async Task SetSettingsAsync(long userId, bool on, bool idle, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.UserPrefs AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET ChatSmsOn = @on, ChatSmsIdle = @idle, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, ChatSmsOn, ChatSmsIdle) VALUES (@userId, @on, @idle);
            """, new { userId, on, idle }, null, ct));
    }

    public async Task<Dictionary<long, ChatSmsSettingsRow>> ListSettingsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long UserId, bool On, bool Idle)>(Sql.Cmd("SELECT UserId, ChatSmsOn, ChatSmsIdle FROM dbo.UserPrefs WHERE UserId IN @ids", new { ids = userIds.ToArray() }, null, ct));
        return rows.ToDictionary(r => r.UserId, r => new ChatSmsSettingsRow(r.On, r.Idle));
    }

    public async Task<ChatSmsStateRow> GetStateAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<(long? LastGroupId, DateTime? BackAt)?>(Sql.Cmd("SELECT LastGroupId, BackAt FROM dbo.ChatSmsState WHERE UserId = @userId", new { userId }, null, ct));
        return row is { } r ? new(r.LastGroupId, r.BackAt) : new(null, null);
    }

    public async Task SetLastGroupAsync(long userId, long groupId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.ChatSmsState AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET LastGroupId = @groupId, UpdatedAt = @now
            WHEN NOT MATCHED THEN INSERT (UserId, LastGroupId, UpdatedAt) VALUES (@userId, @groupId, @now);
            """, new { userId, groupId, now }, null, ct));
    }

    public async Task SetBackAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.ChatSmsState AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET BackAt = @now, UpdatedAt = @now
            WHEN NOT MATCHED THEN INSERT (UserId, BackAt, UpdatedAt) VALUES (@userId, @now, @now);
            """, new { userId, now }, null, ct));
    }

    public async Task<int> CountAsync(long userId, string direction, long? groupId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT COUNT(*) FROM dbo.ChatSmsLog
            WHERE UserId = @userId AND Direction = @direction AND [At] >= @since AND (@groupId IS NULL OR GroupId = @groupId)
            """, new { userId, direction, groupId, since }, null, ct));
    }

    public async Task LogAsync(long userId, long? groupId, string direction, string outcome, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatSmsLog (UserId, GroupId, Direction, Outcome, [At]) VALUES (@userId, @groupId, @direction, @outcome, @at)", new { userId, groupId, direction, outcome, at }, null, ct));
    }

    public async Task<List<long>> ListOnAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<long>(Sql.Cmd("SELECT UserId FROM dbo.UserPrefs WHERE ChatSmsOn = 1 AND UserId IN @ids", new { ids = userIds.ToArray() }, null, ct))).ToList();
    }
}
