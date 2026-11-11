using System.Data.Common;
using Dapper;

namespace Princess.Api.Data;

/// <summary>A guest-made group.</summary>
public sealed class ChatGroupRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Name { get; set; } = "";
    public long? CreatedByUserId { get; set; }
    /// <summary>Phase 4: only admins post.</summary>
    public bool AnnouncementOnly { get; set; }
}

/// <summary>A person in a group, with the names the screens show.</summary>
public sealed class ChatGroupPersonRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public bool IsSupervised { get; set; }
    /// <summary>Phase 4: the second admin (the creator is always one and is not flagged).</summary>
    public bool IsAdmin { get; set; }
    public string? Avatar { get; set; }
}

/// <summary>One invitation, with the group and the names of the inviter and invitee.</summary>
public sealed class ChatGroupInviteRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long GroupId { get; set; }
    public string GroupName { get; set; } = "";
    public long InviterId { get; set; }
    public string InviterFirst { get; set; } = "";
    public string InviterLast { get; set; } = "";
    public long InviteeId { get; set; }
    public Guid InviteePublicId { get; set; }
    public string InviteeFirst { get; set; } = "";
    public string InviteeLast { get; set; } = "";
    public string Status { get; set; } = "";
    public long? GuardianUserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Guest-made groups and their invitations (docs/chat-plan.md, phase 5). Every write that depends on a status says which statuses it expects, so two answers at once cannot both win.</summary>
public interface IChatGroupStore
{
    /// <summary>Makes a group with the creator as its only member. Returns the group.</summary>
    Task<ChatGroupRow> CreateAsync(long creatorId, string name, DateTime now, CancellationToken ct);
    /// <summary>The group a person is an active member of, or null. The check behind everything but answering an invitation.</summary>
    Task<ChatGroupRow?> GetForMemberAsync(long userId, Guid conversationId, CancellationToken ct);
    /// <summary>The people who are in the group now, the creator first, then in the order they joined.</summary>
    Task<List<ChatGroupPersonRow>> ListActiveAsync(long groupId, CancellationToken ct);
    /// <summary>Names or releases the group's second admin.</summary>
    Task SetAdminAsync(long groupId, long userId, bool on, CancellationToken ct);
    /// <summary>Makes the group announcement-only (only admins post) or open again.</summary>
    Task SetAnnouncementOnlyAsync(long groupId, bool on, CancellationToken ct);
    /// <summary>The invitations still waiting for the group.</summary>
    Task<List<ChatGroupInviteRow>> ListWaitingAsync(long groupId, CancellationToken ct);
    /// <summary>Whether the two people have an agreed chat connection (either way round).</summary>
    Task<bool> AreConnectedAsync(long a, long b, CancellationToken ct);
    Task<bool> HasBlockedAsync(long blocker, long blocked, CancellationToken ct);
    /// <summary>Adds a waiting invitation. Null when the person already has one for the group, or is already in it.</summary>
    Task<ChatGroupInviteRow?> InviteAsync(long groupId, long inviterId, long inviteeId, string status, long? guardianUserId, DateTime expiresAt, DateTime now, CancellationToken ct);
    Task<ChatGroupInviteRow?> GetInviteAsync(Guid publicId, CancellationToken ct);
    /// <summary>The invitations waiting for the person, or for a child they are guardian of, newest first. Not those from someone the person blocked.</summary>
    Task<List<ChatGroupInviteRow>> ListInvitesForAsync(long userId, CancellationToken ct);
    /// <summary>Closes a waiting invitation, only if it is still in one of <paramref name="from"/>. False when it was not.</summary>
    Task<bool> SetInviteStatusAsync(long id, string[] from, string to, DateTime now, CancellationToken ct);
    /// <summary>
    /// Accepts a waiting invitation and puts the person in the group in one transaction, with a "joined" line. A person who was in before starts a fresh window (they never see what was said while they were away).
    /// Returns <c>null</c> when done, <c>answered</c> when it was no longer waiting, <c>full</c> when the group has no room.
    /// </summary>
    Task<string?> AcceptInviteAsync(long id, string joinedLine, int max, DateTime now, CancellationToken ct);
    /// <summary>Takes a person out (<paramref name="status"/> is <c>left</c> or <c>removed</c>) and adds the line. When the creator leaves, the person who has been in longest becomes the creator. False when they were not an active member.</summary>
    Task<bool> RemoveMemberAsync(long groupId, long userId, string status, string line, DateTime now, CancellationToken ct);
    /// <summary>Renames the group and adds the line.</summary>
    Task RenameAsync(long groupId, long byUserId, string name, string line, DateTime now, CancellationToken ct);
    /// <summary>Closes waiting invitations that passed their time, for the person (as invitee or guardian) or the group's creator.</summary>
    Task ExpireAsync(long userId, DateTime now, CancellationToken ct);
}

public sealed class DapperChatGroupStore(IDbConnectionFactory db) : IChatGroupStore
{
    private const string InviteSelect = """
        SELECT i.Id, i.PublicId, i.GroupId, g.Name AS GroupName, i.InviterId, ip.FirstName AS InviterFirst, ip.LastName AS InviterLast,
               i.InviteeId, u.PublicId AS InviteePublicId, up.FirstName AS InviteeFirst, up.LastName AS InviteeLast,
               i.Status, i.GuardianUserId, i.ExpiresAt, i.CreatedAt
        FROM dbo.ChatGroupInvites i
        JOIN dbo.ChatGroups g ON g.Id = i.GroupId
        JOIN dbo.Profiles ip ON ip.UserId = i.InviterId
        JOIN dbo.Users u ON u.Id = i.InviteeId
        JOIN dbo.Profiles up ON up.UserId = u.Id
        """;

    public async Task<ChatGroupRow> CreateAsync(long creatorId, string name, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var group = await c.QuerySingleAsync<ChatGroupRow>(Sql.Cmd("""
            INSERT INTO dbo.ChatGroups (Name, Kind, CreatedByUserId) OUTPUT INSERTED.Id, INSERTED.PublicId, INSERTED.Name, INSERTED.CreatedByUserId
            VALUES (@name, 'group', @creatorId)
            """, new { name, creatorId }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, Status, JoinedAt) VALUES (@id, @creatorId, 'active', @now)", new { group.Id, creatorId, now }, tx, ct));
        await tx.CommitAsync(ct);
        return group;
    }

    public async Task<ChatGroupRow?> GetForMemberAsync(long userId, Guid conversationId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatGroupRow>(Sql.Cmd("""
            SELECT g.Id, g.PublicId, g.Name, g.CreatedByUserId, g.AnnouncementOnly
            FROM dbo.ChatGroups g
            JOIN dbo.ChatGroupMembers m ON m.GroupId = g.Id AND m.UserId = @userId AND m.Status = 'active'
            WHERE g.PublicId = @conversationId AND g.Kind = 'group'
            """, new { userId, conversationId }, null, ct));
    }

    public async Task<List<ChatGroupPersonRow>> ListActiveAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatGroupPersonRow>(Sql.Cmd("""
            SELECT u.Id AS UserId, u.PublicId, p.FirstName, p.LastName, u.IsSupervised, m.IsAdmin, up.ChatAvatar AS Avatar
            FROM dbo.ChatGroupMembers m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.Users u ON u.Id = m.UserId
            JOIN dbo.Profiles p ON p.UserId = u.Id
            LEFT JOIN dbo.UserPrefs up ON up.UserId = u.Id
            WHERE m.GroupId = @groupId AND m.Status = 'active'
            ORDER BY CASE WHEN u.Id = g.CreatedByUserId THEN 0 ELSE 1 END, m.JoinedAt, u.Id
            """, new { groupId }, null, ct))).ToList();
    }

    public async Task SetAdminAsync(long groupId, long userId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET IsAdmin = @on WHERE GroupId = @groupId AND UserId = @userId AND Status = 'active'", new { groupId, userId, on }, null, ct));
    }

    public async Task SetAnnouncementOnlyAsync(long groupId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroups SET AnnouncementOnly = @on WHERE Id = @groupId AND Kind = 'group'", new { groupId, on }, null, ct));
    }

    public async Task<List<ChatGroupInviteRow>> ListWaitingAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatGroupInviteRow>(Sql.Cmd(InviteSelect + " WHERE i.GroupId = @groupId AND i.Status IN ('awaitingGuardian','pending') ORDER BY i.CreatedAt, i.Id", new { groupId }, null, ct))).ToList();
    }

    public async Task<bool> AreConnectedAsync(long a, long b, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatConnections WHERE Status = 'accepted' AND ((RequesterId = @a AND TargetId = @b) OR (RequesterId = @b AND TargetId = @a))) THEN 1 ELSE 0 END
            """, new { a, b }, null, ct)) == 1;
    }

    public async Task<bool> HasBlockedAsync(long blocker, long blocked, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatBlocks WHERE UserId = @blocker AND BlockedUserId = @blocked) THEN 1 ELSE 0 END", new { blocker, blocked }, null, ct)) == 1;
    }

    public async Task<ChatGroupInviteRow?> InviteAsync(long groupId, long inviterId, long inviteeId, string status, long? guardianUserId, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        if (await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND UserId = @inviteeId AND Status = 'active'", new { groupId, inviteeId }, null, ct)) > 0) return null;
        Guid publicId;
        try
        {
            publicId = await c.ExecuteScalarAsync<Guid>(Sql.Cmd("""
                INSERT INTO dbo.ChatGroupInvites (GroupId, InviterId, InviteeId, Status, GuardianUserId, ExpiresAt, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.PublicId
                VALUES (@groupId, @inviterId, @inviteeId, @status, @guardianUserId, @expiresAt, @now, @now)
                """, new { groupId, inviterId, inviteeId, status, guardianUserId, expiresAt, now }, null, ct));
        }
        catch (DbException e) when (e is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
        {
            return null;   // the one-waiting-invitation index: they were already asked
        }
        return await GetInviteAsync(publicId, ct);
    }

    public async Task<ChatGroupInviteRow?> GetInviteAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatGroupInviteRow>(Sql.Cmd(InviteSelect + " WHERE i.PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<List<ChatGroupInviteRow>> ListInvitesForAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatGroupInviteRow>(Sql.Cmd(InviteSelect + """

            WHERE ((i.Status = 'pending' AND i.InviteeId = @userId) OR (i.Status = 'awaitingGuardian' AND i.GuardianUserId = @userId))
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatBlocks bl WHERE bl.UserId = i.InviteeId AND bl.BlockedUserId = i.InviterId)
            ORDER BY i.CreatedAt DESC, i.Id DESC
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<bool> SetInviteStatusAsync(long id, string[] from, string to, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroupInvites SET Status = @to, RespondedAt = @now, UpdatedAt = @now WHERE Id = @id AND Status IN @from
            """, new { id, from, to, now }, null, ct)) == 1;
    }

    public async Task<string?> AcceptInviteAsync(long id, string joinedLine, int max, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var invite = await c.QuerySingleOrDefaultAsync<(long GroupId, long InviteeId)?>(Sql.Cmd("""
            UPDATE dbo.ChatGroupInvites SET Status = 'accepted', RespondedAt = @now, UpdatedAt = @now
            OUTPUT INSERTED.GroupId, INSERTED.InviteeId
            WHERE Id = @id AND Status IN ('awaitingGuardian','pending')
            """, new { id, now }, tx, ct));
        if (invite is not { } i) return "answered";
        // The room is counted inside the transaction, with the group row locked, so two acceptances at the limit cannot both get in.
        await c.ExecuteAsync(Sql.Cmd("SELECT Id FROM dbo.ChatGroups WITH (UPDLOCK, HOLDLOCK) WHERE Id = @groupId", new { i.GroupId }, tx, ct));
        if (await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active'", new { i.GroupId }, tx, ct)) >= max)
        {
            await tx.RollbackAsync(ct);
            return "full";
        }
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroupMembers SET Status = 'active', JoinedAt = @now, LeftAt = NULL, LastReadMessageId = NULL, IsAdmin = 0 WHERE GroupId = @groupId AND UserId = @inviteeId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.ChatGroupMembers (GroupId, UserId, Status, JoinedAt) VALUES (@groupId, @inviteeId, 'active', @now);
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At]) VALUES (@groupId, @inviteeId, @joinedLine, 1, @now);
            """, new { i.GroupId, i.InviteeId, joinedLine, now }, tx, ct));
        await tx.CommitAsync(ct);
        return null;
    }

    public async Task<bool> RemoveMemberAsync(long groupId, long userId, string status, string line, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var changed = await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroupMembers SET Status = @status, LeftAt = @now, IsAdmin = 0 WHERE GroupId = @groupId AND UserId = @userId AND Status = 'active'
            """, new { groupId, userId, status, now }, tx, ct));
        if (changed == 0) return false;
        // The line is sent from the person who went, at the moment they went, so it is the last thing they can read.
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At]) VALUES (@groupId, @userId, @line, 1, @now);
            UPDATE dbo.ChatGroups SET UpdatedAt = @now,
                CreatedByUserId = (SELECT TOP 1 m.UserId FROM dbo.ChatGroupMembers m WHERE m.GroupId = @groupId AND m.Status = 'active' ORDER BY m.JoinedAt, m.UserId)
            WHERE Id = @groupId AND CreatedByUserId = @userId;
            """, new { groupId, userId, line, now }, tx, ct));
        // Whatever the person had invited and was still waiting is withdrawn with them.
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupInvites SET Status = 'cancelled', UpdatedAt = @now WHERE GroupId = @groupId AND InviterId = @userId AND Status IN ('awaitingGuardian','pending')", new { groupId, userId, now }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    public async Task RenameAsync(long groupId, long byUserId, string name, string line, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroups SET Name = @name, UpdatedAt = @now WHERE Id = @groupId;
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At]) VALUES (@groupId, @byUserId, @line, 1, @now);
            """, new { groupId, byUserId, name, line, now }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task ExpireAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroupInvites SET Status = 'expired', UpdatedAt = @now
            WHERE Status IN ('awaitingGuardian','pending') AND ExpiresAt <= @now AND (InviteeId = @userId OR GuardianUserId = @userId OR InviterId = @userId)
            """, new { userId, now }, null, ct));
    }
}
