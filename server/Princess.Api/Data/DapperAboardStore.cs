using System.Data.Common;
using Dapper;

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

/// <summary>The chat store over SQL Server.</summary>
public sealed class DapperChatStore(IDbConnectionFactory db) : IChatStore
{
    private const string MyGroups = "(SELECT GroupId FROM dbo.ChatGroupMembers WHERE UserId = @userId)";

    public async Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ChatPeerRow>(Sql.Cmd("""
            SELECT DISTINCT u.Id AS UserId, u.PublicId, CAST(ISNULL(p.ReceiptsOn, 0) AS bit) AS ReceiptsOn
            FROM dbo.ChatGroupMembers me
            JOIN dbo.ChatGroupMembers m ON m.GroupId = me.GroupId AND m.UserId <> me.UserId
            JOIN dbo.Users u ON u.Id = m.UserId
            LEFT JOIN dbo.UserPrefs p ON p.UserId = u.Id
            WHERE me.UserId = @userId
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<List<ChatMessageRow>> ListMessagesAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var messages = (await c.QueryAsync<ChatMessageRow>(Sql.Cmd($"""
            SELECT TOP (500) m.Id, m.PublicId, m.FromUserId, m.[Text], m.Photo, m.[At]
            FROM dbo.ChatMessages m WHERE m.GroupId IN {MyGroups} ORDER BY m.[At] DESC, m.Id DESC
            """, new { userId }, null, ct))).Reverse().ToList();
        if (messages.Count == 0) return messages;
        var ids = messages.Select(m => m.Id).ToArray();
        var reads = (await c.QueryAsync<(long MessageId, long UserId)>(Sql.Cmd("SELECT MessageId, UserId FROM dbo.ChatReads WHERE MessageId IN @ids", new { ids }, null, ct))).ToList();
        foreach (var m in messages) m.SeenBy = [.. reads.Where(r => r.MessageId == m.Id).Select(r => r.UserId)];
        return messages;
    }

    public async Task<ChatMessageRow> AddMessageAsync(long userId, string text, string? photo, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var group = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT TOP 1 GroupId FROM dbo.ChatGroupMembers WHERE UserId = @userId ORDER BY GroupId", new { userId }, tx, ct));
        if (group is null)
        {
            group = await c.ExecuteScalarAsync<long>(Sql.Cmd("INSERT INTO dbo.ChatGroups (Name) OUTPUT INSERTED.Id VALUES (N'Chat')", null, tx, ct));
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ChatGroupMembers (GroupId, UserId) VALUES (@group, @userId)", new { group, userId }, tx, ct));
        }
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.ChatMessages (GroupId, FromUserId, [Text], Photo, [At]) OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@group, @userId, @text, @photo, @at)
            """, new { group, userId, text, photo, at }, tx, ct));
        await tx.CommitAsync(ct);
        return new ChatMessageRow { Id = id, PublicId = publicId, FromUserId = userId, Text = text, Photo = photo, At = at };
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

    public async Task MarkSeenAsync(long userId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd($"""
            INSERT INTO dbo.ChatReads (MessageId, UserId, SeenAt)
            SELECT m.Id, @userId, @at FROM dbo.ChatMessages m
            WHERE m.GroupId IN {MyGroups} AND m.FromUserId <> @userId AND NOT EXISTS (SELECT 1 FROM dbo.ChatReads r WHERE r.MessageId = m.Id AND r.UserId = @userId)
            """, new { userId, at }, null, ct));
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
            SELECT m.Id, @userId, @reason, @at FROM dbo.ChatMessages m WHERE m.PublicId = @messagePublicId AND m.GroupId IN {MyGroups}
            """, new { userId, messagePublicId, reason, at }, null, ct)) > 0;
    }
}
