using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;

namespace Princess.Api.Data;

/// <summary>
/// The user row read on every authenticated request (<see cref="DapperUserStore.FindByPublicIdAsync"/>), kept for a short time.
/// Anything that changes the user or profile calls <see cref="Invalidate"/>, which drops every entry at once: those writes (profile save,
/// password reset, sign-up) are rare, so clearing all is simpler than tracking keys and cannot leave a stale row behind.
/// The cache is per server instance, so the short TTL is the bound on staleness if another instance (or a hand-run SQL script) changes a user.
/// Login success and failure counters are not cached state: sign-in reads the user by identifier, which is never cached.
/// </summary>
public sealed class UserCache(IMemoryCache cache)
{
    public static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
    private CancellationTokenSource _generation = new();

    public async Task<UserRecord?> GetOrLoadAsync(Guid publicId, Func<Task<UserRecord?>> load)
    {
        var key = "user:" + publicId;
        if (cache.TryGetValue(key, out UserRecord? hit) && hit is not null) return hit.Copy();
        var token = Volatile.Read(ref _generation).Token; // taken before the read, so an Invalidate during the load discards the result
        var user = await load();
        if (user is null) return null;
        using (var entry = cache.CreateEntry(key))
        {
            entry.Value = user.Copy();
            entry.AbsoluteExpirationRelativeToNow = Ttl;
            entry.AddExpirationToken(new CancellationChangeToken(token));
        }
        return user;
    }

    public void Invalidate()
    {
        var old = Interlocked.Exchange(ref _generation, new CancellationTokenSource());
        old.Cancel();
        old.Dispose();
    }
}

/// <summary>
/// <c>ref.Sailings</c>: twelve rows, never written by the API and read on most booking and discovery paths.
/// <c>BookingOpen</c> is a manual close made in SQL, so the TTL is how long a close can take to show.
/// </summary>
public sealed class SailingCache(IMemoryCache cache)
{
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);
    private const string Key = "ref:sailings";

    public async Task<List<SailingRow>> GetOrLoadAsync(Func<Task<List<SailingRow>>> load)
    {
        if (cache.TryGetValue(Key, out List<SailingRow>? hit) && hit is not null) return Copy(hit);
        var rows = await load();
        cache.Set(Key, Copy(rows), Ttl);
        return rows;
    }

    public void Invalidate() => cache.Remove(Key);

    // Rows are mutable classes, so each caller gets its own copies.
    private static List<SailingRow> Copy(List<SailingRow> rows) => [.. rows.Select(r => r.Copy())];
}
