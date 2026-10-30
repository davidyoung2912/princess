namespace Princess.Api.Data;

/// <summary>Phase 6 stores. Each takes internal ids; the endpoints resolve every public guid once (data model section 2) before calling in.</summary>
public interface IAccountStore
{
    Task<List<GuestRow>> GetPartyAsync(long bookingId, CancellationToken ct);
    /// <summary>A booking both people are guests on, preferring a confirmed one with the latest sailing. Null if they share none.</summary>
    Task<SharedBooking?> FindSharedBookingAsync(long userId, long otherUserId, CancellationToken ct);
    Task<ProfileRecord?> GetProfileAsync(long userId, CancellationToken ct);
    /// <summary>Saves the profile and its tags. The email is written to <c>Users</c> only when <paramref name="updateEmail"/> is set. Throws a conflict when the email is taken.</summary>
    Task SaveProfileAsync(ProfileRecord profile, bool updateEmail, DateTime now, CancellationToken ct);
    Task<HelperRecord?> GetHelperAsync(long guestUserId, CancellationToken ct);
    Task<HelperRecord> UpsertHelperAsync(long guestUserId, string name, string relationship, string permissions, string status, DateTime now, CancellationToken ct);
    Task<HelperRecord?> RevokeHelperAsync(long guestUserId, DateTime now, CancellationToken ct);
    /// <summary>History of the person and of the supervised children they book for, newest first.</summary>
    Task<List<HistoryRecord>> ListHistoryAsync(long userId, CancellationToken ct);
    Task AddHistoryAsync(long userId, long byUserId, string what, string detail, DateTime now, CancellationToken ct);
    Task SetDocumentAsync(long userId, string doc, DateTime? expires, DateTime now, CancellationToken ct);
    Task RemoveDocumentAsync(long userId, string doc, CancellationToken ct);
}

public interface ITripStore
{
    /// <summary>Every booking the person is a guest on or has linked, cancelled ones included.</summary>
    Task<List<BookingRow>> ListForUserAsync(long userId, CancellationToken ct);
    Task<BookingRow?> GetAsync(long bookingId, CancellationToken ct);
    /// <summary>An agent booking matching all three of number, lead guest's last name and sailing date, else null.</summary>
    Task<BookingRow?> FindAgentBookingAsync(string number, string lastName, DateTime departure, CancellationToken ct);
    Task<bool> IsLinkedOrMemberAsync(long userId, long bookingId, CancellationToken ct);
    Task LinkAsync(long userId, long bookingId, DateTime now, CancellationToken ct);
    Task<List<PaymentRow>> ListPaymentsAsync(long bookingId, CancellationToken ct);
    Task InsertPaymentAsync(NewPayment payment, CancellationToken ct);
    Task<List<CardRow>> ListCardsAsync(long userId, CancellationToken ct);
    Task<CardRow> AddCardAsync(long userId, string brand, string last4, string expiry, DateTime now, CancellationToken ct);
    Task<bool> RemoveCardAsync(long userId, Guid cardPublicId, CancellationToken ct);
    Task<List<PastTripRow>> ListPastTripsAsync(long userId, CancellationToken ct);
    Task<List<SailingRow>> ListSailingsAsync(CancellationToken ct);
}

public interface IInboxStore
{
    Task<string?> GetPrefsJsonAsync(long userId, CancellationToken ct);
    Task SavePrefsJsonAsync(long userId, string json, DateTime now, CancellationToken ct);
    Task<HashSet<string>> ReadNoticeKindsAsync(long userId, CancellationToken ct);
    Task MarkNoticesReadAsync(long userId, IReadOnlyCollection<string> kinds, DateTime now, CancellationToken ct);
    Task<List<TicketRow>> ListTicketsAsync(long userId, CancellationToken ct);
    Task<TicketRow> AddTicketAsync(long userId, string kind, string detail, DateTime now, CancellationToken ct);
    Task<List<FeedbackRecord>> ListFeedbackAsync(long userId, CancellationToken ct);
    Task AddFeedbackAsync(long userId, FeedbackRecord feedback, CancellationToken ct);
    Task<List<string>> ListFavouritesAsync(long userId, CancellationToken ct);
    /// <summary>Adds the key at the end, or removes it if present; returns the list as it now stands.</summary>
    Task<List<string>> ToggleFavouriteAsync(long userId, string key, CancellationToken ct);
}

public interface IPrivacyStore
{
    Task<List<ConsentRow>> ListConsentsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);
    Task SetConsentAsync(long userId, string consentId, bool on, long changedByUserId, DateTime now, CancellationToken ct);
    Task<List<AccessRow>> ListAccessAsync(long userId, int max, CancellationToken ct);
    Task AddAccessAsync(long userId, string actor, string purpose, DateTime now, CancellationToken ct);
    /// <summary>Retention runs recorded for the booking's guests, newest last.</summary>
    Task<List<RetentionRow>> ListRetentionRunsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct);
    /// <summary>Hard-deletes the named kinds for the booking in one transaction and records the run against <paramref name="runUserId"/>.</summary>
    Task PurgeAsync(long bookingId, IReadOnlyCollection<long> guestUserIds, long runUserId, IReadOnlyCollection<string> kinds, DateTime now, CancellationToken ct);
    Task<string?> GetBudgetJsonAsync(long bookingId, CancellationToken ct);
    Task SaveBudgetJsonAsync(long bookingId, string json, DateTime now, CancellationToken ct);
}

public interface IDemoStore
{
    /// <summary>Seconds to add to real time for a demo user (D4); 0 when there is no row.</summary>
    Task<long> GetClockOffsetSecondsAsync(long userId, CancellationToken ct);
}
