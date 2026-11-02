namespace Princess.Api.Domain;

public sealed record ExcursionDifficulty(double Km, bool Steps, string Heat, string Shade, bool Seats, bool Restrooms, bool Wet);

public sealed record AccessReferenceDto(Dictionary<string, ExcursionDifficulty> Difficulty, IReadOnlyList<string> AccessibleCategories);

public sealed record CatalogueReferenceDto(IReadOnlyList<Excursion> Excursions, IReadOnlyList<Venue> Venues, IReadOnlyList<Port> Ports);

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

    public static CatalogueReferenceDto Catalogue() => new(ExcursionRules.Catalogue, DiningRules.Venues, [.. Itinerary.Ports.Values]);

    public static AccessReferenceDto Access() => new(new Dictionary<string, ExcursionDifficulty>(Difficulty), CabinRules.AccessibleCategories);
}
