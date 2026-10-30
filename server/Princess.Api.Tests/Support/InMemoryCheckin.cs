using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 9 store in memory, over the same bookings as the rest of the world.</summary>
public sealed class InMemoryCheckinStore(InMemoryJourney world) : ICheckinStore
{
    public List<(long BookingId, CheckinStepRow Row)> Steps { get; } = [];
    public Dictionary<long, CheckinBookingRow> Bookings { get; } = [];
    public Dictionary<(long, long), PassRow> Passes { get; } = [];
    public Dictionary<long, EmbarkRow> Embark { get; } = [];
    public HashSet<(long, string, string)> Ticks { get; } = [];

    public Task<long?> FindBookingIdAsync(string number, CancellationToken ct) => Task.FromResult(world.Bookings.FirstOrDefault(b => b.Number == number)?.BookingId);

    public Task<List<CheckinStepRow>> ListStepsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Steps.Where(s => s.BookingId == bookingId).Select(s => s.Row).ToList());

    public Task SaveStepAsync(long bookingId, string step, IReadOnlyList<long> userIds, DateTime at, string dataJson, CancellationToken ct)
    {
        foreach (var userId in userIds)
        {
            Steps.RemoveAll(s => s.BookingId == bookingId && s.Row.UserId == userId && s.Row.Step == step);
            Steps.Add((bookingId, new CheckinStepRow { UserId = userId, Step = step, DoneAt = at, Data = dataJson }));
        }
        return Task.CompletedTask;
    }

    private CheckinBookingRow Row(long bookingId) => Bookings.TryGetValue(bookingId, out var r) ? r : Bookings[bookingId] = new CheckinBookingRow();

    public Task<CheckinBookingRow?> GetBookingAsync(long bookingId, CancellationToken ct) => Task.FromResult(Bookings.GetValueOrDefault(bookingId));

    public Task SavePaymentAsync(long bookingId, long cardId, string label, DateTime at, CancellationToken ct)
    {
        var r = Row(bookingId);
        (r.PaymentCardId, r.PaymentLabel, r.PaymentAt) = (cardId, label, at);
        return Task.CompletedTask;
    }

    public Task SaveArrivalAsync(long bookingId, string windowId, DateTime at, CancellationToken ct)
    {
        Row(bookingId).ArrivalAt = at;
        return Task.CompletedTask;
    }

    public Task FinishAsync(long bookingId, DateTime at, CancellationToken ct)
    {
        Row(bookingId).FinishedAt = at;
        return Task.CompletedTask;
    }

    public Task<List<PassRow>> ListPassesAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Passes.Where(p => p.Key.Item1 == bookingId).Select(p => p.Value).OrderBy(p => p.Seq).ToList());

    public Task SavePassesAsync(long bookingId, IReadOnlyList<PassRow> passes, DateTime at, CancellationToken ct)
    {
        foreach (var p in passes)
            Passes[(bookingId, p.UserId)] = new PassRow { UserId = p.UserId, Seq = p.Seq, Code = p.Code, InWallet = Passes.GetValueOrDefault((bookingId, p.UserId))?.InWallet ?? false };
        return Task.CompletedTask;
    }

    public Task SetWalletAsync(long bookingId, CancellationToken ct)
    {
        foreach (var p in Passes.Where(p => p.Key.Item1 == bookingId)) p.Value.InWallet = true;
        return Task.CompletedTask;
    }

    public Task<EmbarkRow?> GetEmbarkAsync(long bookingId, CancellationToken ct) => Task.FromResult(Embark.GetValueOrDefault(bookingId));

    public Task<HashSet<string>> ListTicksAsync(long bookingId, string kind, CancellationToken ct) =>
        Task.FromResult(Ticks.Where(t => t.Item1 == bookingId && t.Item2 == kind).Select(t => t.Item3).ToHashSet());

    public Task SetTickAsync(long bookingId, string kind, string itemId, bool done, CancellationToken ct)
    {
        if (done) Ticks.Add((bookingId, kind, itemId)); else Ticks.Remove((bookingId, kind, itemId));
        return Task.CompletedTask;
    }

    public Task SetBagsAsync(long bookingId, DateTime? droppedAt, CancellationToken ct)
    {
        if (!Embark.TryGetValue(bookingId, out var e)) Embark[bookingId] = e = new EmbarkRow();
        e.LuggageDroppedAt = droppedAt;
        return Task.CompletedTask;
    }
}
