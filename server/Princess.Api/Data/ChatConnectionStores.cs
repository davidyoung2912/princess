using System.Data.Common;
using Dapper;

namespace Princess.Api.Data;

/// <summary>A guest another guest may ask to chat with: only what a search shows.</summary>
public sealed class ChatPersonRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public bool IsSupervised { get; set; }
    /// <summary>The id of the picture they chose in chat, or null for initials.</summary>
    public string? Avatar { get; set; }
}

/// <summary>One request to chat, with the names of both people. The two people's guid public ids are what the screens use.</summary>
public sealed class ChatConnectionRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long RequesterId { get; set; }
    public Guid RequesterPublicId { get; set; }
    public string RequesterFirst { get; set; } = "";
    public string RequesterLast { get; set; } = "";
    public bool RequesterSupervised { get; set; }
    public string? RequesterAvatar { get; set; }
    public long TargetId { get; set; }
    public Guid TargetPublicId { get; set; }
    public string TargetFirst { get; set; } = "";
    public string TargetLast { get; set; } = "";
    public bool TargetSupervised { get; set; }
    public string? TargetAvatar { get; set; }
    public string Status { get; set; } = "";
    public long? GuardianUserId { get; set; }
    public string? GuardianFor { get; set; }
    /// <summary>The direct conversation, once accepted.</summary>
    public Guid? ConversationId { get; set; }
    public long? EndedByUserId { get; set; }
    public DateTime? RequesterSeenAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Requests to chat and the direct conversations they make (docs/chat-plan.md, phase 1). Every write that depends on the current status says which statuses it expects, so two answers at once cannot both win.</summary>
public interface IChatConnectionStore
{
    /// <summary>Guests on a confirmed booking for the same sailing as the caller whose name contains <paramref name="like"/>, or only the one with <paramref name="personPublicId"/>. Never the caller, anyone who blocked them or whom they blocked, anyone who turned off being found (unless they share a booking), or a child they share no booking with.</summary>
    Task<List<ChatPersonRow>> FindPeopleAsync(long userId, string? like, Guid? personPublicId, int max, CancellationToken ct);
    Task<ChatConnectionRow?> GetAsync(Guid publicId, CancellationToken ct);
    /// <summary>The live (waiting or agreed) connection between two people, whichever way round it was asked.</summary>
    Task<ChatConnectionRow?> FindOpenBetweenAsync(long a, long b, CancellationToken ct);
    /// <summary>What the person needs to see: live connections they are in or must approve, and answers (a decline) they have not seen. Those whose sender was blocked by the person are left out.</summary>
    Task<List<ChatConnectionRow>> ListForUserAsync(long userId, CancellationToken ct);
    Task<DateTime?> LastDeclineAsync(long requesterId, long targetId, CancellationToken ct);
    Task<int> CountOpenOutgoingAsync(long userId, CancellationToken ct);
    Task<int> CountSentSinceAsync(long userId, DateTime since, CancellationToken ct);
    /// <summary>Adds a waiting request. Null when the two already have a live one (the table allows only one).</summary>
    Task<ChatConnectionRow?> InsertAsync(long requesterId, long targetId, string status, long? guardianUserId, string? guardianFor, DateTime expiresAt, DateTime now, CancellationToken ct);
    /// <summary>Moves a request to a new waiting status or a closed one, only if it is still in one of <paramref name="from"/>. False when it was not (somebody else answered first).</summary>
    Task<bool> SetStatusAsync(long id, string[] from, string to, long? guardianUserId, string? guardianFor, bool answered, DateTime now, CancellationToken ct);
    /// <summary>Agrees a waiting request and makes the direct conversation for both people in one transaction. Null when it was no longer waiting.</summary>
    Task<Guid?> AcceptAsync(long id, DateTime now, CancellationToken ct);
    /// <summary>Ends an agreed connection and records who did. False when it was not agreed.</summary>
    Task<bool> EndAsync(long id, long byUserId, DateTime now, CancellationToken ct);
    /// <summary>Records that the sender has seen the answers to their requests.</summary>
    Task MarkAnswersSeenAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>Closes waiting requests that passed their time, for the person (as sender, receiver or guardian).</summary>
    Task ExpireAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>Whether the first person has blocked the second.</summary>
    Task<bool> HasBlockedAsync(long blocker, long blocked, CancellationToken ct);
    /// <summary>The person's chat choices: whether others can find them by name, and whether a notice may show the message text.</summary>
    Task<(bool Findable, bool ShowPreview, bool Typing)> GetSettingsAsync(long userId, CancellationToken ct);
    Task SetSettingsAsync(long userId, bool findable, bool showPreview, bool typing, CancellationToken ct);
    /// <summary>Hide me, in one transaction: turns off being found, ends every agreed connection and withdraws every waiting request the person sent or was sent. Returns how many connections it closed.</summary>
    Task<int> HideAsync(long userId, DateTime now, CancellationToken ct);
}

public sealed class DapperChatConnectionStore(IDbConnectionFactory db) : IChatConnectionStore
{
    private sealed class PairRow
    {
        public long RequesterId { get; set; }
        public long TargetId { get; set; }
    }

    private const string Select = """
        SELECT c.Id, c.PublicId, c.RequesterId, r.PublicId AS RequesterPublicId, rp.FirstName AS RequesterFirst, rp.LastName AS RequesterLast, r.IsSupervised AS RequesterSupervised,
               c.TargetId, t.PublicId AS TargetPublicId, tp.FirstName AS TargetFirst, tp.LastName AS TargetLast, t.IsSupervised AS TargetSupervised, rup.ChatAvatar AS RequesterAvatar, tup.ChatAvatar AS TargetAvatar,
               c.Status, c.GuardianUserId, c.GuardianFor, g.PublicId AS ConversationId, c.EndedByUserId, c.RequesterSeenAt, c.RespondedAt, c.ExpiresAt, c.CreatedAt
        FROM dbo.ChatConnections c
        JOIN dbo.Users r ON r.Id = c.RequesterId JOIN dbo.Profiles rp ON rp.UserId = r.Id
        JOIN dbo.Users t ON t.Id = c.TargetId JOIN dbo.Profiles tp ON tp.UserId = t.Id
        LEFT JOIN dbo.UserPrefs rup ON rup.UserId = r.Id LEFT JOIN dbo.UserPrefs tup ON tup.UserId = t.Id
        LEFT JOIN dbo.ChatGroups g ON g.Id = c.GroupId
        """;

    // People who share a booking with the caller: a travelling party is not "found", it is already known.
    private const string SharesBooking = "EXISTS (SELECT 1 FROM dbo.BookingGuests a JOIN dbo.BookingGuests b ON b.BookingId = a.BookingId WHERE a.UserId = @userId AND b.UserId = u.Id)";

    public async Task<List<ChatPersonRow>> FindPeopleAsync(long userId, string? like, Guid? personPublicId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatPersonRow>(Sql.Cmd($"""
            SELECT TOP (@max) u.Id AS UserId, u.PublicId, p.FirstName, p.LastName, u.IsSupervised, up.ChatAvatar AS Avatar
            FROM dbo.Users u
            JOIN dbo.Profiles p ON p.UserId = u.Id
            LEFT JOIN dbo.UserPrefs up ON up.UserId = u.Id
            WHERE u.Id <> @userId AND u.Role = 'guest'
              AND (@personPublicId IS NULL OR u.PublicId = @personPublicId)
              AND (@like IS NULL OR p.FirstName LIKE @like OR p.LastName LIKE @like OR p.FirstName + N' ' + p.LastName LIKE @like)
              AND (
                    {SharesBooking}
                    OR (
                        ISNULL(up.ChatFindable, 1) = 1 AND u.IsSupervised = 0
                        AND EXISTS (
                            SELECT 1
                            FROM dbo.BookingGuests me
                            JOIN dbo.Bookings mb ON mb.Id = me.BookingId AND mb.Status = 'confirmed'
                            JOIN dbo.Bookings ob ON ob.SailingId = mb.SailingId AND ob.Status = 'confirmed'
                            JOIN dbo.BookingGuests og ON og.BookingId = ob.Id AND og.UserId = u.Id
                            WHERE me.UserId = @userId)
                    )
                  )
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatBlocks bl WHERE (bl.UserId = u.Id AND bl.BlockedUserId = @userId) OR (bl.UserId = @userId AND bl.BlockedUserId = u.Id))
            ORDER BY p.FirstName, p.LastName, u.Id
            """, new { userId, like, personPublicId, max }, null, ct))).ToList();
    }

    public async Task<ChatConnectionRow?> GetAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatConnectionRow>(Sql.Cmd(Select + " WHERE c.PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<ChatConnectionRow?> FindOpenBetweenAsync(long a, long b, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<ChatConnectionRow>(Sql.Cmd(
            Select + " WHERE c.Status IN ('awaitingGuardian','pending','accepted') AND ((c.RequesterId = @a AND c.TargetId = @b) OR (c.RequesterId = @b AND c.TargetId = @a))", new { a, b }, null, ct));
    }

    public async Task<List<ChatConnectionRow>> ListForUserAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatConnectionRow>(Sql.Cmd(Select + """

            WHERE (
                    (c.Status IN ('awaitingGuardian','pending','accepted') AND (c.RequesterId = @userId OR c.TargetId = @userId OR c.GuardianUserId = @userId))
                 OR (c.Status = 'declined' AND c.RequesterId = @userId AND c.RequesterSeenAt IS NULL)
                  )
              AND NOT (c.TargetId = @userId AND c.GuardianUserId IS NULL AND EXISTS (SELECT 1 FROM dbo.ChatBlocks bl WHERE bl.UserId = @userId AND bl.BlockedUserId = c.RequesterId))
            ORDER BY c.CreatedAt DESC, c.Id DESC
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<DateTime?> LastDeclineAsync(long requesterId, long targetId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<DateTime?>(Sql.Cmd(
            "SELECT MAX(RespondedAt) FROM dbo.ChatConnections WHERE RequesterId = @requesterId AND TargetId = @targetId AND Status = 'declined'", new { requesterId, targetId }, null, ct));
    }

    public async Task<int> CountOpenOutgoingAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd(
            "SELECT COUNT(*) FROM dbo.ChatConnections WHERE RequesterId = @userId AND Status IN ('awaitingGuardian','pending')", new { userId }, null, ct));
    }

    public async Task<int> CountSentSinceAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd(
            "SELECT COUNT(*) FROM dbo.ChatConnections WHERE RequesterId = @userId AND CreatedAt >= @since", new { userId, since }, null, ct));
    }

    public async Task<ChatConnectionRow?> InsertAsync(long requesterId, long targetId, string status, long? guardianUserId, string? guardianFor, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        Guid publicId;
        try
        {
            publicId = await c.ExecuteScalarAsync<Guid>(Sql.Cmd("""
                INSERT INTO dbo.ChatConnections (RequesterId, TargetId, Status, GuardianUserId, GuardianFor, ExpiresAt, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.PublicId
                VALUES (@requesterId, @targetId, @status, @guardianUserId, @guardianFor, @expiresAt, @now, @now)
                """, new { requesterId, targetId, status, guardianUserId, guardianFor, expiresAt, now }, null, ct));
        }
        catch (DbException e) when (e is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
        {
            return null;   // the one-live-connection-per-pair index: somebody asked first
        }
        return await GetAsync(publicId, ct);
    }

    public async Task<bool> SetStatusAsync(long id, string[] from, string to, long? guardianUserId, string? guardianFor, bool answered, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatConnections
            SET Status = @to, GuardianUserId = @guardianUserId, GuardianFor = @guardianFor, RespondedAt = CASE WHEN @answered = 1 THEN @now ELSE RespondedAt END, UpdatedAt = @now
            WHERE Id = @id AND Status IN @from
            """, new { id, from, to, guardianUserId, guardianFor, answered, now }, null, ct)) == 1;
    }

    public async Task<Guid?> AcceptAsync(long id, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var people = await c.QuerySingleOrDefaultAsync<PairRow>(Sql.Cmd("""
            UPDATE dbo.ChatConnections SET Status = 'accepted', RespondedAt = @now, UpdatedAt = @now
            OUTPUT INSERTED.RequesterId, INSERTED.TargetId
            WHERE Id = @id AND Status IN ('awaitingGuardian','pending')
            """, new { id, now }, tx, ct));
        if (people is not { } p) return null;   // not waiting any more: somebody answered first
        var (groupId, groupPublicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.ChatGroups (Name, Kind) OUTPUT INSERTED.Id, INSERTED.PublicId VALUES (N'Direct', 'direct')
            """, null, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, Status, JoinedAt) VALUES (@groupId, @a, 'active', @now), (@groupId, @b, 'active', @now);
            UPDATE dbo.ChatConnections SET GroupId = @groupId WHERE Id = @id;
            """, new { groupId, a = p.RequesterId, b = p.TargetId, now, id }, tx, ct));
        await tx.CommitAsync(ct);
        return groupPublicId;
    }

    public async Task<bool> EndAsync(long id, long byUserId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatConnections SET Status = 'ended', EndedByUserId = @byUserId, EndedAt = @now, UpdatedAt = @now WHERE Id = @id AND Status = 'accepted'
            """, new { id, byUserId, now }, null, ct)) == 1;
    }

    public async Task MarkAnswersSeenAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.ChatConnections SET RequesterSeenAt = @now WHERE RequesterId = @userId AND RequesterSeenAt IS NULL AND Status IN ('accepted','declined','ended')", new { userId, now }, null, ct));
    }

    public async Task ExpireAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatConnections SET Status = 'expired', UpdatedAt = @now
            WHERE Status IN ('awaitingGuardian','pending') AND ExpiresAt <= @now AND (RequesterId = @userId OR TargetId = @userId OR GuardianUserId = @userId)
            """, new { userId, now }, null, ct));
    }

    public async Task<bool> HasBlockedAsync(long blocker, long blocked, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatBlocks WHERE UserId = @blocker AND BlockedUserId = @blocked) THEN 1 ELSE 0 END", new { blocker, blocked }, null, ct)) == 1;
    }

    public async Task<(bool Findable, bool ShowPreview, bool Typing)> GetSettingsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<(bool Findable, bool ShowPreview, bool Typing)?>(Sql.Cmd("SELECT ChatFindable, ChatShowPreview, ChatTyping FROM dbo.UserPrefs WHERE UserId = @userId", new { userId }, null, ct));
        return row ?? (true, false, true);
    }

    public async Task SetSettingsAsync(long userId, bool findable, bool showPreview, bool typing, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.UserPrefs AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET ChatFindable = @findable, ChatShowPreview = @showPreview, ChatTyping = @typing, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, ChatFindable, ChatShowPreview, ChatTyping) VALUES (@userId, @findable, @showPreview, @typing);
            """, new { userId, findable, showPreview, typing }, null, ct));
    }

    public async Task<int> HideAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.UserPrefs AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET ChatFindable = 0, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, ChatFindable) VALUES (@userId, 0);
            """, new { userId }, tx, ct));
        var ended = await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatConnections SET Status = 'ended', EndedByUserId = @userId, EndedAt = @now, UpdatedAt = @now
            WHERE Status = 'accepted' AND (RequesterId = @userId OR TargetId = @userId)
            """, new { userId, now }, tx, ct));
        // Waiting requests close quietly as withdrawn, so nobody gets a decline (and no cooldown starts).
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatConnections SET Status = 'cancelled', UpdatedAt = @now
            WHERE Status IN ('awaitingGuardian','pending') AND (RequesterId = @userId OR TargetId = @userId)
            """, new { userId, now }, tx, ct));
        await tx.CommitAsync(ct);
        return ended;
    }
}
