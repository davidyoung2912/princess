using Dapper;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>A supervised child, for the guardian's view.</summary>
public sealed class ChatChildRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
}

/// <summary>A report, with the conversation it came from. No message text.</summary>
public sealed class ChatReportRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long MessageId { get; set; }
    public long GroupId { get; set; }
    public string Kind { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Status { get; set; } = ChatSafetyRules.Open;
    public DateTime At { get; set; }
}

/// <summary>A line of a case: a message and who said it. A photo is only flagged.</summary>
public sealed class ChatCaseLineRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Text { get; set; } = "";
    public bool HasPhoto { get; set; }
    public DateTime At { get; set; }
}

/// <summary>Guardians reading a child's chats, and staff reviewing reports (docs/chat-plan.md, phase 7).</summary>
public interface IChatSafetyStore
{
    /// <summary>The supervised children whose booker is <paramref name="bookerId"/>.</summary>
    Task<List<ChatChildRow>> ListChildrenAsync(long bookerId, CancellationToken ct);
    /// <summary>Reports with this status, oldest first.</summary>
    Task<List<ChatReportRow>> ListReportsAsync(string status, int max, CancellationToken ct);
    Task<ChatReportRow?> GetReportAsync(Guid publicId, CancellationToken ct);
    /// <summary>The reported message and up to <paramref name="span"/> messages either side of it in the same conversation, in order. System lines are left out.</summary>
    Task<List<ChatCaseLineRow>> ListContextAsync(long messageId, long groupId, int span, CancellationToken ct);
    /// <summary>
    /// Records the decision on an open report, and with <paramref name="removeMessage"/> replaces the message's text and drops its photo. Every other open report on the same message is closed the same way.
    /// False when the report is not open.
    /// </summary>
    Task<bool> ResolveAsync(long reportId, string status, bool removeMessage, long reviewerId, DateTime now, CancellationToken ct);
}

public sealed class DapperChatSafetyStore(IDbConnectionFactory db) : IChatSafetyStore
{
    public async Task<List<ChatChildRow>> ListChildrenAsync(long bookerId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatChildRow>(Sql.Cmd("""
            SELECT u.Id AS UserId, u.PublicId, pr.FirstName, pr.LastName
            FROM dbo.Users u
            JOIN dbo.Profiles pr ON pr.UserId = u.Id
            WHERE u.BookerUserId = @bookerId AND u.IsSupervised = 1
            ORDER BY pr.FirstName, u.Id
            """, new { bookerId }, null, ct))).ToList();
    }

    private const string ReportSelect = """
        SELECT r.Id, r.PublicId, r.MessageId, m.GroupId, g.Kind, r.Reason, r.Status, r.[At]
        FROM dbo.ChatReports r
        JOIN dbo.ChatMessages m ON m.Id = r.MessageId
        JOIN dbo.ChatGroups g ON g.Id = m.GroupId
        """;

    public async Task<List<ChatReportRow>> ListReportsAsync(string status, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatReportRow>(Sql.Cmd(ReportSelect + " WHERE r.Status = @status ORDER BY r.[At], r.Id OFFSET 0 ROWS FETCH NEXT @max ROWS ONLY", new { status, max }, null, ct))).ToList();
    }

    public async Task<ChatReportRow?> GetReportAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatReportRow>(Sql.Cmd(ReportSelect + " WHERE r.PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<List<ChatCaseLineRow>> ListContextAsync(long messageId, long groupId, int span, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // A message its sender deleted shows staff what it said (OriginalText): that is what the report is about.
        const string cols = "m.Id, m.PublicId, ISNULL(pr.FirstName, N'Stanley') AS FirstName, ISNULL(pr.LastName, N'') AS LastName, CASE WHEN m.DeletedAt IS NULL THEN m.[Text] ELSE ISNULL(m.OriginalText, N'') END AS [Text], CAST(CASE WHEN m.Photo IS NULL THEN 0 ELSE 1 END AS bit) AS HasPhoto, m.[At]";
        // A LEFT join: Stanley's answers have no sender, and a reported one must still show with the question before it.
        const string from = "FROM dbo.ChatMessages m LEFT JOIN dbo.Profiles pr ON pr.UserId = m.FromUserId";
        var before = (await c.QueryAsync<ChatCaseLineRow>(Sql.Cmd($"SELECT TOP (@span) {cols} {from} WHERE m.GroupId = @groupId AND m.IsSystem = 0 AND m.Id < @messageId ORDER BY m.Id DESC", new { span, groupId, messageId }, null, ct))).Reverse();
        var it = await c.QueryAsync<ChatCaseLineRow>(Sql.Cmd($"SELECT {cols} {from} WHERE m.Id = @messageId AND m.GroupId = @groupId", new { groupId, messageId }, null, ct));
        var after = await c.QueryAsync<ChatCaseLineRow>(Sql.Cmd($"SELECT TOP (@span) {cols} {from} WHERE m.GroupId = @groupId AND m.IsSystem = 0 AND m.Id > @messageId ORDER BY m.Id", new { span, groupId, messageId }, null, ct));
        return [.. before, .. it, .. after];
    }

    public async Task<bool> ResolveAsync(long reportId, string status, bool removeMessage, long reviewerId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        // Only an open report can be decided, and the status test is in the update, so two reviewers cannot both win.
        var messageId = await c.ExecuteScalarAsync<long?>(Sql.Cmd("""
            UPDATE dbo.ChatReports SET Status = @status, ResolvedAt = @now, ResolvedByUserId = @reviewerId
            OUTPUT INSERTED.MessageId
            WHERE Id = @reportId AND Status = 'open'
            """, new { reportId, status, now, reviewerId }, tx, ct));
        if (messageId is null) return false;
        if (removeMessage)
        {
            await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatMessages SET [Text] = @text, Photo = NULL, ExtraPhotos = 0 WHERE Id = @messageId", new { messageId, text = ChatSafetyRules.RemovedText }, tx, ct));
            await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatMessagePhotos WHERE MessageId = @messageId", new { messageId }, tx, ct));
            await c.ExecuteAsync(Sql.Cmd("""
                UPDATE dbo.ChatReports SET Status = @status, ResolvedAt = @now, ResolvedByUserId = @reviewerId
                WHERE MessageId = @messageId AND Status = 'open'
                """, new { messageId, status, now, reviewerId }, tx, ct));
        }
        await tx.CommitAsync(ct);
        return true;
    }
}
