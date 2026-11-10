using Dapper;

namespace Princess.Api.Data;

/// <summary>One person's agreement to keep one conversation.</summary>
public sealed class ChatKeepRow
{
    public long GroupId { get; set; }
    public long UserId { get; set; }
}

/// <summary>Keeping a chat past the standard period (docs/chat-features-research.md, phase 5). A chat is kept only while every active member has agreed; the date it is deleted is stored on the conversation.</summary>
public interface IChatKeepStore
{
    /// <summary>Who has agreed to keep each of the conversations.</summary>
    Task<List<ChatKeepRow>> ListAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct);
    /// <summary>Records or withdraws one person's agreement. Repeating it changes nothing.</summary>
    Task SetAsync(long groupId, long userId, bool on, DateTime now, CancellationToken ct);
    /// <summary>The date each kept conversation is deleted (only those that have one).</summary>
    Task<Dictionary<long, DateTime>> KeepUntilForAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct);
    /// <summary>Sets the date a kept conversation is deleted, or clears it (null) when it is no longer kept.</summary>
    Task SetKeepUntilAsync(long groupId, DateTime? until, CancellationToken ct);
}

/// <summary>
/// The SQL that says a conversation is kept right now, used by the daily purge so it never needs the service: a date ahead, and every active member has agreed.
/// <c>@now</c> is real UTC. A member who joined after the others agreed has not, so the chat is ordinary again until they do.
/// </summary>
public static class ChatKeepSql
{
    public static string IsKept(string group) => $"""
        ({group}.KeepUntil IS NOT NULL AND {group}.KeepUntil > @now
         AND NOT EXISTS (SELECT 1 FROM dbo.ChatGroupMembers gm WHERE gm.GroupId = {group}.Id AND gm.Status = 'active'
                         AND NOT EXISTS (SELECT 1 FROM dbo.ChatKeeps k WHERE k.GroupId = {group}.Id AND k.UserId = gm.UserId)))
        """;

    /// <summary>
    /// Deletes the messages of every conversation whose kept date has passed, and forgets the agreement, so the rows do not stay for ever. Returns how many messages went.
    /// Runs on real time, with the rest of the retention job.
    /// </summary>
    public static async Task<int> DeleteExpiredAsync(IDbConnectionFactory db, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var messages = await c.ExecuteAsync(Sql.Cmd("DELETE m FROM dbo.ChatMessages m JOIN dbo.ChatGroups g ON g.Id = m.GroupId WHERE g.KeepUntil IS NOT NULL AND g.KeepUntil <= @now", new { now }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("DELETE k FROM dbo.ChatKeeps k JOIN dbo.ChatGroups g ON g.Id = k.GroupId WHERE g.KeepUntil IS NOT NULL AND g.KeepUntil <= @now", new { now }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET KeepUntil = NULL WHERE KeepUntil IS NOT NULL AND KeepUntil <= @now", new { now }, tx, ct));
        await tx.CommitAsync(ct);
        return messages;
    }
}

public sealed class DapperChatKeepStore(IDbConnectionFactory db) : IChatKeepStore
{
    public async Task<List<ChatKeepRow>> ListAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatKeepRow>(Sql.Cmd("SELECT GroupId, UserId FROM dbo.ChatKeeps WHERE GroupId IN @groupIds", new { groupIds }, null, ct))).ToList();
    }

    public async Task SetAsync(long groupId, long userId, bool on, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(on ? """
            IF NOT EXISTS (SELECT 1 FROM dbo.ChatKeeps WHERE GroupId = @groupId AND UserId = @userId)
              INSERT INTO dbo.ChatKeeps (GroupId, UserId, KeptAt) VALUES (@groupId, @userId, @now)
            """ : "DELETE FROM dbo.ChatKeeps WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, now }, null, ct));
    }

    public async Task<Dictionary<long, DateTime>> KeepUntilForAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long Id, DateTime Until)>(Sql.Cmd("SELECT Id, KeepUntil AS Until FROM dbo.ChatGroups WHERE Id IN @groupIds AND KeepUntil IS NOT NULL", new { groupIds }, null, ct));
        return rows.ToDictionary(r => r.Id, r => r.Until);
    }

    public async Task SetKeepUntilAsync(long groupId, DateTime? until, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET KeepUntil = @until WHERE Id = @groupId", new { groupId, until }, null, ct));
    }
}
