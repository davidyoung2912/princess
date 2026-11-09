using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>One ship's deck plan as the app reads it: places, the six elevator banks, the six muster stations and a few accessibility notes. <c>Version</c> changes when the content does.</summary>
public sealed record AboardPlanDto(string Version, string ShipId, IReadOnlyList<string> Accessibility, IReadOnlyList<DeckPlaceDto> Places, IReadOnlyList<ElevatorBankDto> Elevators, IReadOnlyList<MusterStationDto> Muster);

/// <summary>
/// The deck plan of each ship at <c>aboard</c> depth. Sun Princess's is <see cref="ShipReference"/>'s; Sky Princess and Sapphire Princess are **concept samples**:
/// plausible places on plausible decks for their classes, not the real deck plans (see <c>docs/content-verification.md</c>). A verified plan replaces the lists with no code change.
/// Every ship keeps the place ids that other content refers to (<see cref="CoreIds"/>), each with the ship's own name and deck.
/// </summary>
public static class AboardPlans
{
    /// <summary>Place ids every ship's plan has, because services, programme, day plan and feeds name them (AB5 replaces the hard-coded ones).</summary>
    public static readonly IReadOnlyList<string> CoreIds =
        ["medical", "landing", "guest-services", "piazza", "intl-cafe", "shops", "excursions-desk", "lotus", "fitness", "eatery", "lido", "lido-pool", "promenade", "sea-view", "firefly", "neon-grove", "underground"];

    private static readonly IReadOnlyList<ElevatorBankDto> Banks =
    [
        new("A", "forward", "port"), new("B", "forward", "starboard"),
        new("C", "midship", "port"), new("D", "midship", "starboard"),
        new("E", "aft", "port"), new("F", "aft", "starboard"),
    ];

    private static DeckPlaceDto P(string id, string name, int deck, string section, string kind, bool stepFree = true, string? note = null) => new(id, name, deck, section, kind, stepFree, note);

    private static AboardPlanDto Seal(string shipId, IReadOnlyList<string> access, IReadOnlyList<DeckPlaceDto> places, IReadOnlyList<ElevatorBankDto> banks, IReadOnlyList<MusterStationDto> muster)
    {
        var json = JsonSerializer.Serialize(new { shipId, access, places, banks, muster });
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant()[..16];
        return new AboardPlanDto(version, shipId, access, places, banks, muster);
    }

    /// <summary>The plan of a ship, or null when the ship has none (an unknown ship).</summary>
    public static AboardPlanDto? For(string shipId) => All.Value.GetValueOrDefault(shipId);

    /// <summary>The ship a sailing runs on; Sun Princess for a sailing the book does not list (the older sample sailings).</summary>
    public static string ShipOfSailing(string sailingId) => FareBook.ShipOf(sailingId) ?? "sun-princess";

    /// <summary>
    /// The rooms Sun Princess's content names that other ships house elsewhere: Sun's id, then each ship's id for the same job
    /// (null when the ship has no such room). Content that names a Sun room goes through <see cref="Room"/>.
    /// </summary>
    private static readonly Dictionary<string, Dictionary<string, string?>> Rooms = new()
    {
        ["arena"] = new() { ["sun-princess"] = "arena", ["sky-princess"] = "princess-theater", ["sapphire-princess"] = "princess-theater" },
        ["eclipse"] = new() { ["sun-princess"] = "eclipse", ["sky-princess"] = "allegro", ["sapphire-princess"] = "santa-fe" },
        ["dome"] = new() { ["sun-princess"] = "dome", ["sky-princess"] = "seawalk", ["sapphire-princess"] = null },
        ["americana"] = new() { ["sun-princess"] = "americana", ["sky-princess"] = null, ["sapphire-princess"] = null },
    };

    /// <summary>The place that does a Sun room's job on a ship (<c>arena</c> is the main theatre, <c>eclipse</c> the main dining room, <c>dome</c> the late-night room), the id itself when it is not a Sun-only room, or null when the ship has none.</summary>
    public static string? Room(string? shipId, string id) =>
        !Rooms.TryGetValue(id, out var byShip) ? id : byShip.GetValueOrDefault(shipId ?? "sun-princess", id);

    /// <summary>A ship's place ids for a list of Sun place ids: each mapped, those the ship has no room for dropped, repeats kept out.</summary>
    public static List<string> MapRooms(string? shipId, IEnumerable<string> ids) =>
        [.. ids.Select(i => Room(shipId, i)).OfType<string>().Distinct()];

    /// <summary>Like <see cref="MapRooms"/> but keeps repeats, for a rotation where an id's weight is its count.</summary>
    public static string[] MapRoomsKeepingRepeats(string? shipId, IEnumerable<string> ids) =>
        [.. ids.Select(i => Room(shipId, i)).OfType<string>()];

    /// <summary>The name of the main dining room on a ship, for plan text.</summary>
    public static string MainDiningName(string? shipId) => PlaceName(shipId ?? "sun-princess", Room(shipId, "eclipse") ?? "eclipse") is { Length: > 0 } n ? n : "Eclipse Dining Room";

    /// <summary>The muster station with this letter on a ship, or null.</summary>
    public static MusterStation? Station(string shipId, string letter) =>
        For(shipId)?.Muster.FirstOrDefault(m => m.Letter == letter) is { } m ? new MusterStation(m.Letter, m.Name, m.PlaceId, m.Deck) : null;

    /// <summary>The station for a label such as "Station C" on a ship; unknown labels give null.</summary>
    public static MusterStation? StationByLabel(string shipId, string label)
    {
        var t = label.Trim();
        return t.Length == 9 && t.StartsWith("Station ", StringComparison.Ordinal) ? Station(shipId, t[8..]) : null;
    }

    /// <summary>The name of a place on a ship, or empty.</summary>
    public static string PlaceName(string shipId, string placeId) => For(shipId)?.Places.FirstOrDefault(p => p.Id == placeId)?.Name ?? "";

    /// <summary>"Medical Center, Deck 4 forward": where a place is, for the emergency card.</summary>
    public static string Where(string shipId, string placeId, string fallback) =>
        For(shipId)?.Places.FirstOrDefault(p => p.Id == placeId) is { } p ? $"{p.Name}, Deck {p.Deck} {p.Section}" : fallback;

    /// <summary>The ids of the ships that have a plan.</summary>
    public static IReadOnlyCollection<string> Ships => All.Value.Keys;

    // ---- Sky Princess (Royal class, concept sample) ----

    private static readonly string[] SkyAccessibility =
    [
        "Sample plan: check the real deck plan before you rely on a route.",
        "Six elevator banks with touchscreens that assign a car; step-free routes join the Piazza, the dining rooms and the Lido.",
        "Wheelchair-accessible seating in the Princess Theater, the Piazza and the main dining rooms.",
        "The SeaWalk is open air with a glass floor over the sea; the doors have a low threshold, and the walkway is not suited to some mobility aids in wind.",
    ];

    private static readonly DeckPlaceDto[] SkyPlaces =
    [
        P("medical", "Medical Center", 4, "forward", "medical"),
        P("landing", "The Landing (gangway)", 5, "midship", "service"),
        P("guest-services", "Guest Services", 5, "forward", "service"),
        P("piazza", "The Piazza", 5, "midship", "show", true, "Three levels; each has a lift to the others"),
        P("intl-cafe", "International Café", 5, "midship", "dining"),
        P("bellinis", "Bellini’s Cocktail Bar", 5, "midship", "bar"),
        P("shops", "Shops of Princess", 6, "midship", "shop"),
        P("excursions-desk", "Shore Excursions desk", 6, "midship", "service"),
        P("allegro", "Allegro Dining Room", 6, "aft", "dining"),
        P("concerto", "Concerto Dining Room", 7, "aft", "dining"),
        P("princess-theater", "Princess Theater", 7, "forward", "show", true, "Wheelchair spaces on both sides; ask an usher"),
        P("explorers-lounge", "Explorers Lounge", 7, "midship", "show"),
        P("crown", "Crown Grill", 7, "aft", "dining"),
        P("sabatini", "Sabatini’s", 7, "midship", "dining"),
        P("casino", "Princess Casino", 7, "forward", "show"),
        P("promenade", "Promenade (outdoor)", 8, "aft", "pool", true, "Gentle ramps at each door; the deck is flat"),
        P("firefly", "Kids Club (3 to 7)", 15, "forward", "family"),
        P("neon-grove", "Tweens Club (8 to 12)", 15, "forward", "family"),
        P("underground", "Teen Lounge (13 to 17)", 15, "forward", "family"),
        P("lotus", "Lotus Spa", 16, "midship", "wellness"),
        P("fitness", "Fitness Center", 16, "forward", "wellness"),
        P("salon", "Lotus Salon", 16, "midship", "wellness"),
        P("eatery", "Horizon Court", 16, "midship", "dining"),
        P("alfredo", "Alfredo’s Pizzeria", 16, "aft", "dining"),
        P("lido", "The Lido (Lido Eats)", 16, "midship", "dining"),
        P("lido-pool", "Lido Pool", 16, "midship", "pool", true, "Pool lift at the shallow end"),
        P("wc-5", "Restrooms by the Piazza", 5, "aft", "restroom", true, "Step-free and accessible stalls; a family restroom is next door"),
        P("wc-16", "Restrooms at the Lido", 16, "aft", "restroom", true, "Step-free and accessible stalls; baby changing"),
        P("movies", "Movies Under the Stars", 16, "midship", "show"),
        P("sea-view", "Sea View Bar", 17, "forward", "bar"),
        P("seawalk", "The SeaWalk", 17, "aft", "pool", true, "Open air; low threshold at the door"),
        P("sun-bar", "Sun Bar", 18, "forward", "bar", false, "Two steps up from the sun deck. The Sea View Bar on deck 17 serves the same drinks, step-free"),
    ];

    private static readonly MusterStationDto[] SkyMuster =
    [
        new("A", "Princess Theater, port side", "princess-theater", 7),
        new("B", "Princess Theater, starboard side", "princess-theater", 7),
        new("C", "The Piazza, port side", "piazza", 5),
        new("D", "The Piazza, starboard side", "piazza", 5),
        new("E", "Concerto Dining Room", "concerto", 7),
        new("F", "Allegro Dining Room", "allegro", 6),
    ];

    // ---- Sapphire Princess (Gem class, concept sample) ----

    private static readonly string[] SapphireAccessibility =
    [
        "Sample plan: check the real deck plan before you rely on a route.",
        "Six elevator banks with touchscreens that assign a car; step-free routes join the Piazza, the dining rooms and the Lido.",
        "Wheelchair-accessible seating in the Princess Theater and the main dining rooms.",
        "An older, mid-sized ship: some thresholds are higher than on newer ships, and a few doors are heavier. Guest Services can help.",
    ];

    private static readonly DeckPlaceDto[] SapphirePlaces =
    [
        P("medical", "Medical Center", 4, "forward", "medical"),
        P("landing", "The Landing (gangway)", 5, "midship", "service"),
        P("guest-services", "Guest Services", 5, "forward", "service"),
        P("piazza", "The Piazza", 5, "midship", "show"),
        P("intl-cafe", "International Café", 5, "midship", "dining"),
        P("shops", "Shops of Princess", 5, "aft", "shop"),
        P("excursions-desk", "Shore Excursions desk", 6, "midship", "service"),
        P("santa-fe", "Santa Fe Dining Room", 5, "aft", "dining"),
        P("vivaldi", "Vivaldi Dining Room", 6, "aft", "dining"),
        P("princess-theater", "Princess Theater", 6, "forward", "show", true, "Wheelchair spaces at the back and sides; ask an usher"),
        P("explorers-lounge", "Explorers Lounge", 6, "midship", "show"),
        P("crown", "Crown Grill", 6, "midship", "dining"),
        P("sabatini", "Sabatini’s", 6, "aft", "dining"),
        P("casino", "Princess Casino", 6, "forward", "show"),
        P("promenade", "Promenade (outdoor)", 7, "aft", "pool", true, "Gentle ramps at each door; the deck is flat"),
        P("lotus", "Lotus Spa", 12, "midship", "wellness"),
        P("fitness", "Fitness Center", 12, "forward", "wellness"),
        P("salon", "Lotus Salon", 12, "midship", "wellness"),
        P("eatery", "Horizon Court", 12, "midship", "dining"),
        P("alfredo", "Alfredo’s Pizzeria", 12, "aft", "dining"),
        P("lido", "The Lido (Lido Eats)", 12, "midship", "dining"),
        P("lido-pool", "Lido Pool", 12, "midship", "pool", true, "Pool lift at the shallow end"),
        P("wc-5", "Restrooms by the Piazza", 5, "aft", "restroom", true, "Step-free and accessible stalls; a family restroom is next door"),
        P("wc-12", "Restrooms at the Lido", 12, "aft", "restroom", true, "Step-free and accessible stalls; baby changing"),
        P("movies", "Movies Under the Stars", 12, "midship", "show"),
        P("serenity", "Serenity Adults-Only Retreat", 13, "aft", "pool"),
        P("firefly", "Kids Club (3 to 7)", 13, "forward", "family"),
        P("neon-grove", "Tweens Club (8 to 12)", 13, "forward", "family"),
        P("underground", "Teen Lounge (13 to 17)", 13, "forward", "family"),
        P("sea-view", "Sea View Bar", 13, "forward", "bar"),
        P("sun-bar", "Sun Bar", 13, "midship", "bar", false, "Two steps up from the sun deck. The Sea View Bar serves the same drinks, step-free"),
    ];

    private static readonly MusterStationDto[] SapphireMuster =
    [
        new("A", "Princess Theater, port side", "princess-theater", 6),
        new("B", "Princess Theater, starboard side", "princess-theater", 6),
        new("C", "The Piazza, port side", "piazza", 5),
        new("D", "The Piazza, starboard side", "piazza", 5),
        new("E", "Vivaldi Dining Room", "vivaldi", 6),
        new("F", "Santa Fe Dining Room", "santa-fe", 5),
    ];

    // Declared after the plans it reads, so the static fields are set when it first runs.
    private static readonly Lazy<Dictionary<string, AboardPlanDto>> All = new(() =>
    {
        var sun = ShipReference.Get();
        var plans = new[]
        {
            Seal("sun-princess", sun.Accessibility, sun.Places, sun.Elevators, sun.Muster),
            Seal("sky-princess", SkyAccessibility, SkyPlaces, Banks, SkyMuster),
            Seal("sapphire-princess", SapphireAccessibility, SapphirePlaces, Banks, SapphireMuster),
        };
        return plans.ToDictionary(p => p.ShipId);
    });
}
