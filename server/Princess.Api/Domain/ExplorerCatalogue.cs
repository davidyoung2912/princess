using System.Text.Json;

namespace Princess.Api.Domain;

// The Explorer content of each ship (docs/explorer-harmony-plan.md). The field names follow src/domain/explorer/types.ts and scripts/ship-explorer-data.ts.

/// <summary>When a venue is open, by kind of day. The first rule whose <see cref="When"/> matches the day wins. <c>Kind</c> is <c>fixed</c> (the <see cref="Windows"/>), <c>sailaway</c> (opens <see cref="AfterMinutes"/> after the ship sails, closes at <see cref="Until"/>) or <c>closed</c>.</summary>
public sealed record HoursRule(string Kind, string[] When, string[][]? Windows, string[][]? Staffed, int? AfterMinutes, string? Until);

/// <summary>One place a guest can go in one of the six Explorers. <see cref="Bookable"/> is <c>none</c>, <c>dining</c> or <c>spa</c>.</summary>
public sealed record ExplorerVenue(
    string Id, string Explorer, string Kind, string Title, string Short, string Long, string PlaceId, string DeckLabel, HoursRule[] Hours,
    long? Cover, int? MinAge, string Bookable, int Order, string[] Features, string[] Accessibility, string[]? Family = null, string[]? KidsMenu = null);

/// <summary>Something that happens at a venue, on the kinds of day in <see cref="When"/> (see <see cref="DayKinds"/>). <see cref="Extra"/> is cents per person. <see cref="Capacity"/> is the places there are, when limited. <see cref="Performer"/>, <see cref="Series"/> (the name shared by showings that belong together), <see cref="Access"/> (codes such as <c>hearingLoop</c>), <see cref="Dress"/> and <see cref="Arrive"/> are shown on the event when set.</summary>
public sealed record ExplorerEventDef(
    string Id, string VenueId, string[] When, string Start, int Minutes, string Title, string Detail, string Age, string Interest, long Extra, bool AfterAllAboard, int? Capacity,
    string? Performer = null, string? Series = null, string[]? Access = null, string? Dress = null, string? Arrive = null);

/// <summary><see cref="Marks"/> are "vegan", "vegetarian" and "nas" (no added sugar), a guide like <see cref="Contains"/>.
public sealed record MealDish(string Name, string[] Contains, string? Note, string[]? Marks = null);

public sealed record MealCourse(string Name, MealDish[] Dishes);

/// <summary>A menu of a restaurant. <see cref="TemplateDay"/> is a day of the ship's authored week (<see cref="ShipExplorer.MenuTemplate"/>); 0 is every day.</summary>
public sealed record MealMenuDef(string VenueId, string Meal, string From, string To, int TemplateDay, string Title, string? Theme, bool Formal, MealCourse[] Courses);

/// <summary>A treatment or service a spa venue sells by appointment. <see cref="Price"/> is cents per person; <see cref="Rooms"/> is how many can be given at once; <see cref="When"/> are the kinds of day it runs (a port-day special runs only in port).</summary>
public sealed record SpaTreatment(string Id, string VenueId, string Title, string Detail, int Minutes, long Price, int? MinAge, int Rooms, string[] When);

public sealed record ShipExplorer(string[] MenuTemplate, ExplorerVenue[] Venues, ExplorerEventDef[] Events, MealMenuDef[] Menus, SpaTreatment[]? Treatments = null)
{
    public SpaTreatment[] TreatmentList => Treatments ?? [];
}

/// <summary>
/// The venues, events and menus of every ship, from <c>Content/ship-explorer.json</c> (written by <c>npm run shipexplorer:gen</c>). A venue id belongs to one ship, so an id found anywhere names its ship;
/// event ids are unique across the Explorer content and never equal a programme event id, because both live in a guest's plan.
/// </summary>
public static class ExplorerCatalogue
{
    public static readonly string[] Kinds = ["dining", "entertainment", "shopping", "spa", "exercise", "activities"];

    /// <summary>The page each Explorer lives at in the app (the venue id follows), used for the link a reminder opens. Matches <c>EXPLORER_PATHS</c> in the front end.</summary>
    public static string PathOf(string explorer) => explorer switch
    {
        "dining" => "/dining-today", "entertainment" => "/entertainment", "shopping" => "/shopping-today", "spa" => "/spa-explorer",
        "exercise" => "/exercise-explorer", _ => "/activities-explorer",
    };

    /// <summary>The page of one venue (<see cref="PathOf"/> and the venue id), the screen a shared venue or event card opens.</summary>
    public static string VenuePath(ExplorerVenue venue) => $"{PathOf(venue.Explorer)}/{venue.Id}";

    public static bool ValidKind(string? kind) => kind is not null && Kinds.Contains(kind);

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private static readonly Lazy<IReadOnlyDictionary<string, ShipExplorer>> All = new(() =>
    {
        using var stream = typeof(ExplorerCatalogue).Assembly.GetManifestResourceStream("ship-explorer.json")
            ?? throw new InvalidOperationException("ship-explorer.json is not embedded.");
        return JsonSerializer.Deserialize<Dictionary<string, ShipExplorer>>(stream, Options)!;
    });

    /// <summary>The ships that have Explorer content.</summary>
    public static IReadOnlyCollection<string> Ships => [.. All.Value.Keys];

    /// <summary>One ship's content, or null for a ship with none.</summary>
    public static ShipExplorer? For(string? shipId) => shipId is not null && All.Value.TryGetValue(shipId, out var s) ? s : null;

    /// <summary>A ship's content (Sun Princess's for an unknown or missing ship).</summary>
    public static ShipExplorer Of(string? shipId) => For(shipId) ?? All.Value[ShipDining.SunId];

    public static ExplorerVenue? VenueOn(string? shipId, string? id) => Of(shipId).Venues.FirstOrDefault(v => v.Id == id);

    public static SpaTreatment? TreatmentOn(string? shipId, string? id) => Of(shipId).TreatmentList.FirstOrDefault(x => x.Id == id);

    public static ExplorerEventDef? EventOn(string? shipId, string? id) => Of(shipId).Events.FirstOrDefault(e => e.Id == id);

    /// <summary>The ship a venue pin names (<c>venue:&lt;ship&gt;.&lt;venue&gt;</c>) and the venue, or null when either does not exist.</summary>
    public static (string ShipId, ExplorerVenue Venue)? VenueOfPinKey(string? key)
    {
        if (key is null || !key.StartsWith("venue:", StringComparison.Ordinal)) return null;
        var rest = key["venue:".Length..];
        var dot = rest.IndexOf('.');
        if (dot <= 0 || dot == rest.Length - 1) return null;
        var ship = rest[..dot];
        return For(ship)?.Venues.FirstOrDefault(v => v.Id == rest[(dot + 1)..]) is { } v ? (ship, v) : null;
    }
}
