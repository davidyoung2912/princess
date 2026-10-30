namespace Princess.Api.Data;

/// <summary>A booked (or cancelled) shore excursion. Guests are internal user ids; <see cref="Methods"/> is how the payment was made, worded for the screens.</summary>
public sealed class TourRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string ExcursionId { get; set; } = "";
    public int Day { get; set; }
    public long TotalCents { get; set; }
    /// <summary>The part of the total covered by the package's excursion credit.</summary>
    public long CreditCents { get; set; }
    public string Status { get; set; } = "booked";
    public long? FeeCents { get; set; }
    public long? RefundCents { get; set; }
    public DateTime At { get; set; }
    public List<long> GuestIds { get; set; } = [];
    public List<string> Methods { get; set; } = [];
}

public sealed class CartLineRow
{
    public string ExcursionId { get; set; } = "";
    public List<long> GuestIds { get; set; } = [];
}

public sealed class TableRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string VenueId { get; set; } = "";
    public int Day { get; set; }
    /// <summary>"HH:mm".</summary>
    public string Time { get; set; } = "";
    public string Note { get; set; } = "";
    public long ChargeCents { get; set; }
    public int LateMinutes { get; set; }
    public DateTime At { get; set; }
    public List<long> GuestIds { get; set; } = [];
    /// <summary>Guests whose dinner used one of their package's specialty meals.</summary>
    public List<long> CoveredIds { get; set; } = [];
}

public sealed class PurchaseRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "addOn";
    public string ItemId { get; set; } = "";
    public int Units { get; set; }
    public long UnitCents { get; set; }
    public long TotalCents { get; set; }
    public string Status { get; set; } = "active";
    public long CreditedCents { get; set; }
    public DateTime At { get; set; }
    public List<long> GuestIds { get; set; } = [];
    public List<string> Methods { get; set; } = [];
}

public sealed class AssistRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long GuestUserId { get; set; }
    public string Kind { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class TravelRow
{
    public string? Window { get; set; }
    public string? Mode { get; set; }
    public string? Hotel { get; set; }
}

public sealed record NewTour(string ExcursionId, int Day, IReadOnlyList<long> GuestIds, long TotalCents, long CreditCents);

public sealed record NewTable(string VenueId, int Day, string Time, IReadOnlyList<long> GuestIds, IReadOnlyList<long> CoveredIds, string Note, long ChargeCents, DateTime At);

public sealed record NewPurchase(string Kind, string ItemId, IReadOnlyList<long> GuestIds, int Units, long UnitCents, long TotalCents, DateTime At);

/// <summary>A change to a booked tour: fewer guests (or none, which cancels it), what is left to pay, and the fee and refund so far.</summary>
public sealed record TourChange(long TourId, IReadOnlyList<long> GuestIds, long TotalCents, long CreditCents, string Status, long FeeCents, long RefundCents, DateTime At);

/// <summary>Phase 8 store: excursions, dining, packages, ticks, travel plan and assistance. A booking is always an internal id; the service has already checked who may see it.</summary>
public interface IPlanStore
{
    // Excursions
    Task<List<TourRow>> ListToursAsync(long bookingId, CancellationToken ct);
    /// <summary>People on active tours of this excursion across the whole sailing, optionally leaving one tour out, for counting places left.</summary>
    Task<int> CountTourGuestsAsync(string sailingId, string excursionId, long? exceptTourId, CancellationToken ct);
    Task<List<CartLineRow>> GetCartAsync(long bookingId, CancellationToken ct);
    /// <summary>Puts a line in the cart, replacing any line for the same tour.</summary>
    Task SetCartLineAsync(long bookingId, string excursionId, IReadOnlyList<long> guestIds, CancellationToken ct);
    Task RemoveCartLineAsync(long bookingId, string excursionId, CancellationToken ct);
    /// <summary>Books every tour, empties the cart and records the payment (if any money moved) in one transaction.</summary>
    Task BookToursAsync(long bookingId, IReadOnlyList<NewTour> tours, NewBookingPayment? payment, DateTime at, CancellationToken ct);
    /// <summary>Applies the change and records the refund (if any money went back to a card) in one transaction.</summary>
    Task ChangeTourAsync(long bookingId, TourChange change, NewBookingPayment? refund, CancellationToken ct);

    // Dining
    Task<List<TableRow>> ListTablesAsync(long bookingId, CancellationToken ct);
    /// <summary>Tables booked at this time across the whole sailing, optionally leaving one out.</summary>
    Task<int> CountTablesAsync(string sailingId, string venueId, int day, string time, long? exceptTableId, CancellationToken ct);
    Task<TableRow> AddTableAsync(long bookingId, NewTable table, CancellationToken ct);
    /// <summary>Moves the table in place, so it keeps its address and is never missing or doubled. Clears any lateness.</summary>
    Task MoveTableAsync(long bookingId, long tableId, int day, string time, CancellationToken ct);
    Task SetTableLateAsync(long bookingId, long tableId, int minutes, CancellationToken ct);
    Task CancelTableAsync(long bookingId, long tableId, CancellationToken ct);

    // Packages
    Task<List<PurchaseRow>> ListPurchasesAsync(long bookingId, CancellationToken ct);
    Task AddPurchaseAsync(long bookingId, NewPurchase purchase, NewBookingPayment payment, CancellationToken ct);
    /// <summary>Sets the status and the credit given for a price drop; cancelling a purchase also records the refund.</summary>
    Task UpdatePurchaseAsync(long bookingId, long purchaseId, string status, long creditedCents, NewBookingPayment? refund, CancellationToken ct);

    // Checklist and packing
    Task<HashSet<string>> GetTicksAsync(long bookingId, string list, CancellationToken ct);
    Task SetTickAsync(long bookingId, string list, string itemId, bool done, DateTime at, CancellationToken ct);

    // Travel
    Task<TravelRow?> GetTravelAsync(long bookingId, CancellationToken ct);
    Task SaveTravelAsync(long bookingId, TravelRow plan, CancellationToken ct);

    // Assistance
    Task<List<AssistRow>> ListAssistAsync(long bookingId, CancellationToken ct);
    Task<AssistRow> AddAssistAsync(long bookingId, long guestUserId, string kind, string note, DateTime at, CancellationToken ct);
    Task<bool> CancelAssistAsync(long bookingId, Guid publicId, CancellationToken ct);
}
