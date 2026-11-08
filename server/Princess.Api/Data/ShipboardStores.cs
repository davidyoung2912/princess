namespace Princess.Api.Data;

public sealed class OrderLineRow
{
    public int Seq { get; set; }
    public string ItemId { get; set; } = "";
    public int Qty { get; set; }
    public long GuestUserId { get; set; }
    /// <summary>A comma list of menu extra ids.</summary>
    public string Extras { get; set; } = "";
    public string? Note { get; set; }
    public long UnitCents { get; set; }
    /// <summary><c>substitute</c> or <c>remove</c> once the guest has chosen for a line that ran out.</summary>
    public string? Choice { get; set; }
    public bool Unavailable { get; set; }
}

/// <summary>
/// An order. <see cref="ResolvedOrCancelledAt"/> is the moment the guest chose for the lines that ran out, or (with <c>Stage = cancelled</c>) the moment the order was cancelled: the table has no column for either,
/// and the stage of a live order is worked out from the clock, so <c>EtaAt</c> carries it.
/// </summary>
public sealed class OrderRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long PlacedByUserId { get; set; }
    public string Kind { get; set; } = "delivery";
    public DateTime PlacedAt { get; set; }
    public DateTime? DeliverAt { get; set; }
    public string LocationKind { get; set; } = "cabin";
    public string? LocationRef { get; set; }
    public long TipCents { get; set; }
    public long FeeCents { get; set; }
    public long ServiceCents { get; set; }
    public long TotalCents { get; set; }
    public long CoveredCents { get; set; }
    public long RefundCents { get; set; }
    public string Stage { get; set; } = "received";
    public DateTime? ResolvedOrCancelledAt { get; set; }
    public int Contacted { get; set; }
    public List<OrderLineRow> Lines { get; set; } = [];
}

public sealed class FamilyZonesRow
{
    public long ChildUserId { get; set; }
    public string ZoneIds { get; set; } = "[]";
    public string Auth { get; set; } = "{}";
}

public sealed class ClubCheckinRow
{
    public long ChildUserId { get; set; }
    public string ClubId { get; set; } = "";
    public DateTime InAt { get; set; }
}

public sealed class FamilyLogRow
{
    public Guid PublicId { get; set; }
    public DateTime At { get; set; }
    public string Text { get; set; } = "";
}

public sealed class ReunionRow
{
    public string PlaceId { get; set; } = "";
    public string? BackupId { get; set; }
    public string Note { get; set; } = "";
}

public sealed class HealthReportRow
{
    public Guid PublicId { get; set; }
    public long ByUserId { get; set; }
    public List<long> GuestUserIds { get; set; } = [];
    public List<string> Symptoms { get; set; } = [];
    public int StartedHoursAgo { get; set; }
    public DateTime At { get; set; }
}

public sealed class HealthRequestRow
{
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class RoomSettingsRow
{
    public string Housekeeping { get; set; } = "{}";
    public string Devices { get; set; } = "{}";
}

public sealed record AlbumEntry(string PhotoId, long UserId);

public sealed class PhotoPurchaseRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Option { get; set; } = "";
    public long PaidCents { get; set; }
    /// <summary>What the included photos would have cost; the number of included photos is this over the price of one.</summary>
    public long SavedCents { get; set; }
    public DateTime Until { get; set; }
    public DateTime At { get; set; }
    public long BuyerUserId { get; set; }
    /// <summary>The photos bought and whether each has been saved.</summary>
    public List<(string PhotoId, bool Downloaded)> Items { get; set; } = [];
}

public sealed class LaundryRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Service { get; set; } = "";
    public int Qty { get; set; }
    public DateTime PickupAt { get; set; }
    public DateTime ReturnAt { get; set; }
    public string Stage { get; set; } = "requested";
    public long TotalCents { get; set; }
    public long FreeCents { get; set; }
    public string Note { get; set; } = "";
    public DateTime PlacedAt { get; set; }
    public long RequestedByUserId { get; set; }
}

/// <summary>A Wi-Fi device. What it cost, and whether a package paid for it, is the amount and cover of its line on the account.</summary>
public sealed class WifiRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Name { get; set; } = "";
    public string Plan { get; set; } = "";
    public int Days { get; set; }
    public DateTime AddedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public long PaidCents { get; set; }
    public bool Included { get; set; }
    public long BuyerUserId { get; set; }
}

public sealed class UpdateAckRow
{
    public string ScenarioId { get; set; } = "";
    public string Option { get; set; } = "";
    public DateTime At { get; set; }
}

/// <summary>
/// Phase 10b store: orders, the family and children's clubs, health, the stateroom, photos, laundry, Wi-Fi and trip updates. A booking is always an internal id; the service has already checked who may see it.
/// A write that puts something on the account takes the lines (in the same transaction) and replaces every line of that source.
/// </summary>
public interface IShipboardStore
{
    Task<List<OrderRow>> ListOrdersAsync(long bookingId, CancellationToken ct);
    Task<OrderRow?> GetOrderAsync(long bookingId, Guid publicId, CancellationToken ct);
    /// <summary>Inserts an order (<c>Id = 0</c>) or updates one, with its lines and, when <paramref name="folio"/> is given, the account lines that replace the order's.</summary>
    Task<OrderRow> SaveOrderAsync(long bookingId, OrderRow order, IReadOnlyList<FolioWrite>? folio, CancellationToken ct);

    Task<List<FamilyZonesRow>> ListFamilyZonesAsync(long bookingId, CancellationToken ct);
    Task SaveZonesAsync(long bookingId, long childUserId, string zonesJson, CancellationToken ct);
    Task SaveAuthAsync(long bookingId, long childUserId, string authJson, CancellationToken ct);
    /// <summary>Each child's open club check-in (not yet checked out).</summary>
    Task<List<ClubCheckinRow>> ListOpenCheckinsAsync(IReadOnlyCollection<long> childUserIds, CancellationToken ct);
    Task ClubCheckInAsync(long bookingId, long childUserId, string clubId, DateTime at, long byUserId, string log, CancellationToken ct);
    Task ClubCheckOutAsync(long bookingId, long childUserId, DateTime at, long byUserId, string log, CancellationToken ct);
    Task<List<FamilyLogRow>> ListFamilyLogAsync(long bookingId, int take, CancellationToken ct);
    Task<ReunionRow?> GetReunionAsync(long bookingId, CancellationToken ct);
    Task SaveReunionAsync(long bookingId, string placeId, string backupId, string note, CancellationToken ct);

    Task<List<HealthReportRow>> ListHealthReportsAsync(long bookingId, CancellationToken ct);
    Task AddHealthReportAsync(long bookingId, long byUserId, IReadOnlyList<long> guestUserIds, IReadOnlyList<string> symptoms, int startedHoursAgo, DateTime at, CancellationToken ct);
    Task<List<HealthRequestRow>> ListHealthRequestsAsync(long bookingId, CancellationToken ct);
    Task AddHealthRequestAsync(long bookingId, string kind, string note, DateTime at, CancellationToken ct);

    Task<RoomSettingsRow?> GetRoomAsync(long bookingId, CancellationToken ct);
    Task SaveRoomAsync(long bookingId, string housekeepingJson, string devicesJson, CancellationToken ct);

    Task<List<string>> ListFavouritesAsync(long userId, CancellationToken ct);
    /// <summary>Adds the photo to the person's favourites, or takes it off; returns the list.</summary>
    Task<List<string>> ToggleFavouriteAsync(long userId, string photoId, CancellationToken ct);
    /// <summary>The photos shared with the party of a booking, each with the person who shared it.</summary>
    Task<List<AlbumEntry>> ListAlbumAsync(long bookingId, CancellationToken ct);
    /// <summary>Shares the photo with the party, or takes the caller's share back; returns the album.</summary>
    Task<List<AlbumEntry>> ToggleAlbumAsync(long bookingId, long userId, string photoId, CancellationToken ct);
    Task<List<PhotoPurchaseRow>> ListPhotoPurchasesAsync(long bookingId, CancellationToken ct);
    Task<PhotoPurchaseRow> AddPhotoPurchaseAsync(long bookingId, PhotoPurchaseRow purchase, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    /// <summary>Marks the next batch of unsaved photos as saved; keeps what earlier attempts saved.</summary>
    Task<PhotoPurchaseRow?> SavePhotoBatchAsync(long bookingId, Guid publicId, int batch, CancellationToken ct);

    Task<List<LaundryRow>> ListLaundryAsync(long bookingId, CancellationToken ct);
    Task<LaundryRow> AddLaundryAsync(long bookingId, LaundryRow request, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    /// <summary>Cancels the request and takes its charge off the account.</summary>
    Task<bool> CancelLaundryAsync(long bookingId, Guid publicId, CancellationToken ct);

    Task<List<WifiRow>> ListWifiAsync(long bookingId, CancellationToken ct);
    Task<WifiRow> AddWifiAsync(long bookingId, WifiRow device, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task UpgradeWifiAsync(long bookingId, Guid publicId, string plan, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<bool> RemoveWifiAsync(long bookingId, Guid publicId, CancellationToken ct);

    Task<List<UpdateAckRow>> ListAcksAsync(long userId, CancellationToken ct);
    Task SaveAckAsync(long userId, string scenarioId, string option, DateTime at, CancellationToken ct);
}

/// <summary>A line to put on the onboard account. A line with no person is the booker's.</summary>
public sealed record FolioWrite(long? UserId, int Day, string Category, string Description, long Cents, string? CoveredBy, DateTime At);
