using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 10b store in memory. Account lines go to the on-board store's folio, so the account reads them back as the database would.</summary>
public sealed class InMemoryShipboardStore(InMemoryOnboardStore onboard) : IShipboardStore
{
    private long _next = 1;
    private readonly Dictionary<(string Type, long Id), List<FolioRow>> _lines = [];

    public List<(long BookingId, OrderRow Order)> Orders { get; } = [];
    public Dictionary<(long BookingId, long ChildUserId), FamilyZonesRow> Zones { get; } = [];
    public List<(long ChildUserId, string ClubId, DateTime InAt, DateTime? OutAt)> Checkins { get; } = [];
    public List<(long BookingId, FamilyLogRow Row)> FamilyLog { get; } = [];
    public Dictionary<long, ReunionRow> Reunions { get; } = [];
    public List<(long BookingId, HealthReportRow Row)> Reports { get; } = [];
    public List<(long BookingId, HealthRequestRow Row)> Requests { get; } = [];
    public Dictionary<long, RoomSettingsRow> Rooms { get; } = [];
    public Dictionary<long, List<string>> Favourites { get; } = [];
    public List<(long BookingId, PhotoPurchaseRow Row)> Purchases { get; } = [];
    public List<(long BookingId, LaundryRow Row)> Laundry { get; } = [];
    public List<(long BookingId, WifiRow Row)> Wifi { get; } = [];
    public Dictionary<(long UserId, string ScenarioId), UpdateAckRow> Acks { get; } = [];

    private void Replace(long bookingId, string type, long id, IReadOnlyList<FolioWrite> folio)
    {
        if (_lines.Remove((type, id), out var old)) foreach (var row in old) onboard.Folio.RemoveAll(f => ReferenceEquals(f.Row, row));
        var rows = folio.Select(l => new FolioRow { PublicId = Guid.NewGuid(), UserId = l.UserId, Day = l.Day, Category = l.Category, Description = l.Description, Cents = l.Cents, CoveredBy = l.CoveredBy, At = l.At }).ToList();
        _lines[(type, id)] = rows;
        foreach (var row in rows) onboard.Folio.Add((bookingId, row));
    }

    // ---- Orders ----

    private static OrderRow Copy(OrderRow o) => new()
    {
        Id = o.Id, PublicId = o.PublicId, PlacedByUserId = o.PlacedByUserId, Kind = o.Kind, PlacedAt = o.PlacedAt, DeliverAt = o.DeliverAt, LocationKind = o.LocationKind, LocationRef = o.LocationRef,
        TipCents = o.TipCents, FeeCents = o.FeeCents, ServiceCents = o.ServiceCents, TotalCents = o.TotalCents, CoveredCents = o.CoveredCents, RefundCents = o.RefundCents, Stage = o.Stage,
        ResolvedOrCancelledAt = o.ResolvedOrCancelledAt, Contacted = o.Contacted,
        Lines = [.. o.Lines.Select(l => new OrderLineRow { Seq = l.Seq, ItemId = l.ItemId, Qty = l.Qty, GuestUserId = l.GuestUserId, Extras = l.Extras, Note = l.Note, UnitCents = l.UnitCents, Choice = l.Choice, Unavailable = l.Unavailable })],
    };

    public Task<List<OrderRow>> ListOrdersAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Orders.Where(o => o.BookingId == bookingId).Select(o => Copy(o.Order)).OrderByDescending(o => o.PlacedAt).ThenByDescending(o => o.Id).ToList());

    public Task<OrderRow?> GetOrderAsync(long bookingId, Guid publicId, CancellationToken ct) =>
        Task.FromResult(Orders.Where(o => o.BookingId == bookingId && o.Order.PublicId == publicId).Select(o => Copy(o.Order)).FirstOrDefault());

    public Task<OrderRow> SaveOrderAsync(long bookingId, OrderRow order, IReadOnlyList<FolioWrite>? folio, CancellationToken ct)
    {
        if (order.Id == 0)
        {
            order.Id = _next++;
            order.PublicId = Guid.NewGuid();
            Orders.Add((bookingId, Copy(order)));
        }
        else
        {
            var i = Orders.FindIndex(o => o.BookingId == bookingId && o.Order.Id == order.Id);
            Orders[i] = (bookingId, Copy(order));
        }
        if (folio is not null) Replace(bookingId, "order", order.Id, folio);
        return Task.FromResult(order);
    }

    // ---- Family ----

    public Task<List<FamilyZonesRow>> ListFamilyZonesAsync(long bookingId, CancellationToken ct) => Task.FromResult(Zones.Where(z => z.Key.BookingId == bookingId).Select(z => z.Value).ToList());

    public Task SaveZonesAsync(long bookingId, long childUserId, string zonesJson, CancellationToken ct)
    {
        if (!Zones.TryGetValue((bookingId, childUserId), out var z)) Zones[(bookingId, childUserId)] = z = new FamilyZonesRow { ChildUserId = childUserId };
        z.ZoneIds = zonesJson;
        return Task.CompletedTask;
    }

    public Task SaveAuthAsync(long bookingId, long childUserId, string authJson, CancellationToken ct)
    {
        if (!Zones.TryGetValue((bookingId, childUserId), out var z)) Zones[(bookingId, childUserId)] = z = new FamilyZonesRow { ChildUserId = childUserId };
        z.Auth = authJson;
        return Task.CompletedTask;
    }

    public Task<List<ClubCheckinRow>> ListOpenCheckinsAsync(IReadOnlyCollection<long> childUserIds, CancellationToken ct) =>
        Task.FromResult(Checkins.Where(c => childUserIds.Contains(c.ChildUserId) && c.OutAt is null).Select(c => new ClubCheckinRow { ChildUserId = c.ChildUserId, ClubId = c.ClubId, InAt = c.InAt }).ToList());

    public Task ClubCheckInAsync(long bookingId, long childUserId, string clubId, DateTime at, long byUserId, string log, CancellationToken ct)
    {
        Checkins.Add((childUserId, clubId, at, null));
        FamilyLog.Add((bookingId, new FamilyLogRow { PublicId = Guid.NewGuid(), At = at, Text = log }));
        return Task.CompletedTask;
    }

    public Task ClubCheckOutAsync(long bookingId, long childUserId, DateTime at, long byUserId, string log, CancellationToken ct)
    {
        var i = Checkins.FindIndex(c => c.ChildUserId == childUserId && c.OutAt is null);
        Checkins[i] = Checkins[i] with { OutAt = at };
        FamilyLog.Add((bookingId, new FamilyLogRow { PublicId = Guid.NewGuid(), At = at, Text = log }));
        return Task.CompletedTask;
    }

    public Task<List<FamilyLogRow>> ListFamilyLogAsync(long bookingId, int take, CancellationToken ct) =>
        Task.FromResult(FamilyLog.Where(l => l.BookingId == bookingId).Select(l => l.Row).Reverse().OrderByDescending(l => l.At).Take(take).ToList());

    public Task<ReunionRow?> GetReunionAsync(long bookingId, CancellationToken ct) => Task.FromResult(Reunions.GetValueOrDefault(bookingId));

    public Task SaveReunionAsync(long bookingId, string placeId, string backupId, string note, CancellationToken ct)
    {
        Reunions[bookingId] = new ReunionRow { PlaceId = placeId, BackupId = backupId, Note = note };
        return Task.CompletedTask;
    }

    // ---- Health ----

    public Task<List<HealthReportRow>> ListHealthReportsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Reports.Where(r => r.BookingId == bookingId).Select(r => r.Row).OrderByDescending(r => r.At).ToList());

    public Task AddHealthReportAsync(long bookingId, long byUserId, IReadOnlyList<long> guestUserIds, IReadOnlyList<string> symptoms, int startedHoursAgo, DateTime at, CancellationToken ct)
    {
        Reports.Add((bookingId, new HealthReportRow { PublicId = Guid.NewGuid(), ByUserId = byUserId, GuestUserIds = [.. guestUserIds], Symptoms = [.. symptoms], StartedHoursAgo = startedHoursAgo, At = at }));
        return Task.CompletedTask;
    }

    public Task<List<HealthRequestRow>> ListHealthRequestsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Requests.Where(r => r.BookingId == bookingId).Select(r => r.Row).OrderByDescending(r => r.At).ToList());

    public Task AddHealthRequestAsync(long bookingId, string kind, string note, DateTime at, CancellationToken ct)
    {
        Requests.Add((bookingId, new HealthRequestRow { PublicId = Guid.NewGuid(), Kind = kind, Note = note, At = at }));
        return Task.CompletedTask;
    }

    // ---- Room ----

    public Task<RoomSettingsRow?> GetRoomAsync(long bookingId, CancellationToken ct) => Task.FromResult(Rooms.GetValueOrDefault(bookingId));

    public Task SaveRoomAsync(long bookingId, string housekeepingJson, string devicesJson, CancellationToken ct)
    {
        Rooms[bookingId] = new RoomSettingsRow { Housekeeping = housekeepingJson, Devices = devicesJson };
        return Task.CompletedTask;
    }

    // ---- Photos ----

    public Task<List<string>> ListFavouritesAsync(long userId, CancellationToken ct) => Task.FromResult(Favourites.TryGetValue(userId, out var l) ? [.. l] : new List<string>());

    public Task<List<string>> ToggleFavouriteAsync(long userId, string photoId, CancellationToken ct)
    {
        if (!Favourites.TryGetValue(userId, out var l)) Favourites[userId] = l = [];
        if (!l.Remove(photoId)) l.Add(photoId);
        return Task.FromResult(new List<string>(l));
    }

    private static PhotoPurchaseRow Copy(PhotoPurchaseRow p) => new()
    {
        Id = p.Id, PublicId = p.PublicId, Option = p.Option, PaidCents = p.PaidCents, SavedCents = p.SavedCents, Until = p.Until, At = p.At, BuyerUserId = p.BuyerUserId, Items = [.. p.Items],
    };

    public Task<List<PhotoPurchaseRow>> ListPhotoPurchasesAsync(long bookingId, CancellationToken ct) => Task.FromResult(Purchases.Where(p => p.BookingId == bookingId).Select(p => Copy(p.Row)).OrderBy(p => p.At).ThenBy(p => p.Id).ToList());

    public Task<PhotoPurchaseRow> AddPhotoPurchaseAsync(long bookingId, PhotoPurchaseRow purchase, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        purchase.Id = _next++;
        purchase.PublicId = Guid.NewGuid();
        Purchases.Add((bookingId, Copy(purchase)));
        Replace(bookingId, "photo", purchase.Id, folio);
        return Task.FromResult(purchase);
    }

    public Task<PhotoPurchaseRow?> SavePhotoBatchAsync(long bookingId, Guid publicId, int batch, CancellationToken ct)
    {
        var i = Purchases.FindIndex(p => p.BookingId == bookingId && p.Row.PublicId == publicId);
        if (i < 0) return Task.FromResult<PhotoPurchaseRow?>(null);
        var row = Purchases[i].Row;
        var left = batch;
        row.Items = [.. row.Items.Select(x => !x.Downloaded && left-- > 0 ? (x.PhotoId, true) : x)];
        return Task.FromResult<PhotoPurchaseRow?>(Copy(row));
    }

    // ---- Laundry ----

    public Task<List<LaundryRow>> ListLaundryAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Laundry.Where(l => l.BookingId == bookingId).Select(l => l.Row).OrderByDescending(l => l.PlacedAt).ThenByDescending(l => l.Id).ToList());

    public Task<LaundryRow> AddLaundryAsync(long bookingId, LaundryRow request, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        request.Id = _next++;
        request.PublicId = Guid.NewGuid();
        request.Stage = "requested";
        Laundry.Add((bookingId, request));
        Replace(bookingId, "laundry", request.Id, folio);
        return Task.FromResult(request);
    }

    public Task<bool> CancelLaundryAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        var found = Laundry.FirstOrDefault(l => l.BookingId == bookingId && l.Row.PublicId == publicId).Row;
        if (found is null) return Task.FromResult(false);
        found.Stage = "cancelled";
        Replace(bookingId, "laundry", found.Id, []);
        return Task.FromResult(true);
    }

    // ---- Wi-Fi ----

    public Task<List<WifiRow>> ListWifiAsync(long bookingId, CancellationToken ct) => Task.FromResult(Wifi.Where(w => w.BookingId == bookingId).Select(w => w.Row).OrderBy(w => w.AddedAt).ThenBy(w => w.Id).ToList());

    public Task<WifiRow> AddWifiAsync(long bookingId, WifiRow device, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        device.Id = _next++;
        device.PublicId = Guid.NewGuid();
        Wifi.Add((bookingId, device));
        Replace(bookingId, "wifi", device.Id, folio);
        return Task.FromResult(device);
    }

    public Task UpgradeWifiAsync(long bookingId, Guid publicId, string plan, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        var d = Wifi.First(w => w.BookingId == bookingId && w.Row.PublicId == publicId).Row;
        d.Plan = plan;
        d.PaidCents = folio.Sum(l => l.Cents);
        Replace(bookingId, "wifi", d.Id, folio);
        return Task.CompletedTask;
    }

    public Task<bool> RemoveWifiAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        var i = Wifi.FindIndex(w => w.BookingId == bookingId && w.Row.PublicId == publicId);
        if (i < 0) return Task.FromResult(false);
        Replace(bookingId, "wifi", Wifi[i].Row.Id, []);
        Wifi.RemoveAt(i);
        return Task.FromResult(true);
    }

    // ---- Trip updates ----

    public Task<List<UpdateAckRow>> ListAcksAsync(long userId, CancellationToken ct) => Task.FromResult(Acks.Where(a => a.Key.UserId == userId).Select(a => a.Value).ToList());

    public Task SaveAckAsync(long userId, string scenarioId, string option, DateTime at, CancellationToken ct)
    {
        Acks[(userId, scenarioId)] = new UpdateAckRow { ScenarioId = scenarioId, Option = option, At = at };
        return Task.CompletedTask;
    }
}
