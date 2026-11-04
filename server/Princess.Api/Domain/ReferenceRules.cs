using Princess.Api.Data;

namespace Princess.Api.Domain;

public sealed record ExcursionDifficulty(double Km, bool Steps, string Heat, string Shade, bool Seats, bool Restrooms, bool Wet);

/// <summary>How long a passport must still be valid beyond the day the ship is in a country, by the guest's citizenship, and whether a guest of another nationality should check for a visa. Authored concept figures: the guest is always sent to the official source.</summary>
/// <summary>One country's passport and visa rule. <c>Source</c> is the official page to check it against and <c>AsOf</c> the date the sample was written (not a date it was verified).</summary>
public sealed record EntryRuleDto(string Country, int MonthsUs, int MonthsOther, bool VisaCheckOther, string? Source = null, string? AsOf = null);

public sealed record EntryReferenceDto(string Version, IReadOnlyList<EntryRuleDto> Rules);

public sealed record AccessReferenceDto(string Version, Dictionary<string, ExcursionDifficulty> Difficulty, IReadOnlyList<string> AccessibleCategories);

/// <summary>One sailing in the served table. Every sailing runs the same eight-day timeline from its departure date.</summary>
public sealed record SailingRefDto(string Id, string Departure, bool Holiday, bool Reference);

/// <summary>One day of the timeline, relative to departure (day 1 is the departure date); times are local to the port, <c>HH:mm</c>. <c>ShipZone</c> is the zone the ship's clocks follow on that day.</summary>
public sealed record ItineraryRefDto(int Day, string Port, string? Arrive, string? AllAboard, string? Depart, string? ShipZone = null);

/// <summary>The sailings, the ports they call at, the shared itinerary and the zones the ship's clocks follow (multi-device plan 3, Phase 3). <c>Version</c> changes when the content does.</summary>
public sealed record SailingsReferenceDto(string Version, IReadOnlyList<SailingRefDto> Sailings, IReadOnlyList<Port> Ports, IReadOnlyList<ItineraryRefDto> Itinerary, string ShipHomeZone, string ShipWestZone, IReadOnlyList<CatalogueSailingDto>? Entries = null);

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
        var legacy = Timeline.Legacy(new DateOnly(2000, 1, 1));
        var template = legacy.Days.Select(d => new ItineraryRefDto(d.Day, d.Port, d.Arrive?.ToString("HH:mm"), d.AllAboard?.ToString("HH:mm"), d.Depart?.ToString("HH:mm"), legacy.ShipZoneOnDate(d.Date))).ToList();
        var ports = Itinerary.Ports.Values.ToList();
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            string.Join('|', sailings.Select(x => $"{x.Id}:{x.Departure}:{x.Holiday}:{x.Reference}")) + "#" + string.Join('|', template) + "#" + string.Join('|', ports)))).ToLowerInvariant()[..16];
        return new(version, sailings, ports, template, Itinerary.ShipHomeZone, Itinerary.ShipWestZone);
    }

    /// <summary>
    /// A row for each country the catalogue sails to, keyed by ISO country code. Months of passport validity beyond the day the ship is there, by citizenship, and whether a guest of another
    /// nationality should check for a visa or travel authorisation. Authored samples, unverified (see docs/content-verification.md): the guest is always sent to the official source.
    /// </summary>
    /// <summary>The date the entry rows were written. Unverified: see <c>docs/content-verification.md</c>.</summary>
    public const string EntryAsOf = "2026-11-03";

    private static readonly string Schengen = "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa_en";

    /// <summary>The official page for each country's entry rules (a government immigration or foreign ministry site).</summary>
    public static readonly IReadOnlyDictionary<string, string> EntrySources = new Dictionary<string, string>
    {
        ["US"] = "https://www.cbp.gov/travel/international-visitors",
        ["PR"] = "https://www.cbp.gov/travel/international-visitors",
        ["MX"] = "https://www.gob.mx/inm",
        ["BZ"] = "https://immigration.gov.bz",
        ["HN"] = "https://www.inm.gob.hn",
        ["BS"] = "https://www.bahamas.gov.bs",
        ["TC"] = "https://www.gov.tc",
        ["DO"] = "https://www.migracion.gob.do",
        ["ES"] = Schengen, ["FR"] = Schengen, ["IT"] = Schengen, ["PT"] = Schengen, ["BE"] = Schengen, ["DE"] = Schengen, ["DK"] = Schengen,
        ["SE"] = Schengen, ["FI"] = Schengen, ["EE"] = Schengen, ["NO"] = Schengen, ["IS"] = Schengen, ["GR"] = Schengen,
        ["ME"] = "https://www.gov.me",
        ["TR"] = "https://www.mfa.gov.tr",
        ["GB"] = "https://www.gov.uk/check-uk-visa",
        ["MA"] = "https://www.diplomatie.ma",
        ["JP"] = "https://www.mofa.go.jp/j_info/visit/visa/index.html",
        ["KR"] = "https://www.visa.go.kr",
        ["TW"] = "https://www.boca.gov.tw",
        ["HK"] = "https://www.immd.gov.hk",
        ["VN"] = "https://evisa.gov.vn",
        ["SG"] = "https://www.ica.gov.sg",
        ["MY"] = "https://www.imi.gov.my",
        ["TH"] = "https://www.thaievisa.go.th",
        ["ID"] = "https://www.imigrasi.go.id",
        ["AU"] = "https://immi.homeaffairs.gov.au",
        ["NZ"] = "https://www.immigration.govt.nz",
    };

    public static IReadOnlyList<EntryRuleDto> EntryRules => EntryRows.Select(r => r with { Source = EntrySources[r.Country], AsOf = EntryAsOf }).ToList();

    private static readonly IReadOnlyList<EntryRuleDto> EntryRows =
    [
        new("US", 0, 0, true),
        new("MX", 0, 0, true),
        new("BZ", 6, 6, true),
        new("HN", 6, 6, true),
        new("BS", 0, 0, true),
        new("TC", 0, 0, true),
        new("PR", 0, 0, true),
        new("DO", 0, 0, true),
        new("ES", 3, 3, true),
        new("FR", 3, 3, true),
        new("IT", 3, 3, true),
        new("PT", 3, 3, true),
        new("BE", 3, 3, true),
        new("DE", 3, 3, true),
        new("DK", 3, 3, true),
        new("SE", 3, 3, true),
        new("FI", 3, 3, true),
        new("EE", 3, 3, true),
        new("NO", 3, 3, true),
        new("IS", 3, 3, true),
        new("GR", 3, 3, true),
        new("ME", 3, 3, true),
        new("TR", 6, 6, true),
        new("GB", 0, 0, true),
        new("MA", 6, 6, true),
        new("JP", 0, 0, true),
        new("KR", 0, 0, true),
        new("TW", 6, 6, true),
        new("HK", 1, 1, true),
        new("VN", 6, 6, true),
        new("SG", 6, 6, true),
        new("MY", 6, 6, true),
        new("TH", 6, 6, true),
        new("ID", 6, 6, true),
        new("AU", 0, 0, true),
        new("NZ", 3, 3, true),
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
