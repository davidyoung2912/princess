using Dapper;

namespace Princess.Api.Data;

/// <summary>
/// What Stanley on tap in a thread (docs/chat-features-research.md, phase 10) keeps: how many catch-ups a person asked for lately (for the hourly cap) and the creator's off switch for one group.
/// A use holds no text and no words of anyone's; it is only who, where and when, and a day later it is gone.
/// </summary>
public interface IChatStanleyStore
{
    /// <summary>How many catch-ups the person has asked for since <paramref name="since"/>.</summary>
    Task<int> CountUsesAsync(long userId, DateTime since, CancellationToken ct);
    /// <summary>Records one catch-up, and removes this person's uses older than a day.</summary>
    Task RecordUseAsync(long userId, long groupId, DateTime at, CancellationToken ct);
    /// <summary>Whether the creator switched Stanley's help off in this conversation.</summary>
    Task<bool> IsOffAsync(long groupId, CancellationToken ct);
    Task SetOffAsync(long groupId, bool off, CancellationToken ct);
    /// <summary>How many answers Stanley gave in the conversation since <paramref name="since"/> (his status lines do not count): the per-conversation cooldown.</summary>
    Task<int> CountAnswersAsync(long groupId, DateTime since, CancellationToken ct);
    /// <summary>One member's choice not to see Stanley's answers in this conversation.</summary>
    Task SetMutedAsync(long groupId, long userId, bool muted, CancellationToken ct);
}

public sealed class DapperChatStanleyStore(IDbConnectionFactory db) : IChatStanleyStore
{
    public async Task<int> CountUsesAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatStanleyUses WHERE UserId = @userId AND [At] > @since", new { userId, since }, null, ct));
    }

    public async Task RecordUseAsync(long userId, long groupId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            DELETE FROM dbo.ChatStanleyUses WHERE UserId = @userId AND [At] <= DATEADD(day, -1, @at);
            INSERT INTO dbo.ChatStanleyUses (UserId, GroupId, [At]) VALUES (@userId, @groupId, @at)
            """, new { userId, groupId, at }, null, ct));
    }

    public async Task<bool> IsOffAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<bool>(Sql.Cmd("SELECT StanleyTapOff FROM dbo.ChatGroups WHERE Id = @groupId", new { groupId }, null, ct));
    }

    public async Task SetOffAsync(long groupId, bool off, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET StanleyTapOff = @off WHERE Id = @groupId", new { groupId, off }, null, ct));
    }

    public async Task<int> CountAnswersAsync(long groupId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatMessages WHERE GroupId = @groupId AND FromUserId IS NULL AND IsSystem = 0 AND [At] > @since", new { groupId, since }, null, ct));
    }

    public async Task SetMutedAsync(long groupId, long userId, bool muted, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET StanleyMuted = @muted WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, muted }, null, ct));
    }
}
