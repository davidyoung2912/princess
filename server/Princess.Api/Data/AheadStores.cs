namespace Princess.Api.Data;

public sealed class QueueRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string VenueId { get; set; } = "";
    public DateTime JoinedAt { get; set; }
    /// <summary>Parties ahead at the start; later positions are worked out from this and the clock.</summary>
    public int Start { get; set; }
}

public sealed class WaitlistRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string VenueId { get; set; } = "";
    public int Day { get; set; }
    /// <summary>"HH:mm".</summary>
    public string Time { get; set; } = "";
    public DateTime JoinedAt { get; set; }
    public int Start { get; set; }
    /// <summary><c>waiting</c> until the table is taken, then <c>booked</c>. Offered and expired are worked out from the clock.</summary>
    public string Stage { get; set; } = "waiting";
    /// <summary>Asked to be booked automatically. Cleared when the guest takes the table by hand, so a booked row that is still auto was booked by the system.</summary>
    public bool Auto { get; set; }
    public List<long> GuestIds { get; set; } = [];
}

public sealed class ShowTicketRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string EventId { get; set; } = "";
    public int Day { get; set; }
    public List<long> GuestIds { get; set; } = [];
}

public sealed class BidRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string CategoryId { get; set; } = "";
    public long Cents { get; set; }
    /// <summary><c>open</c> or <c>withdrawn</c> as stored; whether an open bid won is worked out from the decision date.</summary>
    public string Status { get; set; } = "open";
    public bool BuyNow { get; set; }
    public DateTime At { get; set; }
}

public sealed class ClubRow
{
    public long ChildUserId { get; set; }
    public string Allergies { get; set; } = "";
    public string Medical { get; set; } = "";
    public string Medication { get; set; } = "";
    public bool PhotoConsent { get; set; }
    public bool SelfSignOut { get; set; }
    public string EmergencyPhone { get; set; } = "";
    public List<Domain.Pickup> Pickups { get; set; } = [];
}

public sealed class MedallionRow
{
    public DateTime? ActivatedAt { get; set; }
    public DateTime? LostAt { get; set; }
}

public sealed class TagRow
{
    public string Way { get; set; } = "";
    public DateTime OrderedAt { get; set; }
    public DateTime? HandedOverAt { get; set; }
}

public sealed class AdvisorAskRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string AdvisorId { get; set; } = "";
    public string Way { get; set; } = "";
    public string Question { get; set; } = "";
    /// <summary>The scripted first reply to a chat; null for a call-back.</summary>
    public string? Reply { get; set; }
    public DateTime? CallbackBy { get; set; }
    public DateTime At { get; set; }
}

public sealed class MarketingConsentRow
{
    public string Channel { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Region { get; set; } = "";
    public DateTime AskedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
}

public sealed class FixCaseRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Flow { get; set; } = "";
    public string Note { get; set; } = "";
    public string Reference { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class AssistCaseRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Note { get; set; } = "";
    public string? BookingNumber { get; set; }
    public string Reference { get; set; } = "";
    public string? Choice { get; set; }
    public DateTime At { get; set; }
}

/// <summary>Phase 8b store: queues and waitlists, show tickets, and the before-the-cruise services. A booking is always an internal id; the service has already checked who may see it.</summary>
public interface IAheadStore
{
    // Waits
    Task<List<QueueRow>> ListQueuesAsync(long bookingId, CancellationToken ct);
    Task<QueueRow> AddQueueAsync(long bookingId, string venueId, int start, DateTime at, CancellationToken ct);
    Task<bool> DeleteQueueAsync(long bookingId, long id, CancellationToken ct);
    Task<List<WaitlistRow>> ListWaitlistAsync(long bookingId, CancellationToken ct);
    Task<WaitlistRow> AddWaitlistAsync(long bookingId, string venueId, int day, string time, IReadOnlyList<long> guestIds, int start, bool auto, DateTime at, CancellationToken ct);
    Task<bool> DeleteWaitlistAsync(long bookingId, long id, CancellationToken ct);
    /// <summary>Marks the entry booked. <paramref name="auto"/> says whether the system did it.</summary>
    Task MarkWaitlistBookedAsync(long bookingId, long id, bool auto, DateTime at, CancellationToken ct);

    // Shows
    Task<List<ShowTicketRow>> ListTicketsAsync(long bookingId, CancellationToken ct);
    /// <summary>Seats held on this show and day by every booking on the sailing.</summary>
    Task<int> CountSeatsAsync(string sailingId, string eventId, int day, CancellationToken ct);
    Task<ShowTicketRow> AddTicketAsync(long bookingId, string eventId, int day, IReadOnlyList<long> guestIds, DateTime at, CancellationToken ct);
    Task<bool> DeleteTicketAsync(long bookingId, long id, CancellationToken ct);

    // Upgrade bids
    Task<List<BidRow>> ListBidsAsync(long bookingId, CancellationToken ct);
    Task<BidRow> AddBidAsync(long bookingId, string categoryId, long cents, bool buyNow, DateTime at, CancellationToken ct);
    Task WithdrawBidAsync(long bookingId, long id, DateTime at, CancellationToken ct);

    // Clubs
    Task<List<ClubRow>> ListClubsAsync(long bookingId, CancellationToken ct);
    Task SaveClubAsync(long bookingId, string clubId, string emergencyName, ClubRow club, DateTime at, CancellationToken ct);
    Task<bool> DeleteClubAsync(long bookingId, long childUserId, CancellationToken ct);

    // Medallion, bag tags, preparation
    Task<MedallionRow?> GetMedallionAsync(long bookingId, CancellationToken ct);
    Task SaveMedallionAsync(long bookingId, string stage, string trackingNumber, DateTime? activatedAt, DateTime? lostAt, CancellationToken ct);
    Task<TagRow?> GetTagsAsync(long bookingId, CancellationToken ct);
    Task SaveTagsAsync(long bookingId, string way, string stage, DateTime orderedAt, DateTime? handedOverAt, CancellationToken ct);
    Task<HashSet<string>> GetPrepAsync(long bookingId, CancellationToken ct);
    Task SetPrepAsync(long bookingId, string itemId, bool done, DateTime at, CancellationToken ct);

    // Per person
    Task<List<AdvisorAskRow>> ListAdvisorAsksAsync(long userId, CancellationToken ct);
    Task AddAdvisorAskAsync(long userId, string advisorId, string way, string? phone, string question, string? reply, DateTime? callbackBy, DateTime at, CancellationToken ct);
    Task<List<MarketingConsentRow>> ListConsentsAsync(long userId, CancellationToken ct);
    Task SaveConsentAsync(long userId, MarketingConsentRow consent, byte[]? codeHash, DateTime? expiresAt, CancellationToken ct);
    Task<bool> DeleteConsentAsync(long userId, string channel, CancellationToken ct);
    Task<List<FixCaseRow>> ListFixCasesAsync(long userId, CancellationToken ct);
    Task AddFixCaseAsync(long userId, string flow, string note, string reference, DateTime contactBy, DateTime at, CancellationToken ct);
    Task<List<AssistCaseRow>> ListAssistCasesAsync(long userId, CancellationToken ct);
    /// <summary>Saves the case. <paramref name="bookingId"/> is set for a bereavement or medical case, which is about a booking; its number is in <see cref="AssistCaseRow.BookingNumber"/>.</summary>
    Task AddAssistCaseAsync(long userId, long? bookingId, AssistCaseRow row, CancellationToken ct);
    Task SetAssistChoiceAsync(long userId, long id, string choice, CancellationToken ct);
}
