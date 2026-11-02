using Princess.Api.Data;

namespace Princess.Api.Domain;

public sealed record ExcursionDifficulty(double Km, bool Steps, string Heat, string Shade, bool Seats, bool Restrooms, bool Wet);

/// <summary>How long a passport must still be valid beyond the day the ship is in a country, by the guest's citizenship, and whether a guest of another nationality should check for a visa. Authored concept figures: the guest is always sent to the official source.</summary>
public sealed record EntryRuleDto(string Port, int MonthsUs, int MonthsOther, bool VisaCheckOther);

public sealed record EntryReferenceDto(string Version, IReadOnlyList<EntryRuleDto> Rules);

public sealed record AccessReferenceDto(string Version, Dictionary<string, ExcursionDifficulty> Difficulty, IReadOnlyList<string> AccessibleCategories);

/// <summary>One sailing in the served table. Every sailing runs the same eight-day timeline from its departure date.</summary>
public sealed record SailingRefDto(string Id, string Departure, bool Holiday, bool Reference);

/// <summary>One day of the timeline, relative to departure (day 1 is the departure date); times are local to the port, <c>HH:mm</c>.</summary>
public sealed record ItineraryRefDto(int Day, string Port, string? Arrive, string? AllAboard, string? Depart);

/// <summary>The sailings, the ports they call at, the shared itinerary and the zones the ship's clocks follow (multi-device plan 3, Phase 3). <c>Version</c> changes when the content does.</summary>
public sealed record SailingsReferenceDto(string Version, IReadOnlyList<SailingRefDto> Sailings, IReadOnlyList<Port> Ports, IReadOnlyList<ItineraryRefDto> Itinerary, string ShipHomeZone, string ShipWestZone);

public sealed record CatalogueReferenceDto(string Version, IReadOnlyList<Excursion> Excursions, IReadOnlyList<Venue> Venues, IReadOnlyList<Port> Ports);

/// <summary>
/// Authored access reference data that the screens used to hold alone (multi-device plan Phase 5): how hard each excursion is on foot,
/// and which room types have accessible staterooms. The difficulty figures are held here until <c>ref.Excursions</c> gets columns for them.
/// </summary>
public static class ReferenceRules
{
    public static readonly IReadOnlyDictionary<string, ExcursionDifficulty> Difficulty = new Dictionary<string, ExcursionDifficulty>
    {
        ["coz-snorkel"] = new(0.5, true, "high", "low", true, true, true),
        ["coz-ruins"] = new(2, true, "high", "medium", false, true, false),
        ["coz-beach"] = new(0.3, false, "medium", "high", true, true, true),
        ["coz-glass"] = new(0.8, true, "medium", "medium", true, true, true),
        ["bze-altunha"] = new(2.5, true, "high", "medium", false, true, false),
        ["bze-cave"] = new(3, true, "medium", "high", false, false, true),
        ["bze-reef"] = new(0.5, true, "high", "low", true, true, true),
        ["bze-walk"] = new(2, false, "high", "low", true, true, false),
        ["rtb-zip"] = new(1.5, true, "high", "high", false, true, false),
        ["rtb-snorkel"] = new(0.4, false, "high", "low", true, true, true),
        ["rtb-wildlife"] = new(1, false, "medium", "high", true, true, false),
        ["rtb-drive"] = new(0.3, false, "medium", "medium", true, false, false),
    };

    public static CatalogueReferenceDto Catalogue()
    {
        var ports = Itinerary.Ports.Values.ToList();
        var text = System.Text.Json.JsonSerializer.Serialize(new { e = ExcursionRules.Catalogue, v = DiningRules.Venues, p = ports });
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, ExcursionRules.Catalogue, DiningRules.Venues, ports);
    }

    public static SailingsReferenceDto Sailings(IEnumerable<SailingRow> rows)
    {
        var sailings = rows.Select(r => new SailingRefDto(r.Id, DateOnly.FromDateTime(r.Departure).ToString("yyyy-MM-dd"), r.IsHoliday, r.IsReference)).ToList();
        var template = Itinerary.Days(new DateOnly(2000, 1, 1)).Select(d => new ItineraryRefDto(d.Day, d.Port, d.Arrive?.ToString("HH:mm"), d.AllAboard?.ToString("HH:mm"), d.Depart?.ToString("HH:mm"))).ToList();
        var ports = Itinerary.Ports.Values.ToList();
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            string.Join('|', sailings.Select(x => $"{x.Id}:{x.Departure}:{x.Holiday}:{x.Reference}")) + "#" + string.Join('|', template) + "#" + string.Join('|', ports)))).ToLowerInvariant()[..16];
        return new(version, sailings, ports, template, Itinerary.ShipHomeZone, Itinerary.ShipWestZone);
    }

    public static readonly IReadOnlyList<EntryRuleDto> EntryRules =
    [
        new("fll", 0, 0, true),
        new("cozumel", 0, 0, true),
        new("belize", 6, 6, true),
        new("roatan", 6, 6, true),
    ];

    public static EntryReferenceDto Entry()
    {
        var text = System.Text.Json.JsonSerializer.Serialize(EntryRules);
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, EntryRules);
    }

    public static AccessReferenceDto Access()
    {
        var difficulty = new Dictionary<string, ExcursionDifficulty>(Difficulty);
        var text = System.Text.Json.JsonSerializer.Serialize(new { d = difficulty.OrderBy(x => x.Key, StringComparer.Ordinal).ToList(), c = CabinRules.AccessibleCategories });
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, difficulty, CabinRules.AccessibleCategories);
    }
}
