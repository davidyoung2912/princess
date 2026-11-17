using Dapper;

namespace Princess.Api.Data;

/// <summary>
/// What the group coordinator (docs/chat-features-research.md, phase 11) keeps: when each person was last reminded about a thread (so nobody is nudged more than once in three days) and who turned reminders off.
/// A reminder row holds no text and no question: only the group, the poll or plan it was about, who was reminded and when. Rows older than a month go as new ones are added.
/// </summary>
public interface IChatCoordinatorStore
{
    /// <summary>The newest reminder time for each person reminded in this group.</summary>
    Task<Dictionary<long, DateTime>> LastRemindedAsync(long groupId, CancellationToken ct);
    /// <summary>Records that these people were reminded about a message.</summary>
    Task RecordRemindersAsync(long groupId, long messageId, IReadOnlyCollection<long> userIds, DateTime at, CancellationToken ct);
    /// <summary>The members who turned reminders off in this group.</summary>
    Task<HashSet<long>> RemindersMutedAsync(long groupId, CancellationToken ct);
    Task SetRemindersMutedAsync(long groupId, long userId, bool muted, CancellationToken ct);
}

public sealed class DapperChatCoordinatorStore(IDbConnectionFactory db) : IChatCoordinatorStore
{
    public async Task<Dictionary<long, DateTime>> LastRemindedAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long UserId, DateTime At)>(Sql.Cmd("SELECT UserId, MAX([At]) AS [At] FROM dbo.ChatStanleyReminders WHERE GroupId = @groupId GROUP BY UserId", new { groupId }, null, ct));
        return rows.ToDictionary(r => r.UserId, r => r.At);
    }

    public async Task RecordRemindersAsync(long groupId, long messageId, IReadOnlyCollection<long> userIds, DateTime at, CancellationToken ct)
    {
        if (userIds.Count == 0) return;
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatStanleyReminders WHERE [At] <= DATEADD(day, -30, @at)", new { at }, null, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatStanleyReminders (GroupId, MessageId, UserId, [At]) VALUES (@groupId, @messageId, @userId, @at)",
            userIds.Select(userId => new { groupId, messageId, userId, at }), null, ct));
    }

    public async Task<HashSet<long>> RemindersMutedAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return [.. await c.QueryAsync<long>(Sql.Cmd("SELECT UserId FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND RemindersMuted = 1", new { groupId }, null, ct))];
    }

    public async Task SetRemindersMutedAsync(long groupId, long userId, bool muted, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET RemindersMuted = @muted WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, muted }, null, ct));
    }
}
