using Dapper;

namespace Princess.Api.Data;

public sealed class ChatHuddleLinkRow
{
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public sealed class ChatHuddleCardRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long AddedBy { get; set; }
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string Payload { get; set; } = "{}";
    public DateTime AsOf { get; set; }
}

/// <summary>The trip huddle's storage (docs/chat-features-research.md, phase 15). A huddle is a <c>ChatGroups</c> row of Kind <c>huddle</c>; messages, reads and the window are the ordinary chat's.</summary>
public interface IChatHuddleStore
{
    /// <summary>The caller's date of birth, or null when there is no profile.</summary>
    Task<DateOnly?> BornAsync(long userId, CancellationToken ct);
    Task ConfirmAdultAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>How many huddles the person made that are still open (they are in), and how many they are in.</summary>
    Task<(int OpenAsCreator, int In)> CountsAsync(long userId, CancellationToken ct);
    Task<ChatGroupRow> CreateAsync(long creatorId, string name, DateTime now, CancellationToken ct);
    /// <summary>The huddle the person is an active member of, or null.</summary>
    Task<ChatGroupRow?> GetForMemberAsync(long userId, Guid id, CancellationToken ct);
    Task<DateTime> LastActivityAsync(long groupId, CancellationToken ct);
    /// <summary>Replaces any live link with a new one (the old ones are revoked in the same transaction).</summary>
    Task MakeLinkAsync(long groupId, long by, string tokenHash, DateTime now, DateTime expiresAt, CancellationToken ct);
    Task RevokeLinksAsync(long groupId, DateTime now, CancellationToken ct);
    Task<DateTime?> LiveLinkUntilAsync(long groupId, DateTime now, CancellationToken ct);
    Task<int> LinksMadeSinceAsync(long by, DateTime since, CancellationToken ct);
    Task<ChatHuddleLinkRow?> FindLinkAsync(string tokenHash, CancellationToken ct);
    /// <summary>Puts the person in with a "joined" line, counted with the group locked so two joins at the limit cannot both get in. Null when done, <c>full</c> when there is no room.</summary>
    Task<string?> JoinAsync(long groupId, long userId, string line, int max, DateTime now, CancellationToken ct);
    Task<List<ChatHuddleCardRow>> ListCardsAsync(long groupId, CancellationToken ct);
    Task AddCardAsync(long groupId, long by, string kind, string title, string payload, DateTime asOf, DateTime now, CancellationToken ct);
    /// <summary>Removes a card the person added (anyone may remove their own; the creator may remove any: <paramref name="any"/>). False when none matched.</summary>
    Task<bool> RemoveCardAsync(long groupId, Guid cardId, long by, bool any, CancellationToken ct);
    /// <summary>When each of these people joined the huddle (their current window's start).</summary>
    Task<List<DateTime>> JoinTimesAsync(long groupId, IReadOnlyCollection<long> userIds, CancellationToken ct);
    /// <summary>The members who said OK to carry the history over.</summary>
    Task<HashSet<long>> ListCarryAsync(long groupId, CancellationToken ct);
    Task SetCarryAsync(long groupId, long userId, bool agree, DateTime now, CancellationToken ct);
    /// <summary>The caller's confirmed booking (by number, else the latest) that they booked, with the users on it, or null.</summary>
    Task<HuddleBookingRow?> FindBookingAsync(long bookerId, string? number, CancellationToken ct);
    /// <summary>
    /// One transaction: makes the booking's party chat if there is none, adds the members going there, copies the huddle's text from <paramref name="carryFrom"/> (only from those members, never a photo) when
    /// <paramref name="carryHistory"/>, then turns the huddle into an ordinary group (<paramref name="keepGroup"/>) or deletes it. Returns the party chat's public id.
    /// </summary>
    Task<Guid> ConvertAsync(long groupId, long bookingId, IReadOnlyCollection<long> party, bool carryHistory, DateTime carryFrom, bool keepGroup, string line, DateTime now, CancellationToken ct);
}

public sealed class HuddleBookingRow
{
    public long BookingId { get; set; }
    public List<long> UserIds { get; set; } = [];
}

public sealed class DapperChatHuddleStore(IDbConnectionFactory db) : IChatHuddleStore
{
    public async Task<DateOnly?> BornAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var dob = await c.ExecuteScalarAsync<DateTime?>(Sql.Cmd("SELECT Dob FROM dbo.Profiles WHERE UserId = @userId", new { userId }, null, ct));
        return dob is { } d ? DateOnly.FromDateTime(d) : null;
    }

    public async Task ConfirmAdultAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("IF NOT EXISTS (SELECT 1 FROM dbo.ChatAgeConfirmations WHERE UserId = @userId) INSERT INTO dbo.ChatAgeConfirmations (UserId, ConfirmedAt) VALUES (@userId, @now)", new { userId, now }, null, ct));
    }

    public async Task<(int OpenAsCreator, int In)> CountsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleAsync<(int Made, int Inside)>(Sql.Cmd("""
            SELECT ISNULL(SUM(CASE WHEN g.CreatedByUserId = @userId THEN 1 ELSE 0 END), 0) AS Made, COUNT(*) AS Inside
            FROM dbo.ChatGroupMembers m JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            WHERE m.UserId = @userId AND m.Status = 'active' AND g.Kind = 'huddle'
            """, new { userId }, null, ct));
        return (row.Made, row.Inside);
    }

    public async Task<ChatGroupRow> CreateAsync(long creatorId, string name, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var group = await c.QuerySingleAsync<ChatGroupRow>(Sql.Cmd("""
            INSERT INTO dbo.ChatGroups (Name, Kind, CreatedByUserId) OUTPUT INSERTED.Id, INSERTED.PublicId, INSERTED.Name, INSERTED.CreatedByUserId
            VALUES (@name, 'huddle', @creatorId)
            """, new { name, creatorId }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, Status, JoinedAt) VALUES (@id, @creatorId, 'active', @now)", new { group.Id, creatorId, now }, tx, ct));
        await tx.CommitAsync(ct);
        return group;
    }

    public async Task<ChatGroupRow?> GetForMemberAsync(long userId, Guid id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatGroupRow>(Sql.Cmd("""
            SELECT g.Id, g.PublicId, g.Name, g.CreatedByUserId, g.AnnouncementOnly
            FROM dbo.ChatGroups g JOIN dbo.ChatGroupMembers m ON m.GroupId = g.Id AND m.UserId = @userId AND m.Status = 'active'
            WHERE g.PublicId = @id AND g.Kind = 'huddle'
            """, new { userId, id }, null, ct));
    }

    public async Task<DateTime> LastActivityAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<DateTime>(Sql.Cmd("SELECT ISNULL((SELECT MAX([At]) FROM dbo.ChatMessages WHERE GroupId = @groupId AND IsSystem = 0), (SELECT CreatedAt FROM dbo.ChatGroups WHERE Id = @groupId))", new { groupId }, null, ct));
    }

    public async Task MakeLinkAsync(long groupId, long by, string tokenHash, DateTime now, DateTime expiresAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatHuddleInvites SET RevokedAt = @now WHERE GroupId = @groupId AND RevokedAt IS NULL", new { groupId, now }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatHuddleInvites (GroupId, CreatedBy, TokenHash, CreatedAt, ExpiresAt) VALUES (@groupId, @by, @tokenHash, @now, @expiresAt)", new { groupId, by, tokenHash, now, expiresAt }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task RevokeLinksAsync(long groupId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatHuddleInvites SET RevokedAt = @now WHERE GroupId = @groupId AND RevokedAt IS NULL", new { groupId, now }, null, ct));
    }

    public async Task<DateTime?> LiveLinkUntilAsync(long groupId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<DateTime?>(Sql.Cmd("SELECT MAX(ExpiresAt) FROM dbo.ChatHuddleInvites WHERE GroupId = @groupId AND RevokedAt IS NULL AND ExpiresAt > @now", new { groupId, now }, null, ct));
    }

    public async Task<int> LinksMadeSinceAsync(long by, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatHuddleInvites WHERE CreatedBy = @by AND CreatedAt >= @since", new { by, since }, null, ct));
    }

    public async Task<ChatHuddleLinkRow?> FindLinkAsync(string tokenHash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatHuddleLinkRow>(Sql.Cmd("""
            SELECT i.GroupId, g.PublicId AS GroupPublicId, i.ExpiresAt, i.RevokedAt
            FROM dbo.ChatHuddleInvites i JOIN dbo.ChatGroups g ON g.Id = i.GroupId AND g.Kind = 'huddle'
            WHERE i.TokenHash = @tokenHash
            """, new { tokenHash }, null, ct));
    }

    public async Task<string?> JoinAsync(long groupId, long userId, string line, int max, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("SELECT Id FROM dbo.ChatGroups WITH (UPDLOCK, HOLDLOCK) WHERE Id = @groupId", new { groupId }, tx, ct));
        if (await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active'", new { groupId }, tx, ct)) >= max)
        {
            await tx.RollbackAsync(ct);
            return "full";
        }
        // Someone who was in before starts a fresh window: they never read what was said while they were away.
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroupMembers SET Status = 'active', JoinedAt = @now, LeftAt = NULL, LastReadMessageId = NULL, IsAdmin = 0 WHERE GroupId = @groupId AND UserId = @userId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, Status, JoinedAt) VALUES (@groupId, @userId, 'active', @now);
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At]) VALUES (@groupId, @userId, @line, 1, @now);
            """, new { groupId, userId, line, now }, tx, ct));
        await tx.CommitAsync(ct);
        return null;
    }

    public async Task<List<ChatHuddleCardRow>> ListCardsAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatHuddleCardRow>(Sql.Cmd("SELECT Id, PublicId, AddedBy, Kind, Title, Payload, AsOf FROM dbo.ChatHuddleShortlist WHERE GroupId = @groupId ORDER BY CreatedAt, Id", new { groupId }, null, ct))).ToList();
    }

    public async Task AddCardAsync(long groupId, long by, string kind, string title, string payload, DateTime asOf, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatHuddleShortlist (PublicId, GroupId, AddedBy, Kind, Title, Payload, AsOf, CreatedAt) VALUES (NEWID(), @groupId, @by, @kind, @title, @payload, @asOf, @now)", new { groupId, by, kind, title, payload, asOf, now }, null, ct));
    }

    public async Task<bool> RemoveCardAsync(long groupId, Guid cardId, long by, bool any, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatHuddleShortlist WHERE GroupId = @groupId AND PublicId = @cardId AND (@any = 1 OR AddedBy = @by)", new { groupId, cardId, by, any }, null, ct)) > 0;
    }

    public async Task<List<DateTime>> JoinTimesAsync(long groupId, IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<DateTime>(Sql.Cmd("SELECT JoinedAt FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active' AND UserId IN @userIds", new { groupId, userIds }, null, ct))).ToList();
    }

    public async Task<HashSet<long>> ListCarryAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<long>(Sql.Cmd("SELECT UserId FROM dbo.ChatHuddleCarry WHERE GroupId = @groupId", new { groupId }, null, ct))).ToHashSet();
    }

    public async Task SetCarryAsync(long groupId, long userId, bool agree, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(agree
            ? "IF NOT EXISTS (SELECT 1 FROM dbo.ChatHuddleCarry WHERE GroupId = @groupId AND UserId = @userId) INSERT INTO dbo.ChatHuddleCarry (GroupId, UserId, AgreedAt) VALUES (@groupId, @userId, @now)"
            : "DELETE FROM dbo.ChatHuddleCarry WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, now }, null, ct));
    }

    public async Task<HuddleBookingRow?> FindBookingAsync(long bookerId, string? number, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("""
            SELECT TOP 1 Id FROM dbo.Bookings WHERE BookerUserId = @bookerId AND Status = 'confirmed' AND (@number IS NULL OR Number = @number) ORDER BY Id DESC
            """, new { bookerId, number }, null, ct));
        if (id is not { } bookingId) return null;
        var users = (await c.QueryAsync<long>(Sql.Cmd("SELECT UserId FROM dbo.BookingGuests WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToList();
        return new() { BookingId = bookingId, UserIds = users };
    }

    public async Task<Guid> ConvertAsync(long groupId, long bookingId, IReadOnlyCollection<long> party, bool carryHistory, DateTime carryFrom, bool keepGroup, string line, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var partyId = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.ChatGroups WHERE Kind = 'party' AND BookingId = @bookingId", new { bookingId }, tx, ct))
            ?? await c.ExecuteScalarAsync<long>(Sql.Cmd("INSERT INTO dbo.ChatGroups (Name, Kind, BookingId) OUTPUT INSERTED.Id VALUES (N'My group', 'party', @bookingId)", new { bookingId }, tx, ct));
        // Everyone going, once. A person who left the party chat before keeps that choice.
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatGroupMembers (GroupId, UserId)
            SELECT @partyId, u FROM (SELECT DISTINCT UserId AS u FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active' AND UserId IN @party) x
            WHERE NOT EXISTS (SELECT 1 FROM dbo.ChatGroupMembers m WHERE m.GroupId = @partyId AND m.UserId = x.u)
            """, new { partyId, groupId, party }, tx, ct));
        if (carryHistory)
            await c.ExecuteAsync(Sql.Cmd("""
                INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At])
                SELECT @partyId, m.FromUserId, m.[Text], 0, m.[At] FROM dbo.ChatMessages m
                WHERE m.GroupId = @groupId AND m.IsSystem = 0 AND m.Kind = 'text' AND m.DeletedAt IS NULL AND m.Photo IS NULL AND m.FromUserId IN @party AND m.[At] >= @carryFrom
                ORDER BY m.[At], m.Id
                """, new { partyId, groupId, party, carryFrom }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At]) SELECT @partyId, CreatedByUserId, @line, 1, @now FROM dbo.ChatGroups WHERE Id = @groupId", new { partyId, groupId, line, now }, tx, ct));
        if (keepGroup)
            await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET Kind = 'group' WHERE Id = @groupId AND Kind = 'huddle'; DELETE FROM dbo.ChatHuddleInvites WHERE GroupId = @groupId; DELETE FROM dbo.ChatHuddleCarry WHERE GroupId = @groupId;", new { groupId }, tx, ct));
        else
            await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatGroups WHERE Id = @groupId AND Kind = 'huddle'", new { groupId }, tx, ct));
        var publicId = await c.ExecuteScalarAsync<Guid>(Sql.Cmd("SELECT PublicId FROM dbo.ChatGroups WHERE Id = @partyId", new { partyId }, tx, ct));
        await tx.CommitAsync(ct);
        return publicId;
    }
}

/// <summary>A huddle with no message for 60 days is deleted whole (its members, messages, links and cards go with it).</summary>
public static class ChatHuddleRetention
{
    public static async Task<int> DeleteQuietAsync(IDbConnectionFactory db, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            DELETE g FROM dbo.ChatGroups g
            WHERE g.Kind = 'huddle' AND ISNULL((SELECT MAX(m.[At]) FROM dbo.ChatMessages m WHERE m.GroupId = g.Id AND m.IsSystem = 0), g.CreatedAt) <= DATEADD(day, -@days, @now)
            """, new { now, days = Domain.ChatHuddleRules.DeleteAfterDays }, null, ct));
    }
}
