using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>The Phase 10 store in memory.</summary>
public sealed class InMemoryOnboardStore : IOnboardStore
{
    public HashSet<(long UserId, string SailingId, string EventId, int Day)> Plan { get; } = [];
    public Dictionary<(long BookingId, long UserId), DateTime> Muster { get; } = [];
    public List<(long BookingId, FolioRow Row)> Folio { get; } = [];
    public List<(long BookingId, ServiceThreadRow Thread)> Threads { get; } = [];
    private long _next = 1;

    public Task<List<PlanEventRow>> ListPlanAsync(long userId, string sailingId, CancellationToken ct) =>
        Task.FromResult(Plan.Where(p => p.UserId == userId && p.SailingId == sailingId).OrderBy(p => p.Day).Select(p => new PlanEventRow { EventId = p.EventId, Day = p.Day }).ToList());

    public Task SetPlanAsync(long userId, string sailingId, string eventId, int day, bool on, CancellationToken ct)
    {
        if (on) Plan.Add((userId, sailingId, eventId, day)); else Plan.Remove((userId, sailingId, eventId, day));
        return Task.CompletedTask;
    }

    public Task<Dictionary<long, DateTime>> ListMusterAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Muster.Where(m => m.Key.BookingId == bookingId).ToDictionary(m => m.Key.UserId, m => m.Value));

    public Task SaveMusterAsync(long bookingId, IReadOnlyList<long> userIds, long byUserId, DateTime at, CancellationToken ct)
    {
        foreach (var u in userIds) Muster.TryAdd((bookingId, u), at);
        return Task.CompletedTask;
    }

    public Task<List<FolioRow>> ListFolioAsync(long bookingId, CancellationToken ct) => Task.FromResult(Folio.Where(f => f.BookingId == bookingId).Select(f => f.Row).OrderBy(f => f.At).ToList());

    public Task<List<ServiceThreadRow>> ListThreadsAsync(long bookingId, CancellationToken ct) => Task.FromResult(Threads.Where(t => t.BookingId == bookingId).Select(t => t.Thread).ToList());

    private ServiceThreadRow ThreadFor(long bookingId, string channel)
    {
        var found = Threads.FirstOrDefault(t => t.BookingId == bookingId && t.Thread.Channel == channel).Thread;
        if (found is not null) return found;
        var row = new ServiceThreadRow { Channel = channel };
        Threads.Add((bookingId, row));
        return row;
    }

    public Task AddServiceMessageAsync(long bookingId, string channel, string text, DateTime at, CancellationToken ct)
    {
        ThreadFor(bookingId, channel).Messages.Add(new ServiceMessageRow { Id = _next++, Text = text, At = at });
        return Task.CompletedTask;
    }

    public Task EscalateAsync(long bookingId, string channel, string phone, DateTime at, CancellationToken ct)
    {
        var t = ThreadFor(bookingId, channel);
        (t.EscalatedPhone, t.EscalatedAt) = (phone, at);
        return Task.CompletedTask;
    }
}
