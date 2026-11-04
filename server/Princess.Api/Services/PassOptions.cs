using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Princess.Api.Services;

/// <summary>Boarding pass settings. <c>SigningKey</c> is a secret (user-secrets or an environment variable); when empty the pass key is derived from <c>Jwt:SigningKey</c>.</summary>
public sealed class PassOptions
{
    public const string Section = "Passes";

    public string SigningKey { get; set; } = "";
    /// <summary>Misses on one booking number in the window before the public lookup refuses it.</summary>
    [Range(1, 1000)] public int MaxLookupMisses { get; set; } = 5;
    /// <summary>Both the window the misses are counted in and how long the booking number then stays locked.</summary>
    [Range(1, 1440)] public int LookupLockoutMinutes { get; set; } = 15;
}

/// <summary>
/// Counts misses per booking number on the public pass lookup, whoever asks, so a number cannot be ground through however many addresses are used.
/// A locked number answers the same notFound as any other miss. Held in memory, so it is per process: with several instances each keeps its own count.
/// </summary>
public sealed class PassLookupGuard(IMemoryCache cache, IOptions<PassOptions> options)
{
    private sealed class Count { public int Misses; }

    private static string Key(string number) => $"pass-lookup:{number}";

    public bool IsLocked(string number) => cache.TryGetValue(Key(number), out Count? c) && c is not null && c.Misses >= options.Value.MaxLookupMisses;

    public void Failed(string number)
    {
        var o = options.Value;
        var key = Key(number);
        var c = cache.GetOrCreate(key, e => { e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(o.LookupLockoutMinutes); return new Count(); })!;
        lock (c) c.Misses++;
    }

    public void Succeeded(string number) => cache.Remove(Key(number));
}
