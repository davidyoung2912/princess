namespace Princess.Api.Data;

/// <summary>A guest on a booking with what the rules need: age and citizenship come from the profile, held documents from <c>GuestDocuments</c>.</summary>
public sealed class GuestRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public DateTime Dob { get; set; }
    public string Citizenship { get; set; } = "us";
    public bool IsSupervised { get; set; }
    public long? BookerUserId { get; set; }
    public int Seq { get; set; }
    /// <summary>Document id to expiry (null where none).</summary>
    public Dictionary<string, DateTime?> Held { get; set; } = [];
}

public sealed class SharedBooking
{
    public long BookingId { get; set; }
    public string Number { get; set; } = "";
    public long BookerUserId { get; set; }
    public DateTime Departure { get; set; }
    public int Nights { get; set; }
}

public sealed class ProfileRecord
{
    public long UserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public DateTime Dob { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string Citizenship { get; set; } = "us";
    public string Bedding { get; set; } = "noPreference";
    public string SpecialRequests { get; set; } = "";
    public string EmergencyName { get; set; } = "";
    public string EmergencyPhone { get; set; } = "";
    public string EmergencyRelationship { get; set; } = "";
    public List<string> Dietary { get; set; } = [];
    public List<string> Needs { get; set; } = [];
}

public sealed class HelperRecord
{
    public string Name { get; set; } = "";
    public string Relationship { get; set; } = "";
    public string Permissions { get; set; } = "";
    public string Status { get; set; } = "requested";
    public DateTime ChangedAt { get; set; }
}

public sealed class HistoryRecord
{
    public Guid PublicId { get; set; }
    public DateTime At { get; set; }
    public string By { get; set; } = "";
    public string What { get; set; } = "";
    public string Detail { get; set; } = "";
}

/// <summary>A booking as the trip screens need it, with the sailing, cabin category and payment total joined in.</summary>
public sealed class BookingRow
{
    public long BookingId { get; set; }
    public string Number { get; set; } = "";
    public string Kind { get; set; } = "direct";
    public string? AgentName { get; set; }
    public long BookerUserId { get; set; }
    public string SailingId { get; set; } = "";
    public string SailingTitle { get; set; } = "";
    public string ShipName { get; set; } = "";
    public DateTime Departure { get; set; }
    public int Nights { get; set; }
    public string CategoryId { get; set; } = "";
    public string CategoryName { get; set; } = "";
    public string FareId { get; set; } = "";
    public string? CabinNumber { get; set; }
    public string Status { get; set; } = "confirmed";
    public long TotalCents { get; set; }
    public long DepositCents { get; set; }
    public DateTime FinalDueDate { get; set; }
    public DateTime ConfirmedAt { get; set; }
    public int GuestAccounts { get; set; }
    public int GuestDetails { get; set; }
    public int GuestCount => Math.Max(GuestAccounts, GuestDetails);
    public DateTime? CheckinFinishedAt { get; set; }
    /// <summary>Captured deposit, balance and full payments, less refunds, so declined attempts never count.</summary>
    public long PaidCents { get; set; }
}

public sealed class PaymentRow
{
    public Guid PublicId { get; set; }
    public string Label { get; set; } = "";
    public long AmountCents { get; set; }
    public DateTime At { get; set; }
    public string Status { get; set; } = "captured";
    public string? Method { get; set; }
    public string? CardBrand { get; set; }
    public string? Last4 { get; set; }
}

public sealed record NewPayment(long BookingId, long UserId, string Label, long AmountCents, string Reference, long? CardId, string CardBrand, string Last4, DateTime At);

public sealed class CardRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Brand { get; set; } = "";
    public string Last4 { get; set; } = "";
    public string Expiry { get; set; } = "";
    public bool IsDefault { get; set; }
}

public sealed class PastTripRow
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Ship { get; set; } = "";
    public DateTime Departure { get; set; }
    public int Nights { get; set; }
    public bool Cancelled { get; set; }
}

public sealed class TicketRow
{
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Status { get; set; } = "open";
    public string Detail { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class FeedbackRecord
{
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Text { get; set; } = "";
    public string LogJson { get; set; } = "[]";
    public string? Screenshot { get; set; }
    public string Reference { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class ConsentRow
{
    public long UserId { get; set; }
    public string ConsentId { get; set; } = "";
    public bool On { get; set; }
}

public sealed class AccessRow
{
    public string Actor { get; set; } = "";
    public string Purpose { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class RetentionRow
{
    public string Kinds { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class SailingRow
{
    public string Id { get; set; } = "";
    public DateTime Departure { get; set; }
    public bool IsHoliday { get; set; }
    public bool IsReference { get; set; }
    public int Nights { get; set; } = 7;
    /// <summary><c>ref.Sailings.BookingOpen</c>: a manual close. "One day to go" is worked out from the date.</summary>
    public bool BookingOpen { get; set; } = true;
}
