using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>What the guest asked for, as values the search can use. Every field is optional; an empty filter matches everything.</summary>
public sealed record DiscoverFilters(int[]? Months = null, int? NightsMin = null, int? NightsMax = null, string[]? Regions = null, bool? Warm = null, int? MaxTender = null, long? MaxPerNightCents = null)
{
    public static readonly DiscoverFilters None = new();

    public bool IsEmpty => this is { Months: null or [], NightsMin: null, NightsMax: null, Regions: null or [], Warm: null, MaxTender: null, MaxPerNightCents: null };
}

/// <summary>One thing Stanley understood, shown as a chip the guest can change or remove. <c>Assumed</c> is true when Stanley filled a gap rather than being told.</summary>
public sealed record DiscoverChip(string Key, string Label, bool Assumed);

public sealed record InterviewDto(DiscoverFilters Filters, IReadOnlyList<DiscoverChip> Chips, IReadOnlyList<string> Assumptions, bool Understood);

/// <summary>A sailing as the discovery rules see it. <c>Calls</c> is null when the sailing has no day rows, so ports, sea days and tendering are unknown rather than zero.</summary>
public sealed record DiscoverCandidate(string Id, string Title, string ShipId, DateOnly Departure, int Nights, string? RegionId, long? PerNightCents, long? FromCents, bool Holiday, bool BookingOpen, IReadOnlyList<DiscoverCall>? Calls, int? SeaDays);

/// <summary>A port of call: the hours in port come from the arrival and departure times and are null when either is missing.</summary>
public sealed record DiscoverCall(string Port, double? Hours, bool Tender);

public sealed record DiscoverDirectionDto(string Kind, string Label, string SailingId, string Title, string Departure, int Nights, long? PerNightCents, IReadOnlyList<string> Met, IReadOnlyList<string> Missed, IReadOnlyList<string> NoData, IReadOnlyList<string> TradeOffs);

public sealed record DiscoverDirectionsDto(IReadOnlyList<DiscoverDirectionDto> Directions, int Considered, string? Note);

public sealed record CompareCellDto(string Key, string Text, bool Known, double? Fit);

public sealed record CompareRowDto(string SailingId, string Title, int? Score, IReadOnlyList<CompareCellDto> Cells, IReadOnlyList<string> Missing, IReadOnlyList<string> PortNotes);

public sealed record CompareChoiceDto(string Criterion, string Label, IReadOnlyList<string> SailingIds);

public sealed record CompareDto(IReadOnlyList<CompareRowDto> Rows, IReadOnlyDictionary<string, int> Weights, IReadOnlyList<string> Criteria, IReadOnlyList<CompareChoiceDto> IfYouValue, string PriceBasis, string Note);

/// <summary>The saved decision brief: what the guest said, the filters as edited, the short list and the weights. Needs (access, diet) are kept apart so a shared copy can leave them out.</summary>
public sealed record DiscoverBrief(string? Text, DiscoverFilters? Filters, string[]? Shortlist, Dictionary<string, int>? Weights, string[]? Needs, string? Title = null);

public sealed record DiscoverBriefDto(DiscoverBrief Brief, DateTime? UpdatedAt);

public sealed record BookingFlagDto(string Field, string Code, string Text);

public sealed record BookingCheckDto(IReadOnlyList<BookingFlagDto> Flags, string Authority);

public sealed record BookingCheckRequest(string? FirstName, string? LastName, string? BirthDate, string? Departure);

public sealed record DiscoverInterviewRequest(string? Text);

public sealed record DiscoverDirectionsRequest(DiscoverFilters? Filters);

public sealed record DiscoverCompareRequest(string[]? SailingIds, Dictionary<string, int>? Weights, DiscoverFilters? Filters);

/// <summary>
/// Dream and Discover intelligence (docs/stanley-gap-analysis-and-plan.md, phase 8). The words become filters by plain rules, not a model, so the same words always give the same chips and a guest sees
/// exactly what was understood and what was assumed. Directions and comparisons are calculated from the catalogue: price, ports, sea days, tendering and fit to the filters are the only things that rank,
/// so no commercial ordering exists to hide. A criterion with no data is labelled and left out of the score, never counted as zero.
/// </summary>
public static class StanleyDiscoverRules
{
    public const int TextMax = 500;
    public const int MaxCompare = 4;
    public const int ShortlistMax = 5;
    public const int NeedsMax = 6;

    public static readonly IReadOnlyList<string> Criteria = ["price", "ports", "seaDays", "tender", "fit"];

    private static readonly Dictionary<string, string> CriterionLabel = new()
    {
        ["price"] = "the lowest price a night", ["ports"] = "the most ports", ["seaDays"] = "the fewest sea days", ["tender"] = "the least tendering", ["fit"] = "the closest fit to what you asked",
    };

    private static readonly string[] MonthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    private static readonly string[] MonthShort = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    private static readonly (string Key, string[] Words, string[] Regions)[] RegionWords =
    [
        ("caribbean", ["caribbean", "bahamas"], ["caribbean"]),
        ("med", ["mediterranean", "med ", "greece", "italy", "adriatic"], ["western-med", "eastern-med"]),
        ("europe", ["europe", "baltic", "fjord", "norway", "scandinavia", "iceland"], ["northern-europe", "scandinavia"]),
        ("asia", ["asia", "japan", "korea", "thailand", "singapore"], ["japan-korea", "southeast-asia"]),
        ("pacific", ["australia", "new zealand", "pacific"], ["australia-nz"]),
        ("atlantic", ["atlantic", "crossing", "transatlantic"], ["atlantic"]),
    ];

    private static readonly Dictionary<string, string> RegionLabel = new()
    {
        ["caribbean"] = "Caribbean", ["western-med"] = "Western Mediterranean", ["eastern-med"] = "Eastern Mediterranean", ["northern-europe"] = "Northern Europe", ["scandinavia"] = "Scandinavia and the Baltic",
        ["japan-korea"] = "Japan and Korea", ["southeast-asia"] = "Southeast Asia", ["australia-nz"] = "Australia and New Zealand", ["atlantic"] = "Atlantic",
    };

    public static string Money(long cents) => "$" + (cents / 100m).ToString("#,##0", CultureInfo.InvariantCulture);

    // ---- Interview ----

    public static InterviewDto Interview(string? text)
    {
        var t = " " + (text ?? "").Trim().ToLowerInvariant() + " ";
        var chips = new List<DiscoverChip>();
        var assumptions = new List<string>();
        int[]? months = null; int? nMin = null, nMax = null; string[]? regions = null; bool? warm = null; int? tender = null; long? budget = null;

        // When: a month by name, or a season with early or late.
        var named = new List<int>();
        for (var i = 0; i < 12; i++) if (Regex.IsMatch(t, $@"\b({MonthNames[i]}|{MonthShort[i]}\.?)\b") && !(MonthNames[i] == "may" && Regex.IsMatch(t, @"\b(may i|i may|we may|might)\b"))) named.Add(i + 1);
        var seasons = new (string Word, int[] Months)[] { ("spring", [3, 4, 5]), ("summer", [6, 7, 8]), ("autumn", [9, 10, 11]), ("fall", [9, 10, 11]), ("winter", [12, 1, 2]) };
        if (named.Count > 0) months = [.. named.Distinct().Order()];
        else foreach (var (word, m) in seasons)
        {
            if (!Regex.IsMatch(t, $@"\b{word}\b")) continue;
            var late = Regex.IsMatch(t, $@"\blate {word}\b");
            var early = Regex.IsMatch(t, $@"\bearly {word}\b");
            months = late ? [m[^1]] : early ? [m[0]] : m;
            assumptions.Add(late ? $"\"Late {word}\" taken as {MonthNames[m[^1] - 1]}." : early ? $"\"Early {word}\" taken as {MonthNames[m[0] - 1]}." : $"\"{Cap(word)}\" taken as {MonthNames[m[0] - 1]} to {MonthNames[m[^1] - 1]}.");
            break;
        }
        if (months is not null) chips.Add(new("months", "Sailing in " + string.Join(", ", months.Select(m => Cap(MonthNames[m - 1]))), named.Count == 0));

        // How long.
        var digits = Regex.Match(t, @"\b(\d{1,2})[- ]?(night|day)s?\b");
        var words = Regex.Match(t, @"\b(a|one|two|three) weeks?\b");
        if (digits.Success)
        {
            var n = int.Parse(digits.Groups[1].Value, CultureInfo.InvariantCulture);
            if (digits.Groups[2].Value == "day") { n = Math.Max(1, n - 1); assumptions.Add($"{digits.Groups[1].Value} days taken as {n} nights."); }
            if (n is >= 1 and <= 60) { nMin = nMax = n; }
        }
        else if (words.Success)
        {
            var weeks = words.Groups[1].Value switch { "two" => 2, "three" => 3, _ => 1 };
            var about = Regex.IsMatch(t, @"\b(about|around|roughly)\b");
            nMin = weeks * 7 - (about || weeks == 1 ? 1 : 0); nMax = weeks * 7 + (about || weeks == 1 ? 1 : 0);
            assumptions.Add($"{(weeks == 1 ? "A week" : weeks + " weeks")} taken as {nMin} to {nMax} nights.");
        }
        else if (Regex.IsMatch(t, @"\b(long weekend|weekend|short break|short)\b")) { nMin = 2; nMax = 5; assumptions.Add("A short trip taken as 2 to 5 nights."); }
        else if (Regex.IsMatch(t, @"\b(long trip|long cruise|extended)\b")) { nMin = 10; nMax = 21; assumptions.Add("A long trip taken as 10 to 21 nights."); }
        if (nMin is { } lo && nMax is { } hi) chips.Add(new("nights", lo == hi ? $"{lo} nights" : $"{lo} to {hi} nights", digits.Success ? digits.Groups[2].Value == "day" : true));

        // Where.
        var found = new List<string>();
        foreach (var (_, wordsFor, regionIds) in RegionWords) if (wordsFor.Any(w => t.Contains(w))) found.AddRange(regionIds);
        if (found.Count > 0) { regions = [.. found.Distinct()]; chips.Add(new("regions", "Where: " + string.Join(", ", regions.Select(RegionName)), false)); }

        // Weather.
        if (Regex.IsMatch(t, @"\b(cool|cold|chilly|not too hot|mild)\b")) { warm = false; chips.Add(new("warm", "Cool weather", false)); }
        else if (Regex.IsMatch(t, @"\b(warm|hot|sun|sunny|beach|beaches|tropical)\b")) { warm = true; chips.Add(new("warm", "Warm weather", false)); assumptions.Add("Warm weather is judged by region and month, not a forecast."); }

        // Tenders.
        if (Regex.IsMatch(t, @"\b(no tender|avoid tender|without tender|never tender)\w*")) { tender = 0; chips.Add(new("tender", "No tender ports", false)); }
        else if (Regex.IsMatch(t, @"\b(few|fewer|limit|minimal|not many) tender\w*") || Regex.IsMatch(t, @"\bfew tender\b")) { tender = 1; chips.Add(new("tender", "At most one tender port", true)); assumptions.Add("\"Few tender ports\" taken as at most one."); }

        // Budget.
        var money = Regex.Match(t, @"(under|below|less than|up to|max(?:imum)?)\s*\$?\s*(\d{2,5})\s*(?:a|per|/)\s*(night|day)");
        if (money.Success) { budget = long.Parse(money.Groups[2].Value, CultureInfo.InvariantCulture) * 100; chips.Add(new("budget", $"Under {Money(budget.Value)} a person a night", false)); }

        var filters = new DiscoverFilters(months, nMin, nMax, regions, warm, tender, budget);
        return new(filters, chips, assumptions, !filters.IsEmpty);
    }

    private static string Cap(string s) => char.ToUpperInvariant(s[0]) + s[1..];

    public static string RegionName(string id) => RegionLabel.GetValueOrDefault(id, id);

    /// <summary>Makes the filters safe to use: ranges are in order and in bounds, regions are known, lists are short.</summary>
    public static DiscoverFilters? Clean(DiscoverFilters? f)
    {
        if (f is null) return DiscoverFilters.None;
        if (f.Months is { Length: > 12 } || f.Months?.Any(m => m is < 1 or > 12) == true) return null;
        if (f.NightsMin is < 1 or > 365 || f.NightsMax is < 1 or > 365 || (f.NightsMin > f.NightsMax)) return null;
        if (f.Regions is { Length: > 12 } || f.Regions?.Any(r => !RegionLabel.ContainsKey(r)) == true) return null;
        if (f.MaxTender is < 0 or > 20 || f.MaxPerNightCents is < 0 or > 10_000_000) return null;
        return f with { Months = f.Months?.Distinct().Order().ToArray(), Regions = f.Regions?.Distinct().ToArray() };
    }

    // ---- Fit to the filters ----

    /// <summary>Whether a region is warm in a month: true, false, or null when this authored table has no view. Not a forecast.</summary>
    public static bool? Warmth(string? region, int month) => region switch
    {
        "caribbean" or "southeast-asia" => true,
        "australia-nz" => month is 11 or 12 or 1 or 2 or 3 ? true : month is 6 or 7 or 8 ? false : null,
        "western-med" or "eastern-med" => month is >= 6 and <= 9 ? true : month is 11 or 12 or 1 or 2 or 3 ? false : null,
        "japan-korea" => month is >= 6 and <= 9 ? true : month is 12 or 1 or 2 ? false : null,
        "northern-europe" or "scandinavia" or "atlantic" => false,
        _ => null,
    };

    public sealed record Fit(IReadOnlyList<string> Met, IReadOnlyList<string> Missed, IReadOnlyList<string> NoData)
    {
        /// <summary>The share of the checks with an answer that were met, or null when none had an answer.</summary>
        public double? Ratio => Met.Count + Missed.Count == 0 ? null : (double)Met.Count / (Met.Count + Missed.Count);
    }

    public static Fit FitOf(DiscoverFilters f, DiscoverCandidate c)
    {
        List<string> met = [], missed = [], none = [];
        void Check(bool? ok, string label) { if (ok is null) none.Add(label); else (ok.Value ? met : missed).Add(label); }
        if (f.Months is { Length: > 0 }) Check(f.Months.Contains(c.Departure.Month), "Sails in " + string.Join(" or ", f.Months.Select(m => Cap(MonthNames[m - 1]))));
        if (f.NightsMin is not null || f.NightsMax is not null) Check(c.Nights >= (f.NightsMin ?? 1) && c.Nights <= (f.NightsMax ?? 365), $"{c.Nights} nights");
        if (f.Regions is { Length: > 0 }) Check(c.RegionId is null ? null : f.Regions.Contains(c.RegionId), c.RegionId is null ? "Region" : RegionName(c.RegionId));
        if (f.Warm is { } warm) Check(Warmth(c.RegionId, c.Departure.Month) is { } w ? w == warm : null, warm ? "Warm weather" : "Cool weather");
        if (f.MaxTender is { } maxT) Check(c.Calls is null ? null : c.Calls.Count(x => x.Tender) <= maxT, maxT == 0 ? "No tender ports" : $"At most {maxT} tender port{(maxT == 1 ? "" : "s")}");
        if (f.MaxPerNightCents is { } cap) Check(c.PerNightCents is null ? null : c.PerNightCents <= cap, $"Under {Money(cap)} a night");
        return new(met, missed, none);
    }

    // ---- Directions ----

    private static int Tenders(DiscoverCandidate c) => c.Calls?.Count(x => x.Tender) ?? 0;

    public static DiscoverDirectionsDto Directions(DiscoverFilters f, IReadOnlyList<DiscoverCandidate> all, DateOnly today)
    {
        var open = all.Where(c => c.Departure >= today).ToList();
        var scored = open.Select(c => (C: c, F: FitOf(f, c))).Where(x => x.F.Ratio is null ? f.IsEmpty || x.F.NoData.Count > 0 : x.F.Ratio >= 0.5).ToList();
        if (scored.Count == 0) return new([], open.Count, "none");
        var chosen = new List<(DiscoverCandidate C, Fit F, string Kind)>();
        // A direction is distinct when it is a different region or a different ship from every one already picked.
        bool Distinct(DiscoverCandidate c) => chosen.All(x => x.C.RegionId != c.RegionId || x.C.ShipId != c.ShipId);

        void Pick(string kind, IEnumerable<(DiscoverCandidate C, Fit F)> ordered)
        {
            var next = ordered.FirstOrDefault(x => chosen.All(y => y.C.Id != x.C.Id) && Distinct(x.C));
            if (next.C is not null) chosen.Add((next.C, next.F, kind));
        }

        var byFit = scored.OrderByDescending(x => x.F.Ratio ?? 0).ThenBy(x => x.C.PerNightCents ?? long.MaxValue).ThenBy(x => x.C.Id, StringComparer.Ordinal);
        Pick("bestFit", byFit);
        Pick("lowestPrice", scored.Where(x => x.C.PerNightCents is not null).OrderBy(x => x.C.PerNightCents).ThenBy(x => x.C.Id, StringComparer.Ordinal));
        Pick("mostPorts", scored.Where(x => x.C.Calls is not null).OrderByDescending(x => x.C.Calls!.Count).ThenBy(x => Tenders(x.C)).ThenBy(x => x.C.Id, StringComparer.Ordinal));
        Pick("calmest", scored.Where(x => x.C.Calls is not null).OrderBy(x => Tenders(x.C)).ThenByDescending(x => x.C.SeaDays ?? 0).ThenBy(x => x.C.Id, StringComparer.Ordinal));
        // If the strict pass left fewer than two, take the next-best sailing that departs in a different month.
        if (chosen.Count < 2)
            foreach (var x in byFit.Where(x => chosen.All(y => y.C.Id != x.C.Id && y.C.Departure.Month != x.C.Departure.Month))) { chosen.Add((x.C, x.F, "another")); break; }

        var lead = chosen[0].C;
        var dirs = chosen.Select(x => new DiscoverDirectionDto(x.Kind, KindLabel(x.Kind), x.C.Id, x.C.Title, x.C.Departure.ToString("yyyy-MM-dd"), x.C.Nights, x.C.PerNightCents, x.F.Met, x.F.Missed, x.F.NoData, TradeOffs(lead, x.C, x.Kind))).ToList();
        return new(dirs, open.Count, dirs.Count < 2 ? "onlyOne" : null);
    }

    private static string KindLabel(string kind) => kind switch
    {
        "bestFit" => "Closest to what you asked", "lowestPrice" => "Lowest price a night", "mostPorts" => "Most ports", "calmest" => "Calmest: least tendering", _ => "Another option",
    };

    private static List<string> TradeOffs(DiscoverCandidate lead, DiscoverCandidate c, string kind)
    {
        var lines = new List<string>();
        if (c.Id == lead.Id)
        {
            lines.Add(c.PerNightCents is { } p ? $"From {Money(p)} a person a night (two sharing, cheapest room type, before taxes)." : "No fare is published for this sailing yet.");
            if (c.Calls is { } calls) lines.Add($"{calls.Count} port{(calls.Count == 1 ? "" : "s")}, {c.SeaDays} sea day{(c.SeaDays == 1 ? "" : "s")}, {Tenders(c)} tender port{(Tenders(c) == 1 ? "" : "s")}.");
            return lines;
        }
        if (c.PerNightCents is { } a && lead.PerNightCents is { } b && a != b) lines.Add(a < b ? $"{Money(b - a)} a night less than the closest-fit sailing." : $"{Money(a - b)} a night more than the closest-fit sailing.");
        else if (c.PerNightCents is null) lines.Add("No fare is published, so the price cannot be compared.");
        if (c.Calls is { } cc && lead.Calls is { } lc)
        {
            if (cc.Count != lc.Count) lines.Add($"{Math.Abs(cc.Count - lc.Count)} {(cc.Count > lc.Count ? "more" : "fewer")} port{(Math.Abs(cc.Count - lc.Count) == 1 ? "" : "s")}.");
            if (Tenders(c) != Tenders(lead)) lines.Add($"{Math.Abs(Tenders(c) - Tenders(lead))} {(Tenders(c) > Tenders(lead) ? "more" : "fewer")} tender port{(Math.Abs(Tenders(c) - Tenders(lead)) == 1 ? "" : "s")}.");
        }
        if (c.Nights != lead.Nights) lines.Add($"{Math.Abs(c.Nights - lead.Nights)} night{(Math.Abs(c.Nights - lead.Nights) == 1 ? "" : "s")} {(c.Nights > lead.Nights ? "longer" : "shorter")}.");
        if (lines.Count == 0) lines.Add("Much the same as the closest-fit sailing on price and ports; it differs in ship or date.");
        return lines;
    }

    // ---- Compare ----

    public const int WeightMax = 5;

    public static Dictionary<string, int> DefaultWeights() => Criteria.ToDictionary(c => c, _ => 3);

    /// <summary>Weights from 0 to 5 for known criteria only; anything missing is the default of 3. Null for a weight outside the range or a criterion that does not exist.</summary>
    public static Dictionary<string, int>? CleanWeights(Dictionary<string, int>? given)
    {
        var w = DefaultWeights();
        if (given is null) return w;
        foreach (var (k, v) in given)
        {
            if (!w.ContainsKey(k) || v is < 0 or > WeightMax) return null;
            w[k] = v;
        }
        return w;
    }

    private static double? Value(string criterion, DiscoverCandidate c, double? fit) => criterion switch
    {
        "price" => c.PerNightCents,
        "ports" => c.Calls?.Count,
        "seaDays" => c.SeaDays,
        "tender" => c.Calls is null ? null : Tenders(c),
        "fit" => fit,
        _ => null,
    };

    private static bool HigherIsBetter(string criterion) => criterion is "ports" or "fit";

    private static string Text(string criterion, DiscoverCandidate c, double? fit) => (criterion, Value(criterion, c, fit)) switch
    {
        (_, null) => "No data",
        ("price", { } v) => Money((long)v) + " a night",
        ("fit", { } v) => $"{Math.Round(v * 100)}% of your asks met",
        (_, { } v) => ((int)v).ToString(CultureInfo.InvariantCulture),
    };

    public static CompareDto Compare(IReadOnlyList<DiscoverCandidate> picked, Dictionary<string, int> weights, DiscoverFilters filters)
    {
        var fits = picked.ToDictionary(c => c.Id, c => filters.IsEmpty ? null : FitOf(filters, c).Ratio);
        var norm = new Dictionary<(string, string), double>();
        foreach (var crit in Criteria)
        {
            var vals = picked.Select(c => (c.Id, V: Value(crit, c, fits[c.Id]))).Where(x => x.V is not null).ToList();
            if (vals.Count == 0) continue;
            var lo = vals.Min(x => x.V!.Value); var hi = vals.Max(x => x.V!.Value);
            foreach (var (id, v) in vals) norm[(crit, id)] = hi == lo ? 1 : HigherIsBetter(crit) ? (v!.Value - lo) / (hi - lo) : (hi - v!.Value) / (hi - lo);
        }

        var rows = picked.Select(c =>
        {
            double sum = 0, wsum = 0;
            var missing = new List<string>();
            var cells = new List<CompareCellDto>();
            foreach (var crit in Criteria)
            {
                var known = Value(crit, c, fits[c.Id]) is not null;
                cells.Add(new(crit, Text(crit, c, fits[c.Id]), known, known && norm.TryGetValue((crit, c.Id), out var n) ? Math.Round(n, 3) : null));
                if (!known) { if (crit != "fit" || !filters.IsEmpty) missing.Add(CriterionName(crit)); continue; }
                sum += weights[crit] * norm[(crit, c.Id)]; wsum += weights[crit];
            }
            var score = wsum == 0 ? (int?)null : (int)Math.Round(100 * sum / wsum);
            return new CompareRowDto(c.Id, c.Title, score, cells, missing, PortNotes(c));
        }).OrderByDescending(r => r.Score ?? -1).ThenBy(r => r.SailingId, StringComparer.Ordinal).ToList();

        var choices = Criteria.Where(cr => norm.Keys.Any(k => k.Item1 == cr)).Select(cr =>
        {
            var best = norm.Where(k => k.Key.Item1 == cr).Max(k => k.Value);
            return new CompareChoiceDto(cr, CriterionLabel[cr], [.. norm.Where(k => k.Key.Item1 == cr && k.Value == best).Select(k => k.Key.Item2).Order(StringComparer.Ordinal)]);
        }).ToList();

        return new(rows, weights, Criteria, choices, "Per person a night, two sharing, in the cheapest room type of each sailing, before taxes. A room type is a category, not a particular cabin.",
            "Scores use only the criteria above and your weights. Nothing is ranked by what Princess would prefer you to book.");
    }

    private static string CriterionName(string crit) => crit switch { "price" => "Price", "ports" => "Ports", "seaDays" => "Sea days", "tender" => "Tendering", _ => "Fit to your asks" };

    /// <summary>Hours in each port, worked out from the arrival and departure times, and whether a tender is needed. Calls with no times say so.</summary>
    public static List<string> PortNotes(DiscoverCandidate c) =>
        c.Calls is null ? ["No itinerary is published for this sailing."] :
        [.. c.Calls.Select(x => $"{x.Port}: {(x.Hours is { } h ? $"{h:0.#} hours in port" : "hours not published")}, {(x.Tender ? "tender needed" : "alongside")}")];

    // ---- Brief ----

    public static string? BriefProblem(DiscoverBrief? b, ISet<string> knownSailings)
    {
        if (b is null) return "brief";
        if ((b.Text?.Length ?? 0) > TextMax || (b.Title?.Length ?? 0) > 60) return "tooLong";
        if (b.Filters is not null && Clean(b.Filters) is null) return "filters";
        if (b.Shortlist is { } s && (s.Length > ShortlistMax || s.Distinct().Count() != s.Length || s.Any(id => !knownSailings.Contains(id)))) return "shortlist";
        if (b.Weights is not null && CleanWeights(b.Weights) is null) return "weights";
        if (b.Needs is { } n && (n.Length > NeedsMax || n.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 60))) return "needs";
        return null;
    }

    /// <summary>The "our ideal cruise" text for sharing. Needs such as access or diet are left out unless the guest includes them.</summary>
    public static string ShareText(DiscoverBrief b, IReadOnlyDictionary<string, string> sailingTitles, bool includeNeeds)
    {
        var lines = new List<string> { b.Title is { Length: > 0 } t ? t : "Our ideal cruise" };
        var f = Clean(b.Filters ?? DiscoverFilters.None) ?? DiscoverFilters.None;
        if (f.Months is { Length: > 0 }) lines.Add("When: " + string.Join(", ", f.Months.Select(m => Cap(MonthNames[m - 1]))));
        if (f.NightsMin is not null || f.NightsMax is not null) lines.Add(f.NightsMin == f.NightsMax ? $"How long: {f.NightsMin} nights" : $"How long: {f.NightsMin ?? 1} to {f.NightsMax} nights");
        if (f.Regions is { Length: > 0 }) lines.Add("Where: " + string.Join(", ", f.Regions.Select(RegionName)));
        if (f.Warm is { } w) lines.Add(w ? "Weather: warm" : "Weather: cool");
        if (f.MaxTender is { } mt) lines.Add(mt == 0 ? "No tender ports" : $"At most {mt} tender port{(mt == 1 ? "" : "s")}");
        if (f.MaxPerNightCents is { } cap) lines.Add($"Budget: under {Money(cap)} a person a night");
        var short_ = (b.Shortlist ?? []).Where(sailingTitles.ContainsKey).Select(id => sailingTitles[id]).ToList();
        if (short_.Count > 0) lines.Add("Short list: " + string.Join("; ", short_));
        if (includeNeeds && b.Needs is { Length: > 0 }) lines.Add("Needs: " + string.Join(", ", b.Needs));
        return string.Join("\n", lines);
    }

    // ---- Booking help ----

    /// <summary>Likely slips in a name or date, as hints only. The booking validator stays the authority and may still refuse or accept what is said here.</summary>
    public static BookingCheckDto CheckBooking(BookingCheckRequest? r, DateOnly today)
    {
        var flags = new List<BookingFlagDto>();
        void Name(string field, string? v, string label)
        {
            var s = (v ?? "").Trim();
            if (s.Length == 0) return;
            if (s.Any(char.IsDigit)) flags.Add(new(field, "digits", $"The {label} has a number in it."));
            if (Regex.IsMatch(s, @"^(mr|mrs|ms|miss|dr|sir)\.?\s", RegexOptions.IgnoreCase)) flags.Add(new(field, "title", $"The {label} starts with a title. Leave titles out; the name should match the passport."));
            if (s.Length > 2 && (s == s.ToUpperInvariant() || s == s.ToLowerInvariant()) && s.Any(char.IsLetter)) flags.Add(new(field, "case", $"The {label} is all {(s == s.ToUpperInvariant() ? "capitals" : "lower case")}. Check it reads as it does on the passport."));
            if (s.Length == 1) flags.Add(new(field, "short", $"The {label} is one letter. Use the full name from the passport."));
        }
        Name("firstName", r?.FirstName, "first name");
        Name("lastName", r?.LastName, "last name");
        if (!string.IsNullOrWhiteSpace(r?.FirstName) && !string.IsNullOrWhiteSpace(r?.LastName) && r.FirstName.Trim().Equals(r.LastName.Trim(), StringComparison.OrdinalIgnoreCase))
            flags.Add(new("lastName", "same", "The first and last name are the same. Check they are not swapped or repeated."));
        if (DateOnly.TryParseExact(r?.BirthDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var born))
        {
            if (born > today) flags.Add(new("birthDate", "future", "The date of birth is in the future."));
            else if (born < today.AddYears(-110)) flags.Add(new("birthDate", "old", "The date of birth is more than 110 years ago. Check the year."));
            if (DateOnly.TryParseExact(r?.Departure, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var sails) && born <= today && born.AddYears(18) > sails)
                flags.Add(new("birthDate", "turns18", "This guest is under 18 when the ship sails. Check the date of birth; a guest under 18 must travel with an adult."));
        }
        else if (!string.IsNullOrWhiteSpace(r?.BirthDate)) flags.Add(new("birthDate", "format", "The date of birth should be year, month, day, like 1980-04-23."));
        if (DateOnly.TryParseExact(r?.Departure, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dep) && dep < today)
            flags.Add(new("departure", "past", "The sailing date has passed."));
        return new(flags, "The booking checks make the final decision. These are only hints.");
    }
}
