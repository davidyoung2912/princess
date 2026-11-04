namespace Princess.Api.Domain;

/// <summary>
/// The length, booking state and per-night fares of every sailing, read from <c>ref.Sailings</c> and <c>ref.SailingFares</c> and set whenever the sailings are loaded.
/// <see cref="Pricing"/> asks it for any sailing that is not in its older code tables, so price and length live in data. Empty until the first load (tests, a cold start).
/// </summary>
/// <summary>A stateroom category of a ship, as the catalogue holds it (<c>ref.CabinCategories</c>).</summary>
public sealed record ShipCategory(string Id, string ShipId, string Name, bool Suite, int Capacity, int SizeSqFt, string Description, int SortOrder);

public static class FareBook
{
    private sealed record Entry(int Nights, bool Open, IReadOnlyDictionary<string, long> PerNight);

    private static volatile IReadOnlyDictionary<string, Entry> _book = new Dictionary<string, Entry>();
    private static volatile IReadOnlyDictionary<string, string> _ships = new Dictionary<string, string>();
    private static volatile IReadOnlyList<ShipCategory> _categories = [];

    /// <summary>Which ship each sailing runs on and every ship's stateroom categories, so a sailing is priced and offered in its own ship's categories.</summary>
    public static void SetShips(IEnumerable<(string SailingId, string ShipId)> sailings, IEnumerable<ShipCategory> categories)
    {
        _ships = sailings.ToDictionary(s => s.SailingId, s => s.ShipId);
        _categories = [.. categories.OrderBy(c => c.SortOrder).ThenBy(c => c.Id, StringComparer.Ordinal)];
    }

    public static void Set(IEnumerable<(string Id, int Nights, bool Open)> sailings, IEnumerable<(string SailingId, string CategoryId, long PerNightCents)> fares)
    {
        var byId = fares.GroupBy(f => f.SailingId).ToDictionary(g => g.Key, g => (IReadOnlyDictionary<string, long>)g.ToDictionary(x => x.CategoryId, x => x.PerNightCents));
        _book = sailings.ToDictionary(s => s.Id, s => new Entry(s.Nights, s.Open, byId.GetValueOrDefault(s.Id) ?? new Dictionary<string, long>()));
    }

    public static void Clear() { _book = new Dictionary<string, Entry>(); _ships = new Dictionary<string, string>(); _categories = []; }

    public static int? Nights(string sailingId) => _book.TryGetValue(sailingId, out var e) ? e.Nights : null;

    /// <summary>Open for booking and priced: it has a fare for at least one room type.</summary>
    public static bool Offered(string sailingId) => _book.TryGetValue(sailingId, out var e) && e.Open && e.PerNight.Count > 0;

    /// <summary>Priced in data, open or not (a sailing people can look at but not yet book still has sample prices).</summary>
    public static bool Priced(string sailingId) => _book.TryGetValue(sailingId, out var e) && e.PerNight.Count > 0;

    /// <summary>The stateroom categories of the ship a sailing runs on, in the ship's order; empty when the sailing's ship is not known.</summary>
    public static IReadOnlyList<ShipCategory> CategoriesOf(string sailingId) =>
        _ships.TryGetValue(sailingId, out var ship) ? [.. _categories.Where(c => c.ShipId == ship)] : [];

    public static ShipCategory? Category(string? id) => _categories.FirstOrDefault(c => c.Id == id);

    /// <summary>The category with the lowest fare on a sailing (the "from" price), or null when it has no fares.</summary>
    public static string? Cheapest(string sailingId) =>
        _book.TryGetValue(sailingId, out var e) && e.PerNight.Count > 0 ? e.PerNight.OrderBy(x => x.Value).ThenBy(x => x.Key, StringComparer.Ordinal).First().Key : null;

    /// <summary>The fare per person per night for two sharing, in cents.</summary>
    public static long? PerNight(string sailingId, string category) =>
        _book.TryGetValue(sailingId, out var e) && e.PerNight.TryGetValue(category, out var c) ? c : null;
}
