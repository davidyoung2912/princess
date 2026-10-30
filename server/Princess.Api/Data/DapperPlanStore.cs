using System.Text.Json;
using Dapper;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Data;

/// <summary>The Phase 8 store over SQL Server. Reads stitch guests and payment methods onto each row; writes that move money run in one transaction with the payment row.</summary>
public sealed class DapperPlanStore(IDbConnectionFactory db) : IPlanStore
{
    private sealed record Guest(long OwnerId, long UserId);
    private sealed record Method(long PaymentId, string Method_, string? CardBrand, string? Last4);

    private static string Describe(string method, string? brand, string? last4) => method == "wallet" ? "Device wallet" : $"{TripService.BrandName(brand ?? "")} ending {last4}";

    private static async Task<Dictionary<long, List<string>>> MethodsAsync(System.Data.Common.DbConnection c, IEnumerable<long> paymentIds, CancellationToken ct)
    {
        var ids = paymentIds.Distinct().ToArray();
        var result = new Dictionary<long, List<string>>();
        if (ids.Length == 0) return result;
        var rows = await c.QueryAsync<(long PaymentId, string Method, string? CardBrand, string? Last4)>(Sql.Cmd(
            "SELECT PaymentId, Method, CardBrand, Last4 FROM dbo.PaymentParts WHERE PaymentId IN @ids ORDER BY PaymentId, Seq", new { ids }, null, ct));
        foreach (var r in rows)
        {
            if (!result.TryGetValue(r.PaymentId, out var list)) result[r.PaymentId] = list = [];
            list.Add(Describe(r.Method, r.CardBrand, r.Last4));
        }
        return result;
    }

    // ---- Excursions ----

    private sealed class TourSql
    {
        public long Id { get; set; }
        public Guid PublicId { get; set; }
        public string ExcursionId { get; set; } = "";
        public int Day { get; set; }
        public long TotalCents { get; set; }
        public long CreditCents { get; set; }
        public string Status { get; set; } = "";
        public long? CancelFeeCents { get; set; }
        public long? CancelRefundCents { get; set; }
        public long? PaymentId { get; set; }
        public DateTime At { get; set; }
    }

    public async Task<List<TourRow>> ListToursAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var tours = (await c.QueryAsync<TourSql>(Sql.Cmd("""
            SELECT Id, PublicId, ExcursionId, [Day], TotalCents, CreditCents, Status, CancelFeeCents, CancelRefundCents, PaymentId, [At]
            FROM dbo.TourBookings WHERE BookingId = @bookingId AND Source = 'pre' ORDER BY [At], Id
            """, new { bookingId }, null, ct))).ToList();
        if (tours.Count == 0) return [];
        var guests = (await c.QueryAsync<Guest>(Sql.Cmd(
            "SELECT TourBookingId AS OwnerId, UserId FROM dbo.TourBookingGuests WHERE TourBookingId IN @ids ORDER BY CreatedAt, UserId", new { ids = tours.Select(t => t.Id).ToArray() }, null, ct))).ToList();
        var methods = await MethodsAsync(c, tours.Where(t => t.PaymentId is not null).Select(t => t.PaymentId!.Value), ct);
        return tours.Select(t => new TourRow
        {
            Id = t.Id, PublicId = t.PublicId, ExcursionId = t.ExcursionId, Day = t.Day, TotalCents = t.TotalCents, CreditCents = t.CreditCents, Status = t.Status,
            FeeCents = t.CancelFeeCents, RefundCents = t.CancelRefundCents, At = t.At,
            GuestIds = guests.Where(g => g.OwnerId == t.Id).Select(g => g.UserId).ToList(),
            Methods = t.PaymentId is { } p && methods.TryGetValue(p, out var m) ? m : [],
        }).ToList();
    }

    public async Task<int> CountTourGuestsAsync(string sailingId, string excursionId, long? exceptTourId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT COUNT(*) FROM dbo.TourBookingGuests g
            JOIN dbo.TourBookings t ON t.Id = g.TourBookingId
            JOIN dbo.Bookings b ON b.Id = t.BookingId
            WHERE b.SailingId = @sailingId AND b.Status = 'confirmed' AND t.ExcursionId = @excursionId AND t.Status = 'booked'
              AND (@exceptTourId IS NULL OR t.Id <> @exceptTourId)
            """, new { sailingId, excursionId, exceptTourId }, null, ct));
    }

    public async Task<List<CartLineRow>> GetCartAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var lines = (await c.QueryAsync<string>(Sql.Cmd("SELECT ExcursionId FROM dbo.TourCartLines WHERE BookingId = @bookingId ORDER BY CreatedAt, ExcursionId", new { bookingId }, null, ct))).ToList();
        var guests = (await c.QueryAsync<(string ExcursionId, long UserId)>(Sql.Cmd(
            "SELECT ExcursionId, UserId FROM dbo.TourCartGuests WHERE BookingId = @bookingId ORDER BY CreatedAt, UserId", new { bookingId }, null, ct))).ToList();
        return lines.Select(l => new CartLineRow { ExcursionId = l, GuestIds = guests.Where(g => g.ExcursionId == l).Select(g => g.UserId).ToList() }).ToList();
    }

    public async Task SetCartLineAsync(long bookingId, string excursionId, IReadOnlyList<long> guestIds, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.TourCartLines WHERE BookingId = @bookingId AND ExcursionId = @excursionId", new { bookingId, excursionId }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.TourCartLines (BookingId, ExcursionId) VALUES (@bookingId, @excursionId)", new { bookingId, excursionId }, tx, ct));
        foreach (var userId in guestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.TourCartGuests (BookingId, ExcursionId, UserId) VALUES (@bookingId, @excursionId, @userId)", new { bookingId, excursionId, userId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task RemoveCartLineAsync(long bookingId, string excursionId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.TourCartLines WHERE BookingId = @bookingId AND ExcursionId = @excursionId", new { bookingId, excursionId }, null, ct));
    }

    public async Task BookToursAsync(long bookingId, IReadOnlyList<NewTour> tours, NewBookingPayment? payment, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        long? paymentId = payment is null ? null : await DapperBookingStore.InsertPaymentAsync(c, tx, bookingId, payment, ct);
        foreach (var t in tours)
        {
            var id = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
                INSERT INTO dbo.TourBookings (BookingId, ExcursionId, [Day], Source, TotalCents, CreditCents, Status, PaymentId, [At])
                OUTPUT INSERTED.Id
                VALUES (@bookingId, @ExcursionId, @Day, 'pre', @TotalCents, @CreditCents, 'booked', @paymentId, @at)
                """, new { bookingId, t.ExcursionId, t.Day, t.TotalCents, t.CreditCents, paymentId, at }, tx, ct));
            foreach (var userId in t.GuestIds)
                await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.TourBookingGuests (TourBookingId, UserId) VALUES (@id, @userId)", new { id, userId }, tx, ct));
        }
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.TourCartLines WHERE BookingId = @bookingId", new { bookingId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task ChangeTourAsync(long bookingId, TourChange change, NewBookingPayment? refund, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.TourBookings SET TotalCents = @TotalCents, CreditCents = @CreditCents, Status = @Status, CancelFeeCents = @FeeCents, CancelRefundCents = @RefundCents, UpdatedAt = @At
            WHERE Id = @TourId AND BookingId = @bookingId
            """, new { change.TourId, bookingId, change.TotalCents, change.CreditCents, change.Status, change.FeeCents, change.RefundCents, change.At }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.TourBookingGuests WHERE TourBookingId = @TourId", new { change.TourId }, tx, ct));
        foreach (var userId in change.GuestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.TourBookingGuests (TourBookingId, UserId) VALUES (@TourId, @userId)", new { change.TourId, userId }, tx, ct));
        if (refund is not null) await DapperBookingStore.InsertPaymentAsync(c, tx, bookingId, refund, ct);
        await tx.CommitAsync(ct);
    }

    // ---- Dining ----

    private sealed class TableSql
    {
        public long Id { get; set; }
        public Guid PublicId { get; set; }
        public string VenueId { get; set; } = "";
        public int Day { get; set; }
        public string Time { get; set; } = "";
        public string Note { get; set; } = "";
        public long ChargeCents { get; set; }
        public int LateMinutes { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    private const string TableSelect = """
        SELECT Id, PublicId, VenueId, [Day], CONVERT(CHAR(5), TimeLocal, 108) AS [Time], Note, ChargeCents, LateMinutes, CreatedAt
        FROM dbo.DiningReservations
        """;

    public async Task<List<TableRow>> ListTablesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var tables = (await c.QueryAsync<TableSql>(Sql.Cmd($"{TableSelect} WHERE BookingId = @bookingId AND Status = 'booked' ORDER BY [Day], TimeLocal, Id", new { bookingId }, null, ct))).ToList();
        if (tables.Count == 0) return [];
        var guests = (await c.QueryAsync<(long ReservationId, long UserId, bool Covered)>(Sql.Cmd(
            "SELECT ReservationId, UserId, Covered FROM dbo.DiningReservationGuests WHERE ReservationId IN @ids ORDER BY CreatedAt, UserId", new { ids = tables.Select(t => t.Id).ToArray() }, null, ct))).ToList();
        return tables.Select(t => new TableRow
        {
            Id = t.Id, PublicId = t.PublicId, VenueId = t.VenueId, Day = t.Day, Time = t.Time, Note = t.Note, ChargeCents = t.ChargeCents, LateMinutes = t.LateMinutes, At = t.CreatedAt,
            GuestIds = guests.Where(g => g.ReservationId == t.Id).Select(g => g.UserId).ToList(),
            CoveredIds = guests.Where(g => g.ReservationId == t.Id && g.Covered).Select(g => g.UserId).ToList(),
        }).ToList();
    }

    public async Task<int> CountTablesAsync(string sailingId, string venueId, int day, string time, long? exceptTableId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT COUNT(*) FROM dbo.DiningReservations r
            JOIN dbo.Bookings b ON b.Id = r.BookingId
            WHERE b.SailingId = @sailingId AND b.Status = 'confirmed' AND r.Status = 'booked' AND r.VenueId = @venueId AND r.[Day] = @day
              AND r.TimeLocal = @at AND (@exceptTableId IS NULL OR r.Id <> @exceptTableId)
            """, new { sailingId, venueId, day, at = TimeSpan.Parse(time + ":00"), exceptTableId }, null, ct));
    }

    public async Task<TableRow> AddTableAsync(long bookingId, NewTable t, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var row = await c.QuerySingleAsync<(long Id, Guid PublicId)>(Sql.Cmd("""
            INSERT INTO dbo.DiningReservations (BookingId, VenueId, [Day], TimeLocal, Note, ChargeCents, Status, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @VenueId, @Day, @at, @Note, @ChargeCents, 'booked', @At)
            """, new { bookingId, t.VenueId, t.Day, at = TimeSpan.Parse(t.Time + ":00"), t.Note, t.ChargeCents, t.At }, tx, ct));
        foreach (var userId in t.GuestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.DiningReservationGuests (ReservationId, UserId, Covered) VALUES (@id, @userId, @covered)",
                new { id = row.Id, userId, covered = t.CoveredIds.Contains(userId) }, tx, ct));
        await tx.CommitAsync(ct);
        return new TableRow
        {
            Id = row.Id, PublicId = row.PublicId, VenueId = t.VenueId, Day = t.Day, Time = t.Time, Note = t.Note, ChargeCents = t.ChargeCents, At = t.At,
            GuestIds = [.. t.GuestIds], CoveredIds = [.. t.CoveredIds],
        };
    }

    public async Task MoveTableAsync(long bookingId, long tableId, int day, string time, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.DiningReservations SET [Day] = @day, TimeLocal = @at, LateMinutes = 0, UpdatedAt = SYSUTCDATETIME() WHERE Id = @tableId AND BookingId = @bookingId AND Status = 'booked'",
            new { bookingId, tableId, day, at = TimeSpan.Parse(time + ":00") }, null, ct));
    }

    public async Task SetTableLateAsync(long bookingId, long tableId, int minutes, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.DiningReservations SET LateMinutes = @minutes, UpdatedAt = SYSUTCDATETIME() WHERE Id = @tableId AND BookingId = @bookingId AND Status = 'booked'", new { bookingId, tableId, minutes }, null, ct));
    }

    public async Task CancelTableAsync(long bookingId, long tableId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.DiningReservations SET Status = 'cancelled', UpdatedAt = SYSUTCDATETIME() WHERE Id = @tableId AND BookingId = @bookingId", new { bookingId, tableId }, null, ct));
    }

    // ---- Packages ----

    private sealed class PurchaseSql
    {
        public long Id { get; set; }
        public Guid PublicId { get; set; }
        public string Kind { get; set; } = "";
        public string ItemId { get; set; } = "";
        public int Units { get; set; }
        public long UnitCents { get; set; }
        public long TotalCents { get; set; }
        public string Status { get; set; } = "";
        public long CreditedCents { get; set; }
        public long? PaymentId { get; set; }
        public DateTime At { get; set; }
    }

    public async Task<List<PurchaseRow>> ListPurchasesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<PurchaseSql>(Sql.Cmd(
            "SELECT Id, PublicId, Kind, ItemId, Units, UnitCents, TotalCents, Status, CreditedCents, PaymentId, [At] FROM dbo.Purchases WHERE BookingId = @bookingId ORDER BY [At], Id", new { bookingId }, null, ct))).ToList();
        if (rows.Count == 0) return [];
        var guests = (await c.QueryAsync<Guest>(Sql.Cmd(
            "SELECT PurchaseId AS OwnerId, UserId FROM dbo.PurchaseGuests WHERE PurchaseId IN @ids ORDER BY CreatedAt, UserId", new { ids = rows.Select(r => r.Id).ToArray() }, null, ct))).ToList();
        var methods = await MethodsAsync(c, rows.Where(r => r.PaymentId is not null).Select(r => r.PaymentId!.Value), ct);
        return rows.Select(r => new PurchaseRow
        {
            Id = r.Id, PublicId = r.PublicId, Kind = r.Kind, ItemId = r.ItemId, Units = r.Units, UnitCents = r.UnitCents, TotalCents = r.TotalCents, Status = r.Status,
            CreditedCents = r.CreditedCents, At = r.At, GuestIds = guests.Where(g => g.OwnerId == r.Id).Select(g => g.UserId).ToList(),
            Methods = r.PaymentId is { } p && methods.TryGetValue(p, out var m) ? m : [],
        }).ToList();
    }

    public async Task AddPurchaseAsync(long bookingId, NewPurchase p, NewBookingPayment payment, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var paymentId = await DapperBookingStore.InsertPaymentAsync(c, tx, bookingId, payment, ct);
        var id = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
            INSERT INTO dbo.Purchases (BookingId, Kind, ItemId, Units, UnitCents, TotalCents, Status, PaymentId, [At])
            OUTPUT INSERTED.Id
            VALUES (@bookingId, @Kind, @ItemId, @Units, @UnitCents, @TotalCents, 'active', @paymentId, @At)
            """, new { bookingId, p.Kind, p.ItemId, p.Units, p.UnitCents, p.TotalCents, paymentId, p.At }, tx, ct));
        foreach (var userId in p.GuestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.PurchaseGuests (PurchaseId, UserId) VALUES (@id, @userId)", new { id, userId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task UpdatePurchaseAsync(long bookingId, long purchaseId, string status, long creditedCents, NewBookingPayment? refund, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.Purchases SET Status = @status, CreditedCents = @creditedCents, UpdatedAt = SYSUTCDATETIME() WHERE Id = @purchaseId AND BookingId = @bookingId",
            new { bookingId, purchaseId, status, creditedCents }, tx, ct));
        if (refund is not null) await DapperBookingStore.InsertPaymentAsync(c, tx, bookingId, refund, ct);
        await tx.CommitAsync(ct);
    }

    // ---- Ticks ----

    private static string TickTable(string list) => list switch
    {
        "checklist" => "dbo.ChecklistTicks",
        "packing" => "dbo.PackingTicks",
        _ => throw new ArgumentOutOfRangeException(nameof(list)),
    };

    public async Task<HashSet<string>> GetTicksAsync(long bookingId, string list, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return [.. await c.QueryAsync<string>(Sql.Cmd($"SELECT ItemId FROM {TickTable(list)} WHERE BookingId = @bookingId AND Done = 1", new { bookingId }, null, ct))];
    }

    public async Task SetTickAsync(long bookingId, string list, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd($"""
            MERGE {TickTable(list)} AS t
            USING (SELECT @bookingId AS BookingId, @itemId AS ItemId) AS s ON t.BookingId = s.BookingId AND t.ItemId = s.ItemId
            WHEN MATCHED THEN UPDATE SET Done = @done, [At] = @at
            WHEN NOT MATCHED THEN INSERT (BookingId, ItemId, Done, [At]) VALUES (@bookingId, @itemId, @done, @at);
            """, new { bookingId, itemId, done, at }, null, ct));
    }

    // ---- Travel ----

    public async Task<TravelRow?> GetTravelAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<(string ArrivalMode, string? ArrivalWindowId, string Details)>(Sql.Cmd(
            "SELECT ArrivalMode, ArrivalWindowId, Details FROM dbo.TravelPlans WHERE BookingId = @bookingId", new { bookingId }, null, ct));
        if (row.ArrivalMode is null) return null;
        string? hotel = null;
        try { hotel = JsonDocument.Parse(row.Details).RootElement.TryGetProperty("hotel", out var h) && h.ValueKind == JsonValueKind.String ? h.GetString() : null; }
        catch (JsonException) { /* an unreadable detail reads as no hotel */ }
        return new TravelRow { Mode = row.ArrivalMode.Length == 0 ? null : row.ArrivalMode, Window = PlanRules.WindowFromId(row.ArrivalWindowId), Hotel = hotel };
    }

    public async Task SaveTravelAsync(long bookingId, TravelRow plan, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var details = JsonSerializer.Serialize(new { hotel = plan.Hotel });
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.TravelPlans AS t
            USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET ArrivalMode = @mode, ArrivalWindowId = @windowId, Details = @details, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, ArrivalMode, ArrivalWindowId, Details) VALUES (@bookingId, @mode, @windowId, @details);
            """, new { bookingId, mode = plan.Mode ?? "", windowId = plan.Window is null ? null : PlanRules.WindowId(plan.Window), details }, null, ct));
    }

    // ---- Assistance ----

    public async Task<List<AssistRow>> ListAssistAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<AssistRow>(Sql.Cmd(
            "SELECT Id, PublicId, GuestUserId, Kind, Note, [At] FROM dbo.AssistanceRequests WHERE BookingId = @bookingId AND Status <> 'cancelled' ORDER BY [At] DESC, Id DESC", new { bookingId }, null, ct))).ToList();
    }

    public async Task<AssistRow> AddAssistAsync(long bookingId, long guestUserId, string kind, string note, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleAsync<AssistRow>(Sql.Cmd("""
            INSERT INTO dbo.AssistanceRequests (BookingId, GuestUserId, Kind, Note, Status, [At])
            OUTPUT INSERTED.Id, INSERTED.PublicId, INSERTED.GuestUserId, INSERTED.Kind, INSERTED.Note, INSERTED.[At]
            VALUES (@bookingId, @guestUserId, @kind, @note, 'received', @at)
            """, new { bookingId, guestUserId, kind, note, at }, null, ct));
        return row;
    }

    public async Task<bool> CancelAssistAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.AssistanceRequests SET Status = 'cancelled', UpdatedAt = SYSUTCDATETIME() WHERE PublicId = @publicId AND BookingId = @bookingId AND Status <> 'cancelled'",
            new { bookingId, publicId }, null, ct)) > 0;
    }
}
