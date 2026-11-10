using Dapper;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>A channel or room as one guest sees it before and after joining.</summary>
public sealed class ChatRoomRow
{
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public string Kind { get; set; } = ChatRoomRules.Room;
    public string? RoomKind { get; set; }
    public string Name { get; set; } = "";
    public string? Topic { get; set; }
    public string? SailingId { get; set; }
    public bool Closed { get; set; }
    public bool SlowMode { get; set; }
    public int Cap { get; set; }
    public int Members { get; set; }
    public int Moderators { get; set; }
    public string? Rules { get; set; }
    public int RefOffsetMinutes { get; set; }
    /// <summary>The person asking is an active member.</summary>
    public bool Joined { get; set; }
    /// <summary>The person has a confirmed booking, current or past, on this room's sailing.</summary>
    public bool BookedOnSailing { get; set; }
    /// <summary>The person has a confirmed booking on any sailing.</summary>
    public bool AnyBooking { get; set; }
    /// <summary>The person was removed by staff: they cannot join again.</summary>
    public bool Removed { get; set; }
}

/// <summary>A post held for staff. The text is shown to staff only, and kept only while it is held.</summary>
public sealed class ChatHeldRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public string GroupName { get; set; } = "";
    public long FromUserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Text { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "held";
    public DateTime At { get; set; }
}

/// <summary>A line of what a guest may read of a room before joining: staff-pinned posts (a room) or staff posts (a channel).</summary>
public sealed class ChatPreviewRow
{
    public string Text { get; set; } = "";
    public DateTime At { get; set; }
}

/// <summary>A suggested question; <c>Text</c> and the asker show to staff only, and only popular ones reach a preview.</summary>
public sealed class ChatQuestionRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public Guid GroupPublicId { get; set; }
    public string GroupName { get; set; } = "";
    public string Text { get; set; } = "";
    public string Status { get; set; } = "suggested";
    public DateTime At { get; set; }
}

public sealed class ChatRoomPostRow
{
    public Guid PublicId { get; set; }
    public Guid FromPublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Text { get; set; } = "";
    public DateTime At { get; set; }
    public bool Pinned { get; set; }
}

public sealed class ChatRoomPersonRow
{
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public DateTime? MutedUntil { get; set; }
}

public sealed class ChatRoomModeratorRow
{
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public bool Named { get; set; }
}

public sealed class ChatRoomCountRow
{
    public Guid GroupPublicId { get; set; }
    public string Name { get; set; } = "";
    public int Count { get; set; }
}

public sealed class ChatActionCountRow
{
    public string Action { get; set; } = "";
    public int Count { get; set; }
}

/// <summary>Channels and rooms (docs/chat-features-research.md, phase 8): joining, the moderator rota, staff actions with their audit rows, held posts and the weekly summary. Messages themselves are the chat store's.</summary>
public interface IChatRoomStore
{
    /// <summary>Every channel and room, with what the person has to do with each.</summary>
    Task<List<ChatRoomRow>> ListAsync(long userId, CancellationToken ct);
    Task<ChatRoomRow?> FindAsync(long userId, Guid groupPublicId, CancellationToken ct);
    /// <summary>Joins or follows (muted, as every room starts). <c>ok</c>, <c>full</c> or <c>removed</c>; a repeat is <c>ok</c> and changes nothing.</summary>
    Task<string> JoinAsync(long groupId, long userId, int cap, DateTime now, CancellationToken ct);
    Task LeaveAsync(long groupId, long userId, DateTime now, CancellationToken ct);
    Task AcceptRulesAsync(long groupId, long userId, DateTime now, CancellationToken ct);
    /// <summary>When the person last posted here (null for never): what slow mode measures from.</summary>
    Task<DateTime?> LastPostAsync(long groupId, long userId, CancellationToken ct);
    /// <summary>What a guest who is not in the room may read of it.</summary>
    Task<List<ChatPreviewRow>> PreviewAsync(long groupId, string kind, int max, CancellationToken ct);

    // ---- Staff ----
    Task<(long Id, Guid PublicId)> CreateAsync(string kind, string? roomKind, string name, string? topic, string? sailingId, int refOffset, int cap, string rules, long by, DateTime now, CancellationToken ct);
    Task<bool> SailingExistsAsync(string sailingId, CancellationToken ct);
    Task SetClosedAsync(long groupId, bool closed, CancellationToken ct);
    Task SetSlowAsync(long groupId, bool on, CancellationToken ct);
    Task SetRulesAsync(long groupId, string rules, CancellationToken ct);
    Task<int> CountModeratorsAsync(long groupId, CancellationToken ct);
    /// <summary>Adds or removes a named moderator (a person by public id). False when there is no such person.</summary>
    Task<bool> SetModeratorAsync(long groupId, Guid personPublicId, bool on, DateTime now, CancellationToken ct);
    /// <summary>Mutes a member until <paramref name="until"/> (null lifts it). Returns their user id, or null when they are not in the room.</summary>
    Task<long?> MuteMemberAsync(long groupId, Guid personPublicId, DateTime? until, CancellationToken ct);
    /// <summary>Removes a member for good (they cannot join again). Returns their user id, or null when they are not in the room.</summary>
    Task<long?> RemoveMemberAsync(long groupId, Guid personPublicId, DateTime now, CancellationToken ct);
    /// <summary>Takes a message away for everyone, keeps the words for the report case, and closes open reports on it. Returns (message id, sender id), or null when it is not a person's live message in the room.</summary>
    Task<(long Id, long FromUserId)?> RemoveMessageAsync(long groupId, Guid messagePublicId, long by, DateTime now, CancellationToken ct);
    /// <summary>Pins a message of the room, or false when the room is full of pins or the message is not in it.</summary>
    Task<bool> PinAsync(long groupId, Guid messagePublicId, long by, DateTime now, int max, CancellationToken ct);
    Task LogActionAsync(long groupId, long by, string action, long? targetUserId, long? messageId, DateTime now, CancellationToken ct);

    /// <summary>The latest live posts of people in the room (newest first), for staff to remove or pin.</summary>
    Task<List<ChatRoomPostRow>> ListPostsAsync(long groupId, int max, CancellationToken ct);
    /// <summary>The room's active members, for staff to mute or remove.</summary>
    Task<List<ChatRoomPersonRow>> ListPeopleAsync(long groupId, int max, CancellationToken ct);
    /// <summary>Every administrator, with whether they are named on this room's rota.</summary>
    Task<List<ChatRoomModeratorRow>> ListModeratorsAsync(long groupId, CancellationToken ct);

    // ---- Held posts ----
    Task AddHeldAsync(long groupId, long fromUserId, string text, string reason, DateTime now, CancellationToken ct);
    Task<List<ChatHeldRow>> ListHeldAsync(int max, CancellationToken ct);
    Task<ChatHeldRow?> GetHeldAsync(Guid publicId, CancellationToken ct);
    /// <summary>Marks a held post released or rejected. False when it was already decided. A rejected post's words are cleared.</summary>
    Task<bool> ResolveHeldAsync(long id, string status, long by, DateTime now, CancellationToken ct);

    // ---- Suggested questions ----
    Task<int> CountOpenQuestionsAsync(long groupId, long userId, CancellationToken ct);
    Task AddQuestionAsync(long groupId, long userId, string text, DateTime now, CancellationToken ct);
    Task<List<string>> ListPopularAsync(long groupId, int max, CancellationToken ct);
    Task<List<ChatQuestionRow>> ListSuggestedAsync(int max, CancellationToken ct);
    Task<ChatQuestionRow?> GetQuestionAsync(Guid publicId, CancellationToken ct);
    /// <summary>Marks a waiting question popular or rejected (a rejected one loses its words). False when it was already decided.</summary>
    Task<bool> ResolveQuestionAsync(long id, string status, long by, DateTime now, CancellationToken ct);
    /// <summary>The members to nudge about a change to the room (everyone active).</summary>
    Task<List<long>> ActiveMemberIdsAsync(long groupId, CancellationToken ct);

    // ---- Weekly summary ----
    Task<int> CountReportsAsync(DateTime since, CancellationToken ct);
    Task<List<ChatActionCountRow>> ActionCountsAsync(DateTime since, CancellationToken ct);
    Task<List<ChatRoomCountRow>> BusiestAsync(DateTime since, int max, CancellationToken ct);
    /// <summary>Every channel and room with its moderator count and whether it is closed, for the rota gaps.</summary>
    Task<List<ChatRoomRow>> ListAllAsync(CancellationToken ct);
    Task<int> CountHeldAsync(CancellationToken ct);
}

internal sealed class RemovedRef
{
    public long Id { get; set; }
    public long FromUserId { get; set; }
}

public sealed class DapperChatRoomStore(IDbConnectionFactory db) : IChatRoomStore
{
    private const string RoomSelect = """
        SELECT g.Id AS GroupId, g.PublicId AS GroupPublicId, g.Kind, g.RoomKind, g.Name, g.Topic, g.SailingId, CAST(g.RoomClosed AS bit) AS Closed, CAST(g.SlowMode AS bit) AS SlowMode, g.MemberCap AS Cap,
               g.RoomRules AS Rules, g.RoomRefOffset AS RefOffsetMinutes,
               (SELECT COUNT(*) FROM dbo.ChatGroupMembers m WHERE m.GroupId = g.Id AND m.Status = 'active') AS Members,
               (SELECT COUNT(*) FROM dbo.ChatRoomModerators r WHERE r.GroupId = g.Id) AS Moderators,
               CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatGroupMembers m WHERE m.GroupId = g.Id AND m.UserId = @userId AND m.Status = 'active') THEN 1 ELSE 0 END AS bit) AS Joined,
               CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatGroupMembers m WHERE m.GroupId = g.Id AND m.UserId = @userId AND m.Status = 'removed') THEN 1 ELSE 0 END AS bit) AS Removed,
               CAST(CASE WHEN g.SailingId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Bookings b JOIN dbo.BookingGuests bg ON bg.BookingId = b.Id WHERE bg.UserId = @userId AND b.Status = 'confirmed' AND b.SailingId = g.SailingId) THEN 1 ELSE 0 END AS bit) AS BookedOnSailing,
               CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Bookings b JOIN dbo.BookingGuests bg ON bg.BookingId = b.Id WHERE bg.UserId = @userId AND b.Status = 'confirmed') THEN 1 ELSE 0 END AS bit) AS AnyBooking
        FROM dbo.ChatGroups g
        """;

    public async Task<List<ChatRoomRow>> ListAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRoomRow>(Sql.Cmd(RoomSelect + " WHERE g.Kind IN ('channel','room') ORDER BY CASE WHEN g.Kind = 'channel' THEN 0 ELSE 1 END, g.Name, g.Id", new { userId }, null, ct))).ToList();
    }

    public async Task<ChatRoomRow?> FindAsync(long userId, Guid groupPublicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatRoomRow>(Sql.Cmd(RoomSelect + " WHERE g.Kind IN ('channel','room') AND g.PublicId = @groupPublicId", new { userId, groupPublicId }, null, ct));
    }

    public async Task<string> JoinAsync(long groupId, long userId, int cap, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<string>(Sql.Cmd("""
            DECLARE @status VARCHAR(7) = (SELECT Status FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND UserId = @userId);
            IF @status = 'removed' SELECT 'removed';
            ELSE IF @status = 'active' SELECT 'ok';
            ELSE IF (SELECT COUNT(*) FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active') >= @cap SELECT 'full';
            ELSE
            BEGIN
              IF @status IS NULL INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, Status, JoinedAt, Muted) VALUES (@groupId, @userId, 'active', @now, 1);
              ELSE UPDATE dbo.ChatGroupMembers SET Status = 'active', LeftAt = NULL, JoinedAt = @now, Muted = 1, MutedUntil = NULL WHERE GroupId = @groupId AND UserId = @userId;
              SELECT 'ok';
            END
            """, new { groupId, userId, cap, now }, null, ct)) ?? "ok";
    }

    public async Task LeaveAsync(long groupId, long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET Status = 'left', LeftAt = @now WHERE GroupId = @groupId AND UserId = @userId AND Status = 'active'", new { groupId, userId, now }, null, ct));
    }

    public async Task AcceptRulesAsync(long groupId, long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET RulesAcceptedAt = ISNULL(RulesAcceptedAt, @now) WHERE GroupId = @groupId AND UserId = @userId AND Status = 'active'", new { groupId, userId, now }, null, ct));
    }

    public async Task<DateTime?> LastPostAsync(long groupId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<DateTime?>(Sql.Cmd("SELECT MAX([At]) FROM dbo.ChatMessages WHERE GroupId = @groupId AND FromUserId = @userId AND IsSystem = 0", new { groupId, userId }, null, ct));
    }

    public async Task<List<ChatPreviewRow>> PreviewAsync(long groupId, string kind, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var sql = kind == ChatRoomRules.Channel
            ? "SELECT TOP (@max) [Text], [At] FROM dbo.ChatMessages WHERE GroupId = @groupId AND IsSystem = 0 AND DeletedAt IS NULL AND [Text] <> N'' ORDER BY Id DESC"
            : "SELECT TOP (@max) m.[Text], m.[At] FROM dbo.ChatPins p JOIN dbo.ChatMessages m ON m.Id = p.MessageId WHERE p.GroupId = @groupId AND m.DeletedAt IS NULL ORDER BY p.[At] DESC";
        return (await c.QueryAsync<ChatPreviewRow>(Sql.Cmd(sql, new { groupId, max }, null, ct))).ToList();
    }

    public async Task<(long Id, Guid PublicId)> CreateAsync(string kind, string? roomKind, string name, string? topic, string? sailingId, int refOffset, int cap, string rules, long by, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // A room starts closed: it opens only once its rota is named (ChatRoomRules.OpenProblem). A channel has only staff posting, so it opens at once.
        return await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.ChatGroups (Name, Kind, RoomKind, Topic, SailingId, RoomClosed, RoomRules, RoomRefOffset, MemberCap, CreatedByUserId)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@name, @kind, @roomKind, @topic, @sailingId, CASE WHEN @kind = 'room' THEN 1 ELSE 0 END, @rules, @refOffset, @cap, @by)
            """, new { kind, roomKind, name, topic, sailingId, refOffset, cap, rules, by }, null, ct));
    }

    public async Task<bool> SailingExistsAsync(string sailingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM ref.Sailings WHERE Id = @sailingId", new { sailingId }, null, ct)) > 0;
    }

    public async Task SetClosedAsync(long groupId, bool closed, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET RoomClosed = @closed, UpdatedAt = SYSUTCDATETIME() WHERE Id = @groupId", new { groupId, closed }, null, ct));
    }

    public async Task SetSlowAsync(long groupId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET SlowMode = @on, UpdatedAt = SYSUTCDATETIME() WHERE Id = @groupId", new { groupId, on }, null, ct));
    }

    public async Task SetRulesAsync(long groupId, string rules, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // New rules ask everyone to accept again on their next post.
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET RoomRules = @rules, UpdatedAt = SYSUTCDATETIME() WHERE Id = @groupId", new { groupId, rules }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET RulesAcceptedAt = NULL WHERE GroupId = @groupId", new { groupId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<int> CountModeratorsAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatRoomModerators WHERE GroupId = @groupId", new { groupId }, null, ct));
    }

    public async Task<bool> SetModeratorAsync(long groupId, Guid personPublicId, bool on, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var userId = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.Users WHERE PublicId = @personPublicId AND Role = 'admin'", new { personPublicId }, null, ct));
        if (userId is null) return false;
        if (on)
            await c.ExecuteAsync(Sql.Cmd("IF NOT EXISTS (SELECT 1 FROM dbo.ChatRoomModerators WHERE GroupId = @groupId AND UserId = @userId) INSERT INTO dbo.ChatRoomModerators (GroupId, UserId, [At]) VALUES (@groupId, @userId, @now)", new { groupId, userId, now }, null, ct));
        else
            await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatRoomModerators WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId }, null, ct));
        return true;
    }

    public async Task<long?> MuteMemberAsync(long groupId, Guid personPublicId, DateTime? until, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<long?>(Sql.Cmd("""
            UPDATE m SET ModMutedUntil = @until
            OUTPUT INSERTED.UserId
            FROM dbo.ChatGroupMembers m JOIN dbo.Users u ON u.Id = m.UserId
            WHERE m.GroupId = @groupId AND u.PublicId = @personPublicId AND m.Status = 'active'
            """, new { groupId, personPublicId, until }, null, ct));
    }

    public async Task<long?> RemoveMemberAsync(long groupId, Guid personPublicId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<long?>(Sql.Cmd("""
            UPDATE m SET Status = 'removed', LeftAt = @now
            OUTPUT INSERTED.UserId
            FROM dbo.ChatGroupMembers m JOIN dbo.Users u ON u.Id = m.UserId
            WHERE m.GroupId = @groupId AND u.PublicId = @personPublicId AND m.Status = 'active'
            """, new { groupId, personPublicId, now }, null, ct));
    }

    public async Task<(long Id, long FromUserId)?> RemoveMessageAsync(long groupId, Guid messagePublicId, long by, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var found = await c.QuerySingleOrDefaultAsync<RemovedRef>(Sql.Cmd("""
            UPDATE dbo.ChatMessages SET OriginalText = ISNULL(OriginalText, [Text]), [Text] = N'', Photo = NULL, DeletedAt = @now
            OUTPUT INSERTED.Id, INSERTED.FromUserId
            WHERE PublicId = @messagePublicId AND GroupId = @groupId AND DeletedAt IS NULL AND IsSystem = 0 AND FromUserId IS NOT NULL
            """, new { groupId, messagePublicId, now }, tx, ct));
        if (found is not null)
            await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatReports SET Status = 'removed', ResolvedAt = @now, ResolvedByUserId = @by WHERE MessageId = @id AND Status = 'open'", new { id = found.Id, now, by }, tx, ct));
        await tx.CommitAsync(ct);
        return found is null ? null : (found.Id, found.FromUserId);
    }

    public async Task<bool> PinAsync(long groupId, Guid messagePublicId, long by, DateTime now, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.ChatMessages WHERE PublicId = @messagePublicId AND GroupId = @groupId AND DeletedAt IS NULL AND IsSystem = 0", new { messagePublicId, groupId }, null, ct));
        if (id is null) return false;
        if (await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatPins WHERE GroupId = @groupId AND MessageId = @id", new { groupId, id }, null, ct)) > 0) return true;
        if (await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatPins WHERE GroupId = @groupId", new { groupId }, null, ct)) >= max) return false;
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatPins (GroupId, MessageId, PinnedBy, [At]) VALUES (@groupId, @id, @by, @now)", new { groupId, id, by, now }, null, ct));
        return true;
    }

    public async Task<List<ChatRoomPostRow>> ListPostsAsync(long groupId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRoomPostRow>(Sql.Cmd("""
            SELECT TOP (@max) m.PublicId, u.PublicId AS FromPublicId, pr.FirstName, pr.LastName, m.[Text], m.[At],
                   CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatPins p WHERE p.GroupId = m.GroupId AND p.MessageId = m.Id) THEN 1 ELSE 0 END AS bit) AS Pinned
            FROM dbo.ChatMessages m
            JOIN dbo.Users u ON u.Id = m.FromUserId
            JOIN dbo.Profiles pr ON pr.UserId = m.FromUserId
            WHERE m.GroupId = @groupId AND m.IsSystem = 0 AND m.DeletedAt IS NULL AND m.FromUserId IS NOT NULL AND m.[Text] <> N''
            ORDER BY m.Id DESC
            """, new { groupId, max }, null, ct))).ToList();
    }

    public async Task<List<ChatRoomPersonRow>> ListPeopleAsync(long groupId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRoomPersonRow>(Sql.Cmd("""
            SELECT TOP (@max) u.PublicId, pr.FirstName, pr.LastName, m.ModMutedUntil AS MutedUntil
            FROM dbo.ChatGroupMembers m
            JOIN dbo.Users u ON u.Id = m.UserId
            JOIN dbo.Profiles pr ON pr.UserId = m.UserId
            WHERE m.GroupId = @groupId AND m.Status = 'active'
            ORDER BY pr.FirstName, pr.LastName
            """, new { groupId, max }, null, ct))).ToList();
    }

    public async Task<List<ChatRoomModeratorRow>> ListModeratorsAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRoomModeratorRow>(Sql.Cmd("""
            SELECT u.PublicId, pr.FirstName, pr.LastName,
                   CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatRoomModerators r WHERE r.GroupId = @groupId AND r.UserId = u.Id) THEN 1 ELSE 0 END AS bit) AS Named
            FROM dbo.Users u JOIN dbo.Profiles pr ON pr.UserId = u.Id
            WHERE u.Role = 'admin'
            ORDER BY pr.FirstName, pr.LastName
            """, new { groupId }, null, ct))).ToList();
    }

    public async Task LogActionAsync(long groupId, long by, string action, long? targetUserId, long? messageId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatRoomActions (GroupId, ByUserId, Action, TargetUserId, MessageId, [At]) VALUES (@groupId, @by, @action, @targetUserId, @messageId, @now)", new { groupId, by, action, targetUserId, messageId, now }, null, ct));
    }

    public async Task AddHeldAsync(long groupId, long fromUserId, string text, string reason, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatHeldMessages (GroupId, FromUserId, [Text], Reason, [At]) VALUES (@groupId, @fromUserId, @text, @reason, @now)", new { groupId, fromUserId, text, reason, now }, null, ct));
    }

    private const string HeldSelect = """
        SELECT h.Id, h.PublicId, h.GroupId, g.PublicId AS GroupPublicId, g.Name AS GroupName, h.FromUserId, pr.FirstName, pr.LastName, h.[Text], h.Reason, h.Status, h.[At]
        FROM dbo.ChatHeldMessages h
        JOIN dbo.ChatGroups g ON g.Id = h.GroupId
        JOIN dbo.Profiles pr ON pr.UserId = h.FromUserId
        """;

    public async Task<List<ChatHeldRow>> ListHeldAsync(int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatHeldRow>(Sql.Cmd(HeldSelect.Replace("SELECT h.Id", "SELECT TOP (@max) h.Id") + " WHERE h.Status = 'held' ORDER BY h.[At], h.Id", new { max }, null, ct))).ToList();
    }

    public async Task<ChatHeldRow?> GetHeldAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatHeldRow>(Sql.Cmd(HeldSelect + " WHERE h.PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<bool> ResolveHeldAsync(long id, string status, long by, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatHeldMessages SET Status = @status, ResolvedBy = @by, ResolvedAt = @now, [Text] = CASE WHEN @status = 'rejected' THEN N'' ELSE [Text] END WHERE Id = @id AND Status = 'held'", new { id, status, by, now }, null, ct)) > 0;
    }

    public async Task<int> CountOpenQuestionsAsync(long groupId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatRoomQuestions WHERE GroupId = @groupId AND FromUserId = @userId AND Status = 'suggested'", new { groupId, userId }, null, ct));
    }

    public async Task AddQuestionAsync(long groupId, long userId, string text, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatRoomQuestions (GroupId, FromUserId, [Text], [At]) VALUES (@groupId, @userId, @text, @now)", new { groupId, userId, text, now }, null, ct));
    }

    public async Task<List<string>> ListPopularAsync(long groupId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd("SELECT TOP (@max) [Text] FROM dbo.ChatRoomQuestions WHERE GroupId = @groupId AND Status = 'popular' ORDER BY ResolvedAt DESC, Id DESC", new { groupId, max }, null, ct))).ToList();
    }

    private const string QuestionSelect = """
        SELECT q.Id, q.PublicId, g.PublicId AS GroupPublicId, g.Name AS GroupName, q.[Text], q.Status, q.[At]
        FROM dbo.ChatRoomQuestions q JOIN dbo.ChatGroups g ON g.Id = q.GroupId
        """;

    public async Task<List<ChatQuestionRow>> ListSuggestedAsync(int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatQuestionRow>(Sql.Cmd(QuestionSelect.Replace("SELECT q.Id", "SELECT TOP (@max) q.Id") + " WHERE q.Status = 'suggested' ORDER BY q.[At], q.Id", new { max }, null, ct))).ToList();
    }

    public async Task<ChatQuestionRow?> GetQuestionAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatQuestionRow>(Sql.Cmd(QuestionSelect + " WHERE q.PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<bool> ResolveQuestionAsync(long id, string status, long by, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatRoomQuestions SET Status = @status, ResolvedBy = @by, ResolvedAt = @now, [Text] = CASE WHEN @status = 'rejected' THEN N'' ELSE [Text] END WHERE Id = @id AND Status = 'suggested'", new { id, status, by, now }, null, ct)) > 0;
    }

    public async Task<List<long>> ActiveMemberIdsAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<long>(Sql.Cmd("SELECT UserId FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active'", new { groupId }, null, ct))).ToList();
    }

    public async Task<int> CountReportsAsync(DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT COUNT(*) FROM dbo.ChatReports r JOIN dbo.ChatMessages m ON m.Id = r.MessageId JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            WHERE g.Kind IN ('channel','room') AND r.[At] >= @since
            """, new { since }, null, ct));
    }

    public async Task<List<ChatActionCountRow>> ActionCountsAsync(DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatActionCountRow>(Sql.Cmd("SELECT Action, COUNT(*) AS [Count] FROM dbo.ChatRoomActions WHERE [At] >= @since GROUP BY Action ORDER BY Action", new { since }, null, ct))).ToList();
    }

    public async Task<List<ChatRoomCountRow>> BusiestAsync(DateTime since, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRoomCountRow>(Sql.Cmd("""
            SELECT TOP (@max) g.PublicId AS GroupPublicId, g.Name, COUNT(*) AS [Count]
            FROM dbo.ChatMessages m JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            WHERE g.Kind = 'room' AND m.IsSystem = 0 AND m.[At] >= @since
            GROUP BY g.PublicId, g.Name ORDER BY COUNT(*) DESC, g.Name
            """, new { since, max }, null, ct))).ToList();
    }

    public async Task<List<ChatRoomRow>> ListAllAsync(CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRoomRow>(Sql.Cmd(RoomSelect + " WHERE g.Kind IN ('channel','room') ORDER BY g.Name, g.Id", new { userId = 0L }, null, ct))).ToList();
    }

    public async Task<int> CountHeldAsync(CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatHeldMessages WHERE Status = 'held'", null, null, ct));
    }
}

/// <summary>
/// What the retention job removes from rooms (docs/chat-features-research.md, 8.1 and 8.5): a sailing room's posts go 30 days after the sailing ends, an interest room's posts 12 months after they were made.
/// A channel is staff-written and is not purged. Held posts that were decided are cleared of their words after 30 days. Runs on real time, with the rest of the retention job.
/// </summary>
public static class ChatRoomRetention
{
    public const int SailingRoomDays = 30, InterestRoomMonths = 12, HeldDays = 30;

    public static async Task<int> DeleteOldAsync(IDbConnectionFactory db, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var sailing = await c.ExecuteAsync(Sql.Cmd("""
            DELETE m FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN ref.Sailings s ON s.Id = g.SailingId
            WHERE g.Kind = 'room' AND g.RoomKind = 'sailing' AND DATEADD(day, s.Nights + @days, CAST(s.Departure AS DATETIME2)) <= @now
            """, new { now, days = SailingRoomDays }, tx, ct));
        var interest = await c.ExecuteAsync(Sql.Cmd("""
            DELETE m FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            WHERE g.Kind = 'room' AND g.RoomKind = 'interest' AND m.[At] <= DATEADD(month, -@months, @now)
            """, new { now, months = InterestRoomMonths }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatHeldMessages WHERE Status <> 'held' AND ResolvedAt <= DATEADD(day, -@days, @now)", new { now, days = HeldDays }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatRoomQuestions WHERE Status = 'rejected' AND ResolvedAt <= DATEADD(day, -@days, @now)", new { now, days = HeldDays }, tx, ct));
        await tx.CommitAsync(ct);
        return sailing + interest;
    }
}
