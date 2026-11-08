using System.Data.Common;
using System.Text.Json;
using Dapper;

namespace Princess.Api.Data;

/// <summary>The Phase 10b store over SQL Server.</summary>
public sealed class DapperShipboardStore(IDbConnectionFactory db) : IShipboardStore
{
    // ---- The account ----

    /// <summary>Replaces every account line of one source (an order, a photo purchase, a laundry request, a Wi-Fi device) in the caller's transaction.</summary>
    internal static async Task ReplaceFolioAsync(DbConnection c, DbTransaction tx, long bookingId, string sourceType, long sourceId, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.FolioLines WHERE BookingId = @bookingId AND SourceType = @sourceType AND SourceId = @sourceId", new { bookingId, sourceType, sourceId }, tx, ct));
        foreach (var l in folio)
        {
            await c.ExecuteAsync(Sql.Cmd("""
                INSERT INTO dbo.FolioLines (BookingId, UserId, [Day], Category, Description, Cents, CoveredBy, SourceType, SourceId, [At])
                VALUES (@bookingId, @UserId, @Day, @Category, @Description, @Cents, @CoveredBy, @sourceType, @sourceId, @At)
                """, new { bookingId, l.UserId, l.Day, l.Category, l.Description, l.Cents, l.CoveredBy, sourceType, sourceId, l.At }, tx, ct));
        }
    }

    // ---- Orders ----

    private const string OrderColumns =
        "Id, PublicId, PlacedByUserId, Kind, PlacedAt, DeliverAt, LocationKind, LocationRef, TipCents, FeeCents, ServiceCents, TotalCents, CoveredCents, RefundCents, Stage, EtaAt AS ResolvedOrCancelledAt, Contacted";

    private static async Task FillLinesAsync(DbConnection c, List<OrderRow> orders, CancellationToken ct)
    {
        if (orders.Count == 0) return;
        var ids = orders.Select(o => o.Id).ToArray();
        var lines = (await c.QueryAsync<(long OrderId, int Seq, string ItemId, int Qty, long GuestUserId, string? Extras, string? Note, long UnitCents, string? Choice, bool Unavailable)>(Sql.Cmd(
            "SELECT OrderId, Seq, ItemId, Qty, GuestUserId, Extras, Note, UnitCents, Choice, Unavailable FROM dbo.OrderLines WHERE OrderId IN @ids ORDER BY OrderId, Seq", new { ids }, null, ct))).ToList();
        foreach (var o in orders)
            o.Lines = [.. lines.Where(l => l.OrderId == o.Id).Select(l => new OrderLineRow
            {
                Seq = l.Seq, ItemId = l.ItemId, Qty = l.Qty, GuestUserId = l.GuestUserId, Extras = l.Extras ?? "", Note = l.Note, UnitCents = l.UnitCents, Choice = l.Choice, Unavailable = l.Unavailable,
            })];
    }

    public async Task<List<OrderRow>> ListOrdersAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var orders = (await c.QueryAsync<OrderRow>(Sql.Cmd($"SELECT {OrderColumns} FROM dbo.Orders WHERE BookingId = @bookingId ORDER BY PlacedAt DESC, Id DESC", new { bookingId }, null, ct))).ToList();
        await FillLinesAsync(c, orders, ct);
        return orders;
    }

    public async Task<OrderRow?> GetOrderAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var orders = (await c.QueryAsync<OrderRow>(Sql.Cmd($"SELECT {OrderColumns} FROM dbo.Orders WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, null, ct))).ToList();
        await FillLinesAsync(c, orders, ct);
        return orders.FirstOrDefault();
    }

    public async Task<OrderRow> SaveOrderAsync(long bookingId, OrderRow o, IReadOnlyList<FolioWrite>? folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var args = new
        {
            bookingId, o.Id, o.PlacedByUserId, o.Kind, o.PlacedAt, o.DeliverAt, o.LocationKind, o.LocationRef, o.TipCents, o.FeeCents, o.ServiceCents, o.TotalCents, o.CoveredCents, o.RefundCents,
            o.Stage, EtaAt = o.ResolvedOrCancelledAt, o.Contacted,
        };
        if (o.Id == 0)
        {
            var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
                INSERT INTO dbo.Orders (BookingId, PlacedByUserId, Kind, PlacedAt, DeliverAt, LocationKind, LocationRef, TipCents, FeeCents, ServiceCents, TotalCents, CoveredCents, RefundCents, Stage, EtaAt, Contacted)
                OUTPUT INSERTED.Id, INSERTED.PublicId
                VALUES (@bookingId, @PlacedByUserId, @Kind, @PlacedAt, @DeliverAt, @LocationKind, @LocationRef, @TipCents, @FeeCents, @ServiceCents, @TotalCents, @CoveredCents, @RefundCents, @Stage, @EtaAt, @Contacted)
                """, args, tx, ct));
            o.Id = id;
            o.PublicId = publicId;
            foreach (var l in o.Lines)
            {
                await c.ExecuteAsync(Sql.Cmd("""
                    INSERT INTO dbo.OrderLines (OrderId, BookingId, Seq, ItemId, Qty, GuestUserId, Extras, Note, UnitCents, Choice, Unavailable)
                    VALUES (@id, @bookingId, @Seq, @ItemId, @Qty, @GuestUserId, @Extras, @Note, @UnitCents, @Choice, @Unavailable)
                    """, new { id, bookingId, l.Seq, l.ItemId, l.Qty, l.GuestUserId, l.Extras, l.Note, l.UnitCents, l.Choice, l.Unavailable }, tx, ct));
            }
        }
        else
        {
            await c.ExecuteAsync(Sql.Cmd("""
                UPDATE dbo.Orders SET LocationKind = @LocationKind, LocationRef = @LocationRef, FeeCents = @FeeCents, ServiceCents = @ServiceCents, TotalCents = @TotalCents, CoveredCents = @CoveredCents,
                  RefundCents = @RefundCents, Stage = @Stage, EtaAt = @EtaAt, Contacted = @Contacted, UpdatedAt = SYSUTCDATETIME()
                WHERE Id = @Id AND BookingId = @bookingId
                """, args, tx, ct));
            foreach (var l in o.Lines)
                await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.OrderLines SET Choice = @Choice WHERE OrderId = @Id AND Seq = @Seq", new { o.Id, l.Seq, l.Choice }, tx, ct));
        }
        if (folio is not null) await ReplaceFolioAsync(c, tx, bookingId, "order", o.Id, folio, ct);
        await tx.CommitAsync(ct);
        return o;
    }

    // ---- Family ----

    public async Task<List<FamilyZonesRow>> ListFamilyZonesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<FamilyZonesRow>(Sql.Cmd("SELECT ChildUserId, ZoneIds, Auth FROM dbo.FamilyZones WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToList();
    }

    public async Task SaveZonesAsync(long bookingId, long childUserId, string zonesJson, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.FamilyZones AS t USING (SELECT @childUserId AS ChildUserId, @bookingId AS BookingId) AS s ON t.ChildUserId = s.ChildUserId AND t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET ZoneIds = @zonesJson, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (ChildUserId, BookingId, ZoneIds) VALUES (@childUserId, @bookingId, @zonesJson);
            """, new { bookingId, childUserId, zonesJson }, null, ct));
    }

    public async Task SaveAuthAsync(long bookingId, long childUserId, string authJson, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.FamilyZones AS t USING (SELECT @childUserId AS ChildUserId, @bookingId AS BookingId) AS s ON t.ChildUserId = s.ChildUserId AND t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Auth = @authJson, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (ChildUserId, BookingId, Auth) VALUES (@childUserId, @bookingId, @authJson);
            """, new { bookingId, childUserId, authJson }, null, ct));
    }

    public async Task<List<ClubCheckinRow>> ListOpenCheckinsAsync(IReadOnlyCollection<long> childUserIds, CancellationToken ct)
    {
        if (childUserIds.Count == 0) return [];
        var ids = childUserIds.ToArray();
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ClubCheckinRow>(Sql.Cmd(
            "SELECT ChildUserId, ClubId, InAt FROM dbo.KidClubCheckins WHERE ChildUserId IN @ids AND OutAt IS NULL", new { ids }, null, ct))).ToList();
    }

    public async Task ClubCheckInAsync(long bookingId, long childUserId, string clubId, DateTime at, long byUserId, string log, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.KidClubCheckins (ChildUserId, ClubId, InAt, ByUserId) VALUES (@childUserId, @clubId, @at, @byUserId)", new { childUserId, clubId, at, byUserId }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.FamilyLog (BookingId, [At], [Text]) VALUES (@bookingId, @at, @log)", new { bookingId, at, log }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task ClubCheckOutAsync(long bookingId, long childUserId, DateTime at, long byUserId, string log, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.KidClubCheckins SET OutAt = @at, OutByUserId = @byUserId WHERE ChildUserId = @childUserId AND OutAt IS NULL", new { childUserId, at, byUserId }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.FamilyLog (BookingId, [At], [Text]) VALUES (@bookingId, @at, @log)", new { bookingId, at, log }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<List<FamilyLogRow>> ListFamilyLogAsync(long bookingId, int take, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<FamilyLogRow>(Sql.Cmd(
            "SELECT TOP (@take) PublicId, [At], [Text] FROM dbo.FamilyLog WHERE BookingId = @bookingId ORDER BY [At] DESC, Id DESC", new { bookingId, take }, null, ct))).ToList();
    }

    public async Task<ReunionRow?> GetReunionAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ReunionRow>(Sql.Cmd("SELECT PlaceId, BackupId, Note FROM dbo.ReunionPlans WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveReunionAsync(long bookingId, string placeId, string backupId, string note, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.ReunionPlans AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET PlaceId = @placeId, BackupId = @backupId, Note = @note, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, PlaceId, BackupId, Note) VALUES (@bookingId, @placeId, @backupId, @note);
            """, new { bookingId, placeId, backupId, note }, null, ct));
    }

    // ---- Health ----

    public async Task<List<HealthReportRow>> ListHealthReportsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var reports = (await c.QueryAsync<(long Id, Guid PublicId, long ByUserId, string Symptoms, int StartedHoursAgo, DateTime At)>(Sql.Cmd(
            "SELECT Id, PublicId, ByUserId, Symptoms, StartedHoursAgo, [At] FROM dbo.HealthReports WHERE BookingId = @bookingId ORDER BY [At] DESC, Id DESC", new { bookingId }, null, ct))).ToList();
        if (reports.Count == 0) return [];
        var ids = reports.Select(r => r.Id).ToArray();
        var guests = (await c.QueryAsync<(long ReportId, long UserId)>(Sql.Cmd("SELECT ReportId, UserId FROM dbo.HealthReportGuests WHERE ReportId IN @ids", new { ids }, null, ct))).ToList();
        return [.. reports.Select(r => new HealthReportRow
        {
            PublicId = r.PublicId, ByUserId = r.ByUserId, StartedHoursAgo = r.StartedHoursAgo, At = r.At,
            Symptoms = JsonSerializer.Deserialize<List<string>>(r.Symptoms) ?? [],
            GuestUserIds = [.. guests.Where(g => g.ReportId == r.Id).Select(g => g.UserId)],
        })];
    }

    public async Task AddHealthReportAsync(long bookingId, long byUserId, IReadOnlyList<long> guestUserIds, IReadOnlyList<string> symptoms, int startedHoursAgo, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
            INSERT INTO dbo.HealthReports (BookingId, ByUserId, Symptoms, StartedHoursAgo, [At]) OUTPUT INSERTED.Id VALUES (@bookingId, @byUserId, @symptoms, @startedHoursAgo, @at)
            """, new { bookingId, byUserId, symptoms = JsonSerializer.Serialize(symptoms), startedHoursAgo, at }, tx, ct));
        foreach (var userId in guestUserIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.HealthReportGuests (ReportId, BookingId, UserId) VALUES (@id, @bookingId, @userId)", new { id, bookingId, userId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<List<HealthRequestRow>> ListHealthRequestsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<HealthRequestRow>(Sql.Cmd(
            "SELECT PublicId, Kind, Note, [At] FROM dbo.HealthRequests WHERE BookingId = @bookingId ORDER BY [At] DESC, Id DESC", new { bookingId }, null, ct))).ToList();
    }

    public async Task AddHealthRequestAsync(long bookingId, string kind, string note, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.HealthRequests (BookingId, Kind, Note, [At]) VALUES (@bookingId, @kind, @note, @at)", new { bookingId, kind, note, at }, null, ct));
    }

    // ---- Room ----

    public async Task<RoomSettingsRow?> GetRoomAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<RoomSettingsRow>(Sql.Cmd("SELECT Housekeeping, Devices FROM dbo.RoomSettings WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveRoomAsync(long bookingId, string housekeepingJson, string devicesJson, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.RoomSettings AS t USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Housekeeping = @housekeepingJson, Devices = @devicesJson, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, Housekeeping, Devices) VALUES (@bookingId, @housekeepingJson, @devicesJson);
            """, new { bookingId, housekeepingJson, devicesJson }, null, ct));
    }

    // ---- Photos ----

    public async Task<List<string>> ListFavouritesAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd("SELECT PhotoId FROM dbo.PhotoSelections WHERE UserId = @userId ORDER BY CreatedAt, PhotoId", new { userId }, null, ct))).ToList();
    }

    public async Task<List<string>> ToggleFavouriteAsync(long userId, string photoId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            IF EXISTS (SELECT 1 FROM dbo.PhotoSelections WHERE UserId = @userId AND PhotoId = @photoId)
              DELETE FROM dbo.PhotoSelections WHERE UserId = @userId AND PhotoId = @photoId;
            ELSE
              INSERT INTO dbo.PhotoSelections (UserId, PhotoId) VALUES (@userId, @photoId);
            """, new { userId, photoId }, null, ct));
        return (await c.QueryAsync<string>(Sql.Cmd("SELECT PhotoId FROM dbo.PhotoSelections WHERE UserId = @userId ORDER BY CreatedAt, PhotoId", new { userId }, null, ct))).ToList();
    }

    public async Task<List<PrintOrderRow>> ListPrintOrdersAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<PrintOrderRow>(Sql.Cmd(
            "SELECT Id, PublicId, Product, Reference, TotalCents, [At], DeliverBy, BuyerUserId FROM dbo.PrintOrders WHERE BookingId = @bookingId ORDER BY [At], Id", new { bookingId }, null, ct))).ToList();
        if (rows.Count == 0) return rows;
        var ids = rows.Select(r => r.Id).ToArray();
        var items = (await c.QueryAsync<(long OrderId, string PhotoId)>(Sql.Cmd(
            "SELECT OrderId, PhotoId FROM dbo.PrintOrderItems WHERE OrderId IN @ids ORDER BY OrderId, CreatedAt, PhotoId", new { ids }, null, ct))).ToList();
        foreach (var r in rows) r.PhotoIds = [.. items.Where(i => i.OrderId == r.Id).Select(i => i.PhotoId)];
        return rows;
    }

    public async Task<PrintOrderRow> AddPrintOrderAsync(long bookingId, PrintOrderRow o, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.PrintOrders (BookingId, Product, Reference, TotalCents, DeliverBy, [At], BuyerUserId)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @Product, @Reference, @TotalCents, @DeliverBy, @At, @BuyerUserId)
            """, new { bookingId, o.Product, o.Reference, o.TotalCents, o.DeliverBy, o.At, o.BuyerUserId }, tx, ct));
        foreach (var photoId in o.PhotoIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.PrintOrderItems (OrderId, PhotoId) VALUES (@id, @photoId)", new { id, photoId }, tx, ct));
        await ReplaceFolioAsync(c, tx, bookingId, "print", id, folio, ct);
        await tx.CommitAsync(ct);
        o.Id = id;
        o.PublicId = publicId;
        return o;
    }

    private static async Task<List<AlbumEntry>> LoadAlbumAsync(DbConnection c, long bookingId, CancellationToken ct) =>
        (await c.QueryAsync<AlbumEntry>(Sql.Cmd("SELECT PhotoId, UserId FROM dbo.PhotoAlbum WHERE BookingId = @bookingId ORDER BY CreatedAt, PhotoId, UserId", new { bookingId }, null, ct))).ToList();

    public async Task<List<AlbumEntry>> ListAlbumAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await LoadAlbumAsync(c, bookingId, ct);
    }

    public async Task<List<AlbumEntry>> ToggleAlbumAsync(long bookingId, long userId, string photoId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            IF EXISTS (SELECT 1 FROM dbo.PhotoAlbum WHERE BookingId = @bookingId AND PhotoId = @photoId AND UserId = @userId)
              DELETE FROM dbo.PhotoAlbum WHERE BookingId = @bookingId AND PhotoId = @photoId AND UserId = @userId;
            ELSE
              INSERT INTO dbo.PhotoAlbum (BookingId, PhotoId, UserId) VALUES (@bookingId, @photoId, @userId);
            """, new { bookingId, userId, photoId }, null, ct));
        return await LoadAlbumAsync(c, bookingId, ct);
    }

    private static async Task<List<PhotoPurchaseRow>> LoadPurchasesAsync(DbConnection c, long bookingId, Guid? publicId, CancellationToken ct)
    {
        var rows = (await c.QueryAsync<PhotoPurchaseRow>(Sql.Cmd("""
            SELECT p.Id, p.PublicId, p.OptionId AS [Option], p.PaidCents, p.SavedCents, p.Until, p.[At], ISNULL(f.UserId, 0) AS BuyerUserId
            FROM dbo.PhotoPurchases p LEFT JOIN dbo.FolioLines f ON f.SourceType = 'photo' AND f.SourceId = p.Id
            WHERE p.BookingId = @bookingId AND (@publicId IS NULL OR p.PublicId = @publicId) ORDER BY p.[At], p.Id
            """, new { bookingId, publicId }, null, ct))).ToList();
        if (rows.Count == 0) return rows;
        var ids = rows.Select(r => r.Id).ToArray();
        var items = (await c.QueryAsync<(long PurchaseId, string PhotoId, bool Downloaded)>(Sql.Cmd(
            "SELECT PurchaseId, PhotoId, Downloaded FROM dbo.PhotoPurchaseItems WHERE PurchaseId IN @ids ORDER BY PurchaseId, CreatedAt, PhotoId", new { ids }, null, ct))).ToList();
        foreach (var r in rows) r.Items = [.. items.Where(i => i.PurchaseId == r.Id).Select(i => (i.PhotoId, i.Downloaded))];
        return rows;
    }

    public async Task<List<PhotoPurchaseRow>> ListPhotoPurchasesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await LoadPurchasesAsync(c, bookingId, null, ct);
    }

    public async Task<PhotoPurchaseRow> AddPhotoPurchaseAsync(long bookingId, PhotoPurchaseRow p, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.PhotoPurchases (BookingId, OptionId, PaidCents, SavedCents, Verified, Until, [At])
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @Option, @PaidCents, @SavedCents, 0, @Until, @At)
            """, new { bookingId, p.Option, p.PaidCents, p.SavedCents, p.Until, p.At }, tx, ct));
        foreach (var (photoId, _) in p.Items)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.PhotoPurchaseItems (PurchaseId, PhotoId, Downloaded) VALUES (@id, @photoId, 0)", new { id, photoId }, tx, ct));
        await ReplaceFolioAsync(c, tx, bookingId, "photo", id, folio, ct);
        await tx.CommitAsync(ct);
        p.Id = id;
        p.PublicId = publicId;
        return p;
    }

    public async Task<PhotoPurchaseRow?> SavePhotoBatchAsync(long bookingId, Guid publicId, int batch, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE i SET Downloaded = 1
            FROM dbo.PhotoPurchaseItems i
            WHERE i.PurchaseId = (SELECT Id FROM dbo.PhotoPurchases WHERE BookingId = @bookingId AND PublicId = @publicId)
              AND i.PhotoId IN (SELECT TOP (@batch) PhotoId FROM dbo.PhotoPurchaseItems
                                WHERE PurchaseId = i.PurchaseId AND Downloaded = 0 ORDER BY CreatedAt, PhotoId)
            """, new { bookingId, publicId, batch }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.PhotoPurchases SET Verified = CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.PhotoPurchaseItems WHERE PurchaseId = dbo.PhotoPurchases.Id AND Downloaded = 0) THEN 1 ELSE 0 END
            WHERE BookingId = @bookingId AND PublicId = @publicId
            """, new { bookingId, publicId }, tx, ct));
        await tx.CommitAsync(ct);
        return (await LoadPurchasesAsync(c, bookingId, publicId, ct)).FirstOrDefault();
    }

    // ---- Laundry ----

    public async Task<List<LaundryRow>> ListLaundryAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<LaundryRow>(Sql.Cmd("""
            SELECT l.Id, l.PublicId, l.Service, l.Qty, l.PickupAt, l.ReturnAt, l.Stage, l.TotalCents, l.FreeCents, ISNULL(l.Note, N'') AS Note, l.CreatedAt AS PlacedAt, ISNULL(f.UserId, 0) AS RequestedByUserId
            FROM dbo.LaundryRequests l LEFT JOIN dbo.FolioLines f ON f.SourceType = 'laundry' AND f.SourceId = l.Id
            WHERE l.BookingId = @bookingId ORDER BY l.CreatedAt DESC, l.Id DESC
            """, new { bookingId }, null, ct))).ToList();
    }

    public async Task<LaundryRow> AddLaundryAsync(long bookingId, LaundryRow r, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.LaundryRequests (BookingId, Service, Qty, PickupAt, ReturnAt, Stage, TotalCents, FreeCents, Note, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @Service, @Qty, @PickupAt, @ReturnAt, N'requested', @TotalCents, @FreeCents, @Note, @PlacedAt)
            """, new { bookingId, r.Service, r.Qty, r.PickupAt, r.ReturnAt, r.TotalCents, r.FreeCents, r.Note, r.PlacedAt }, tx, ct));
        await ReplaceFolioAsync(c, tx, bookingId, "laundry", id, folio, ct);
        await tx.CommitAsync(ct);
        r.Id = id;
        r.PublicId = publicId;
        return r;
    }

    public async Task<bool> CancelLaundryAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.LaundryRequests WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, tx, ct));
        if (id is null) return false;
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.LaundryRequests SET Stage = N'cancelled', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id", new { id }, tx, ct));
        await ReplaceFolioAsync(c, tx, bookingId, "laundry", id.Value, [], ct);
        await tx.CommitAsync(ct);
        return true;
    }

    // ---- Wi-Fi ----

    public async Task<List<WifiRow>> ListWifiAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<WifiRow>(Sql.Cmd("""
            SELECT w.Id, w.PublicId, w.Name, w.PlanCode AS [Plan], w.Days, w.CreatedAt AS AddedAt, w.ExpiresAt, ISNULL(f.Cents, 0) AS PaidCents,
              CAST(CASE WHEN f.CoveredBy = 'package' THEN 1 ELSE 0 END AS BIT) AS Included, ISNULL(f.UserId, 0) AS BuyerUserId
            FROM dbo.WifiDevices w LEFT JOIN dbo.FolioLines f ON f.SourceType = 'wifi' AND f.SourceId = w.Id
            WHERE w.BookingId = @bookingId ORDER BY w.CreatedAt, w.Id
            """, new { bookingId }, null, ct))).ToList();
    }

    public async Task<WifiRow> AddWifiAsync(long bookingId, WifiRow d, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var (id, publicId) = await c.QuerySingleAsync<(long, Guid)>(Sql.Cmd("""
            INSERT INTO dbo.WifiDevices (BookingId, Name, PlanCode, Days, ExpiresAt, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @Name, @Plan, @Days, @ExpiresAt, @AddedAt)
            """, new { bookingId, d.Name, d.Plan, d.Days, d.ExpiresAt, d.AddedAt }, tx, ct));
        await ReplaceFolioAsync(c, tx, bookingId, "wifi", id, folio, ct);
        await tx.CommitAsync(ct);
        d.Id = id;
        d.PublicId = publicId;
        return d;
    }

    public async Task UpgradeWifiAsync(long bookingId, Guid publicId, string plan, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.WifiDevices WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, tx, ct));
        if (id is null) return;
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.WifiDevices SET PlanCode = @plan, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id", new { id, plan }, tx, ct));
        await ReplaceFolioAsync(c, tx, bookingId, "wifi", id.Value, folio, ct);
        await tx.CommitAsync(ct);
    }

    public async Task<bool> RemoveWifiAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.WifiDevices WHERE BookingId = @bookingId AND PublicId = @publicId", new { bookingId, publicId }, tx, ct));
        if (id is null) return false;
        await ReplaceFolioAsync(c, tx, bookingId, "wifi", id.Value, [], ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.WifiDevices WHERE Id = @id", new { id }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    // ---- Trip updates ----

    public async Task<List<UpdateAckRow>> ListAcksAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<UpdateAckRow>(Sql.Cmd("SELECT ScenarioId, OptionCode AS [Option], [At] FROM dbo.UpdateAcks WHERE UserId = @userId", new { userId }, null, ct))).ToList();
    }

    public async Task SaveAckAsync(long userId, string scenarioId, string option, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.UpdateAcks AS t USING (SELECT @userId AS UserId, @scenarioId AS ScenarioId) AS s ON t.UserId = s.UserId AND t.ScenarioId = s.ScenarioId
            WHEN MATCHED THEN UPDATE SET OptionCode = @option, [At] = @at
            WHEN NOT MATCHED THEN INSERT (UserId, ScenarioId, OptionCode, [At]) VALUES (@userId, @scenarioId, @option, @at);
            """, new { userId, scenarioId, option, at }, null, ct));
    }
}
