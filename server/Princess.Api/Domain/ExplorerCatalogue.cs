using System.Text.Json;

namespace Princess.Api.Domain;

// The Explorer content of each ship (docs/explorer-harmony-plan.md). The field names follow src/domain/explorer/types.ts and scripts/ship-explorer-data.ts.

/// <summary>When a venue is open, by kind of day. The first rule whose <see cref="When"/> matches the day wins. <c>Kind</c> is <c>fixed</c> (the <see cref="Windows"/>), <c>sailaway</c> (opens <see cref="AfterMinutes"/> after the ship sails, closes at <see cref="Until"/>) or <c>closed</c>.</summary>
public sealed record HoursRule(string Kind, string[] When, string[][]? Windows, string[][]? Staffed, int? AfterMinutes, string? Until);

/// <summary>One place a guest can go in one of the six Explorers. <see cref="Bookable"/> is <c>none</c>, <c>dining</c> or <c>spa</c>.</summary>
public sealed record ExplorerVenue(
    string Id, string Explorer, string Kind, string Title, string Short, string Long, string PlaceId, string DeckLabel, HoursRule[] Hours,
    long? Cover, int? MinAge, string Bookable, int Order, string[] Features, string[] Accessibility, string[]? Family = null, MealDish[]? KidsMenu = null);

/// <summary>Something that happens at a venue, on the kinds of day in <see cref="When"/> (see <see cref="DayKinds"/>). <see cref="Extra"/> is cents per person. <see cref="Capacity"/> is the places there are, when limited. <see cref="Performer"/>, <see cref="Series"/> (the name shared by showings that belong together), <see cref="Access"/> (codes such as <c>hearingLoop</c>), <see cref="Dress"/> and <see cref="Arrive"/> are shown on the event when set.</summary>
public sealed record ExplorerEventDef(
    string Id, string VenueId, string[] When, string Start, int Minutes, string Title, string Detail, string Age, string Interest, long Extra, bool AfterAllAboard, int? Capacity,
    string? Performer = null, string? Series = null, string[]? Access = null, string? Dress = null, string? Arrive = null);

/// <summary><see cref="Marks"/> are "vegan", "vegetarian" and "nas" (no added sugar), a guide like <see cref="Contains"/>. <see cref="Flags"/> are heads-ups kept apart from the diets: "alcohol", "raw" (raw or undercooked) and "spicy"; they never say a dish suits a diet.
public sealed record MealDish(string Name, string[] Contains, string? Note, string[]? Marks = null, string[]? Flags = null);

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

    /// <summary>The treatment a saved-treatment key names (<c>treatment:&lt;ship&gt;.&lt;id&gt;</c>), or null when the ship or the treatment does not exist.</summary>
    public static SpaTreatment? TreatmentOfKey(string? key)
    {
        if (key is null || !key.StartsWith("treatment:", StringComparison.Ordinal)) return null;
        var rest = key["treatment:".Length..];
        var dot = rest.IndexOf('.');
        if (dot <= 0 || dot == rest.Length - 1) return null;
        return For(rest[..dot])?.TreatmentList.FirstOrDefault(x => x.Id == rest[(dot + 1)..]);
    }

    /// <summary>The event a saved-event key names (<c>event:&lt;ship&gt;.&lt;id&gt;</c>) and its ship, or null when either does not exist.</summary>
    public static (string ShipId, ExplorerEventDef Event)? EventOfKey(string? key)
    {
        if (key is null || !key.StartsWith("event:", StringComparison.Ordinal)) return null;
        var rest = key["event:".Length..];
        var dot = rest.IndexOf('.');
        if (dot <= 0 || dot == rest.Length - 1) return null;
        var ship = rest[..dot];
        return For(ship)?.Events.FirstOrDefault(e => e.Id == rest[(dot + 1)..]) is { } e ? (ship, e) : null;
    }

    /// <summary>The slug a saved-dish key holds for a dish name: lower case letters and digits, other runs becoming one dash, at most 22 characters, so the whole key fits the 70 the favourites allow. The app builds the same slug (<c>dishSlug</c> in shortlist.ts).</summary>
    public static string DishSlug(string name)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var ch in name.ToLowerInvariant())
        {
            if (char.IsAsciiLetterOrDigit(ch)) sb.Append(ch);
            else if (sb.Length > 0 && sb[^1] != '-') sb.Append('-');
        }
        var slug = sb.ToString().Trim('-');
        return slug.Length <= 22 ? slug : slug[..22].TrimEnd('-');
    }

    /// <summary>The dish a saved-dish key names (<c>dish:&lt;ship&gt;.&lt;venue&gt;.&lt;slug&gt;</c>): the ship, the venue and the dish's name, found on any menu or the children's menu of that venue. Null when any is missing.</summary>
    public static (string ShipId, ExplorerVenue Venue, string Name)? DishOfKey(string? key)
    {
        if (key is null || !key.StartsWith("dish:", StringComparison.Ordinal)) return null;
        var parts = key["dish:".Length..].Split('.');
        if (parts.Length != 3 || parts.Any(p => p.Length == 0)) return null;
        var ship = For(parts[0]);
        var venue = ship?.Venues.FirstOrDefault(v => v.Id == parts[1]);
        if (ship is null || venue is null) return null;
        var names = ship.Menus.Where(m => m.VenueId == venue.Id).SelectMany(m => m.Courses).SelectMany(c => c.Dishes).Select(d => d.Name)
            .Concat((venue.KidsMenu ?? []).Select(d => d.Name));
        var name = names.FirstOrDefault(n => DishSlug(n) == parts[2]);
        return name is null ? null : (parts[0], venue, name);
    }

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
