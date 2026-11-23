namespace Princess.Api.Data;

/// <summary>A day the guest used the app.</summary>
public sealed record StatsDay(DateOnly Day, int Seconds, int Views, int Opens);

/// <summary>Everything the stats page is worked out from, read in a few queries. Numbers default to zero, words to empty.</summary>
public sealed class StatsRaw
{
    public Dictionary<string, long> N { get; } = new();
    public Dictionary<string, string> T { get; } = new();
    public Dictionary<string, DateTime> D { get; } = new();
    public Dictionary<string, long> Counters { get; } = new();
    public List<StatsDay> Days { get; } = [];
    public long Get(string key) => N.TryGetValue(key, out var v) ? v : 0;
    public string Text(string key) => T.TryGetValue(key, out var v) ? v : "";
    public DateTime? Date(string key) => D.TryGetValue(key, out var v) ? v : null;
    public long Counter(string key) => Counters.TryGetValue(key, out var v) ? v : 0;
}

/// <summary>Reads and writes what the stats page needs. The counters are the app's own; the rest is read from tables that already exist.</summary>
public interface IStatsStore
{
    Task<StatsRaw> LoadAsync(long userId, Guid publicId, DateTime utcNow, CancellationToken ct);
    Task<HashSet<string>> CounterKeysAsync(long userId, CancellationToken ct);
    Task AddAsync(long userId, DateOnly day, IReadOnlyDictionary<string, long> counters, int seconds, int views, int opens, DateTime now, CancellationToken ct);
}
