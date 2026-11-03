namespace Princess.Api.Domain;

/// <summary>
/// The length, booking state and per-night fares of every sailing, read from <c>ref.Sailings</c> and <c>ref.SailingFares</c> and set whenever the sailings are loaded.
/// <see cref="Pricing"/> asks it for any sailing that is not in its older code tables, so price and length live in data. Empty until the first load (tests, a cold start).
/// </summary>
public static class FareBook
{
    private sealed record Entry(int Nights, bool Open, IReadOnlyDictionary<string, long> PerNight);

    private static volatile IReadOnlyDictionary<string, Entry> _book = new Dictionary<string, Entry>();

    public static void Set(IEnumerable<(string Id, int Nights, bool Open)> sailings, IEnumerable<(string SailingId, string CategoryId, long PerNightCents)> fares)
    {
        var byId = fares.GroupBy(f => f.SailingId).ToDictionary(g => g.Key, g => (IReadOnlyDictionary<string, long>)g.ToDictionary(x => x.CategoryId, x => x.PerNightCents));
        _book = sailings.ToDictionary(s => s.Id, s => new Entry(s.Nights, s.Open, byId.GetValueOrDefault(s.Id) ?? new Dictionary<string, long>()));
    }

    public static void Clear() => _book = new Dictionary<string, Entry>();

    public static int? Nights(string sailingId) => _book.TryGetValue(sailingId, out var e) ? e.Nights : null;

    /// <summary>Open for booking and priced: it has an interior fare.</summary>
    public static bool Offered(string sailingId) => _book.TryGetValue(sailingId, out var e) && e.Open && e.PerNight.ContainsKey("interior");

    /// <summary>The fare per person per night for two sharing, in cents.</summary>
    public static long? PerNight(string sailingId, string category) =>
        _book.TryGetValue(sailingId, out var e) && e.PerNight.TryGetValue(category, out var c) ? c : null;
}
