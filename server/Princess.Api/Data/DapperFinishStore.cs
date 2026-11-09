using Dapper;
using Microsoft.Data.SqlClient;

namespace Princess.Api.Data;

/// <summary>The Phase 11 store over SQL Server.</summary>
public sealed class DapperFinishStore(IDbConnectionFactory db) : IFinishStore
{
    // ---- Disembarkation ----

    public async Task<ChoiceRow?> GetChoiceAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<ChoiceRow>(Sql.Cmd("SELECT OptionCode AS [Option], TagsOn, DecidedAt FROM dbo.DisembarkChoices WHERE BookingId = @bookingId", new { bookingId }, null, ct));
        if (row is null) return null;
        row.Bags = (await c.QueryAsync<(long UserId, int Bags)>(Sql.Cmd("SELECT UserId, Bags FROM dbo.DisembarkBags WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToDictionary(b => b.UserId, b => b.Bags);
        return row;
    }

    public async Task SaveChoiceAsync(long bookingId, string option, bool tagsOn, IReadOnlyDictionary<long, int> bags, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.DisembarkChoices AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET OptionCode = @option, TagsOn = @tagsOn, DecidedAt = @at, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, OptionCode, TagsOn, DecidedAt) VALUES (@bookingId, @option, @tagsOn, @at);
            """, new { bookingId, option, tagsOn, at }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.DisembarkBags WHERE BookingId = @bookingId", new { bookingId }, tx, ct));
        foreach (var (userId, n) in bags)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.DisembarkBags (BookingId, UserId, Bags) VALUES (@bookingId, @userId, @n)", new { bookingId, userId, n }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task SetTagsOnAsync(long bookingId, bool on, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.DisembarkChoices SET TagsOn = @on, UpdatedAt = SYSUTCDATETIME() WHERE BookingId = @bookingId", new { bookingId, on }, null, ct));
    }

    public async Task<List<CelebrationRow>> ListCelebrationsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<CelebrationRow>(Sql.Cmd(
            "SELECT ClientId, Label, RIGHT('0' + CAST([Month] AS varchar(2)), 2) + '-' + RIGHT('0' + CAST([Day] AS varchar(2)), 2) AS MonthDay, Surprise, ToldAt FROM dbo.Celebrations WHERE BookingId = @bookingId ORDER BY CreatedAt, ClientId",
            new { bookingId }, null, ct))).ToList();
    }

    public async Task SaveCelebrationsAsync(long bookingId, IReadOnlyList<CelebrationRow> rows, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Celebrations WHERE BookingId = @bookingId", new { bookingId }, tx, ct));
        foreach (var r in rows)
            await c.ExecuteAsync(Sql.Cmd(
                "INSERT INTO dbo.Celebrations (BookingId, ClientId, Label, [Month], [Day], Surprise, ToldAt) VALUES (@bookingId, @ClientId, @Label, @month, @day, @Surprise, @ToldAt)",
                new { bookingId, r.ClientId, r.Label, month = int.Parse(r.MonthDay[..2]), day = int.Parse(r.MonthDay[3..]), r.Surprise, r.ToldAt }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<List<ThanksRow>> ListThanksAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ThanksRow>(Sql.Cmd("SELECT Id, UserId, Team, Body, CreatedAt FROM dbo.Thanks WHERE BookingId = @bookingId ORDER BY CreatedAt, Id", new { bookingId }, null, ct))).ToList();
    }

    public async Task AddThanksAsync(long bookingId, ThanksRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.Thanks (Id, BookingId, UserId, Team, Body, CreatedAt) VALUES (@Id, @bookingId, @UserId, @Team, @Body, @CreatedAt)", new { row.Id, bookingId, row.UserId, row.Team, row.Body, row.CreatedAt }, null, ct));
    }

    public async Task<List<WishRow>> ListWishesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<WishRow>(Sql.Cmd("SELECT Id, UserId, CelebrationClientId, Author, Body, CreatedAt FROM dbo.CelebrationWishes WHERE BookingId = @bookingId ORDER BY CreatedAt, Id", new { bookingId }, null, ct))).ToList();
    }

    public async Task AddWishAsync(long bookingId, WishRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.CelebrationWishes (Id, BookingId, CelebrationClientId, UserId, Author, Body, CreatedAt) VALUES (@Id, @bookingId, @CelebrationClientId, @UserId, @Author, @Body, @CreatedAt)", new { row.Id, bookingId, row.CelebrationClientId, row.UserId, row.Author, row.Body, row.CreatedAt }, null, ct));
    }

    public async Task<CustomsRow?> GetCustomsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<CustomsRow>(Sql.Cmd("SELECT Declaration AS Json, SubmittedAt FROM dbo.Customs WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveCustomsAsync(long bookingId, string json, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.Customs AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Declaration = @json, SubmittedAt = @at, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, Declaration, SubmittedAt) VALUES (@bookingId, @json, @at);
            """, new { bookingId, json, at }, null, ct));
    }

    public async Task<OnwardRow?> GetOnwardAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<OnwardRow>(Sql.Cmd(
            "SELECT Mode, ISNULL(CONVERT(varchar(5), FlightAtLocal, 108), '') AS FlightAt, ISNULL(Flight, N'') AS Flight, Note FROM dbo.OnwardPlans WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveOnwardAsync(long bookingId, OnwardRow plan, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.OnwardPlans AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Mode = @Mode, FlightAtLocal = CAST(NULLIF(@FlightAt, N'') AS time(0)), Flight = @Flight, Note = @Note, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, Mode, FlightAtLocal, Flight, Note) VALUES (@bookingId, @Mode, CAST(NULLIF(@FlightAt, N'') AS time(0)), @Flight, @Note);
            """, new { bookingId, plan.Mode, plan.FlightAt, plan.Flight, plan.Note }, null, ct));
    }

    public async Task<HashSet<string>> ListNightTicksAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd("SELECT ItemId FROM dbo.NightTicks WHERE BookingId = @bookingId AND Done = 1", new { bookingId }, null, ct))).ToHashSet();
    }

    public async Task SetNightTickAsync(long bookingId, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.NightTicks AS t USING (SELECT @bookingId AS BookingId, @itemId AS ItemId) AS s ON t.BookingId = s.BookingId AND t.ItemId = s.ItemId
            WHEN MATCHED THEN UPDATE SET Done = @done, [At] = @at
            WHEN NOT MATCHED THEN INSERT (BookingId, ItemId, Done, [At]) VALUES (@bookingId, @itemId, @done, @at);
            """, new { bookingId, itemId, done, at }, null, ct));
    }

    // ---- The final bill ----

    public async Task<FinalBillRow?> GetFinalBillAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<FinalBillRow>(Sql.Cmd("SELECT TipKeepPercent, EmailedAt, EmailedTo, SettledAt FROM dbo.FinalBill WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveTipAsync(long bookingId, int keepPercent, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.FinalBill AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET TipKeepPercent = @keepPercent, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, TipKeepPercent) VALUES (@bookingId, @keepPercent);
            """, new { bookingId, keepPercent }, tx, ct));
        await DapperShipboardStore.ReplaceFolioAsync(c, tx, bookingId, "tip", bookingId, folio, ct);
        await tx.CommitAsync(ct);
    }

    public async Task SaveEmailedAsync(long bookingId, DateTime at, string to, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.FinalBill AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET EmailedAt = @at, EmailedTo = @to, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, EmailedAt, EmailedTo) VALUES (@bookingId, @at, @to);
            """, new { bookingId, at, to }, null, ct));
    }

    // ---- Cases ----

    public async Task<List<CaseRow>> ListCasesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<CaseRow>(Sql.Cmd("""
            SELECT PublicId, UserId, Kind, Number, Summary, ISNULL(Place, N'') AS Place, ISNULL(Cents, 0) AS Cents, ISNULL(LineId, N'') AS LineId, OpenedAt,
                   ISNULL(DueAt, OpenedAt) AS DueAt, WithdrawnAt, FromFeedback
            FROM dbo.Cases WHERE BookingId = @bookingId ORDER BY OpenedAt DESC, Id DESC
            """, new { bookingId }, null, ct))).ToList();
    }

    public async Task<CaseRow?> AddCaseAsync(long bookingId, CaseRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        try
        {
            row.PublicId = await c.QuerySingleAsync<Guid>(Sql.Cmd("""
                INSERT INTO dbo.Cases (UserId, BookingId, Kind, Number, Summary, Place, Cents, LineId, Stage, OpenedAt, DueAt, FromFeedback)
                OUTPUT INSERTED.PublicId
                VALUES (@UserId, @bookingId, @Kind, @Number, @Summary, @Place, @Cents, NULLIF(@LineId, N''), 'received', @OpenedAt, @DueAt, @FromFeedback)
                """, new { row.UserId, bookingId, row.Kind, row.Number, row.Summary, row.Place, row.Cents, row.LineId, row.OpenedAt, row.DueAt, row.FromFeedback }, null, ct));
            return row;
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            return null;
        }
    }

    public async Task<bool> WithdrawCaseAsync(long bookingId, Guid publicId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.Cases SET Stage = 'withdrawn', WithdrawnAt = @at, UpdatedAt = SYSUTCDATETIME() WHERE BookingId = @bookingId AND PublicId = @publicId AND WithdrawnAt IS NULL",
            new { bookingId, publicId, at }, null, ct)) > 0;
    }

    // ---- Feedback, history, loyalty ----

    public async Task<FeedbackRow?> GetFeedbackAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<FeedbackRow>(Sql.Cmd("SELECT Json, SubmittedAt, EditUntil FROM dbo.PostFeedback WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveFeedbackAsync(long bookingId, string json, DateTime at, DateTime editUntil, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.PostFeedback AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Json = @json, SubmittedAt = @at, EditUntil = @editUntil, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, Json, SubmittedAt, EditUntil) VALUES (@bookingId, @json, @at, @editUntil);
            """, new { bookingId, json, at, editUntil }, null, ct));
    }

    public async Task<List<HistoryTripRow>> ListHistoryTripsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var trips = (await c.QueryAsync<HistoryTripRow>(Sql.Cmd("SELECT Id, Title, Ship, Departure, Nights, Cancelled, FareCents FROM dbo.PastTrips WHERE UserId = @userId ORDER BY Departure DESC", new { userId }, null, ct))).ToList();
        if (trips.Count == 0) return trips;
        var ids = trips.Select(t => t.Id).ToArray();
        var docs = (await c.QueryAsync<(string PastTripId, string Doc, bool Ready)>(Sql.Cmd("SELECT PastTripId, Doc, Ready FROM dbo.PastTripDocs WHERE PastTripId IN @ids ORDER BY PastTripId", new { ids }, null, ct))).ToList();
        foreach (var t in trips) t.Docs = [.. docs.Where(d => d.PastTripId == t.Id).Select(d => (d.Doc, d.Ready))];
        var ports = (await c.QueryAsync<(string PastTripId, string Code, string Name, double Lat, double Lon)>(Sql.Cmd("SELECT PastTripId, Code, Name, CAST(Lat AS FLOAT) AS Lat, CAST(Lon AS FLOAT) AS Lon FROM dbo.PastTripPorts WHERE PastTripId IN @ids ORDER BY PastTripId, Seq", new { ids }, null, ct))).ToList();
        foreach (var t in trips) t.Ports = [.. ports.Where(p => p.PastTripId == t.Id).Select(p => (p.Code, p.Name, p.Lat, p.Lon))];
        return trips;
    }

    public async Task<LoyaltyRecordRow?> GetLoyaltyAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<LoyaltyRecordRow>(Sql.Cmd("SELECT RTRIM(Number) AS Number, DaysCounted, ReferralCode FROM dbo.Loyalty WHERE UserId = @userId", new { userId }, null, ct));
        if (row is null) return null;
        row.Referrals = [.. (await c.QueryAsync<(string Name, string State, Guid Id)>(Sql.Cmd("SELECT FriendName, State, PublicId FROM dbo.Referrals WHERE UserId = @userId ORDER BY Id", new { userId }, null, ct)))];
        return row;
    }

    public async Task<List<CreditRow>> ListCreditsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<CreditRow>(Sql.Cmd(
            "SELECT PublicId AS Id, Source, OriginalCents AS Original, RemainingCents AS Remaining, ExpiresOn FROM dbo.FutureCruiseCredits WHERE UserId = @userId ORDER BY ExpiresOn, Id", new { userId }, null, ct))).ToList();
    }

    public async Task<List<CreditUseRow>> ListCreditUsesAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<CreditUseRow>(Sql.Cmd("""
            SELECT f.[At] AS [At], f.Description AS What, -f.Cents AS Cents
            FROM dbo.FolioLines f JOIN dbo.Bookings b ON b.Id = f.BookingId
            WHERE b.BookerUserId = @userId AND f.SourceType = N'fcc' ORDER BY f.[At] DESC, f.Id DESC
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<List<LoyaltyReportRow>> ListLoyaltyReportsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<LoyaltyReportRow>(Sql.Cmd(
            "SELECT PublicId AS Id, What, Note, Status, [At] AS [At] FROM dbo.LoyaltyReports WHERE UserId = @userId ORDER BY Id DESC", new { userId }, null, ct))).ToList();
    }

    public async Task AddLoyaltyReportAsync(long userId, string what, string note, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.LoyaltyReports (UserId, What, Note, [At]) VALUES (@userId, @what, @note, @at)", new { userId, what, note, at }, null, ct));
    }

    public async Task AddReferralAsync(long userId, string name, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.Referrals (UserId, FriendName) VALUES (@userId, @name)", new { userId, name }, null, ct));
    }

    public async Task<bool> RevokeReferralAsync(long userId, Guid id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Referrals WHERE UserId = @userId AND PublicId = @id AND State = 'invited'", new { userId, id }, null, ct)) > 0;
    }

    // ---- Rebooking ----

    public async Task<List<HoldRow>> ListHoldsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<HoldRow>(Sql.Cmd("""
            SELECT Id, PublicId, SailingId, CategoryId, Guests, TotalCents, DepositCents, CreditCents, FccAppliedCents, Onboard, PlacedAt, ExpiresAt
            FROM dbo.RebookHolds WHERE BookingId = @bookingId ORDER BY PlacedAt, Id
            """, new { bookingId }, null, ct))).ToList();
    }

    public async Task<HoldRow> AddHoldAsync(long bookingId, long userId, HoldRow hold, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.RebookHolds (UserId, BookingId, SailingId, CategoryId, Guests, TotalCents, DepositCents, CreditCents, FccAppliedCents, Onboard, PlacedAt, ExpiresAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@userId, @bookingId, @SailingId, @CategoryId, @Guests, @TotalCents, @DepositCents, @CreditCents, @FccAppliedCents, @Onboard, @PlacedAt, @ExpiresAt)
            """, new { userId, bookingId, hold.SailingId, hold.CategoryId, hold.Guests, hold.TotalCents, hold.DepositCents, hold.CreditCents, hold.FccAppliedCents, hold.Onboard, hold.PlacedAt, hold.ExpiresAt }, tx, ct));
        hold.Id = id;
        hold.PublicId = publicId;
        if (folio.Count > 0) await DapperShipboardStore.ReplaceFolioAsync(c, tx, bookingId, "hold", id, folio, ct);
        await tx.CommitAsync(ct);
        return hold;
    }

    public async Task<bool> ReleaseHoldAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.RebookHolds WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, tx, ct));
        if (id is null) return false;
        await DapperShipboardStore.ReplaceFolioAsync(c, tx, bookingId, "hold", id.Value, [], ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.RebookHolds WHERE Id = @id", new { id }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    public async Task<long> FccLeftAsync(long userId, DateOnly today, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<long>(Sql.Cmd(
            "SELECT ISNULL(SUM(RemainingCents), 0) FROM dbo.FutureCruiseCredits WHERE UserId = @userId AND ExpiresOn >= @today", new { userId, today = today.ToDateTime(TimeOnly.MinValue) }, null, ct));
    }

    public async Task<long> FccConvertedAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<long>(Sql.Cmd("SELECT ISNULL(-SUM(Cents), 0) FROM dbo.FolioLines WHERE BookingId = @bookingId AND SourceType = N'fcc'", new { bookingId }, null, ct));
    }

    public async Task ConvertFccAsync(long bookingId, long userId, long cents, DateOnly today, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var credits = (await c.QueryAsync<(long Id, long Remaining)>(Sql.Cmd(
            "SELECT Id, RemainingCents FROM dbo.FutureCruiseCredits WHERE UserId = @userId AND ExpiresOn >= @today AND RemainingCents > 0 ORDER BY ExpiresOn, Id", new { userId, today = today.ToDateTime(TimeOnly.MinValue) }, tx, ct))).ToList();
        var left = cents;
        foreach (var (id, remaining) in credits)
        {
            if (left <= 0) break;
            var take = Math.Min(left, remaining);
            await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.FutureCruiseCredits SET RemainingCents = RemainingCents - @take, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id", new { id, take }, tx, ct));
            left -= take;
        }
        var seq = await c.ExecuteScalarAsync<long>(Sql.Cmd("SELECT COUNT(*) FROM dbo.FolioLines WHERE BookingId = @bookingId AND SourceType = N'fcc'", new { bookingId }, tx, ct)) + 1;
        await DapperShipboardStore.ReplaceFolioAsync(c, tx, bookingId, "fcc", seq, folio, ct);
        await tx.CommitAsync(ct);
    }

    // ---- The Future Cruise desk ----

    public async Task<List<DeskSlotRow>> ListDeskSlotsAsync(DateTime fromLocal, DateTime toLocal, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<DeskSlotRow>(Sql.Cmd("""
            SELECT s.[At], s.Capacity, (SELECT COUNT(*) FROM dbo.DeskAppointments a WHERE a.[At] = s.[At]) AS Taken
            FROM ref.DeskSlots s WHERE s.[At] >= @fromLocal AND s.[At] <= @toLocal ORDER BY s.[At]
            """, new { fromLocal, toLocal }, null, ct))).ToList();
    }

    public async Task<DateTime?> GetAppointmentAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<DateTime?>(Sql.Cmd("SELECT [At] FROM dbo.DeskAppointments WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task<bool> BookSlotAsync(long bookingId, DateTime atLocal, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var slot = await c.QuerySingleOrDefaultAsync<(int Capacity, int Taken)?>(Sql.Cmd("""
            SELECT s.Capacity, (SELECT COUNT(*) FROM dbo.DeskAppointments a WITH (UPDLOCK, HOLDLOCK) WHERE a.[At] = s.[At] AND a.BookingId <> @bookingId) AS Taken
            FROM ref.DeskSlots s WHERE s.[At] = @atLocal
            """, new { bookingId, atLocal }, tx, ct));
        if (slot is not { } s || s.Taken >= s.Capacity) return false;
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.DeskAppointments AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET [At] = @atLocal, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, [At]) VALUES (@bookingId, @atLocal);
            """, new { bookingId, atLocal }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    public async Task CancelSlotAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.DeskAppointments WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }
}
