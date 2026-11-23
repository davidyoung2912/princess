using Dapper;

namespace Princess.Api.Data;

public sealed class ChatMeetUpRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public long StartedBy { get; set; }
    public string Title { get; set; } = "";
    public string? Place { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public int In { get; set; }
    public int Maybe { get; set; }
    /// <summary>The caller's own answer (in, maybe or no), or null. A "no" is shown only to the person who gave it.</summary>
    public string? Mine { get; set; }
}

public sealed class ChatIntroOptInRow
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Interest { get; set; } = "";
    public DateTime AskedAt { get; set; }
    public DateTime EndsAt { get; set; }
    public bool Adult { get; set; }
    public bool Supervised { get; set; }
}

public sealed class ChatHostFlagRow
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string RoomName { get; set; } = "";
    public Guid MessageId { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

/// <summary>Storage for Stanley as host (docs/chat-features-research.md, phase 12): meet-ups, "introduce me", and flags to staff. Holds ids, short answers and reasons, never message words.</summary>
public interface IChatHostStore
{
    // ---- Meet-ups ----
    Task<int> MeetUpsStartedSinceAsync(long userId, DateTime since, CancellationToken ct);
    Task<Guid> CreateMeetUpAsync(long groupId, long by, string title, string? place, DateTime? startsAt, DateTime now, CancellationToken ct);
    /// <summary>The meet-ups of a room or group, newest first, with counts of in and maybe only and the caller's own answer.</summary>
    Task<List<ChatMeetUpRow>> ListMeetUpsAsync(long groupId, long userId, int max, CancellationToken ct);
    /// <summary>One meet-up, only if the person is an active member of its room or group (and counts as above); null otherwise.</summary>
    Task<ChatMeetUpRow?> FindMeetUpAsync(long userId, Guid meetUpId, CancellationToken ct);
    Task SetAnswerAsync(long meetUpId, long userId, string answer, DateTime now, CancellationToken ct);

    // ---- Introduce me ----
    Task<int> IntroducedSinceAsync(long userId, DateTime since, CancellationToken ct);
    /// <summary>The caller's live opt-in in a room (not withdrawn, not ended), or null.</summary>
    Task<ChatIntroOptInRow?> LiveOptInAsync(long userId, long groupId, DateTime now, CancellationToken ct);
    Task AddOptInAsync(long userId, long groupId, string interest, DateTime now, DateTime endsAt, CancellationToken ct);
    Task WithdrawOptInsAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>Everyone's live opt-ins in one room, with whether each is an adult (profile date of birth, 18 or over) and supervised.</summary>
    Task<List<ChatIntroOptInRow>> ListLiveOptInsAsync(long groupId, DateTime now, CancellationToken ct);
    Task<bool> WereIntroducedAsync(long a, long b, CancellationToken ct);
    /// <summary>How many introductions each of the people has had since the time (people with none are absent). One query for the whole room.</summary>
    Task<Dictionary<long, int>> IntroducedCountsSinceAsync(IReadOnlyCollection<long> userIds, DateTime since, CancellationToken ct);
    /// <summary>Every (blocker, blocked) pair among the people, in the direction it was set. One query for the whole room.</summary>
    Task<HashSet<(long Blocker, long Blocked)>> BlockedAmongAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);
    /// <summary>Every pair among the people who have already been introduced, in both orders. One query for the whole room.</summary>
    Task<HashSet<(long A, long B)>> IntroducedAmongAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);
    /// <summary>Records the pair once and ends both opt-ins in the same transaction. False when the pair already exists or an opt-in was already ended (another request got there first).</summary>
    Task<bool> CreateIntroductionAsync(long a, long b, long groupId, string interest, DateTime now, CancellationToken ct);
    Task<Dictionary<long, (string First, string Last)>> NamesAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);

    // ---- Room lines and flags ----
    /// <summary>Adds a line from Stanley to a room or group (no sender, shown as a system line). Fixed wording only.</summary>
    Task PostLineAsync(long groupId, string text, DateTime now, CancellationToken ct);
    /// <summary>Whether the room or group has a supervised child as an active member.</summary>
    Task<bool> HasSupervisedMemberAsync(long groupId, CancellationToken ct);
    Task<int> FlagsSinceAsync(long userId, DateTime since, CancellationToken ct);
    /// <summary>Flags a message of a room the person is an active member of. False when it is not in such a room. Holds ids and the reason only.</summary>
    Task<(bool Ok, Guid RoomId)> AddFlagAsync(long userId, Guid messageId, string reason, DateTime now, CancellationToken ct);
    Task<List<ChatHostFlagRow>> ListOpenFlagsAsync(int max, CancellationToken ct);
    Task<bool> DecideFlagAsync(Guid flagId, DateTime now, CancellationToken ct);

    /// <summary>Counts only, since a time: what R6 did (meet-ups and introductions, with the distinct guests who started, answered or were introduced), what R11 did (Stanley's lines in rooms), and flags raised.</summary>
    Task<HostCounts> CountsSinceAsync(DateTime since, CancellationToken ct);
}

public sealed record HostCounts(int MeetUps, int Introductions, int HostGuests, int RoomLines, int Flags);

public sealed class DapperChatHostStore(IDbConnectionFactory db) : IChatHostStore
{
    private const string MeetUpSelect = """
        SELECT u.Id, u.PublicId, u.GroupId, g.PublicId AS GroupPublicId, u.StartedBy, u.Title, u.Place, u.StartsAt, u.CreatedAt,
               (SELECT COUNT(*) FROM dbo.ChatMeetUpAnswers a WHERE a.MeetUpId = u.Id AND a.Answer = 'in') AS [In],
               (SELECT COUNT(*) FROM dbo.ChatMeetUpAnswers a WHERE a.MeetUpId = u.Id AND a.Answer = 'maybe') AS Maybe,
               (SELECT a.Answer FROM dbo.ChatMeetUpAnswers a WHERE a.MeetUpId = u.Id AND a.UserId = @userId) AS Mine
        FROM dbo.ChatMeetUps u
        JOIN dbo.ChatGroups g ON g.Id = u.GroupId
        """;

    public async Task<int> MeetUpsStartedSinceAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatMeetUps WHERE StartedBy = @userId AND CreatedAt >= @since", new { userId, since }, null, ct));
    }

    public async Task<Guid> CreateMeetUpAsync(long groupId, long by, string title, string? place, DateTime? startsAt, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var id = Guid.NewGuid();
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatMeetUps (PublicId, GroupId, StartedBy, Title, Place, StartsAt, CreatedAt) VALUES (@id, @groupId, @by, @title, @place, @startsAt, @now)", new { id, groupId, by, title, place, startsAt, now }, null, ct));
        return id;
    }

    public async Task<List<ChatMeetUpRow>> ListMeetUpsAsync(long groupId, long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatMeetUpRow>(Sql.Cmd(MeetUpSelect + " WHERE u.GroupId = @groupId ORDER BY u.CreatedAt DESC, u.Id DESC OFFSET 0 ROWS FETCH NEXT @max ROWS ONLY", new { groupId, userId, max }, null, ct))).ToList();
    }

    public async Task<ChatMeetUpRow?> FindMeetUpAsync(long userId, Guid meetUpId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatMeetUpRow>(Sql.Cmd(MeetUpSelect + """
             WHERE u.PublicId = @meetUpId AND EXISTS (SELECT 1 FROM dbo.ChatGroupMembers m WHERE m.GroupId = u.GroupId AND m.UserId = @userId AND m.Status = 'active')
            """, new { meetUpId, userId }, null, ct));
    }

    public async Task SetAnswerAsync(long meetUpId, long userId, string answer, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatMeetUpAnswers SET Answer = @answer, AnsweredAt = @now WHERE MeetUpId = @meetUpId AND UserId = @userId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.ChatMeetUpAnswers (MeetUpId, UserId, Answer, AnsweredAt) VALUES (@meetUpId, @userId, @answer, @now);
            """, new { meetUpId, userId, answer, now }, null, ct));
    }

    public async Task<int> IntroducedSinceAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatIntroductions WHERE (UserLow = @userId OR UserHigh = @userId) AND CreatedAt >= @since", new { userId, since }, null, ct));
    }

    public async Task<ChatIntroOptInRow?> LiveOptInAsync(long userId, long groupId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<ChatIntroOptInRow>(Sql.Cmd("SELECT TOP 1 Id, UserId, Interest, AskedAt, EndsAt FROM dbo.ChatIntroOptIns WHERE UserId = @userId AND GroupId = @groupId AND WithdrawnAt IS NULL AND EndsAt > @now ORDER BY AskedAt DESC", new { userId, groupId, now }, null, ct));
    }

    public async Task AddOptInAsync(long userId, long groupId, string interest, DateTime now, DateTime endsAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // One live opt-in at a time: a new one replaces any older.
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatIntroOptIns SET WithdrawnAt = @now WHERE UserId = @userId AND WithdrawnAt IS NULL AND EndsAt > @now;
            INSERT INTO dbo.ChatIntroOptIns (UserId, GroupId, Interest, AskedAt, EndsAt) VALUES (@userId, @groupId, @interest, @now, @endsAt);
            """, new { userId, groupId, interest, now, endsAt }, null, ct));
    }

    public async Task WithdrawOptInsAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatIntroOptIns SET WithdrawnAt = @now WHERE UserId = @userId AND WithdrawnAt IS NULL AND EndsAt > @now", new { userId, now }, null, ct));
    }

    public async Task<List<ChatIntroOptInRow>> ListLiveOptInsAsync(long groupId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatIntroOptInRow>(Sql.Cmd("""
            SELECT o.Id, o.UserId, o.Interest, o.AskedAt, o.EndsAt,
                   CASE WHEN p.Dob IS NOT NULL AND p.Dob <= DATEADD(year, -18, @now) THEN 1 ELSE 0 END AS Adult,
                   u.IsSupervised AS Supervised
            FROM dbo.ChatIntroOptIns o
            JOIN dbo.Users u ON u.Id = o.UserId
            LEFT JOIN dbo.Profiles p ON p.UserId = o.UserId
            JOIN dbo.ChatGroupMembers m ON m.GroupId = o.GroupId AND m.UserId = o.UserId AND m.Status = 'active'
            WHERE o.GroupId = @groupId AND o.WithdrawnAt IS NULL AND o.EndsAt > @now
            """, new { groupId, now }, null, ct))).ToList();
    }

    public async Task<Dictionary<long, int>> IntroducedCountsSinceAsync(IReadOnlyCollection<long> userIds, DateTime since, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long UserId, int N)>(Sql.Cmd("""
            SELECT u.UserId, COUNT(*) AS N
            FROM dbo.ChatIntroductions i
            CROSS APPLY (VALUES (i.UserLow), (i.UserHigh)) AS u (UserId)
            WHERE u.UserId IN @userIds AND i.CreatedAt >= @since
            GROUP BY u.UserId
            """, new { userIds, since }, null, ct));
        return rows.ToDictionary(r => r.UserId, r => r.N);
    }

    public async Task<HashSet<(long Blocker, long Blocked)>> BlockedAmongAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        if (userIds.Count < 2) return [];
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long Blocker, long Blocked)>(Sql.Cmd("SELECT UserId AS Blocker, BlockedUserId AS Blocked FROM dbo.ChatBlocks WHERE UserId IN @userIds AND BlockedUserId IN @userIds", new { userIds }, null, ct));
        return [.. rows];
    }

    public async Task<HashSet<(long A, long B)>> IntroducedAmongAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        if (userIds.Count < 2) return [];
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long Low, long High)>(Sql.Cmd("SELECT UserLow AS Low, UserHigh AS High FROM dbo.ChatIntroductions WHERE UserLow IN @userIds AND UserHigh IN @userIds", new { userIds }, null, ct));
        var set = new HashSet<(long, long)>();
        foreach (var (lo, hi) in rows) { set.Add((lo, hi)); set.Add((hi, lo)); }
        return set;
    }

    public async Task<bool> WereIntroducedAsync(long a, long b, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var (lo, hi) = a < b ? (a, b) : (b, a);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatIntroductions WHERE UserLow = @lo AND UserHigh = @hi) THEN 1 ELSE 0 END", new { lo, hi }, null, ct)) == 1;
    }

    public async Task<bool> CreateIntroductionAsync(long a, long b, long groupId, string interest, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (lo, hi) = a < b ? (a, b) : (b, a);
        // Both opt-ins must still be live: whoever gets here first ends them, so the same guest is never introduced twice at once.
        var ended = await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatIntroOptIns SET WithdrawnAt = @now WHERE GroupId = @groupId AND UserId IN (@a, @b) AND WithdrawnAt IS NULL AND EndsAt > @now", new { groupId, a, b, now }, tx, ct));
        var exists = await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatIntroductions WHERE UserLow = @lo AND UserHigh = @hi) THEN 1 ELSE 0 END", new { lo, hi }, tx, ct)) == 1;
        if (ended < 2 || exists)
        {
            await tx.RollbackAsync(ct);
            return false;
        }
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatIntroductions (UserLow, UserHigh, Interest, CreatedAt) VALUES (@lo, @hi, @interest, @now)", new { lo, hi, interest, now }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    public async Task<Dictionary<long, (string First, string Last)>> NamesAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long UserId, string FirstName, string LastName)>(Sql.Cmd("SELECT Id AS UserId, ChatName AS FirstName, N'' AS LastName FROM dbo.Users WHERE Id IN @userIds", new { userIds }, null, ct));
        return rows.ToDictionary(r => r.UserId, r => (r.FirstName, r.LastName));
    }

    public async Task PostLineAsync(long groupId, string text, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At], Persona, Subtitle) VALUES (@groupId, NULL, @text, 1, @now, 'ship', 'Stanley')", new { groupId, text, now }, null, ct));
    }

    public async Task<bool> HasSupervisedMemberAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatGroupMembers m JOIN dbo.Users u ON u.Id = m.UserId WHERE m.GroupId = @groupId AND m.Status = 'active' AND u.IsSupervised = 1) THEN 1 ELSE 0 END", new { groupId }, null, ct)) == 1;
    }

    public async Task<int> FlagsSinceAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatHostFlags WHERE FlaggedBy = @userId AND CreatedAt >= @since", new { userId, since }, null, ct));
    }

    public async Task<(bool Ok, Guid RoomId)> AddFlagAsync(long userId, Guid messageId, string reason, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<(long GroupId, long MessageId, Guid GroupPublicId)?>(Sql.Cmd("""
            SELECT g.Id AS GroupId, m.Id AS MessageId, g.PublicId AS GroupPublicId
            FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId AND g.Kind IN ('room','group')
            JOIN dbo.ChatGroupMembers gm ON gm.GroupId = g.Id AND gm.UserId = @userId AND gm.Status = 'active'
            WHERE m.PublicId = @messageId AND m.IsSystem = 0
            """, new { userId, messageId }, null, ct));
        if (row is not { } r) return (false, Guid.Empty);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatHostFlags (GroupId, MessageId, FlaggedBy, Reason, CreatedAt) VALUES (@GroupId, @MessageId, @userId, @reason, @now)", new { r.GroupId, r.MessageId, userId, reason, now }, null, ct));
        return (true, r.GroupPublicId);
    }

    public async Task<List<ChatHostFlagRow>> ListOpenFlagsAsync(int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatHostFlagRow>(Sql.Cmd("""
            SELECT TOP (@max) f.PublicId AS Id, g.PublicId AS RoomId, g.Name AS RoomName, m.PublicId AS MessageId, f.Reason, f.CreatedAt
            FROM dbo.ChatHostFlags f
            JOIN dbo.ChatGroups g ON g.Id = f.GroupId
            JOIN dbo.ChatMessages m ON m.Id = f.MessageId
            WHERE f.DecidedAt IS NULL ORDER BY f.CreatedAt, f.Id
            """, new { max }, null, ct))).ToList();
    }

    public async Task<bool> DecideFlagAsync(Guid flagId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatHostFlags SET DecidedAt = @now WHERE PublicId = @flagId AND DecidedAt IS NULL", new { flagId, now }, null, ct)) > 0;
    }

    public async Task<HostCounts> CountsSinceAsync(DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var r = await c.QuerySingleAsync<HostCounts>(Sql.Cmd("""
            SELECT (SELECT COUNT(*) FROM dbo.ChatMeetUps WHERE CreatedAt >= @since) AS MeetUps,
                   (SELECT COUNT(*) FROM dbo.ChatIntroductions WHERE CreatedAt >= @since) AS Introductions,
                   (SELECT COUNT(*) FROM (
                        SELECT StartedBy AS UserId FROM dbo.ChatMeetUps WHERE CreatedAt >= @since
                        UNION SELECT UserId FROM dbo.ChatMeetUpAnswers WHERE AnsweredAt >= @since
                        UNION SELECT UserLow FROM dbo.ChatIntroductions WHERE CreatedAt >= @since
                        UNION SELECT UserHigh FROM dbo.ChatIntroductions WHERE CreatedAt >= @since) g) AS HostGuests,
                   (SELECT COUNT(*) FROM dbo.ChatMessages m JOIN dbo.ChatGroups g ON g.Id = m.GroupId
                     WHERE g.Kind = 'room' AND m.FromUserId IS NULL AND m.IsSystem = 1 AND m.Subtitle = 'Stanley' AND m.[At] >= @since) AS RoomLines,
                   (SELECT COUNT(*) FROM dbo.ChatHostFlags WHERE CreatedAt >= @since) AS Flags
            """, new { since }, null, ct));
        return r;
    }
}
