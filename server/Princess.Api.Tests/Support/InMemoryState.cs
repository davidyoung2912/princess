using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

public sealed class InMemoryStateStore : IStateStore
{
    public Dictionary<(bool Booking, long Owner, string Key), StateRow> Rows { get; } = [];

    public Task<List<StateRow>> ListAsync(bool booking, long ownerId, CancellationToken ct) =>
        Task.FromResult(Rows.Where(r => r.Key.Booking == booking && r.Key.Owner == ownerId).Select(r => r.Value).OrderBy(r => r.Key, StringComparer.Ordinal).ToList());

    public Task<StateRow?> GetAsync(bool booking, long ownerId, string key, CancellationToken ct) =>
        Task.FromResult(Rows.GetValueOrDefault((booking, ownerId, key)));

    public Task<StateRow?> SaveAsync(bool booking, long ownerId, string key, string json, int baseVersion, DateTime now, CancellationToken ct)
    {
        var id = (booking, ownerId, key);
        var current = Rows.GetValueOrDefault(id)?.Version ?? 0;
        if (current != baseVersion) return Task.FromResult<StateRow?>(null);
        var row = new StateRow(key, current + 1, json, now);
        Rows[id] = row;
        return Task.FromResult<StateRow?>(row);
    }

    public Task DeleteAsync(bool booking, long ownerId, string key, CancellationToken ct)
    {
        Rows.Remove((booking, ownerId, key));
        return Task.CompletedTask;
    }

    public Task<int> DeleteAllAsync(bool booking, long ownerId, CancellationToken ct) =>
        Task.FromResult(Rows.Keys.Where(k => k.Booking == booking && k.Owner == ownerId).ToList().Count(k => Rows.Remove(k)));
}
