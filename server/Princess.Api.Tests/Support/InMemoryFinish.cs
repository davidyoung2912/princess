using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 11 store in memory. Account lines go through the shipboard store to the on-board folio, so the account reads them back as the database would.</summary>
public sealed class InMemoryFinishStore(InMemoryShipboardStore shipboard) : IFinishStore
{
    private long _next = 1;
    private readonly Dictionary<long, int> _fccSeq = [];

    public Dictionary<long, ChoiceRow> Choices { get; } = [];
    public Dictionary<long, CustomsRow> Customs { get; } = [];
    public Dictionary<long, List<CelebrationRow>> Celebrations { get; } = [];
    public Dictionary<long, OnwardRow> Onward { get; } = [];
    public Dictionary<(long BookingId, string Item), bool> Ticks { get; } = [];
    public Dictionary<long, FinalBillRow> Bills { get; } = [];
    public List<(long BookingId, CaseRow Row)> Cases { get; } = [];
    public Dictionary<long, FeedbackRow> Feedback { get; } = [];
    public List<(long UserId, HistoryTripRow Row)> Trips { get; } = [];
    public Dictionary<long, LoyaltyRecordRow> Loyalty { get; } = [];
    public List<(long BookingId, long UserId, HoldRow Row)> Holds { get; } = [];
    public List<(long UserId, long Id, long Remaining, DateOnly ExpiresOn)> Credits { get; } = [];
    public Dictionary<long, long> Converted { get; } = [];
    public Dictionary<DateTime, int> Slots { get; } = [];
    public Dictionary<long, DateTime> Appointments { get; } = [];

    public Task<ChoiceRow?> GetChoiceAsync(long bookingId, CancellationToken ct) => Task.FromResult(Choices.GetValueOrDefault(bookingId));

    public Task SaveChoiceAsync(long bookingId, string option, bool tagsOn, IReadOnlyDictionary<long, int> bags, DateTime at, CancellationToken ct)
    {
        Choices[bookingId] = new ChoiceRow { Option = option, TagsOn = tagsOn, DecidedAt = at, Bags = new Dictionary<long, int>(bags) };
        return Task.CompletedTask;
    }

    public Task SetTagsOnAsync(long bookingId, bool on, CancellationToken ct)
    {
        if (Choices.TryGetValue(bookingId, out var c)) c.TagsOn = on;
        return Task.CompletedTask;
    }

    public Task<List<CelebrationRow>> ListCelebrationsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Celebrations.GetValueOrDefault(bookingId)?.ToList() ?? []);

    public Task SaveCelebrationsAsync(long bookingId, IReadOnlyList<CelebrationRow> rows, CancellationToken ct)
    {
        Celebrations[bookingId] = rows.ToList();
        return Task.CompletedTask;
    }

    public Dictionary<long, List<ThanksRow>> ThanksRows { get; } = [];
    public Dictionary<long, List<WishRow>> WishRows { get; } = [];

    public Task<List<ThanksRow>> ListThanksAsync(long bookingId, CancellationToken ct) => Task.FromResult(ThanksRows.GetValueOrDefault(bookingId)?.ToList() ?? []);

    public Task AddThanksAsync(long bookingId, ThanksRow row, CancellationToken ct)
    {
        if (!ThanksRows.TryGetValue(bookingId, out var list)) ThanksRows[bookingId] = list = [];
        list.Add(row);
        return Task.CompletedTask;
    }

    public Task<List<WishRow>> ListWishesAsync(long bookingId, CancellationToken ct) => Task.FromResult(WishRows.GetValueOrDefault(bookingId)?.ToList() ?? []);

    public Task AddWishAsync(long bookingId, WishRow row, CancellationToken ct)
    {
        if (!WishRows.TryGetValue(bookingId, out var list)) WishRows[bookingId] = list = [];
        list.Add(row);
        return Task.CompletedTask;
    }

    public Task<CustomsRow?> GetCustomsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Customs.GetValueOrDefault(bookingId));

    public Task SaveCustomsAsync(long bookingId, string json, DateTime at, CancellationToken ct)
    {
        Customs[bookingId] = new CustomsRow { Json = json, SubmittedAt = at };
        return Task.CompletedTask;
    }

    public Task<OnwardRow?> GetOnwardAsync(long bookingId, CancellationToken ct) => Task.FromResult(Onward.GetValueOrDefault(bookingId));

    public Task SaveOnwardAsync(long bookingId, OnwardRow plan, CancellationToken ct)
    {
        Onward[bookingId] = plan;
        return Task.CompletedTask;
    }

    public Task<HashSet<string>> ListNightTicksAsync(long bookingId, CancellationToken ct) => Task.FromResult(Ticks.Where(t => t.Key.BookingId == bookingId && t.Value).Select(t => t.Key.Item).ToHashSet());

    public Task SetNightTickAsync(long bookingId, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        Ticks[(bookingId, itemId)] = done;
        return Task.CompletedTask;
    }

    public Task<FinalBillRow?> GetFinalBillAsync(long bookingId, CancellationToken ct) => Task.FromResult(Bills.GetValueOrDefault(bookingId));

    private FinalBillRow Bill(long bookingId) => Bills.TryGetValue(bookingId, out var b) ? b : Bills[bookingId] = new FinalBillRow();

    public Task SaveTipAsync(long bookingId, int keepPercent, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        Bill(bookingId).TipKeepPercent = keepPercent;
        shipboard.Replace(bookingId, "tip", bookingId, folio);
        return Task.CompletedTask;
    }

    public Task SaveEmailedAsync(long bookingId, DateTime at, string to, CancellationToken ct)
    {
        var b = Bill(bookingId);
        b.EmailedAt = at;
        b.EmailedTo = to;
        return Task.CompletedTask;
    }

    public Task<List<CaseRow>> ListCasesAsync(long bookingId, CancellationToken ct) => Task.FromResult(Cases.Where(c => c.BookingId == bookingId).Select(c => c.Row).OrderByDescending(c => c.OpenedAt).ToList());

    public Task<CaseRow?> AddCaseAsync(long bookingId, CaseRow row, CancellationToken ct)
    {
        if (Cases.Any(c => c.Row.Number == row.Number)) return Task.FromResult<CaseRow?>(null);
        row.PublicId = Guid.NewGuid();
        Cases.Add((bookingId, row));
        return Task.FromResult<CaseRow?>(row);
    }

    public Task<bool> WithdrawCaseAsync(long bookingId, Guid publicId, DateTime at, CancellationToken ct)
    {
        var row = Cases.FirstOrDefault(c => c.BookingId == bookingId && c.Row.PublicId == publicId).Row;
        if (row is null || row.WithdrawnAt is not null) return Task.FromResult(false);
        row.WithdrawnAt = at;
        return Task.FromResult(true);
    }

    public Task<FeedbackRow?> GetFeedbackAsync(long bookingId, CancellationToken ct) => Task.FromResult(Feedback.GetValueOrDefault(bookingId));

    public Task SaveFeedbackAsync(long bookingId, string json, DateTime at, DateTime editUntil, CancellationToken ct)
    {
        Feedback[bookingId] = new FeedbackRow { Json = json, SubmittedAt = at, EditUntil = editUntil };
        return Task.CompletedTask;
    }

    public Task<List<HistoryTripRow>> ListHistoryTripsAsync(long userId, CancellationToken ct) => Task.FromResult(Trips.Where(t => t.UserId == userId).Select(t => t.Row).OrderByDescending(t => t.Departure).ToList());

    public Task<LoyaltyRecordRow?> GetLoyaltyAsync(long userId, CancellationToken ct) => Task.FromResult(Loyalty.GetValueOrDefault(userId));

    public Task<List<HoldRow>> ListHoldsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Holds.Where(h => h.BookingId == bookingId).Select(h => h.Row).OrderBy(h => h.PlacedAt).ThenBy(h => h.Id).ToList());

    public Task<HoldRow> AddHoldAsync(long bookingId, long userId, HoldRow hold, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        hold.Id = _next++;
        hold.PublicId = Guid.NewGuid();
        Holds.Add((bookingId, userId, hold));
        if (folio.Count > 0) shipboard.Replace(bookingId, "hold", hold.Id, folio);
        return Task.FromResult(hold);
    }

    public Task<bool> ReleaseHoldAsync(long bookingId, Guid publicId, CancellationToken ct)
    {
        var found = Holds.FirstOrDefault(h => h.BookingId == bookingId && h.Row.PublicId == publicId);
        if (found.Row is null) return Task.FromResult(false);
        shipboard.Replace(bookingId, "hold", found.Row.Id, []);
        Holds.Remove(found);
        return Task.FromResult(true);
    }

    public Task<long> FccLeftAsync(long userId, DateOnly today, CancellationToken ct) => Task.FromResult(Credits.Where(c => c.UserId == userId && c.ExpiresOn >= today).Sum(c => c.Remaining));

    public Task<long> FccConvertedAsync(long bookingId, CancellationToken ct) => Task.FromResult(Converted.GetValueOrDefault(bookingId));

    public Task ConvertFccAsync(long bookingId, long userId, long cents, DateOnly today, IReadOnlyList<FolioWrite> folio, CancellationToken ct)
    {
        var left = cents;
        for (var i = 0; i < Credits.Count && left > 0; i++)
        {
            var c = Credits[i];
            if (c.UserId != userId || c.ExpiresOn < today || c.Remaining <= 0) continue;
            var take = Math.Min(left, c.Remaining);
            Credits[i] = c with { Remaining = c.Remaining - take };
            left -= take;
        }
        Converted[bookingId] = Converted.GetValueOrDefault(bookingId) + cents;
        _fccSeq[bookingId] = _fccSeq.GetValueOrDefault(bookingId) + 1;
        shipboard.Replace(bookingId, "fcc", _fccSeq[bookingId], folio);
        return Task.CompletedTask;
    }

    public Task<List<DeskSlotRow>> ListDeskSlotsAsync(DateTime fromLocal, DateTime toLocal, CancellationToken ct) =>
        Task.FromResult(Slots.Where(s => s.Key >= fromLocal && s.Key <= toLocal).OrderBy(s => s.Key).Select(s => new DeskSlotRow(s.Key, s.Value, Appointments.Count(a => a.Value == s.Key))).ToList());

    public Task<DateTime?> GetAppointmentAsync(long bookingId, CancellationToken ct) => Task.FromResult<DateTime?>(Appointments.TryGetValue(bookingId, out var at) ? at : null);

    public Task<bool> BookSlotAsync(long bookingId, DateTime atLocal, CancellationToken ct)
    {
        if (!Slots.TryGetValue(atLocal, out var capacity) || Appointments.Count(a => a.Value == atLocal && a.Key != bookingId) >= capacity) return Task.FromResult(false);
        Appointments[bookingId] = atLocal;
        return Task.FromResult(true);
    }

    public Task CancelSlotAsync(long bookingId, CancellationToken ct)
    {
        Appointments.Remove(bookingId);
        return Task.CompletedTask;
    }
}
