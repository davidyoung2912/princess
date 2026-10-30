using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 8b store in memory, over the same bookings as the rest of the world so seats are shared across bookings on a sailing.</summary>
public sealed class InMemoryAheadStore(InMemoryJourney world) : IAheadStore
{
    public List<(long BookingId, QueueRow Row)> Queues { get; } = [];
    public List<(long BookingId, WaitlistRow Row)> Waitlist { get; } = [];
    public List<(long BookingId, ShowTicketRow Row)> Tickets { get; } = [];
    public List<(long BookingId, BidRow Row)> Bids { get; } = [];
    public Dictionary<(long, long), ClubRow> Clubs { get; } = [];
    public Dictionary<long, MedallionRow> Medallions { get; } = [];
    public Dictionary<long, TagRow> Tags { get; } = [];
    public HashSet<(long, string)> Prep { get; } = [];
    public List<(long UserId, AdvisorAskRow Row)> Advisors { get; } = [];
    public List<(long UserId, MarketingConsentRow Row, byte[]? Hash)> Consents { get; } = [];
    public List<(long UserId, FixCaseRow Row)> Fixes { get; } = [];
    public List<(long UserId, AssistCaseRow Row)> Assists { get; } = [];
    private long _next = 7000;

    private string SailingOf(long bookingId) => world.Bookings.First(b => b.BookingId == bookingId).SailingId;

    public Task<List<QueueRow>> ListQueuesAsync(long bookingId, CancellationToken ct) => Task.FromResult(Queues.Where(q => q.BookingId == bookingId).Select(q => q.Row).OrderBy(q => q.JoinedAt).ToList());

    public Task<QueueRow> AddQueueAsync(long bookingId, string venueId, int start, DateTime at, CancellationToken ct)
    {
        var row = new QueueRow { Id = _next++, PublicId = Guid.NewGuid(), VenueId = venueId, JoinedAt = at, Start = start };
        Queues.Add((bookingId, row));
        return Task.FromResult(row);
    }

    public Task<bool> DeleteQueueAsync(long bookingId, long id, CancellationToken ct) => Task.FromResult(Queues.RemoveAll(q => q.BookingId == bookingId && q.Row.Id == id) > 0);

    public Task<List<WaitlistRow>> ListWaitlistAsync(long bookingId, CancellationToken ct) => Task.FromResult(Waitlist.Where(w => w.BookingId == bookingId).Select(w => w.Row).OrderBy(w => w.JoinedAt).ToList());

    public Task<WaitlistRow> AddWaitlistAsync(long bookingId, string venueId, int day, string time, IReadOnlyList<long> guestIds, int start, bool auto, DateTime at, CancellationToken ct)
    {
        var row = new WaitlistRow { Id = _next++, PublicId = Guid.NewGuid(), VenueId = venueId, Day = day, Time = time, JoinedAt = at, Start = start, Auto = auto, GuestIds = [.. guestIds] };
        Waitlist.Add((bookingId, row));
        return Task.FromResult(row);
    }

    public Task<bool> DeleteWaitlistAsync(long bookingId, long id, CancellationToken ct) => Task.FromResult(Waitlist.RemoveAll(w => w.BookingId == bookingId && w.Row.Id == id) > 0);

    public Task MarkWaitlistBookedAsync(long bookingId, long id, bool auto, DateTime at, CancellationToken ct)
    {
        var row = Waitlist.First(w => w.BookingId == bookingId && w.Row.Id == id).Row;
        row.Stage = "booked";
        row.Auto = auto;
        return Task.CompletedTask;
    }

    public Task<List<ShowTicketRow>> ListTicketsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Tickets.Where(t => t.BookingId == bookingId).Select(t => t.Row).ToList());

    public Task<int> CountSeatsAsync(string sailingId, string eventId, int day, CancellationToken ct) =>
        Task.FromResult(Tickets.Where(t => SailingOf(t.BookingId) == sailingId && t.Row.EventId == eventId && t.Row.Day == day).Sum(t => t.Row.GuestIds.Count));

    public Task<ShowTicketRow> AddTicketAsync(long bookingId, string eventId, int day, IReadOnlyList<long> guestIds, DateTime at, CancellationToken ct)
    {
        var row = new ShowTicketRow { Id = _next++, PublicId = Guid.NewGuid(), EventId = eventId, Day = day, GuestIds = [.. guestIds] };
        Tickets.Add((bookingId, row));
        return Task.FromResult(row);
    }

    public Task<bool> DeleteTicketAsync(long bookingId, long id, CancellationToken ct) => Task.FromResult(Tickets.RemoveAll(t => t.BookingId == bookingId && t.Row.Id == id) > 0);

    public Task<List<BidRow>> ListBidsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Bids.Where(b => b.BookingId == bookingId).Select(b => b.Row).OrderBy(b => b.At).ToList());

    public Task<BidRow> AddBidAsync(long bookingId, string categoryId, long cents, bool buyNow, DateTime at, CancellationToken ct)
    {
        var row = new BidRow { Id = _next++, PublicId = Guid.NewGuid(), CategoryId = categoryId, Cents = cents, BuyNow = buyNow, Status = buyNow ? "accepted" : "open", At = at };
        Bids.Add((bookingId, row));
        return Task.FromResult(row);
    }

    public Task WithdrawBidAsync(long bookingId, long id, DateTime at, CancellationToken ct)
    {
        var row = Bids.First(b => b.BookingId == bookingId && b.Row.Id == id).Row;
        if (row.Status == "open") row.Status = "withdrawn";
        return Task.CompletedTask;
    }

    public Task<List<ClubRow>> ListClubsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Clubs.Where(c => c.Key.Item2 == bookingId).Select(c => c.Value).ToList());

    public Task SaveClubAsync(long bookingId, string clubId, string emergencyName, ClubRow club, DateTime at, CancellationToken ct)
    {
        Clubs[(club.ChildUserId, bookingId)] = club;
        return Task.CompletedTask;
    }

    public Task<bool> DeleteClubAsync(long bookingId, long childUserId, CancellationToken ct) => Task.FromResult(Clubs.Remove((childUserId, bookingId)));

    public Task<MedallionRow?> GetMedallionAsync(long bookingId, CancellationToken ct) => Task.FromResult(Medallions.GetValueOrDefault(bookingId));

    public Task SaveMedallionAsync(long bookingId, string stage, string trackingNumber, DateTime? activatedAt, DateTime? lostAt, CancellationToken ct)
    {
        Medallions[bookingId] = new MedallionRow { ActivatedAt = activatedAt, LostAt = lostAt };
        return Task.CompletedTask;
    }

    public Task<TagRow?> GetTagsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Tags.GetValueOrDefault(bookingId));

    public Task SaveTagsAsync(long bookingId, string way, string stage, DateTime orderedAt, DateTime? handedOverAt, CancellationToken ct)
    {
        Tags[bookingId] = new TagRow { Way = way, OrderedAt = orderedAt, HandedOverAt = handedOverAt };
        return Task.CompletedTask;
    }

    public Task<HashSet<string>> GetPrepAsync(long bookingId, CancellationToken ct) => Task.FromResult(Prep.Where(p => p.Item1 == bookingId).Select(p => p.Item2).ToHashSet());

    public Task SetPrepAsync(long bookingId, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        if (done) Prep.Add((bookingId, itemId));
        else Prep.Remove((bookingId, itemId));
        return Task.CompletedTask;
    }

    public Task<List<AdvisorAskRow>> ListAdvisorAsksAsync(long userId, CancellationToken ct) => Task.FromResult(Advisors.Where(a => a.UserId == userId).Select(a => a.Row).ToList());

    public Task AddAdvisorAskAsync(long userId, string advisorId, string way, string? phone, string question, string? reply, DateTime? callbackBy, DateTime at, CancellationToken ct)
    {
        Advisors.Add((userId, new AdvisorAskRow { Id = _next++, PublicId = Guid.NewGuid(), AdvisorId = advisorId, Way = way, Question = question, Reply = reply, CallbackBy = callbackBy, At = at }));
        return Task.CompletedTask;
    }

    public Task<List<MarketingConsentRow>> ListConsentsAsync(long userId, CancellationToken ct) => Task.FromResult(Consents.Where(c => c.UserId == userId).Select(c => c.Row).ToList());

    public Task SaveConsentAsync(long userId, MarketingConsentRow consent, byte[]? codeHash, DateTime? expiresAt, CancellationToken ct)
    {
        var hash = codeHash ?? Consents.FirstOrDefault(c => c.UserId == userId && c.Row.Channel == consent.Channel).Hash;
        Consents.RemoveAll(c => c.UserId == userId && c.Row.Channel == consent.Channel);
        Consents.Add((userId, consent, hash));
        return Task.CompletedTask;
    }

    public Task<bool> DeleteConsentAsync(long userId, string channel, CancellationToken ct) => Task.FromResult(Consents.RemoveAll(c => c.UserId == userId && c.Row.Channel == channel) > 0);

    public Task<List<FixCaseRow>> ListFixCasesAsync(long userId, CancellationToken ct) => Task.FromResult(Fixes.Where(f => f.UserId == userId).Select(f => f.Row).ToList());

    public Task AddFixCaseAsync(long userId, string flow, string note, string reference, DateTime contactBy, DateTime at, CancellationToken ct)
    {
        Fixes.Add((userId, new FixCaseRow { Id = _next++, PublicId = Guid.NewGuid(), Flow = flow, Note = note, Reference = reference, At = at }));
        return Task.CompletedTask;
    }

    public Task<List<AssistCaseRow>> ListAssistCasesAsync(long userId, CancellationToken ct) => Task.FromResult(Assists.Where(a => a.UserId == userId).Select(a => a.Row).ToList());

    public Task AddAssistCaseAsync(long userId, long? bookingId, AssistCaseRow row, CancellationToken ct)
    {
        row.Id = _next++;
        row.PublicId = Guid.NewGuid();
        Assists.Add((userId, row));
        return Task.CompletedTask;
    }

    public Task SetAssistChoiceAsync(long userId, long id, string choice, CancellationToken ct)
    {
        var row = Assists.First(a => a.UserId == userId && a.Row.Id == id).Row;
        row.Choice ??= choice;
        return Task.CompletedTask;
    }
}
