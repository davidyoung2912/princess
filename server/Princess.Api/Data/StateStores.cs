namespace Princess.Api.Data;

public sealed record StateRow(string Key, int Version, string Json, DateTime UpdatedAt);

/// <summary>Documents kept per person or per booking. A save names the version it was based on and fails (null) if another device saved first.</summary>
public interface IStateStore
{
    Task<List<StateRow>> ListAsync(bool booking, long ownerId, CancellationToken ct);
    Task<StateRow?> GetAsync(bool booking, long ownerId, string key, CancellationToken ct);
    /// <summary>One document key for several owners in a single read, by owner id; owners without it are absent. The default asks one owner at a time; a database store overrides it with one query.</summary>
    async Task<Dictionary<long, StateRow>> GetManyAsync(bool booking, IReadOnlyCollection<long> ownerIds, string key, CancellationToken ct)
    {
        var found = new Dictionary<long, StateRow>();
        foreach (var id in ownerIds.Distinct()) if (await GetAsync(booking, id, key, ct) is { } row) found[id] = row;
        return found;
    }
    Task<StateRow?> SaveAsync(bool booking, long ownerId, string key, string json, int baseVersion, DateTime now, CancellationToken ct);
    Task DeleteAsync(bool booking, long ownerId, string key, CancellationToken ct);
    /// <summary>Every document of the owner; returns how many were removed.</summary>
    Task<int> DeleteAllAsync(bool booking, long ownerId, CancellationToken ct);
}
