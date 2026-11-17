using Dapper;

namespace Princess.Api.Data;

public sealed class ChatRecapRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long GroupId { get; set; }
    public long StartedBy { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? SharedAt { get; set; }
    public long? SharedBy { get; set; }
}

public sealed class ChatRecapItemRow
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Kind { get; set; } = "";
    public long MessageId { get; set; }
    public Guid MessagePublicId { get; set; }
    public string Decision { get; set; } = "pending";
    public string? Payload { get; set; }
    public bool Deleted { get; set; }
}

/// <summary>
/// What a group recap keeps (docs/chat-features-research.md, phase 13): the recap, and one row per part with its owner and decision. No text and no picture is copied: a part is the id of the message it points at.
/// </summary>
public interface IChatRecapStore
{
    /// <summary>The group's recap (a group has one), or null.</summary>
    Task<ChatRecapRow?> FindAsync(long groupId, CancellationToken ct);
    Task<ChatRecapRow> CreateAsync(long groupId, long startedBy, DateTime at, CancellationToken ct);
    Task<List<ChatRecapItemRow>> ListItemsAsync(long recapId, CancellationToken ct);
    /// <summary>Adds parts that are not yet in the recap. <c>Approved</c> parts are decided when added (a photo the owner chose); plans start pending.</summary>
    Task AddItemsAsync(long recapId, string kind, long userId, IReadOnlyCollection<long> messageIds, bool approved, DateTime at, CancellationToken ct);
    /// <summary>Removes this person's photo parts that are not in the list (they changed their mind).</summary>
    Task KeepPhotosAsync(long recapId, long userId, IReadOnlyCollection<long> messageIds, CancellationToken ct);
    Task<bool> DecideAsync(long recapId, long userId, long messageId, string decision, DateTime at, CancellationToken ct);
    /// <summary>Marks it shared, once. False when it already was.</summary>
    Task<bool> MarkSharedAsync(long recapId, long by, DateTime at, CancellationToken ct);
    /// <summary>The first photo of a message, or null.</summary>
    Task<string?> PhotoAsync(long messageId, CancellationToken ct);
}

public sealed class DapperChatRecapStore(IDbConnectionFactory db) : IChatRecapStore
{
    public async Task<ChatRecapRow?> FindAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<ChatRecapRow>(Sql.Cmd("SELECT TOP (1) Id, PublicId, GroupId, StartedBy, StartedAt, SharedAt, SharedBy FROM dbo.ChatRecaps WHERE GroupId = @groupId ORDER BY Id DESC", new { groupId }, null, ct));
    }

    public async Task<ChatRecapRow> CreateAsync(long groupId, long startedBy, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var publicId = Guid.NewGuid();
        var id = await c.ExecuteScalarAsync<long>(Sql.Cmd("INSERT INTO dbo.ChatRecaps (PublicId, GroupId, StartedBy, StartedAt) OUTPUT INSERTED.Id VALUES (@publicId, @groupId, @startedBy, @at)", new { publicId, groupId, startedBy, at }, null, ct));
        return new ChatRecapRow { Id = id, PublicId = publicId, GroupId = groupId, StartedBy = startedBy, StartedAt = at };
    }

    public async Task<List<ChatRecapItemRow>> ListItemsAsync(long recapId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRecapItemRow>(Sql.Cmd("""
            SELECT i.Id, i.UserId, i.Kind, i.MessageId, m.PublicId AS MessagePublicId, i.Decision, m.Payload, CAST(CASE WHEN m.DeletedAt IS NULL THEN 0 ELSE 1 END AS bit) AS Deleted
            FROM dbo.ChatRecapItems i JOIN dbo.ChatMessages m ON m.Id = i.MessageId
            WHERE i.RecapId = @recapId ORDER BY i.Id
            """, new { recapId }, null, ct))).ToList();
    }

    public async Task AddItemsAsync(long recapId, string kind, long userId, IReadOnlyCollection<long> messageIds, bool approved, DateTime at, CancellationToken ct)
    {
        if (messageIds.Count == 0) return;
        await using var c = await db.OpenAsync(ct);
        var decision = approved ? "approved" : "pending";
        foreach (var messageId in messageIds)
            await c.ExecuteAsync(Sql.Cmd("""
                IF NOT EXISTS (SELECT 1 FROM dbo.ChatRecapItems WHERE RecapId = @recapId AND MessageId = @messageId)
                INSERT INTO dbo.ChatRecapItems (RecapId, UserId, Kind, MessageId, Decision, DecidedAt) VALUES (@recapId, @userId, @kind, @messageId, @decision, CASE WHEN @approved = 1 THEN @at END)
                """, new { recapId, userId, kind, messageId, decision, approved, at }, null, ct));
    }

    public async Task KeepPhotosAsync(long recapId, long userId, IReadOnlyCollection<long> messageIds, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatRecapItems WHERE RecapId = @recapId AND UserId = @userId AND Kind = 'photo' AND MessageId NOT IN @messageIds",
            new { recapId, userId, messageIds = messageIds.Count == 0 ? new long[] { 0 } : messageIds.ToArray() }, null, ct));
    }

    public async Task<bool> DecideAsync(long recapId, long userId, long messageId, string decision, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatRecapItems SET Decision = @decision, DecidedAt = @at WHERE RecapId = @recapId AND UserId = @userId AND MessageId = @messageId", new { recapId, userId, messageId, decision, at }, null, ct)) > 0;
    }

    public async Task<bool> MarkSharedAsync(long recapId, long by, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatRecaps SET SharedAt = @at, SharedBy = @by WHERE Id = @recapId AND SharedAt IS NULL", new { recapId, by, at }, null, ct)) > 0;
    }

    public async Task<string?> PhotoAsync(long messageId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<string>(Sql.Cmd("SELECT Photo FROM dbo.ChatMessages WHERE Id = @messageId AND DeletedAt IS NULL", new { messageId }, null, ct));
    }
}
