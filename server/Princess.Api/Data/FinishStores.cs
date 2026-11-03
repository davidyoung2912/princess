namespace Princess.Api.Data;

public sealed class ChoiceRow
{
    public string Option { get; set; } = "";
    public bool TagsOn { get; set; }
    public DateTime DecidedAt { get; set; }
    /// <summary>Bags by guest user; a guest with none is absent.</summary>
    public Dictionary<long, int> Bags { get; set; } = [];
}

public sealed class CelebrationRow
{
    public string ClientId { get; set; } = "";
    public string Label { get; set; } = "";
    /// <summary>"MM-DD".</summary>
    public string MonthDay { get; set; } = "";
    public bool Surprise { get; set; }
    public DateTime ToldAt { get; set; }
}

public sealed class ThanksRow
{
    public Guid Id { get; set; }
    public long UserId { get; set; }
    public string Team { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class WishRow
{
    public Guid Id { get; set; }
    public long UserId { get; set; }
    public string CelebrationClientId { get; set; } = "";
    public string Author { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class CustomsRow
{
    /// <summary>The declaration as JSON (<c>food</c>, <c>cash</c>, <c>goodsUsd</c>, <c>note</c>); a hand-written row may hold less.</summary>
    public string Json { get; set; } = "{}";
    public DateTime SubmittedAt { get; set; }
}

public sealed class OnwardRow
{
    public string Mode { get; set; } = "";
    /// <summary>"HH:mm" or "" for no flight.</summary>
    public string FlightAt { get; set; } = "";
    public string Flight { get; set; } = "";
    public string Note { get; set; } = "";
}

public sealed class FinalBillRow
{
    public int TipKeepPercent { get; set; } = 100;
    public DateTime? EmailedAt { get; set; }
    public string? EmailedTo { get; set; }
    public DateTime? SettledAt { get; set; }
}

/// <summary>
/// A case. <see cref="Stage"/> is stored as <c>received</c> and then <c>withdrawn</c>; every other stage, the outcome and the refund are worked out from the clock on each read, so
/// <c>Cases.Stage</c>, <c>Outcome</c>, <c>RefundCents</c> and <c>RefundSentAt</c> are only the desk's record and are not read.
/// </summary>
public sealed class CaseRow
{
    public Guid PublicId { get; set; }
    public long UserId { get; set; }
    public string Kind { get; set; } = "";
    public string Number { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Place { get; set; } = "";
    public long Cents { get; set; }
    public string LineId { get; set; } = "";
    public DateTime OpenedAt { get; set; }
    public DateTime DueAt { get; set; }
    public DateTime? WithdrawnAt { get; set; }
    public bool FromFeedback { get; set; }
}

public sealed class FeedbackRow
{
    public string Json { get; set; } = "{}";
    public DateTime SubmittedAt { get; set; }
    public DateTime EditUntil { get; set; }
}

public sealed class HistoryTripRow
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Ship { get; set; } = "";
    public DateTime Departure { get; set; }
    public int Nights { get; set; }
    public bool Cancelled { get; set; }
    public long? FareCents { get; set; }
    public List<(string Doc, bool Ready)> Docs { get; set; } = [];
    /// <summary>The ports of call in order, with where each is.</summary>
    public List<(string Code, string Name, double Lat, double Lon)> Ports { get; set; } = [];
}

public sealed class LoyaltyRecordRow
{
    public string Number { get; set; } = "";
    /// <summary>Cruise days on the guest's record before the cruise in hand.</summary>
    public int DaysCounted { get; set; }
    public string? ReferralCode { get; set; }
    public List<(string Name, string State)> Referrals { get; set; } = [];
}

public sealed class HoldRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string SailingId { get; set; } = "";
    public string CategoryId { get; set; } = "";
    public int Guests { get; set; }
    public long TotalCents { get; set; }
    public long DepositCents { get; set; }
    public long CreditCents { get; set; }
    public long FccAppliedCents { get; set; }
    public bool Onboard { get; set; }
    public DateTime PlacedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

/// <summary>A Future Cruise Desk slot. <see cref="At"/> is ship wall-clock time, the way <c>ref.DeskSlots</c> is seeded.</summary>
public sealed record DeskSlotRow(DateTime At, int Capacity, int Taken);

/// <summary>Phase 11 store: disembarkation, cases, feedback, loyalty and rebooking. A booking is always an internal id; the service has already checked who may see it.</summary>
public interface IFinishStore
{
    Task<ChoiceRow?> GetChoiceAsync(long bookingId, CancellationToken ct);
    Task SaveChoiceAsync(long bookingId, string option, bool tagsOn, IReadOnlyDictionary<long, int> bags, DateTime at, CancellationToken ct);
    Task SetTagsOnAsync(long bookingId, bool on, CancellationToken ct);

    Task<List<CelebrationRow>> ListCelebrationsAsync(long bookingId, CancellationToken ct);
    /// <summary>Replaces the booking's celebrations with these.</summary>
    Task SaveCelebrationsAsync(long bookingId, IReadOnlyList<CelebrationRow> rows, CancellationToken ct);

    Task<List<ThanksRow>> ListThanksAsync(long bookingId, CancellationToken ct);
    Task AddThanksAsync(long bookingId, ThanksRow row, CancellationToken ct);

    Task<List<WishRow>> ListWishesAsync(long bookingId, CancellationToken ct);
    Task AddWishAsync(long bookingId, WishRow row, CancellationToken ct);

    Task<CustomsRow?> GetCustomsAsync(long bookingId, CancellationToken ct);
    Task SaveCustomsAsync(long bookingId, string json, DateTime at, CancellationToken ct);

    Task<OnwardRow?> GetOnwardAsync(long bookingId, CancellationToken ct);
    Task SaveOnwardAsync(long bookingId, OnwardRow plan, CancellationToken ct);

    Task<HashSet<string>> ListNightTicksAsync(long bookingId, CancellationToken ct);
    Task SetNightTickAsync(long bookingId, string itemId, bool done, DateTime at, CancellationToken ct);

    Task<FinalBillRow?> GetFinalBillAsync(long bookingId, CancellationToken ct);
    /// <summary>Saves the share of the gratuity kept and replaces the account's gratuity adjustment line with <paramref name="folio"/>.</summary>
    Task SaveTipAsync(long bookingId, int keepPercent, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task SaveEmailedAsync(long bookingId, DateTime at, string to, CancellationToken ct);

    Task<List<CaseRow>> ListCasesAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds the case, or returns null when its number is already taken (by this or another booking).</summary>
    Task<CaseRow?> AddCaseAsync(long bookingId, CaseRow row, CancellationToken ct);
    Task<bool> WithdrawCaseAsync(long bookingId, Guid publicId, DateTime at, CancellationToken ct);

    Task<FeedbackRow?> GetFeedbackAsync(long bookingId, CancellationToken ct);
    Task SaveFeedbackAsync(long bookingId, string json, DateTime at, DateTime editUntil, CancellationToken ct);

    Task<List<HistoryTripRow>> ListHistoryTripsAsync(long userId, CancellationToken ct);
    Task<LoyaltyRecordRow?> GetLoyaltyAsync(long userId, CancellationToken ct);

    Task<List<HoldRow>> ListHoldsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds the hold and, with <paramref name="folio"/>, the onboard credit that came with it.</summary>
    Task<HoldRow> AddHoldAsync(long bookingId, long userId, HoldRow hold, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<bool> ReleaseHoldAsync(long bookingId, Guid publicId, CancellationToken ct);

    /// <summary>What is left of the person's future cruise credits that have not run out.</summary>
    Task<long> FccLeftAsync(long userId, DateOnly today, CancellationToken ct);
    /// <summary>What this booking has changed to onboard credit so far.</summary>
    Task<long> FccConvertedAsync(long bookingId, CancellationToken ct);
    /// <summary>Takes <paramref name="cents"/> off the person's credits, oldest expiry first, and puts <paramref name="folio"/> on the account.</summary>
    Task ConvertFccAsync(long bookingId, long userId, long cents, DateOnly today, IReadOnlyList<FolioWrite> folio, CancellationToken ct);

    /// <summary>The desk's slots between two ship wall-clock times, with how many are taken.</summary>
    Task<List<DeskSlotRow>> ListDeskSlotsAsync(DateTime fromLocal, DateTime toLocal, CancellationToken ct);
    Task<DateTime?> GetAppointmentAsync(long bookingId, CancellationToken ct);
    /// <summary>Books the slot for the booking, moving an earlier appointment; false when the slot does not exist or is full.</summary>
    Task<bool> BookSlotAsync(long bookingId, DateTime atLocal, CancellationToken ct);
    Task CancelSlotAsync(long bookingId, CancellationToken ct);
}
