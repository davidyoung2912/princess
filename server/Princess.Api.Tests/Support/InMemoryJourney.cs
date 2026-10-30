using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests.Support;

/// <summary>One in-memory world behind every Phase 6 store, so the HTTP tests exercise the real pipeline and services without SQL Server.</summary>
public sealed class InMemoryJourney : IAccountStore, ITripStore, IInboxStore, IPrivacyStore, IDemoStore
{
    public List<BookingRow> Bookings { get; } = [];
    public Dictionary<long, List<GuestRow>> Party { get; } = [];
    public Dictionary<long, ProfileRecord> Profiles { get; } = [];
    public Dictionary<long, string?> Emails { get; } = [];
    public List<(long GuestId, HelperRecord Helper)> Helpers { get; } = [];
    public List<(long UserId, long ByUserId, string What, string Detail, DateTime At)> History { get; } = [];
    public List<(long BookingId, PaymentRow Row, long UserId)> Payments { get; } = [];
    public List<(long UserId, CardRow Card)> Cards { get; } = [];
    public HashSet<(long UserId, long BookingId)> Linked { get; } = [];
    public List<(long BookingId, string LastName)> AgentLeads { get; } = [];
    public List<PastTripRow> PastTrips { get; } = [];
    public List<SailingRow> Sailings { get; } = [];
    public Dictionary<long, string> Prefs { get; } = [];
    public Dictionary<long, HashSet<string>> NoticesRead { get; } = [];
    public List<(long UserId, TicketRow Ticket)> Tickets { get; } = [];
    public List<(long UserId, FeedbackRecord Feedback)> Feedback { get; } = [];
    public Dictionary<long, List<string>> Favourites { get; } = [];
    public List<ConsentRow> Consents { get; } = [];
    public List<(long UserId, AccessRow Row)> Access { get; } = [];
    public List<(long UserId, RetentionRow Row)> Retention { get; } = [];
    public List<(long BookingId, IReadOnlyCollection<string> Kinds)> Purges { get; } = [];
    public Dictionary<long, string> Budgets { get; } = [];
    public Dictionary<long, long> ClockOffsets { get; } = [];
    public HashSet<long> TakenEmailOwners { get; } = [];
    private long _next = 1000;

    // ---- IAccountStore ----
    public Task<List<GuestRow>> GetPartyAsync(long bookingId, CancellationToken ct) => Task.FromResult(Party.GetValueOrDefault(bookingId)?.ToList() ?? []);

    public Task<SharedBooking?> FindSharedBookingAsync(long userId, long otherUserId, CancellationToken ct)
    {
        var hit = Bookings
            .Where(b => Party.GetValueOrDefault(b.BookingId)?.Any(g => g.UserId == userId) == true && Party[b.BookingId].Any(g => g.UserId == otherUserId))
            .OrderBy(b => b.Status == "confirmed" ? 0 : 1).ThenByDescending(b => b.Departure).FirstOrDefault();
        return Task.FromResult(hit is null ? null : new SharedBooking { BookingId = hit.BookingId, Number = hit.Number, BookerUserId = hit.BookerUserId, Departure = hit.Departure, Nights = hit.Nights });
    }

    public Task<ProfileRecord?> GetProfileAsync(long userId, CancellationToken ct) => Task.FromResult(Profiles.GetValueOrDefault(userId));

    public Task SaveProfileAsync(ProfileRecord p, bool updateEmail, DateTime now, CancellationToken ct)
    {
        if (updateEmail && TakenEmailOwners.Contains(p.UserId)) throw ApiException.Conflict("emailTaken");
        if (!updateEmail) p.Email = Profiles.GetValueOrDefault(p.UserId)?.Email;
        Profiles[p.UserId] = p;
        return Task.CompletedTask;
    }

    public Task<HelperRecord?> GetHelperAsync(long guestUserId, CancellationToken ct) =>
        Task.FromResult(Helpers.Where(h => h.GuestId == guestUserId).Select(h => h.Helper).OrderBy(h => h.Status == "revoked" ? 1 : 0).ThenByDescending(h => h.ChangedAt).FirstOrDefault());

    public Task<HelperRecord> UpsertHelperAsync(long guestUserId, string name, string relationship, string permissions, string status, DateTime now, CancellationToken ct)
    {
        Helpers.RemoveAll(h => h.GuestId == guestUserId && h.Helper.Status != "revoked");
        var helper = new HelperRecord { Name = name, Relationship = relationship, Permissions = permissions, Status = status, ChangedAt = now };
        Helpers.Add((guestUserId, helper));
        return Task.FromResult(helper);
    }

    public Task<HelperRecord?> RevokeHelperAsync(long guestUserId, DateTime now, CancellationToken ct)
    {
        var live = Helpers.FirstOrDefault(h => h.GuestId == guestUserId && h.Helper.Status != "revoked");
        if (live.Helper is null) return Task.FromResult<HelperRecord?>(null);
        live.Helper.Status = "revoked";
        live.Helper.ChangedAt = now;
        return Task.FromResult<HelperRecord?>(live.Helper);
    }

    public Task<List<HistoryRecord>> ListHistoryAsync(long userId, CancellationToken ct) =>
        Task.FromResult(History.Where(h => h.UserId == userId).OrderByDescending(h => h.At)
            .Select(h => new HistoryRecord { PublicId = Guid.NewGuid(), At = h.At, By = Profiles.GetValueOrDefault(h.ByUserId)?.FirstName ?? "", What = h.What, Detail = h.Detail }).ToList());

    public Task AddHistoryAsync(long userId, long byUserId, string what, string detail, DateTime now, CancellationToken ct)
    {
        History.Add((userId, byUserId, what, detail, now));
        return Task.CompletedTask;
    }

    public Task SetDocumentAsync(long userId, string doc, DateTime? expires, DateTime now, CancellationToken ct)
    {
        foreach (var g in Party.Values.SelectMany(p => p).Where(g => g.UserId == userId)) g.Held[doc] = expires;
        return Task.CompletedTask;
    }

    public Task RemoveDocumentAsync(long userId, string doc, CancellationToken ct)
    {
        foreach (var g in Party.Values.SelectMany(p => p).Where(g => g.UserId == userId)) g.Held.Remove(doc);
        return Task.CompletedTask;
    }

    // ---- ITripStore ----
    public Task<List<BookingRow>> ListForUserAsync(long userId, CancellationToken ct) =>
        Task.FromResult(Bookings.Where(b => Party.GetValueOrDefault(b.BookingId)?.Any(g => g.UserId == userId) == true || Linked.Contains((userId, b.BookingId))).OrderBy(b => b.Departure).ToList());

    public Task<BookingRow?> GetAsync(long bookingId, CancellationToken ct) => Task.FromResult(Bookings.FirstOrDefault(b => b.BookingId == bookingId));

    public Task<BookingRow?> FindAgentBookingAsync(string number, string lastName, DateTime departure, CancellationToken ct) =>
        Task.FromResult(Bookings.FirstOrDefault(b => b.Number == number && b.Kind == "agent" && b.Status == "confirmed" && b.Departure.Date == departure.Date
            && AgentLeads.Any(l => l.BookingId == b.BookingId && string.Equals(l.LastName, lastName, StringComparison.OrdinalIgnoreCase))));

    public Task<bool> IsLinkedOrMemberAsync(long userId, long bookingId, CancellationToken ct) =>
        Task.FromResult(Linked.Contains((userId, bookingId)) || Party.GetValueOrDefault(bookingId)?.Any(g => g.UserId == userId) == true);

    public Task LinkAsync(long userId, long bookingId, DateTime now, CancellationToken ct)
    {
        Linked.Add((userId, bookingId));
        return Task.CompletedTask;
    }

    public Task<List<PaymentRow>> ListPaymentsAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Payments.Where(p => p.BookingId == bookingId).Select(p => p.Row).OrderBy(p => p.At).ToList());

    public Task InsertPaymentAsync(NewPayment p, CancellationToken ct)
    {
        Payments.Add((p.BookingId, new PaymentRow { PublicId = Guid.NewGuid(), Label = p.Label, AmountCents = p.AmountCents, At = p.At, Status = "captured", Method = "card", CardBrand = p.CardBrand, Last4 = p.Last4 }, p.UserId));
        Bookings.First(b => b.BookingId == p.BookingId).PaidCents += p.AmountCents;
        return Task.CompletedTask;
    }

    public Task<List<CardRow>> ListCardsAsync(long userId, CancellationToken ct) => Task.FromResult(Cards.Where(c => c.UserId == userId).Select(c => c.Card).ToList());

    public Task<CardRow> AddCardAsync(long userId, string brand, string last4, string expiry, DateTime now, CancellationToken ct)
    {
        var card = new CardRow { Id = _next++, PublicId = Guid.NewGuid(), Brand = brand, Last4 = last4, Expiry = expiry };
        Cards.Add((userId, card));
        return Task.FromResult(card);
    }

    public Task<bool> RemoveCardAsync(long userId, Guid cardPublicId, CancellationToken ct) =>
        Task.FromResult(Cards.RemoveAll(c => c.UserId == userId && c.Card.PublicId == cardPublicId) > 0);

    public Task<List<PastTripRow>> ListPastTripsAsync(long userId, CancellationToken ct) => Task.FromResult(PastTrips.ToList());

    public Task<List<SailingRow>> ListSailingsAsync(CancellationToken ct) => Task.FromResult(Sailings.ToList());

    // ---- IInboxStore ----
    public Task<string?> GetPrefsJsonAsync(long userId, CancellationToken ct) => Task.FromResult(Prefs.GetValueOrDefault(userId));

    public Task SavePrefsJsonAsync(long userId, string json, DateTime now, CancellationToken ct)
    {
        Prefs[userId] = json;
        return Task.CompletedTask;
    }

    public Task<HashSet<string>> ReadNoticeKindsAsync(long userId, CancellationToken ct) => Task.FromResult(NoticesRead.GetValueOrDefault(userId)?.ToHashSet() ?? []);

    public Task MarkNoticesReadAsync(long userId, IReadOnlyCollection<string> kinds, DateTime now, CancellationToken ct)
    {
        if (!NoticesRead.TryGetValue(userId, out var set)) NoticesRead[userId] = set = [];
        foreach (var k in kinds) set.Add(k);
        return Task.CompletedTask;
    }

    public Task<List<TicketRow>> ListTicketsAsync(long userId, CancellationToken ct) => Task.FromResult(Tickets.Where(t => t.UserId == userId).Select(t => t.Ticket).Reverse().OrderByDescending(t => t.At).ToList());

    public Task<TicketRow> AddTicketAsync(long userId, string kind, string detail, DateTime now, CancellationToken ct)
    {
        var t = new TicketRow { PublicId = Guid.NewGuid(), Kind = kind, Detail = detail, At = now };
        Tickets.Add((userId, t));
        return Task.FromResult(t);
    }

    public Task<List<FeedbackRecord>> ListFeedbackAsync(long userId, CancellationToken ct) => Task.FromResult(Feedback.Where(f => f.UserId == userId).Select(f => f.Feedback).Reverse().OrderByDescending(f => f.At).ToList());

    public Task AddFeedbackAsync(long userId, FeedbackRecord feedback, CancellationToken ct)
    {
        Feedback.Add((userId, feedback));
        return Task.CompletedTask;
    }

    public Task<List<string>> ListFavouritesAsync(long userId, CancellationToken ct) => Task.FromResult(Favourites.GetValueOrDefault(userId)?.ToList() ?? []);

    public Task<List<string>> ToggleFavouriteAsync(long userId, string key, CancellationToken ct)
    {
        if (!Favourites.TryGetValue(userId, out var list)) Favourites[userId] = list = [];
        if (!list.Remove(key)) list.Add(key);
        return Task.FromResult(list.ToList());
    }

    // ---- IPrivacyStore ----
    public Task<List<ConsentRow>> ListConsentsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct) => Task.FromResult(Consents.Where(c => userIds.Contains(c.UserId)).ToList());

    public Task SetConsentAsync(long userId, string consentId, bool on, long changedByUserId, DateTime now, CancellationToken ct)
    {
        Consents.RemoveAll(c => c.UserId == userId && c.ConsentId == consentId);
        Consents.Add(new ConsentRow { UserId = userId, ConsentId = consentId, On = on });
        return Task.CompletedTask;
    }

    public Task<List<AccessRow>> ListAccessAsync(long userId, int max, CancellationToken ct) => Task.FromResult(Access.Where(a => a.UserId == userId).Select(a => a.Row).TakeLast(max).ToList());

    public Task AddAccessAsync(long userId, string actor, string purpose, DateTime now, CancellationToken ct)
    {
        Access.Add((userId, new AccessRow { Actor = actor, Purpose = purpose, At = now }));
        return Task.CompletedTask;
    }

    public Task<List<RetentionRow>> ListRetentionRunsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct) => Task.FromResult(Retention.Where(r => userIds.Contains(r.UserId)).Select(r => r.Row).ToList());

    public Task PurgeAsync(long bookingId, IReadOnlyCollection<long> guestUserIds, long runUserId, IReadOnlyCollection<string> kinds, DateTime now, CancellationToken ct)
    {
        Purges.Add((bookingId, kinds));
        Retention.Add((runUserId, new RetentionRow { Kinds = string.Join(',', kinds), At = now }));
        if (kinds.Contains("documents")) foreach (var g in Party[bookingId]) g.Held.Clear();
        return Task.CompletedTask;
    }

    public Task<string?> GetBudgetJsonAsync(long bookingId, CancellationToken ct) => Task.FromResult(Budgets.GetValueOrDefault(bookingId));

    public Task SaveBudgetJsonAsync(long bookingId, string json, DateTime now, CancellationToken ct)
    {
        Budgets[bookingId] = json;
        return Task.CompletedTask;
    }

    // ---- IDemoStore ----
    public Task<long> GetClockOffsetSecondsAsync(long userId, CancellationToken ct) => Task.FromResult(ClockOffsets.GetValueOrDefault(userId));
}
