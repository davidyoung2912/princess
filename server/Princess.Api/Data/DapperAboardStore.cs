using System.Data.Common;
using Dapper;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>The Phase 10c store over SQL Server.</summary>
public sealed class DapperAboardStore(IDbConnectionFactory db) : IAboardStore
{
    private static Task ReplaceFolio(DbConnection c, DbTransaction tx, long bookingId, string sourceType, long sourceId, IReadOnlyList<FolioWrite> folio, CancellationToken ct) =>
        DapperShipboardStore.ReplaceFolioAsync(c, tx, bookingId, sourceType, sourceId, folio, ct);

    // ---- Selections ----

    private const string TimeText = "ISNULL(CONVERT(varchar(5), [Time], 108), '')";

    public async Task<List<SelectionRow>> ListSelectionsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<SelectionRow>(Sql.Cmd(
            $"SELECT Id, PublicId, ItemId, [Day], {TimeText} AS [Time], Qty, TotalCents, UpdatedAt AS [At] FROM dbo.Selections WHERE BookingId = @bookingId ORDER BY Id", new { bookingId }, null, ct))).ToList();
    }

    public async Task<SelectionRow> SaveSelectionAsync(long bookingId, SelectionRow s, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var existing = await c.QuerySingleOrDefaultAsync<(long Id, Guid PublicId)?>(Sql.Cmd(
            $"SELECT Id, PublicId FROM dbo.Selections WHERE BookingId = @bookingId AND ItemId = @ItemId AND [Day] = @Day AND {TimeText} = @Time", new { bookingId, s.ItemId, s.Day, s.Time }, tx, ct));
        if (existing is { } e)
        {
            await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.Selections SET Qty = @Qty, TotalCents = @TotalCents, UpdatedAt = @At WHERE Id = @Id", new { e.Id, s.Qty, s.TotalCents, s.At }, tx, ct));
            s.Id = e.Id;
            s.PublicId = e.PublicId;
        }
        else
        {
            var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
                INSERT INTO dbo.Selections (BookingId, ItemId, [Day], [Time], Qty, TotalCents, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.Id, INSERTED.PublicId
                VALUES (@bookingId, @ItemId, @Day, CAST(NULLIF(@Time, N'') AS time(0)), @Qty, @TotalCents, @At, @At)
                """, new { bookingId, s.ItemId, s.Day, s.Time, s.Qty, s.TotalCents, s.At }, tx, ct));
            s.Id = id;
            s.PublicId = publicId;
        }
        await ReplaceFolio(c, tx, bookingId, "selection", s.Id, folio, ct);
        await tx.CommitAsync(ct);
        return s;
    }

    public async Task<bool> RemoveSelectionAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.Selections WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, tx, ct));
        if (id is null) return false;
        await ReplaceFolio(c, tx, bookingId, "selection", id.Value, [], ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Selections WHERE Id = @id", new { id }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    // ---- One-tap requests ----

    public async Task<List<ServiceRequestRow>> ListRequestsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<ServiceRequestRow>(Sql.Cmd(
            "SELECT PublicId, ItemId, Qty, ISNULL(Note, N'') AS Note, PlacedAt, Stage FROM dbo.ServiceRequests WHERE BookingId = @bookingId ORDER BY PlacedAt DESC, Id DESC", new { bookingId }, null, ct))).ToList();
        var events = (await c.QueryAsync<(Guid PublicId, string Kind, DateTime At)>(Sql.Cmd(
            "SELECT r.PublicId, e.Kind, e.[At] AS [At] FROM dbo.ServiceRequestEvents e JOIN dbo.ServiceRequests r ON r.Id = e.RequestId WHERE r.BookingId = @bookingId ORDER BY e.[At], e.Id", new { bookingId }, null, ct))).ToList();
        foreach (var r in rows) r.Events = [.. events.Where(e => e.PublicId == r.PublicId).Select(e => new ServiceRequestEventRow { Kind = e.Kind, At = e.At })];
        return rows;
    }

    public async Task<bool> AddRequestEventAsync(long bookingId, Guid publicId, string kind, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.ServiceRequestEvents (RequestId, Kind, [At]) SELECT Id, @kind, @at FROM dbo.ServiceRequests WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId, kind, at }, null, ct)) > 0;
    }

    public async Task AddRequestAsync(long bookingId, ServiceRequestRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        r.PublicId = await c.ExecuteScalarAsync<Guid>(Sql.Cmd("""
            INSERT INTO dbo.ServiceRequests (BookingId, ItemId, Qty, Note, PlacedAt, EtaAt, Stage)
            OUTPUT INSERTED.PublicId
            VALUES (@bookingId, @ItemId, @Qty, @Note, @PlacedAt, DATEADD(MINUTE, (SELECT EtaMin FROM ref.ServiceItems WHERE Id = @ItemId), @PlacedAt), N'received')
            """, new { bookingId, r.ItemId, r.Qty, r.Note, r.PlacedAt }, null, ct));
    }

    public async Task<bool> CancelRequestAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.ServiceRequests SET Stage = N'cancelled', UpdatedAt = SYSUTCDATETIME() WHERE BookingId = @bookingId AND PublicId = @publicId AND Stage = N'received'", new { bookingId, publicId }, null, ct)) > 0;
    }

    // ---- Security reports ----

    public async Task<List<SafetyReportRow>> ListReportsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<SafetyReportRow>(Sql.Cmd(
            "SELECT PublicId, Kind, ISNULL(Place, N'') AS Place, Note, Anonymous, Reference, [At] FROM dbo.SafetyReports WHERE BookingId = @bookingId ORDER BY [At] DESC, Id DESC", new { bookingId }, null, ct))).ToList();
    }

    public async Task AddReportAsync(long bookingId, SafetyReportRow r, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        r.PublicId = await c.ExecuteScalarAsync<Guid>(Sql.Cmd("""
            INSERT INTO dbo.SafetyReports (BookingId, Kind, Place, Note, Anonymous, Reference, [At])
            OUTPUT INSERTED.PublicId
            VALUES (@bookingId, @Kind, @Place, @Note, @Anonymous, @Reference, @At)
            """, new { bookingId, r.Kind, r.Place, r.Note, r.Anonymous, r.Reference, r.At }, null, ct));
    }

    // ---- Drinks ----

    public async Task<List<DrinkLogRow>> ListDrinksAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<DrinkLogRow>(Sql.Cmd("SELECT PublicId, DrinkId, [At] FROM dbo.DrinkLogs WHERE UserId = @userId AND [At] >= @since ORDER BY [At], Id", new { userId, since }, null, ct))).ToList();
    }

    public async Task AddDrinkAsync(long userId, string drinkId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.DrinkLogs (UserId, DrinkId, [At]) VALUES (@userId, @drinkId, @at)", new { userId, drinkId, at }, null, ct));
    }

    public async Task<bool> RemoveDrinkAsync(long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.DrinkLogs WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct)) > 0;
    }

    // ---- Money ----

    public async Task<List<TopUpRow>> ListTopUpsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<TopUpRow>(Sql.Cmd(
            "SELECT PublicId, Dollars, Source, [At], SettledAt, Reference FROM dbo.TopUps WHERE BookingId = @bookingId ORDER BY [At] DESC, Id DESC", new { bookingId }, null, ct))).ToList();
    }

    public async Task AddTopUpAsync(long bookingId, TopUpRow t, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.TopUps (BookingId, Dollars, Source, [At], SettledAt, Reference)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @Dollars, @Source, @At, @SettledAt, @Reference)
            """, new { bookingId, t.Dollars, t.Source, t.At, t.SettledAt, t.Reference }, tx, ct));
        await ReplaceFolio(c, tx, bookingId, "topup", id, folio, ct);
        await tx.CommitAsync(ct);
        t.PublicId = publicId;
    }

    private static Task EnsureAccount(DbConnection c, DbTransaction tx, long bookingId, CancellationToken ct) =>
        c.ExecuteAsync(Sql.Cmd("IF NOT EXISTS (SELECT 1 FROM dbo.OnboardAccount WHERE BookingId = @bookingId) INSERT INTO dbo.OnboardAccount (BookingId) VALUES (@bookingId)", new { bookingId }, tx, ct));

    public async Task<OnboardAccountRow> GetAccountAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<OnboardAccountRow>(Sql.Cmd(
            "SELECT PinHash, PinSalt, PinFails, GratuityChoice, GratuityReason, GratuityPaidAt, RTRIM(DisplayCurrency) AS DisplayCurrency FROM dbo.OnboardAccount WHERE BookingId = @bookingId", new { bookingId }, null, ct));
        if (row is null) return new OnboardAccountRow();
        row.Exists = true;
        return row;
    }

    public async Task SetPinAsync(long bookingId, byte[] hash, byte[] salt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await EnsureAccount(c, tx, bookingId, ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.OnboardAccount SET PinHash = @hash, PinSalt = @salt, PinFails = 0, UpdatedAt = SYSUTCDATETIME() WHERE BookingId = @bookingId", new { bookingId, hash, salt }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<int> RecordPinFailAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd(
            "UPDATE dbo.OnboardAccount SET PinFails = PinFails + 1, UpdatedAt = SYSUTCDATETIME() OUTPUT INSERTED.PinFails WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task ResetPinFailsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.OnboardAccount SET PinFails = 0, UpdatedAt = SYSUTCDATETIME() WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveGratuityAsync(long bookingId, string choice, string reason, DateTime at, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await EnsureAccount(c, tx, bookingId, ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.OnboardAccount SET GratuityChoice = @choice, GratuityReason = @reason, GratuityPaidAt = CASE WHEN @choice = 'prepaid' THEN @at ELSE NULL END, UpdatedAt = SYSUTCDATETIME()
            WHERE BookingId = @bookingId
            """, new { bookingId, choice, reason, at }, tx, ct));
        await ReplaceFolio(c, tx, bookingId, "gratuity", bookingId, folio, ct);
        await tx.CommitAsync(ct);
    }

    public async Task SetCurrencyAsync(long bookingId, string code, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await EnsureAccount(c, tx, bookingId, ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.OnboardAccount SET DisplayCurrency = @code, UpdatedAt = SYSUTCDATETIME() WHERE BookingId = @bookingId", new { bookingId, code }, tx, ct));
        await tx.CommitAsync(ct);
    }

    // ---- Cabin parties ----

    public async Task<List<PartyRow>> ListPartiesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var parties = (await c.QueryAsync<PartyRow>(Sql.Cmd(
            "SELECT Id, PublicId, Title, [Day], CONVERT(varchar(5), TimeLocal, 108) AS [Time] FROM dbo.Parties WHERE BookingId = @bookingId ORDER BY [Day], TimeLocal, Id", new { bookingId }, null, ct))).ToList();
        if (parties.Count == 0) return parties;
        var rows = await c.QueryAsync<(Guid PublicId, string Cabin, string Answer)>(Sql.Cmd(
            "SELECT p.PublicId, i.Cabin, i.Answer FROM dbo.PartyInvites i JOIN dbo.Parties p ON p.Id = i.PartyId WHERE p.BookingId = @bookingId ORDER BY i.CreatedAt, i.Cabin", new { bookingId }, null, ct));
        foreach (var p in parties) p.Invites = [.. rows.Where(r => r.PublicId == p.PublicId).Select(r => (r.Cabin, r.Answer))];
        return parties;
    }

    public async Task AddPartyAsync(long bookingId, PartyRow p, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.Parties (BookingId, Title, [Day], TimeLocal) OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @Title, @Day, CAST(@Time AS time(0)))
            """, new { bookingId, p.Title, p.Day, p.Time }, tx, ct));
        foreach (var (cabin, answer) in p.Invites)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.PartyInvites (PartyId, Cabin, Answer) VALUES (@id, @cabin, @answer)", new { id, cabin, answer }, tx, ct));
        await tx.CommitAsync(ct);
        p.PublicId = publicId;
    }

    public async Task<bool> RemovePartyAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Parties WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, null, ct)) > 0;
    }

    // ---- Group tables ----

    public async Task<GroupTableRow?> GetGroupAsync(long bookingId, Guid reservationPublicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var head = await c.QuerySingleOrDefaultAsync<(long Id, string? GroupSplit)?>(Sql.Cmd(
            "SELECT Id, GroupSplit FROM dbo.DiningReservations WHERE BookingId = @bookingId AND PublicId = @reservationPublicId AND Status = 'booked'", new { bookingId, reservationPublicId }, null, ct));
        if (head is not { } h) return null;
        var size = await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.DiningReservationGuests WHERE ReservationId = @Id", new { h.Id }, null, ct));
        var friends = await c.QueryAsync<(int Seq, string Name, string? Cabin)>(Sql.Cmd("SELECT Seq, Name, Cabin FROM dbo.GroupTableFriends WHERE ReservationId = @Id ORDER BY Seq", new { h.Id }, null, ct));
        return new GroupTableRow { ReservationId = h.Id, Split = h.GroupSplit ?? "mine", PartySize = size, Friends = [.. friends.Select(f => (f.Seq, f.Name, f.Cabin ?? ""))] };
    }

    public async Task AddFriendAsync(long reservationId, string name, string cabin, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.GroupTableFriends (ReservationId, Seq, Name, Cabin)
            VALUES (@reservationId, ISNULL((SELECT MAX(Seq) FROM dbo.GroupTableFriends WHERE ReservationId = @reservationId), 0) + 1, @name, @cabin)
            """, new { reservationId, name, cabin }, null, ct));
    }

    public async Task RemoveFriendAsync(long reservationId, int seq, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.GroupTableFriends WHERE ReservationId = @reservationId AND Seq = @seq", new { reservationId, seq }, null, ct));
    }

    public async Task SetSplitAsync(long reservationId, string split, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.DiningReservations SET GroupSplit = @split, UpdatedAt = SYSUTCDATETIME() WHERE Id = @reservationId", new { reservationId, split }, null, ct));
    }

    // ---- Games, TV, readiness ----

    public async Task<string?> GetGameAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<string?>(Sql.Cmd("SELECT State FROM dbo.GameProgress WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task SaveGameAsync(long userId, string json, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.GameProgress AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET State = @json, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, State) VALUES (@userId, @json);
            """, new { userId, json }, null, ct));
    }

    public async Task<string?> GetTvAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<string?>(Sql.Cmd("SELECT State FROM dbo.TvState WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveTvAsync(long bookingId, string json, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.TvState AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET State = @json, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, State) VALUES (@bookingId, @json);
            """, new { bookingId, json }, null, ct));
    }

    public async Task<HashSet<string>> GetReadyAsync(long bookingId, int day, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return [.. await c.QueryAsync<string>(Sql.Cmd("SELECT ItemId FROM dbo.ReadyTicks WHERE BookingId = @bookingId AND [Day] = @day AND Done = 1", new { bookingId, day }, null, ct))];
    }

    public async Task SetReadyAsync(long bookingId, int day, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.ReadyTicks AS t USING (SELECT @bookingId AS BookingId, @day AS [Day], @itemId AS ItemId) AS s ON t.BookingId = s.BookingId AND t.[Day] = s.[Day] AND t.ItemId = s.ItemId
            WHEN MATCHED THEN UPDATE SET Done = @done, [At] = @at
            WHEN NOT MATCHED THEN INSERT (BookingId, [Day], ItemId, Done, [At]) VALUES (@bookingId, @day, @itemId, @done, @at);
            """, new { bookingId, day, itemId, done, at }, null, ct));
    }

    // ---- Last-minute tours ----

    public async Task BookLastMinuteAsync(long bookingId, NewTour t, IReadOnlyList<FolioWrite> folio, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
            INSERT INTO dbo.TourBookings (BookingId, SailingId, ExcursionId, [Day], Source, TotalCents, CreditCents, Status, [At])
            OUTPUT INSERTED.Id
            SELECT b.Id, b.SailingId, @ExcursionId, @Day, 'onboard', @TotalCents, 0, 'booked', @at FROM dbo.Bookings b WHERE b.Id = @bookingId
            """, new { bookingId, t.ExcursionId, t.Day, t.TotalCents, at }, tx, ct));
        foreach (var userId in t.GuestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.TourBookingGuests (TourBookingId, BookingId, UserId) VALUES (@id, @bookingId, @userId)", new { id, bookingId, userId }, tx, ct));
        await ReplaceFolio(c, tx, bookingId, "tour", id, folio, ct);
        await tx.CommitAsync(ct);
    }
}

/// <summary>The chat store over SQL Server (docs/chat-plan.md, phase 4). Nothing here reads across conversations except the list and the counts.</summary>
public sealed class DapperChatStore(IDbConnectionFactory db) : IChatStore
{
    // The messages a member may read: sent in their window (the booking's "My group" keeps showing everything) and not from someone they blocked.
    private const string Window = """
        (g.Kind IN ('party','stanley') OR (m.[At] >= me.JoinedAt AND (me.LeftAt IS NULL OR m.[At] <= me.LeftAt)))
        AND NOT EXISTS (SELECT 1 FROM dbo.ChatBlocks b WHERE b.UserId = me.UserId AND b.BlockedUserId = m.FromUserId)
        """;

    /// <summary>A mute is on only until its end (real UTC), so every reader of the flag agrees without a job to turn it off.</summary>
    private const string MutedNow = "CAST(CASE WHEN me.Muted = 1 AND (me.MutedUntil IS NULL OR me.MutedUntil > SYSUTCDATETIME()) THEN 1 ELSE 0 END AS bit)";

    private const string MemberSelect = $$"""
        SELECT g.Id AS GroupId, g.PublicId AS GroupPublicId, g.Kind, g.Name, me.UserId, me.Status, me.JoinedAt, me.LeftAt, {{MutedNow}} AS Muted, me.MutedUntil, me.ArchivedAt, me.NotifyAway, me.MentionsOnly, me.IsAdmin, g.AnnouncementOnly, me.LastReadMessageId, g.CreatedByUserId, g.CreatedAt,
               CAST(CASE WHEN g.Kind = 'direct' AND EXISTS (SELECT 1 FROM dbo.ChatConnections cc WHERE cc.GroupId = g.Id AND cc.Status = 'ended') THEN 1 ELSE 0 END AS bit) AS DirectEnded,
               sp.Persona AS Persona, sp.Subtitle AS Subtitle
        FROM dbo.ChatGroupMembers me
        JOIN dbo.ChatGroups g ON g.Id = me.GroupId
        OUTER APPLY (SELECT TOP 1 x.Persona, x.Subtitle FROM dbo.ChatMessages x WHERE g.Kind = 'stanley' AND x.GroupId = g.Id AND x.Persona IS NOT NULL ORDER BY x.Id DESC) sp
        """;

    public async Task EnsurePartyAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var has = await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatGroupMembers m JOIN dbo.ChatGroups g ON g.Id = m.GroupId WHERE m.UserId = @userId AND g.Kind = 'party'", new { userId }, tx, ct));
        if (has == 0)
        {
            var group = await c.ExecuteScalarAsync<long>(Sql.Cmd("INSERT INTO dbo.ChatGroups (Name, Kind) OUTPUT INSERTED.Id VALUES (N'My group', 'party')", null, tx, ct));
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatGroupMembers (GroupId, UserId) VALUES (@group, @userId)", new { group, userId }, tx, ct));
        }
        await tx.CommitAsync(ct);
    }

    private sealed class PersonaRow
    {
        public string Persona { get; set; } = "";
        public string Subtitle { get; set; } = "";
    }

    public async Task EnsureStanleyAsync(long userId, string welcome, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        try
        {
            await StanleyThread.EnsureAsync(c, tx, userId, welcome, now, ct);
            await tx.CommitAsync(ct);
        }
        catch (DbException e) when (e is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
        {
            // Two first reads raced and the other one made the thread: nothing to do.
            await tx.RollbackAsync(ct);
        }
    }

    public async Task<(string Voice, string Subtitle)?> LastStanleyPersonaAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<PersonaRow>(Sql.Cmd("""
            SELECT TOP 1 m.Persona, m.Subtitle
            FROM dbo.ChatGroups g JOIN dbo.ChatMessages m ON m.GroupId = g.Id
            WHERE g.StanleyUserId = @userId AND m.Persona IS NOT NULL
            ORDER BY m.Id DESC
            """, new { userId }, null, ct));
        return row is null ? null : (row.Persona, row.Subtitle);
    }

    public async Task AddStanleyLineAsync(long userId, string text, string voice, string subtitle, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // The test is in the insert, so two reads at once add one line, not two.
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At], Persona, Subtitle)
            SELECT g.Id, NULL, @text, 1, @at, @voice, @subtitle
            FROM dbo.ChatGroups g
            WHERE g.StanleyUserId = @userId
              AND NOT EXISTS (SELECT 1 FROM (SELECT TOP 1 x.Persona, x.Subtitle FROM dbo.ChatMessages x WHERE x.GroupId = g.Id AND x.Persona IS NOT NULL ORDER BY x.Id DESC) l
                              WHERE l.Persona = @voice AND l.Subtitle = @subtitle)
            """, new { userId, text, voice, subtitle, at }, null, ct));
    }

    public async Task LogNoticeDeliveryAsync(long userId, string noticeKey, string kind, string lane, string evt, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // The test is in the insert (and backed by the unique constraint), so a repeat adds nothing.
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.StanleyNoticeDeliveries (UserId, NoticeKey, Kind, Lane, Event, [At])
            SELECT @userId, @noticeKey, @kind, @lane, @evt, @at
            WHERE NOT EXISTS (SELECT 1 FROM dbo.StanleyNoticeDeliveries d WHERE d.UserId = @userId AND d.NoticeKey = @noticeKey AND d.Event = @evt)
            """, new { userId, noticeKey = Trim(noticeKey, 120), kind = Trim(kind, 20), lane, evt, at }, null, ct));
    }

    private static string Trim(string s, int max) => s.Length > max ? s[..max] : s;

    public async Task<List<NoticeDeliveryCount>> NoticeDeliverySummaryAsync(DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<NoticeDeliveryCount>(Sql.Cmd(
            "SELECT Kind, Lane, Event, COUNT(*) AS [Count] FROM dbo.StanleyNoticeDeliveries WHERE [At] >= @since GROUP BY Kind, Lane, Event ORDER BY Lane, Kind, Event", new { since }, null, ct))).ToList();
    }

    public async Task<bool> AddStanleyNoticeAsync(long userId, StanleyNotice n, string voice, string subtitle, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // The key test is in the insert (and backed by a unique index), so two checks at once add one message, not two.
        var added = await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At], Persona, Subtitle, Urgency, NoticeKey, Lane, NoticeKind, NoticePath, SupersedeKey, ExpiresAt, NoticeSubject)
            SELECT g.Id, NULL, @text, 0, @at, @voice, @subtitle, @urgency, @key, @lane, @kind, @path, @supersedeKey, @expiresAt, @subject
            FROM dbo.ChatGroups g
            WHERE g.StanleyUserId = @userId
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatMessages x WHERE x.GroupId = g.Id AND x.NoticeKey = @key)
            """, new { userId, text = n.Text, at, voice, subtitle, urgency = n.Urgency, key = n.Key, lane = n.Lane, kind = n.Kind, path = n.Path, supersedeKey = n.SupersedeKey, expiresAt = n.ExpiresAt, subject = n.Subject }, null, ct));
        if (added == 0) return false;
        if (n.SupersedeKey is not null)
            await c.ExecuteAsync(Sql.Cmd("""
                UPDATE m SET SupersededAt = @at
                FROM dbo.ChatMessages m JOIN dbo.ChatGroups g ON g.Id = m.GroupId
                WHERE g.StanleyUserId = @userId AND m.SupersedeKey = @supersedeKey AND m.NoticeKey <> @key AND m.SupersededAt IS NULL
                """, new { userId, at, supersedeKey = n.SupersedeKey, key = n.Key }, null, ct));
        return true;
    }

    public async Task<List<ChatConversationRow>> ListConversationsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatConversationRow>(Sql.Cmd($"""
            SELECT g.Id AS GroupId, g.PublicId AS GroupPublicId, g.Kind, g.Name, me.UserId, me.Status, me.JoinedAt, me.LeftAt, {MutedNow} AS Muted, me.MutedUntil, me.ArchivedAt, me.NotifyAway, me.MentionsOnly, me.IsAdmin, g.AnnouncementOnly, me.LastReadMessageId, g.CreatedByUserId, g.CreatedAt,
                   CAST(CASE WHEN g.Kind = 'direct' AND EXISTS (SELECT 1 FROM dbo.ChatConnections cc WHERE cc.GroupId = g.Id AND cc.Status = 'ended') THEN 1 ELSE 0 END AS bit) AS DirectEnded,
                   sp.Persona AS Persona, sp.Subtitle AS Subtitle,
                   lm.Id AS LastMessageId, ISNULL(lm.FromUserId, 0) AS LastFromUserId, CASE WHEN lm.DeletedAt IS NULL THEN lm.[Text] ELSE N'' END AS LastText,
                   CAST(CASE WHEN lm.Photo IS NULL OR lm.DeletedAt IS NOT NULL THEN 0 ELSE 1 END AS bit) AS LastPhoto, CAST(CASE WHEN lm.DeletedAt IS NULL THEN 0 ELSE 1 END AS bit) AS LastDeleted, lm.[At] AS LastAt, lm.Urgency AS LastUrgency,
                   (SELECT COUNT(*) FROM dbo.ChatMessages m
                    WHERE m.GroupId = g.Id AND m.IsSystem = 0 AND ISNULL(m.FromUserId, 0) <> me.UserId AND m.Id > ISNULL(me.LastReadMessageId, 0) AND {Window}) AS Unread
            FROM dbo.ChatGroupMembers me
            JOIN dbo.ChatGroups g ON g.Id = me.GroupId
            OUTER APPLY (SELECT TOP 1 m.Id, m.FromUserId, m.[Text], m.Photo, m.[At], m.Urgency, m.DeletedAt FROM dbo.ChatMessages m WHERE m.GroupId = g.Id AND (g.Kind <> 'stanley' OR m.IsSystem = 0) AND {Window} ORDER BY m.Id DESC) lm
            OUTER APPLY (SELECT TOP 1 x.Persona, x.Subtitle FROM dbo.ChatMessages x WHERE g.Kind = 'stanley' AND x.GroupId = g.Id AND x.Persona IS NOT NULL ORDER BY x.Id DESC) sp
            WHERE me.UserId = @userId AND me.Status = 'active'
            ORDER BY CASE WHEN g.Kind = 'stanley' THEN 0 ELSE 1 END, ISNULL(lm.[At], g.CreatedAt) DESC, g.Id DESC
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<ChatMemberRow?> GetMemberAsync(long userId, Guid conversationId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatMemberRow>(Sql.Cmd(MemberSelect + " WHERE me.UserId = @userId AND g.PublicId = @conversationId", new { userId, conversationId }, null, ct));
    }

    public async Task<List<ChatPeerRow>> ListMembersAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatPeerRow>(Sql.Cmd("""
            SELECT u.Id AS UserId, u.PublicId, pr.FirstName, pr.LastName, CAST(ISNULL(p.ReceiptsOn, 0) AS bit) AS ReceiptsOn, m.Status, u.IsSupervised, u.BookerUserId
            FROM dbo.ChatGroupMembers m
            JOIN dbo.Users u ON u.Id = m.UserId
            JOIN dbo.Profiles pr ON pr.UserId = u.Id
            LEFT JOIN dbo.UserPrefs p ON p.UserId = u.Id
            WHERE m.GroupId = @groupId
            """, new { groupId }, null, ct))).ToList();
    }

    public async Task<Dictionary<long, List<ChatPeerRow>>> ListMembersForAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct)
    {
        var map = groupIds.ToDictionary(id => id, _ => new List<ChatPeerRow>());
        if (map.Count == 0) return map;
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<ChatPeerRow>(Sql.Cmd("""
            SELECT m.GroupId, u.Id AS UserId, u.PublicId, pr.FirstName, pr.LastName, CAST(ISNULL(p.ReceiptsOn, 0) AS bit) AS ReceiptsOn, m.Status, u.IsSupervised, u.BookerUserId
            FROM dbo.ChatGroupMembers m
            JOIN dbo.Users u ON u.Id = m.UserId
            JOIN dbo.Profiles pr ON pr.UserId = u.Id
            LEFT JOIN dbo.UserPrefs p ON p.UserId = u.Id
            WHERE m.GroupId IN @groupIds
            """, new { groupIds = map.Keys.ToArray() }, null, ct));
        foreach (var r in rows) map[r.GroupId].Add(r);
        return map;
    }

    public async Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatPeerRow>(Sql.Cmd("""
            SELECT DISTINCT u.Id AS UserId, u.PublicId, pr.FirstName, pr.LastName, CAST(ISNULL(p.ReceiptsOn, 0) AS bit) AS ReceiptsOn
            FROM dbo.ChatGroupMembers me
            JOIN dbo.ChatGroupMembers m ON m.GroupId = me.GroupId AND m.UserId <> me.UserId
            JOIN dbo.Users u ON u.Id = m.UserId
            JOIN dbo.Profiles pr ON pr.UserId = u.Id
            LEFT JOIN dbo.UserPrefs p ON p.UserId = u.Id
            WHERE me.UserId = @userId
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<List<ChatMessageRow>> ListMessagesAsync(long groupId, long userId, Guid? before, int limit, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // The window is applied here through the member row so a caller cannot widen it; only the conversation id and cursor come from the request.
        var messages = (await c.QueryAsync<ChatMessageRow>(Sql.Cmd($"""
            SELECT TOP (@take) m.Id, m.PublicId, ISNULL(m.FromUserId, 0) AS FromUserId, CASE WHEN m.DeletedAt IS NULL THEN m.[Text] ELSE N'' END AS [Text], CAST(CASE WHEN m.Photo IS NULL OR m.DeletedAt IS NOT NULL THEN 0 ELSE 1 END AS bit) AS HasPhoto, m.[At], m.IsSystem, m.ViaSms, m.Urgency, m.Persona, m.Subtitle, m.ReplyToId,
                   m.Lane, m.NoticeKind, m.NoticePath, m.NoticeSubject, m.ExpiresAt, m.SupersededAt, m.EditedAt, m.DeletedAt,
                   m.Kind, CASE WHEN m.DeletedAt IS NULL THEN m.Payload ELSE NULL END AS Payload, m.ClosedAt
            FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
            WHERE m.GroupId = @groupId AND {Window}
              AND (@before IS NULL OR m.Id < (SELECT x.Id FROM dbo.ChatMessages x WHERE x.PublicId = @before AND x.GroupId = @groupId))
            ORDER BY m.Id DESC
            """, new { groupId, userId, before, take = limit + 1 }, null, ct))).ToList();
        messages.Reverse();
        if (messages.Count == 0) return messages;
        var ids = messages.Select(m => m.Id).ToArray();
        var reads = (await c.QueryAsync<(long MessageId, long UserId)>(Sql.Cmd("SELECT MessageId, UserId FROM dbo.ChatReads WHERE MessageId IN @ids", new { ids }, null, ct))).ToList();
        var readBy = reads.ToLookup(r => r.MessageId, r => r.UserId);
        foreach (var m in messages) m.SeenBy = [.. readBy[m.Id]];
        // Phase 1: who has a device with it, everyone's reaction, and the quoted message when this reader may read it. Each is one query for the whole page.
        var delivered = (await c.QueryAsync<(long MessageId, long UserId)>(Sql.Cmd("SELECT MessageId, UserId FROM dbo.ChatMessageDeliveries WHERE MessageId IN @ids", new { ids }, null, ct))).ToLookup(r => r.MessageId, r => r.UserId);
        var reactions = (await c.QueryAsync<ChatReactionRow>(Sql.Cmd("SELECT MessageId, UserId, Emoji FROM dbo.ChatReactions WHERE MessageId IN @ids", new { ids }, null, ct))).ToLookup(r => r.MessageId);
        var mentions = (await c.QueryAsync<(long MessageId, long UserId)>(Sql.Cmd("SELECT MessageId, UserId FROM dbo.ChatMentions WHERE MessageId IN @ids", new { ids }, null, ct))).ToLookup(r => r.MessageId, r => r.UserId);
        foreach (var m in messages) { m.DeliveredBy = [.. delivered[m.Id]]; m.Reactions = m.DeletedAt is null ? [.. reactions[m.Id]] : []; m.Mentions = m.DeletedAt is null ? [.. mentions[m.Id]] : []; }
        var replyIds = messages.Where(m => m.ReplyToId is not null).Select(m => m.ReplyToId!.Value).Distinct().ToArray();
        if (replyIds.Length > 0)
        {
            // The quote goes through the same window and block rule as the thread itself, so a reply can never reveal a message its reader could not open.
            var quotes = (await c.QueryAsync<ChatQuoteRow>(Sql.Cmd($"""
                SELECT m.Id, m.PublicId, ISNULL(m.FromUserId, 0) AS FromUserId, CASE WHEN m.DeletedAt IS NULL THEN m.[Text] ELSE N'' END AS [Text], CAST(CASE WHEN m.Photo IS NULL OR m.DeletedAt IS NOT NULL THEN 0 ELSE 1 END AS bit) AS HasPhoto, m.IsSystem,
                       CAST(CASE WHEN m.DeletedAt IS NULL THEN 0 ELSE 1 END AS bit) AS Deleted
                FROM dbo.ChatMessages m
                JOIN dbo.ChatGroups g ON g.Id = m.GroupId
                JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
                WHERE m.GroupId = @groupId AND m.Id IN @replyIds AND {Window}
                """, new { groupId, userId, replyIds }, null, ct))).ToDictionary(q => q.Id);
            foreach (var m in messages) if (m.ReplyToId is { } r && quotes.TryGetValue(r, out var q)) m.Reply = q;
        }
        var urgentIds = messages.Where(m => m.Urgency == "urgent" || m.Lane is not null && m.Urgency == "important").Select(m => m.Id).ToArray();
        if (urgentIds.Length == 0) return messages;   // nothing to ask: most threads have no urgent message
        var acks = (await c.QueryAsync<(long MessageId, long UserId)>(Sql.Cmd("SELECT MessageId, UserId FROM dbo.ChatMessageAcks WHERE MessageId IN @ids", new { ids = urgentIds }, null, ct))).ToList();
        var ackedBy = acks.ToLookup(a => a.MessageId, a => a.UserId);
        foreach (var m in messages) m.AckedBy = [.. ackedBy[m.Id]];
        return messages;
    }

    public async Task<ChatSentRow> AddMessageAsync(long groupId, long userId, string text, string? photo, Guid? clientId, DateTime at, CancellationToken ct, bool viaSms = false, string urgency = "normal", long? replyToId = null, string kind = "text", string? payload = null, IReadOnlyCollection<long>? mentions = null)
    {
        await using var c = await db.OpenAsync(ct);
        const string existing = "SELECT Id, PublicId, FromUserId, [Text], Photo, [At], ViaSms, Urgency, ReplyToId, Kind, Payload FROM dbo.ChatMessages WHERE GroupId = @groupId AND FromUserId = @userId AND ClientId = @clientId";
        if (clientId is not null && await c.QuerySingleOrDefaultAsync<ChatMessageRow>(Sql.Cmd(existing, new { groupId, userId, clientId }, null, ct)) is { } again) return new(again, false);
        try
        {
            var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
                INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], Photo, ClientId, [At], ViaSms, Urgency, ReplyToId, Kind, Payload) OUTPUT INSERTED.Id, INSERTED.PublicId
                VALUES (@groupId, @userId, @text, @photo, @clientId, @at, @viaSms, @urgency, @replyToId, @kind, @payload)
                """, new { groupId, userId, text, photo, clientId, at, viaSms, urgency, replyToId, kind, payload }, null, ct));
            var who = mentions?.Distinct().ToArray() ?? [];
            if (who.Length > 0)
                await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatMentions (MessageId, UserId) SELECT @id, UserId FROM dbo.ChatGroupMembers WHERE GroupId = @groupId AND Status = 'active' AND UserId IN @who", new { id, groupId, who }, null, ct));
            return new(new ChatMessageRow { Id = id, PublicId = publicId, FromUserId = userId, Text = text, Photo = photo, At = at, ViaSms = viaSms, Urgency = urgency, ReplyToId = replyToId, Kind = kind, Payload = payload, Mentions = [.. who] }, true);
        }
        catch (DbException e) when (e is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 } && clientId is not null)
        {
            // Two sends of the same id raced: the other one won, and its message is the answer.
            var stored = await c.QuerySingleAsync<ChatMessageRow>(Sql.Cmd(existing, new { groupId, userId, clientId }, null, ct));
            return new(stored, false);
        }
    }

    public async Task<List<ChatRecipientRow>> ListRecipientsAsync(long groupId, long senderId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatRecipientRow>(Sql.Cmd("""
            SELECT m.UserId, CAST(CASE WHEN m.Muted = 1 AND (m.MutedUntil IS NULL OR m.MutedUntil > SYSUTCDATETIME()) THEN 1 ELSE 0 END AS bit) AS Muted, CAST(ISNULL(up.ChatShowPreview, 0) AS bit) AS ShowPreview, CAST(ISNULL(up.ChatTyping, 1) AS bit) AS Typing, m.MentionsOnly
            FROM dbo.ChatGroupMembers m
            LEFT JOIN dbo.UserPrefs up ON up.UserId = m.UserId
            WHERE m.GroupId = @groupId AND m.Status = 'active' AND m.UserId <> @senderId
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatBlocks b WHERE b.UserId = m.UserId AND b.BlockedUserId = @senderId)
            """, new { groupId, senderId }, null, ct))).ToList();
    }

    public async Task MarkReadAsync(long groupId, long userId, bool receipts, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        // Only ever moves forward: a read on a slow phone must not un-read what another device read.
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE me SET LastReadMessageId = x.Latest
            FROM dbo.ChatGroupMembers me
            CROSS APPLY (SELECT MAX(m.Id) AS Latest FROM dbo.ChatMessages m WHERE m.GroupId = me.GroupId) x
            WHERE me.GroupId = @groupId AND me.UserId = @userId AND x.Latest IS NOT NULL AND x.Latest > ISNULL(me.LastReadMessageId, 0)
            """, new { groupId, userId }, tx, ct));
        if (receipts)
            await c.ExecuteAsync(Sql.Cmd($"""
                INSERT INTO dbo.ChatReads (MessageId, UserId, SeenAt)
                SELECT m.Id, @userId, @at
                FROM dbo.ChatMessages m
                JOIN dbo.ChatGroups g ON g.Id = m.GroupId
                JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
                WHERE m.GroupId = @groupId AND m.IsSystem = 0 AND m.FromUserId <> @userId AND {Window}
                  AND NOT EXISTS (SELECT 1 FROM dbo.ChatReads r WHERE r.MessageId = m.Id AND r.UserId = @userId)
                """, new { groupId, userId, at }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task SetMutedAsync(long groupId, long userId, bool on, CancellationToken ct, DateTime? until = null)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET Muted = @on, MutedUntil = @until WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, on, until = on ? until : null }, null, ct));
    }

    public async Task SetArchivedAsync(long groupId, long userId, DateTime? at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET ArchivedAt = @at WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, at }, null, ct));
    }

    public async Task UnarchiveOthersAsync(long groupId, long senderId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // A member who muted the conversation keeps it archived: they asked not to be bothered.
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatGroupMembers SET ArchivedAt = NULL
            WHERE GroupId = @groupId AND UserId <> @senderId AND ArchivedAt IS NOT NULL
              AND NOT (Muted = 1 AND (MutedUntil IS NULL OR MutedUntil > SYSUTCDATETIME()))
            """, new { groupId, senderId }, null, ct));
    }

    public async Task<bool> EditMessageAsync(long messageId, long userId, string text, DateTime at, DateTime windowStart, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatMessages SET OriginalText = ISNULL(OriginalText, [Text]), [Text] = @text, EditedAt = @at
            WHERE Id = @messageId AND FromUserId = @userId AND DeletedAt IS NULL AND IsSystem = 0 AND Photo IS NULL AND [At] >= @windowStart
            """, new { messageId, userId, text, at, windowStart }, null, ct)) > 0;
    }

    public async Task<bool> DeleteMessageAsync(long messageId, long userId, DateTime at, DateTime windowStart, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ChatMessages SET OriginalText = ISNULL(OriginalText, [Text]), [Text] = N'', DeletedAt = @at
            WHERE Id = @messageId AND FromUserId = @userId AND DeletedAt IS NULL AND IsSystem = 0 AND [At] >= @windowStart
            """, new { messageId, userId, at, windowStart }, null, ct)) > 0;
    }

    public async Task<int> CountSentInAsync(long groupId, long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatMessages WHERE GroupId = @groupId AND FromUserId = @userId AND IsSystem = 0 AND [At] >= @since", new { groupId, userId, since }, null, ct));
    }

    public async Task<ChatMessageRow?> FindLatestFromAsync(long groupId, long readerId, long fromUserId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatMessageRow>(Sql.Cmd($"""
            SELECT TOP 1 m.Id, m.PublicId, ISNULL(m.FromUserId, 0) AS FromUserId, m.IsSystem, m.[At]
            FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @readerId
            WHERE m.GroupId = @groupId AND m.FromUserId = @fromUserId AND m.IsSystem = 0 AND {Window}
            ORDER BY m.Id DESC
            """, new { groupId, readerId, fromUserId }, null, ct));
    }

    public async Task<List<ChatPinRow>> ListPinsAsync(long groupId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatPinRow>(Sql.Cmd($"""
            SELECT m.Id, m.PublicId, ISNULL(m.FromUserId, 0) AS FromUserId, m.[Text], m.Kind, m.Payload, CAST(CASE WHEN m.Photo IS NULL THEN 0 ELSE 1 END AS bit) AS HasPhoto, m.[At]
            FROM dbo.ChatPins p
            JOIN dbo.ChatMessages m ON m.Id = p.MessageId
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
            WHERE p.GroupId = @groupId AND m.DeletedAt IS NULL AND {Window}
            ORDER BY p.[At], m.Id
            """, new { groupId, userId }, null, ct))).ToList();
    }

    public async Task<bool> PinAsync(long groupId, long messageId, long pinnedBy, DateTime at, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // One statement: the count and the insert cannot be split by a second pin arriving between them.
        var added = await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatPins (GroupId, MessageId, PinnedBy, [At])
            SELECT @groupId, @messageId, @pinnedBy, @at
            WHERE NOT EXISTS (SELECT 1 FROM dbo.ChatPins WHERE GroupId = @groupId AND MessageId = @messageId)
              AND (SELECT COUNT(*) FROM dbo.ChatPins WHERE GroupId = @groupId) < @max
            """, new { groupId, messageId, pinnedBy, at, max }, null, ct));
        return added > 0 || await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatPins WHERE GroupId = @groupId AND MessageId = @messageId", new { groupId, messageId }, null, ct)) > 0;
    }

    public async Task UnpinAsync(long groupId, long messageId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatPins WHERE GroupId = @groupId AND MessageId = @messageId", new { groupId, messageId }, null, ct));
    }

    public async Task<HashSet<long>> ListPinnedIdsAsync(long groupId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return [.. await c.QueryAsync<long>(Sql.Cmd("SELECT MessageId FROM dbo.ChatPins WHERE GroupId = @groupId", new { groupId }, null, ct))];
    }

    public async Task SetResponseAsync(long messageId, long userId, int choice, bool addedToPlan, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // One statement per person and message, so two taps racing leave one answer (the last one).
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.ChatResponses WITH (HOLDLOCK) AS t
            USING (SELECT @messageId AS MessageId, @userId AS UserId) AS s ON t.MessageId = s.MessageId AND t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET Choice = @choice, AddedToPlan = @addedToPlan, [At] = @at
            WHEN NOT MATCHED THEN INSERT (MessageId, UserId, Choice, AddedToPlan, [At]) VALUES (@messageId, @userId, @choice, @addedToPlan, @at);
            """, new { messageId, userId, choice, addedToPlan, at }, null, ct));
    }

    public async Task<ChatResponseRow?> GetResponseAsync(long messageId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatResponseRow>(Sql.Cmd("SELECT MessageId, UserId, Choice, AddedToPlan FROM dbo.ChatResponses WHERE MessageId = @messageId AND UserId = @userId", new { messageId, userId }, null, ct));
    }

    public async Task<List<ChatResponseRow>> ListResponsesAsync(IReadOnlyCollection<long> messageIds, CancellationToken ct)
    {
        if (messageIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatResponseRow>(Sql.Cmd("SELECT MessageId, UserId, Choice, AddedToPlan FROM dbo.ChatResponses WHERE MessageId IN @ids", new { ids = messageIds.ToArray() }, null, ct))).ToList();
    }

    public async Task<bool> ClosePollAsync(long messageId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatMessages SET ClosedAt = @at WHERE Id = @messageId AND Kind = 'poll' AND ClosedAt IS NULL", new { messageId, at }, null, ct)) > 0;
    }

    public async Task SetMentionsOnlyAsync(long groupId, long userId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET MentionsOnly = @on WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, on }, null, ct));
    }

    public async Task SetNotifyAwayAsync(long groupId, long userId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatGroupMembers SET NotifyAway = @on WHERE GroupId = @groupId AND UserId = @userId", new { groupId, userId, on }, null, ct));
    }

    public async Task<List<ChatAwayClaimRow>> ClaimAwayAsync(long userId, string status, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatAwayClaimRow>(Sql.Cmd("""
            UPDATE dbo.ChatGroupMembers SET AwayStatus = @status
            OUTPUT INSERTED.GroupId AS GroupId, DELETED.AwayStatus AS Previous, INSERTED.NotifyAway AS NotifyAway
            WHERE UserId = @userId AND Status = 'active' AND ISNULL(AwayStatus, '') <> @status
              AND GroupId NOT IN (SELECT Id FROM dbo.ChatGroups WHERE Kind = 'stanley')
            """, new { userId, status }, null, ct))).ToList();
    }

    public async Task<List<ChatAwayRecipientRow>> ListAwayRecipientsAsync(long userId, IReadOnlyCollection<long> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatAwayRecipientRow>(Sql.Cmd("""
            SELECT m.GroupId, g.PublicId AS GroupPublicId, m.UserId, CAST(CASE WHEN m.Muted = 1 AND (m.MutedUntil IS NULL OR m.MutedUntil > SYSUTCDATETIME()) THEN 1 ELSE 0 END AS bit) AS Muted
            FROM dbo.ChatGroupMembers m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            WHERE m.GroupId IN @groupIds AND m.Status = 'active' AND m.UserId <> @userId
              AND EXISTS (SELECT 1 FROM dbo.ChatConnections cc WHERE cc.Status = 'accepted' AND cc.PairLow = CASE WHEN @userId < m.UserId THEN @userId ELSE m.UserId END AND cc.PairHigh = CASE WHEN @userId < m.UserId THEN m.UserId ELSE @userId END)
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatBlocks b WHERE (b.UserId = m.UserId AND b.BlockedUserId = @userId) OR (b.UserId = @userId AND b.BlockedUserId = m.UserId))
            """, new { userId, groupIds }, null, ct))).ToList();
    }

    public async Task AddSystemLineAsync(long groupId, long userId, string text, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], IsSystem, [At]) VALUES (@groupId, @userId, @text, 1, @at)", new { groupId, userId, text, at }, null, ct));
    }

    public async Task<ChatMessageRow?> FindMessageAsync(long groupId, long userId, Guid messagePublicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ChatMessageRow>(Sql.Cmd($"""
            SELECT m.Id, m.PublicId, ISNULL(m.FromUserId, 0) AS FromUserId, m.[Text], m.Photo, m.[At], m.IsSystem, m.ViaSms, m.Urgency, m.Persona, m.Subtitle,
                   m.Lane, m.NoticeKey, m.NoticeKind, m.NoticePath, m.NoticeSubject, m.ExpiresAt, m.SupersededAt, m.EditedAt, m.DeletedAt, m.Kind, m.Payload, m.ClosedAt
            FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
            WHERE m.GroupId = @groupId AND m.PublicId = @messagePublicId AND {Window}
            """, new { groupId, userId, messagePublicId }, null, ct));
    }

    public async Task<bool> AddDeliveryAsync(Guid messagePublicId, long userId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatMessageDeliveries (MessageId, UserId, DeliveredAt)
            SELECT m.Id, @userId, @at FROM dbo.ChatMessages m
            WHERE m.PublicId = @messagePublicId AND m.IsSystem = 0 AND m.FromUserId IS NOT NULL AND m.FromUserId <> @userId
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatMessageDeliveries d WHERE d.MessageId = m.Id AND d.UserId = @userId)
            """, new { messagePublicId, userId, at }, null, ct)) > 0;
    }

    public async Task<string?> GetReactionAsync(long messageId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<string>(Sql.Cmd("SELECT Emoji FROM dbo.ChatReactions WHERE MessageId = @messageId AND UserId = @userId", new { messageId, userId }, null, ct));
    }

    public async Task SetReactionAsync(long messageId, long userId, string? emoji, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        if (emoji is null) { await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatReactions WHERE MessageId = @messageId AND UserId = @userId", new { messageId, userId }, null, ct)); return; }
        // One row per person per message: update the row if there is one, else add it. A race between two taps ends on one of them, never two rows (the key forbids it).
        var changed = await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatReactions SET Emoji = @emoji, [At] = @at WHERE MessageId = @messageId AND UserId = @userId", new { messageId, userId, emoji, at }, null, ct));
        if (changed > 0) return;
        try { await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatReactions (MessageId, UserId, Emoji, [At]) VALUES (@messageId, @userId, @emoji, @at)", new { messageId, userId, emoji, at }, null, ct)); }
        catch (DbException e) when (e is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
        {
            await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.ChatReactions SET Emoji = @emoji, [At] = @at WHERE MessageId = @messageId AND UserId = @userId", new { messageId, userId, emoji, at }, null, ct));
        }
    }

    public async Task<List<ChatReactionRow>> ListReactionsAsync(long messageId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatReactionRow>(Sql.Cmd("SELECT MessageId, UserId, Emoji FROM dbo.ChatReactions WHERE MessageId = @messageId", new { messageId }, null, ct))).ToList();
    }

    public async Task<List<long>> MarkDeliveredAsync(long groupId, long userId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // Only messages the person may read (their window, nobody they blocked), only from others, and only those not yet marked. OUTPUT cannot hold a subquery, so the senders are read after.
        var marked = (await c.QueryAsync<long>(Sql.Cmd($"""
            INSERT INTO dbo.ChatMessageDeliveries (MessageId, UserId, DeliveredAt)
            OUTPUT INSERTED.MessageId
            SELECT m.Id, @userId, @at
            FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
            WHERE m.GroupId = @groupId AND m.IsSystem = 0 AND m.FromUserId IS NOT NULL AND m.FromUserId <> @userId AND {Window}
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatMessageDeliveries d WHERE d.MessageId = m.Id AND d.UserId = @userId)
            """, new { groupId, userId, at }, null, ct))).ToArray();
        if (marked.Length == 0) return [];
        return (await c.QueryAsync<long>(Sql.Cmd("SELECT DISTINCT FromUserId FROM dbo.ChatMessages WHERE Id IN @marked AND FromUserId IS NOT NULL", new { marked }, null, ct))).ToList();
    }

    public async Task<int> CountSentAsync(long userId, string urgency, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.ChatMessages WHERE FromUserId = @userId AND Urgency = @urgency AND [At] >= @since", new { userId, urgency, since }, null, ct));
    }

    public async Task<bool> AddAckAsync(long messageId, long userId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ChatMessageAcks (MessageId, UserId, AckedAt)
            SELECT @messageId, @userId, @at
            WHERE NOT EXISTS (SELECT 1 FROM dbo.ChatMessageAcks a WHERE a.MessageId = @messageId AND a.UserId = @userId)
            """, new { messageId, userId, at }, null, ct)) > 0;
    }

    public async Task<List<(Guid ConversationId, Guid MessageId)>> ListUnackedUrgentAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<(Guid, Guid)>(Sql.Cmd($"""
            SELECT g.PublicId, m.PublicId
            FROM dbo.ChatGroupMembers me
            JOIN dbo.ChatGroups g ON g.Id = me.GroupId
            JOIN dbo.ChatMessages m ON m.GroupId = g.Id
            WHERE me.UserId = @userId AND me.Status = 'active' AND m.Urgency = 'urgent' AND m.IsSystem = 0 AND ISNULL(m.FromUserId, 0) <> me.UserId AND {Window}
              AND NOT EXISTS (SELECT 1 FROM dbo.ChatMessageAcks a WHERE a.MessageId = m.Id AND a.UserId = @userId)
            ORDER BY m.Id
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<int> UnreadTotalAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd($"""
            SELECT COUNT(*)
            FROM dbo.ChatGroupMembers me
            JOIN dbo.ChatGroups g ON g.Id = me.GroupId
            JOIN dbo.ChatMessages m ON m.GroupId = g.Id
            WHERE me.UserId = @userId AND me.Status = 'active' AND m.IsSystem = 0 AND ISNULL(m.FromUserId, 0) <> me.UserId AND m.Id > ISNULL(me.LastReadMessageId, 0) AND {Window}
            """, new { userId }, null, ct));
    }

    public async Task<bool> GetTypingAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<bool?>(Sql.Cmd("SELECT ChatTyping FROM dbo.UserPrefs WHERE UserId = @userId", new { userId }, null, ct)) ?? true;
    }

    public async Task<bool> GetReceiptsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<bool?>(Sql.Cmd("SELECT ReceiptsOn FROM dbo.UserPrefs WHERE UserId = @userId", new { userId }, null, ct)) ?? false;
    }

    public async Task SetReceiptsAsync(long userId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.UserPrefs AS t USING (SELECT @userId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET ReceiptsOn = @on, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, ReceiptsOn) VALUES (@userId, @on);
            """, new { userId, on }, null, ct));
    }

    public async Task<List<long>> ListBlocksAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<long>(Sql.Cmd("SELECT BlockedUserId FROM dbo.ChatBlocks WHERE UserId = @userId ORDER BY CreatedAt", new { userId }, null, ct))).ToList();
    }

    public async Task SetBlockAsync(long userId, long blockedUserId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        if (on)
            await c.ExecuteAsync(Sql.Cmd("IF NOT EXISTS (SELECT 1 FROM dbo.ChatBlocks WHERE UserId = @userId AND BlockedUserId = @blockedUserId) INSERT INTO dbo.ChatBlocks (UserId, BlockedUserId) VALUES (@userId, @blockedUserId)", new { userId, blockedUserId }, null, ct));
        else
            await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ChatBlocks WHERE UserId = @userId AND BlockedUserId = @blockedUserId", new { userId, blockedUserId }, null, ct));
    }

    public async Task<bool> AddReportAsync(long userId, Guid messagePublicId, string reason, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd($"""
            INSERT INTO dbo.ChatReports (MessageId, ByUserId, Reason, [At])
            SELECT m.Id, @userId, @reason, @at FROM dbo.ChatMessages m
            JOIN dbo.ChatGroups g ON g.Id = m.GroupId
            JOIN dbo.ChatGroupMembers me ON me.GroupId = g.Id AND me.UserId = @userId
            WHERE m.PublicId = @messagePublicId AND m.IsSystem = 0 AND {Window}
            """, new { userId, messagePublicId, reason, at }, null, ct)) > 0;
    }
}
