namespace Princess.Api.Data;

public sealed class SelectionRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string ItemId { get; set; } = "";
    /// <summary>0 for items with no day (shop goods).</summary>
    public int Day { get; set; }
    /// <summary>"HH:mm" ship time, or "" for items with no time.</summary>
    public string Time { get; set; } = "";
    public int Qty { get; set; }
    public long TotalCents { get; set; }
    public DateTime At { get; set; }
}

public sealed class ServiceRequestRow
{
    public Guid PublicId { get; set; }
    public string ItemId { get; set; } = "";
    public int Qty { get; set; }
    public string Note { get; set; } = "";
    public DateTime PlacedAt { get; set; }
    /// <summary><c>received</c> until the guest cancels it (<c>cancelled</c>); the rest of the stages are worked out from the clock.</summary>
    public string Stage { get; set; } = "received";
}

public sealed class SafetyReportRow
{
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Place { get; set; } = "";
    public string Note { get; set; } = "";
    public bool Anonymous { get; set; }
    public string Reference { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class DrinkLogRow
{
    public Guid PublicId { get; set; }
    public string DrinkId { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class TopUpRow
{
    public Guid PublicId { get; set; }
    public int Dollars { get; set; }
    public string Source { get; set; } = "card";
    public DateTime At { get; set; }
    public DateTime? SettledAt { get; set; }
    public string Reference { get; set; } = "";
}

/// <summary>The booking's on-board account settings. The PIN is kept as a salted PBKDF2 hash.</summary>
public sealed class OnboardAccountRow
{
    public byte[]? PinHash { get; set; }
    public byte[]? PinSalt { get; set; }
    public int PinFails { get; set; }
    public string GratuityChoice { get; set; } = "standard";
    public string? GratuityReason { get; set; }
    public DateTime? GratuityPaidAt { get; set; }
    public string DisplayCurrency { get; set; } = "USD";
    public bool Exists { get; set; }
}

public sealed class PartyRow
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = "";
    public int Day { get; set; }
    public string Time { get; set; } = "";
    public List<(string Cabin, string Answer)> Invites { get; set; } = [];
}

/// <summary>A group dining table: the friends on it, how the bill is split and how many of the booking are seated.</summary>
public sealed class GroupTableRow
{
    public long ReservationId { get; set; }
    public string Split { get; set; } = "mine";
    public int PartySize { get; set; }
    public List<(int Seq, string Name, string Cabin)> Friends { get; set; } = [];
}

public sealed class ChatPeerRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public bool ReceiptsOn { get; set; }
}

public sealed class ChatMessageRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long FromUserId { get; set; }
    public string Text { get; set; } = "";
    public string? Photo { get; set; }
    public DateTime At { get; set; }
    /// <summary>The people who have read it.</summary>
    public List<long> SeenBy { get; set; } = [];
}

/// <summary>Phase 10c store: on-board bookings, requests, reports, drinks, money, parties, group tables, games, the TV, last-minute tours and port readiness. Writes that put something on the account take the lines in the same transaction and replace every line of that source.</summary>
public interface IAboardStore
{
    Task<List<SelectionRow>> ListSelectionsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds the selection, or replaces the quantity of the one for the same item, day and time; the account lines replace the old.</summary>
    Task<SelectionRow> SaveSelectionAsync(long bookingId, SelectionRow selection, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<bool> RemoveSelectionAsync(long bookingId, Guid publicId, CancellationToken ct);

    Task<List<ServiceRequestRow>> ListRequestsAsync(long bookingId, CancellationToken ct);
    Task AddRequestAsync(long bookingId, ServiceRequestRow request, CancellationToken ct);
    Task<bool> CancelRequestAsync(long bookingId, Guid publicId, CancellationToken ct);

    Task<List<SafetyReportRow>> ListReportsAsync(long bookingId, CancellationToken ct);
    Task AddReportAsync(long bookingId, SafetyReportRow report, CancellationToken ct);

    /// <summary>The person's drinks since the moment given.</summary>
    Task<List<DrinkLogRow>> ListDrinksAsync(long userId, DateTime since, CancellationToken ct);
    Task AddDrinkAsync(long userId, string drinkId, DateTime at, CancellationToken ct);
    Task<bool> RemoveDrinkAsync(long userId, Guid publicId, CancellationToken ct);

    Task<List<TopUpRow>> ListTopUpsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds a top-up and its credit on the account (dated at the moment the desk settles it).</summary>
    Task AddTopUpAsync(long bookingId, TopUpRow topUp, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<OnboardAccountRow> GetAccountAsync(long bookingId, CancellationToken ct);
    Task SetPinAsync(long bookingId, byte[] hash, byte[] salt, CancellationToken ct);
    /// <summary>Counts a wrong PIN and returns the number of misses so far.</summary>
    Task<int> RecordPinFailAsync(long bookingId, CancellationToken ct);
    Task ResetPinFailsAsync(long bookingId, CancellationToken ct);
    Task SaveGratuityAsync(long bookingId, string choice, string reason, DateTime at, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task SetCurrencyAsync(long bookingId, string code, CancellationToken ct);

    Task<List<PartyRow>> ListPartiesAsync(long bookingId, CancellationToken ct);
    Task AddPartyAsync(long bookingId, PartyRow party, CancellationToken ct);
    Task<bool> RemovePartyAsync(long bookingId, Guid publicId, CancellationToken ct);

    /// <summary>The table for one of the booking's dining reservations (still booked), else null.</summary>
    Task<GroupTableRow?> GetGroupAsync(long bookingId, Guid reservationPublicId, CancellationToken ct);
    Task AddFriendAsync(long reservationId, string name, string cabin, CancellationToken ct);
    Task RemoveFriendAsync(long reservationId, int seq, CancellationToken ct);
    Task SetSplitAsync(long reservationId, string split, CancellationToken ct);

    Task<string?> GetGameAsync(long userId, CancellationToken ct);
    Task SaveGameAsync(long userId, string json, CancellationToken ct);

    Task<string?> GetTvAsync(long bookingId, CancellationToken ct);
    Task SaveTvAsync(long bookingId, string json, CancellationToken ct);

    Task<HashSet<string>> GetReadyAsync(long bookingId, int day, CancellationToken ct);
    Task SetReadyAsync(long bookingId, int day, string itemId, bool done, DateTime at, CancellationToken ct);

    /// <summary>Books a last-minute tour (<c>Source = onboard</c>) and puts it on the account in one go.</summary>
    Task BookLastMinuteAsync(long bookingId, NewTour tour, IReadOnlyList<FolioWrite> folio, DateTime at, CancellationToken ct);
}

/// <summary>The group chat and its safeguards (MSG-01, MSG-05). A person may be in several groups; they see every group's messages together.</summary>
public interface IChatStore
{
    /// <summary>Everyone who shares a group with the person, the person excluded.</summary>
    Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct);
    Task<List<ChatMessageRow>> ListMessagesAsync(long userId, CancellationToken ct);
    /// <summary>Posts to the person's first group, making a group of their own if they are in none.</summary>
    Task<ChatMessageRow> AddMessageAsync(long userId, string text, string? photo, DateTime at, CancellationToken ct);
    Task<bool> GetReceiptsAsync(long userId, CancellationToken ct);
    Task SetReceiptsAsync(long userId, bool on, CancellationToken ct);
    /// <summary>Marks every message the person can see, and did not write, as read.</summary>
    Task MarkSeenAsync(long userId, DateTime at, CancellationToken ct);
    Task<List<long>> ListBlocksAsync(long userId, CancellationToken ct);
    Task SetBlockAsync(long userId, long blockedUserId, bool on, CancellationToken ct);
    /// <summary>Records a report about a message the person can see; false if there is no such message.</summary>
    Task<bool> AddReportAsync(long userId, Guid messagePublicId, string reason, DateTime at, CancellationToken ct);
}
