using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// One ship's dining as the app reads it: the dining rooms (<c>Venues</c>), the directory with dishes tagged for allergens and diets (<c>Directory</c>), the room-service
/// and delivery menu (<c>Menu</c>) and the places the crew deliver to on deck. <c>Version</c> changes when the content does.
/// </summary>
public sealed record ShipVenuesDto(string Version, string ShipId, IReadOnlyList<Venue> Venues, JsonElement Directory, JsonElement Menu, IReadOnlyList<string> DeliveryZones);

/// <summary>
/// Dining rooms, menus and queues of each ship at <c>aboard</c> depth. Sun Princess's are <see cref="DiningRules.Venues"/>, <see cref="OrderRules.Menu"/> and the directory in
/// <c>reference-content.json</c>; Sky Princess and Sapphire Princess are **concept samples** from <c>Content/ship-venues.json</c>, written by <c>npm run shipvenues:gen</c> (the same
/// rows seed <c>ref.Venues</c> and <c>ref.MenuItems</c>). A venue or menu item id belongs to one ship (<c>sky-crown</c>, <c>sky-cheeseburger</c>), so an id found anywhere names its ship.
/// </summary>
public static class ShipDining
{
    public const string SunId = "sun-princess";

    private sealed record Entry(ShipVenuesDto Dto, IReadOnlyList<MenuItem> Menu, IReadOnlyList<QueueVenue> Queue);

    private sealed record DirectoryRow(string Id, string Price, QueueHours Hours);

    private sealed record QueueHours(string[][] Sea, string[][] Port);

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private static readonly Lazy<IReadOnlyDictionary<string, Entry>> All = new(Build);

    private static IReadOnlyDictionary<string, Entry> Build()
    {
        var all = new Dictionary<string, Entry>
        {
            [SunId] = Seal(SunId, DiningRules.Venues, ContentReference.Value("menus.DIRECTORY"), ContentReference.Value("orders.MENU"), OrderRules.Menu, OrderRules.DeliveryZones),
        };
        using var stream = typeof(ShipDining).Assembly.GetManifestResourceStream("ship-venues.json")
            ?? throw new InvalidOperationException("ship-venues.json is not embedded.");
        using var doc = JsonDocument.Parse(stream);
        foreach (var ship in doc.RootElement.EnumerateObject())
        {
            var venues = ship.Value.GetProperty("venues").Deserialize<List<Venue>>(Options)!;
            var menu = ship.Value.GetProperty("menu").Deserialize<List<MenuItem>>(Options)!;
            var zones = ship.Value.GetProperty("deliveryZones").Deserialize<List<string>>(Options)!;
            all[ship.Name] = Seal(ship.Name, venues, ship.Value.GetProperty("directory").Clone(), ship.Value.GetProperty("menu").Clone(), menu, zones);
        }
        return all;
    }

    private static Entry Seal(string shipId, IReadOnlyList<Venue> venues, JsonElement directory, JsonElement rawMenu, IReadOnlyList<MenuItem> menu, IReadOnlyList<string> zones)
    {
        var text = JsonSerializer.Serialize(new { shipId, venues, directory, menu = rawMenu, zones }, Options);
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        // The walk-in places: the directory's rooms that are neither a main dining room nor a specialty (those take reservations).
        var queue = directory.Deserialize<List<DirectoryRow>>(Options)!
            .Where(r => r.Price != "specialty" && venues.FirstOrDefault(v => v.Id == r.Id)?.Kind != "main")
            .Select(r => new QueueVenue(r.Id, r.Hours.Sea, r.Hours.Port))
            .ToList();
        return new Entry(new ShipVenuesDto(version, shipId, venues, directory, rawMenu, zones), menu, queue);
    }

    private static Entry Of(string? shipId) => shipId is not null && All.Value.TryGetValue(shipId, out var e) ? e : All.Value[SunId];

    /// <summary>The ships that have dining.</summary>
    public static IReadOnlyCollection<string> Ships => All.Value.Keys;

    /// <summary>One ship's dining, or null for a ship with none.</summary>
    public static ShipVenuesDto? For(string shipId) => All.Value.TryGetValue(shipId, out var e) ? e.Dto : null;

    /// <summary>The dining rooms of a ship (Sun Princess's for an unknown ship).</summary>
    public static IReadOnlyList<Venue> VenuesOf(string? shipId) => Of(shipId).Dto.Venues;

    /// <summary>The room with this id, on any ship (ids are unique across ships).</summary>
    public static Venue? AnyVenue(string? id) => id is null ? null : All.Value.Values.SelectMany(e => e.Dto.Venues).FirstOrDefault(v => v.Id == id);

    /// <summary>The room with this id if it is on this ship.</summary>
    public static Venue? VenueOn(string? shipId, string? id) => VenuesOf(shipId).FirstOrDefault(v => v.Id == id);

    /// <summary>The room-service and delivery menu of a ship.</summary>
    public static IReadOnlyList<MenuItem> MenuOf(string? shipId) => Of(shipId).Menu;

    /// <summary>The menu item with this id, on any ship.</summary>
    public static MenuItem? AnyItem(string? id) => id is null ? null : All.Value.Values.SelectMany(e => e.Menu).FirstOrDefault(m => m.Id == id);

    /// <summary>The places the crew deliver to on deck, as ids from the ship's deck plan.</summary>
    public static IReadOnlyList<string> ZonesOf(string? shipId) => Of(shipId).Dto.DeliveryZones;

    /// <summary>The walk-in places a guest can join a virtual queue for on a ship.</summary>
    public static IReadOnlyList<QueueVenue> QueueOf(string? shipId) => Of(shipId).Queue;

    /// <summary>The queue place with this id on any ship.</summary>
    public static QueueVenue? AnyQueue(string? id) => id is null ? null : All.Value.Values.SelectMany(e => e.Queue).FirstOrDefault(q => q.Id == id);

    /// <summary>A Sun Princess menu item id as it is on another ship (<c>fish-tacos</c> is <c>sky-fish-tacos</c> on Sky Princess), for the scenarios that name items.</summary>
    public static string ItemOn(string? shipId, string sunItemId) =>
        shipId is null || shipId == SunId || !All.Value.ContainsKey(shipId) ? sunItemId : $"{shipId.Replace("-princess", "", StringComparison.Ordinal)}-{sunItemId}";
}
