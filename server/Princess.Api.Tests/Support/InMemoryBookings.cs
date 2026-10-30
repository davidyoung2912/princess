using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 7 store over the same in-memory world as Phase 6, so a booking made through the API shows up in trips, payments and membership checks.</summary>
public sealed class InMemoryBookingStore(InMemoryJourney world, InMemoryAccessStore access) : IBookingStore
{
    public Dictionary<long, DraftRecord> Drafts { get; } = [];
    public Dictionary<long, LoyaltyRecord> Loyalty { get; } = [];
    public List<(string DraftId, string Via, string To, string Token)> ResumeLinks { get; } = [];
    public Dictionary<long, BookingDetail> Details { get; } = [];
    public Dictionary<Guid, List<ReceiptPartRow>> Parts { get; } = [];
    public Dictionary<string, (long UserId, string Route, string Result)> Keys { get; } = [];
    public string? DraftIdOf(long userId) => Drafts.GetValueOrDefault(userId)?.Id;
    private readonly Dictionary<string, string> _draftOf = [];
    private long _nextBooking = 5000;

    public Task<DraftRecord?> GetDraftAsync(long userId, CancellationToken ct) => Task.FromResult(Drafts.GetValueOrDefault(userId));

    public Task<DraftRecord> SaveDraftAsync(long userId, DraftRecord d, string newId, DateTime now, CancellationToken ct)
    {
        d.Id = Drafts.GetValueOrDefault(userId)?.Id ?? newId;
        d.UpdatedAt = now;
        Drafts[userId] = d;
        return Task.FromResult(d);
    }

    public Task DeleteDraftAsync(long userId, CancellationToken ct)
    {
        Drafts.Remove(userId);
        return Task.CompletedTask;
    }

    public Task AddResumeLinkAsync(string draftId, string via, string toMasked, string token, DateTime sentAt, DateTime expiresAt, CancellationToken ct)
    {
        ResumeLinks.Add((draftId, via, toMasked, token));
        return Task.CompletedTask;
    }

    public Task<LoyaltyRecord> GetLoyaltyAsync(long userId, DateOnly today, CancellationToken ct) => Task.FromResult(Loyalty.GetValueOrDefault(userId) ?? new LoyaltyRecord());

    public Task<BookingRow?> FindByDraftAsync(string draftId, CancellationToken ct) =>
        Task.FromResult(_draftOf.TryGetValue(draftId, out var number) ? world.Bookings.FirstOrDefault(b => b.Number == number) : null);

    public Task<bool> NumberTakenAsync(string number, CancellationToken ct) => Task.FromResult(world.Bookings.Any(b => b.Number == number));

    public Task<HashSet<string>> TakenCabinsAsync(string sailingId, CancellationToken ct) =>
        Task.FromResult(world.Bookings.Where(b => b.SailingId == sailingId && b.Status == "confirmed" && b.CabinNumber is not null).Select(b => b.CabinNumber!).ToHashSet());

    public Task<long> CreateBookingAsync(NewBooking n, CancellationToken ct)
    {
        if (_draftOf.ContainsKey(n.DraftId) || world.Bookings.Any(b => b.Number == n.Number)) throw ApiException.Conflict("duplicate");
        var id = _nextBooking++;
        var sailing = world.Sailings.First(s => s.Id == n.SailingId);
        var category = Pricing.Category(n.CategoryId)!;
        var row = new BookingRow
        {
            BookingId = id, Number = n.Number, Kind = "direct", BookerUserId = n.BookerUserId, SailingId = n.SailingId, SailingTitle = "Western Caribbean", ShipName = "Sun Princess",
            Departure = sailing.Departure, Nights = sailing.Nights, CategoryId = n.CategoryId, CategoryName = category.Name, FareId = n.FareId, CabinNumber = n.CabinNumber, Status = "confirmed",
            TotalCents = n.TotalCents, DepositCents = n.DepositCents, FinalDueDate = n.FinalDueDate, ConfirmedAt = n.ConfirmedAt, GuestAccounts = 1, GuestDetails = n.Guests.Count,
        };
        world.Bookings.Add(row);
        world.Party[id] = [new GuestRow { UserId = n.BookerUserId, PublicId = Guid.NewGuid(), FirstName = n.Guests[0].FirstName, LastName = n.Guests[0].LastName, Dob = n.Guests[0].Dob, Seq = 1 }];
        access.Members.Add((n.BookerUserId, new BookingMembership { BookingId = id, Number = n.Number, BookerUserId = n.BookerUserId, IsLead = true }));
        Details[id] = new BookingDetail
        {
            Row = row, Dining = n.Dining, Occasion = n.Occasion, ContactEmail = n.ContactEmail, ContactPhone = n.ContactPhone, FinalPaymentDays = n.FinalPaymentDays,
            Guests = n.Guests, Acceptances = n.Acceptances, Notified = n.Notified,
        };
        _draftOf[n.DraftId] = n.Number;
        if (n.CreditUsedCents > 0)
        {
            var l = Loyalty[n.BookerUserId];
            if (l.CreditLeftCents < n.CreditUsedCents) throw ApiException.Conflict("priceChanged");
            l.CreditLeftCents -= n.CreditUsedCents;
        }
        Record(id, n.Payment);
        return Task.FromResult(id);
    }

    private void Record(long bookingId, NewBookingPayment p)
    {
        var first = p.Parts.FirstOrDefault();
        var row = new PaymentRow
        {
            PublicId = Guid.NewGuid(), Label = p.Label, AmountCents = p.AmountCents, At = p.At, Status = "captured", Method = first?.Method, CardBrand = first?.CardBrand, Last4 = first?.Last4,
        };
        world.Payments.Add((bookingId, row, p.UserId));
        Parts[row.PublicId] = [.. p.Parts.Select(x => new ReceiptPartRow(x.Method, x.CardBrand, x.Last4, x.Cents))];
        world.Bookings.First(b => b.BookingId == bookingId).PaidCents += p.AmountCents;
    }

    public Task<BookingDetail?> GetDetailAsync(long bookingId, CancellationToken ct)
    {
        var row = world.Bookings.FirstOrDefault(b => b.BookingId == bookingId);
        if (row is null) return Task.FromResult<BookingDetail?>(null);
        if (!Details.TryGetValue(bookingId, out var detail)) Details[bookingId] = detail = new BookingDetail { Row = row };
        detail.Row = row;
        detail.Receipts = [.. world.Payments.Where(p => p.BookingId == bookingId && p.Row.Label is "deposit" or "full" or "balance" or "refund").OrderBy(p => p.Row.At).Select(p => new ReceiptRow
        {
            PublicId = p.Row.PublicId, Label = p.Row.Label, AmountCents = p.Row.AmountCents, At = p.Row.At, Status = p.Row.Status, Parts = Parts.GetValueOrDefault(p.Row.PublicId)
                ?? (p.Row.CardBrand is null ? [] : [new ReceiptPartRow("card", p.Row.CardBrand, p.Row.Last4, p.Row.AmountCents)]),
        })];
        return Task.FromResult<BookingDetail?>(detail);
    }

    public Task AddPaymentAsync(long bookingId, NewBookingPayment payment, CancellationToken ct)
    {
        Record(bookingId, payment);
        return Task.CompletedTask;
    }

    public Task ChangeSailingAsync(SailingChange c, CancellationToken ct)
    {
        var row = world.Bookings.First(b => b.BookingId == c.BookingId);
        var sailing = world.Sailings.First(s => s.Id == c.SailingId);
        row.SailingId = c.SailingId;
        row.Departure = sailing.Departure;
        row.TotalCents = c.TotalCents;
        row.DepositCents = c.DepositCents;
        row.FinalDueDate = c.FinalDueDate;
        row.CabinNumber = c.CabinNumber;
        if (c.Refund is not null) Record(c.BookingId, c.Refund);
        return Task.CompletedTask;
    }

    public Task CancelAsync(Cancellation x, CancellationToken ct)
    {
        var row = world.Bookings.First(b => b.BookingId == x.BookingId);
        row.Status = "cancelled";
        if (!Details.TryGetValue(x.BookingId, out var detail)) Details[x.BookingId] = detail = new BookingDetail { Row = row };
        detail.CancelledAt = x.At;
        detail.CancelFeeCents = x.FeeCents;
        detail.CancelRefundCents = x.RefundCents;
        if (x.Refund is not null) Record(x.BookingId, x.Refund);
        return Task.CompletedTask;
    }

    public Task<string?> FindIdempotentAsync(string key, long userId, string route, CancellationToken ct)
    {
        if (!Keys.TryGetValue(key, out var k)) return Task.FromResult<string?>(null);
        if (k.UserId != userId || k.Route != route) throw ApiException.Conflict("idempotencyKey");
        return Task.FromResult<string?>(k.Result);
    }

    public Task SaveIdempotentAsync(string key, long userId, string route, string result, DateTime now, CancellationToken ct)
    {
        Keys.TryAdd(key, (userId, route, result));
        return Task.CompletedTask;
    }
}
