namespace Princess.Api.Data;

/// <summary>The saved booking draft (<c>dbo.BookingDrafts</c>). People, contact and acceptances are JSON, read whole.</summary>
public sealed class DraftRecord
{
    public string Id { get; set; } = "";
    public string? SailingId { get; set; }
    public string? CategoryId { get; set; }
    public int Guests { get; set; } = 2;
    public string CabinMode { get; set; } = "guaranteed";
    public string? CabinNumber { get; set; }
    public string? FareId { get; set; }
    public string? Dining { get; set; }
    public string Occasion { get; set; } = "none";
    public string? LoyaltyNumber { get; set; }
    public bool UseCredit { get; set; }
    public string AcceptedJson { get; set; } = "{}";
    public string PeopleJson { get; set; } = "[]";
    public string ContactJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; }
}

/// <summary>A person's Captain's Circle number and how much future cruise credit is left today.</summary>
public sealed class LoyaltyRecord
{
    public string? Number { get; set; }
    public long CreditLeftCents { get; set; }
}

/// <summary>What the funnel captured about one guest (<c>dbo.BookingGuestDetails</c> and its tags).</summary>
public sealed class GuestDetailRow
{
    public int Seq { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public DateTime Dob { get; set; }
    public string Gender { get; set; } = "F";
    public string Citizenship { get; set; } = "us";
    public string DietaryStatus { get; set; } = "none";
    public string AllergyNote { get; set; } = "";
    public string[] Dietary { get; set; } = [];
    public string[] Needs { get; set; } = [];
}

public sealed record AcceptanceRow(string LegalId, int Version, DateTime At);

public sealed record NotifiedRow(string Via, string ToMasked, DateTime At);

public sealed record ReceiptPartRow(string Method, string? CardBrand, string? Last4, long Cents);

/// <summary>A payment on a booking with how each part was made. Refunds have no parts.</summary>
public sealed class ReceiptRow
{
    public Guid PublicId { get; set; }
    public string Label { get; set; } = "";
    public long AmountCents { get; set; }
    public DateTime At { get; set; }
    public string Status { get; set; } = "captured";
    public List<ReceiptPartRow> Parts { get; set; } = [];
}

/// <summary>Everything the booking screens show, beyond the <see cref="BookingRow"/> the trip cards use.</summary>
public sealed class BookingDetail
{
    public BookingRow Row { get; set; } = new();
    public string Dining { get; set; } = "anytime";
    public string Occasion { get; set; } = "none";
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public int FinalPaymentDays { get; set; } = 90;
    public DateTime? CancelledAt { get; set; }
    public long? CancelFeeCents { get; set; }
    public long? CancelRefundCents { get; set; }
    public List<GuestDetailRow> Guests { get; set; } = [];
    public List<AcceptanceRow> Acceptances { get; set; } = [];
    public List<NotifiedRow> Notified { get; set; } = [];
    public List<ReceiptRow> Receipts { get; set; } = [];
}

public sealed record NewPaymentPart(string Method, long? CardId, string? CardBrand, string? Last4, long Cents, bool ChallengeUsed);

/// <summary>A payment to record against a booking: a charge with parts, or a refund (negative amount, no parts).</summary>
public sealed record NewBookingPayment(long UserId, string Label, long AmountCents, string Reference, DateTime At, IReadOnlyList<NewPaymentPart> Parts);

public sealed class NewBooking
{
    public string Number { get; set; } = "";
    public string DraftId { get; set; } = "";
    public long BookerUserId { get; set; }
    /// <summary>Printed on the booker's guest row, "WHITFIELD/GERALD".</summary>
    public string BookerPrinted { get; set; } = "";
    public string SailingId { get; set; } = "";
    public string CategoryId { get; set; } = "";
    public string? CabinNumber { get; set; }
    public string FareId { get; set; } = "";
    public string Dining { get; set; } = "anytime";
    public string Occasion { get; set; } = "none";
    public long TotalCents { get; set; }
    public long DepositCents { get; set; }
    public DateTime FinalDueDate { get; set; }
    public int FinalPaymentDays { get; set; } = 90;
    public string? LoyaltyNumber { get; set; }
    public long DiscountCents { get; set; }
    public long CreditUsedCents { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public DateTime ConfirmedAt { get; set; }
    public List<GuestDetailRow> Guests { get; set; } = [];
    public List<AcceptanceRow> Acceptances { get; set; } = [];
    public List<NotifiedRow> Notified { get; set; } = [];
    public NewBookingPayment Payment { get; set; } = null!;
}

/// <summary>A change of sailing: the new total and due date, whether the stateroom is kept, and the refund if the guest has paid more than the new total.</summary>
public sealed record SailingChange(long BookingId, string SailingId, long TotalCents, long DepositCents, DateTime FinalDueDate, string? CabinNumber, NewBookingPayment? Refund, DateTime At);

public sealed record Cancellation(long BookingId, DateTime At, long FeeCents, long RefundCents, NewBookingPayment? Refund);

/// <summary>Phase 7 store: the booking draft, booking creation, and the changes a booking can go through. Takes internal ids; services resolve public ids first.</summary>
public interface IBookingStore
{
    Task<DraftRecord?> GetDraftAsync(long userId, CancellationToken ct);
    /// <summary>Saves the person's one live draft. An existing draft keeps its id (it is the resume-link secret); a new one gets <paramref name="newId"/>. Returns what is stored.</summary>
    Task<DraftRecord> SaveDraftAsync(long userId, DraftRecord draft, string newId, DateTime now, CancellationToken ct);
    Task DeleteDraftAsync(long userId, CancellationToken ct);
    Task AddResumeLinkAsync(string draftId, string via, string toMasked, string token, DateTime sentAt, DateTime expiresAt, CancellationToken ct);

    Task<LoyaltyRecord> GetLoyaltyAsync(long userId, DateOnly today, CancellationToken ct);

    /// <summary>The booking already made from this draft id, if any.</summary>
    Task<BookingRow?> FindByDraftAsync(string draftId, CancellationToken ct);
    Task<bool> NumberTakenAsync(string number, CancellationToken ct);
    /// <summary>Stateroom numbers on confirmed bookings for the sailing.</summary>
    Task<HashSet<string>> TakenCabinsAsync(string sailingId, CancellationToken ct);
    /// <summary>Creates the booking, its guests, acceptances, notices and first payment, and uses up future cruise credit, all or nothing. Returns the booking id.</summary>
    Task<long> CreateBookingAsync(NewBooking booking, CancellationToken ct);

    Task<BookingDetail?> GetDetailAsync(long bookingId, CancellationToken ct);
    Task AddPaymentAsync(long bookingId, NewBookingPayment payment, CancellationToken ct);
    Task ChangeSailingAsync(SailingChange change, CancellationToken ct);
    Task CancelAsync(Cancellation cancellation, CancellationToken ct);

    /// <summary>The booking number a person's idempotency key already produced for this route, else null.</summary>
    Task<string?> FindIdempotentAsync(string key, long userId, string route, CancellationToken ct);
    /// <summary>Throws a conflict when the key belongs to someone else or another route.</summary>
    Task SaveIdempotentAsync(string key, long userId, string route, string result, DateTime now, CancellationToken ct);
}
