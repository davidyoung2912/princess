using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

public sealed class InMemoryPortRowStore : IPortRowStore
{
    public Dictionary<(long Booking, string Kind, string Key), PortRowRow> Rows { get; } = [];

    public Task<List<PortRowRow>> ListAsync(long bookingId, CancellationToken ct) =>
        Task.FromResult(Rows.Where(r => r.Key.Booking == bookingId).Select(r => r.Value).OrderBy(r => r.Kind, StringComparer.Ordinal).ThenBy(r => r.Key, StringComparer.Ordinal).ToList());

    public Task ApplyAsync(long bookingId, IReadOnlyList<PortRowRow> ops, DateTime now, CancellationToken ct)
    {
        foreach (var o in ops)
        {
            var id = (bookingId, o.Kind, o.Key);
            if (!Rows.TryGetValue(id, out var current) || o.At > current.At) Rows[id] = o;
        }
        return Task.CompletedTask;
    }

    public Task<int> PurgeAsync(long bookingId, long beforeAt, CancellationToken ct) =>
        Task.FromResult(Rows.Where(r => r.Key.Booking == bookingId && r.Value.Deleted && r.Value.At < beforeAt).Select(r => r.Key).ToList().Count(k => Rows.Remove(k)));
}
