namespace Princess.Api.Domain;

/// <summary>What the guest wants from the week (the client's <c>WeekPrefs</c>). <see cref="MaxTour"/> is cents per adult, or null for no limit.</summary>
public sealed record WeekPrefsDto(string Pace, string Mobility, bool WithKids, IReadOnlyList<string> Tours, IReadOnlyList<string> Events, long? MaxTour, bool NoEarly, IReadOnlyList<RestBlockDto>? Rest = null);

/// <summary>A part of a day the guest set aside to do nothing (<c>all</c>, <c>morning</c>, <c>afternoon</c> or <c>evening</c>); the week builder plans nothing that starts inside it.</summary>
public sealed record RestBlockDto(int Day, string Part);

public sealed record WeekItemDto(string Kind, string Id, string Title, string Start, string Why);

/// <summary><see cref="Base"/> is the day under the guest's own wishes and <see cref="Target"/> the day under the week's (a relaxed week keeps tours easy), so applying a week needs no day plan of its own.</summary>
public sealed record WeekDayDto(int Day, string Port, IReadOnlyList<WeekItemDto> Items, bool RestDay, string? Alternative, long TourCost, IReadOnlyList<PlanEntryDto> Base, IReadOnlyList<PlanEntryDto> Target);

public sealed record WeekDto(IReadOnlyList<WeekDayDto> Days, long TotalTours, WeekPrefsDto Prefs);

public sealed record AutopilotPlanRequest(string? SailingId, WeekPrefsDto? Prefs);

/// <summary>
/// "Build my day" and the week optimiser, ported from <c>buildDay</c> in <c>src/domain/day.ts</c> and <c>optimiseWeek</c> in <c>src/domain/autopilot.ts</c>
/// (multi-device plan 3, Phase 4). Pure and deterministic: the same wishes always give the same week. Nothing here books or charges.
/// </summary>
public static class AutopilotRules
{
    public static readonly string[] Paces = ["relaxed", "balanced", "packed"];

    /// <summary>Whether a request's preferences are well formed: known pace and mobility, known interests, a sensible budget.</summary>
    public static bool Valid(WeekPrefsDto? p) =>
        p is not null && Paces.Contains(p.Pace) && DayPlanRules.Valid(Wish(p, p.Mobility)) && RestValid(p.Rest);

    public static readonly string[] RestParts = ["all", "morning", "afternoon", "evening"];
    public const int MaxRestBlocks = 8;

    /// <summary>At most one block a day, each on a day of the cruise (1 to 8) with a known part.</summary>
    public static bool RestValid(IReadOnlyList<RestBlockDto>? rest) =>
        rest is null || rest.Count <= MaxRestBlocks && rest.All(r => r is not null && r.Day is >= 1 and <= Itinerary.MaxDay && RestParts.Contains(r.Part)) && rest.Select(r => r.Day).Distinct().Count() == rest.Count;

    /// <summary>The minutes of the day (start included, end not) a rest part covers.</summary>
    public static (int From, int To) RestWindow(string part) => part switch
    {
        "morning" => (0, 12 * 60),
        "afternoon" => (12 * 60, 18 * 60),
        "evening" => (18 * 60, 24 * 60),
        _ => (0, 24 * 60),
    };

    /// <summary>Whether a start time ("HH:mm") on a day falls inside that day's rest block.</summary>
    public static bool InRest(IReadOnlyList<RestBlockDto>? rest, int day, string start)
    {
        var block = rest?.FirstOrDefault(r => r.Day == day);
        if (block is null || start.Length < 5) return false;
        var m = Minutes(start);
        var (from, to) = RestWindow(block.Part);
        return m >= from && m < to;
    }

    private static DayWishDto Wish(WeekPrefsDto p, string mobility) => new(p.Tours, p.Events, mobility, p.WithKids, p.MaxTour);

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2], System.Globalization.CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], System.Globalization.CultureInfo.InvariantCulture);

    private static int EventsPerDay(string pace, bool port) => (pace, port) switch
    {
        ("relaxed", false) => 1, ("relaxed", true) => 0,
        ("balanced", false) => 2, ("balanced", true) => 1,
        (_, false) => 3,
        _ => 2,
    };

    /// <summary>One conflict-free plan for the whole week. A relaxed week keeps tours easy and leaves some port days free.</summary>
    public static WeekDto OptimiseWeek(Timeline timeline, WeekPrefsDto prefs)
    {
        var days = new List<WeekDayDto>();
        foreach (var d in timeline.Days)
        {
            var mobility = prefs.Pace == "relaxed" && prefs.Mobility == "any" ? "easy" : prefs.Mobility;
            var plan = DayPlanRules.Build(timeline, d.Day, Wish(prefs, mobility)).Items;
            var basePlan = DayPlanRules.Build(timeline, d.Day, Wish(prefs, prefs.Mobility)).Items;
            var port = timeline.IsCall(d);
            var limit = EventsPerDay(prefs.Pace, port);
            var events = 0;
            var items = new List<WeekItemDto>();
            foreach (var i in plan)
            {
                if (i.Kind == "event") { if (events >= limit) continue; events++; }
                if (prefs.NoEarly && Minutes(i.Start) < 9 * 60 && i.Kind != "dinner") continue;
                if (InRest(prefs.Rest, d.Day, i.Start)) continue;
                items.Add(new(i.Kind, i.Id, i.Title, i.Start, i.Why));
            }
            var tour = items.FirstOrDefault(i => i.Kind == "tour");
            var x = tour is null ? null : ExcursionRules.ById(tour.Id);
            var stronger = port && tour is null ? plan.FirstOrDefault(i => i.Kind == "tour" && !InRest(prefs.Rest, d.Day, i.Start)) : null;
            days.Add(new(d.Day, d.Port, items, port && tour is null,
                stronger is not null ? $"{stronger.Title}, if you want to go ashore" : tour is not null && prefs.Pace != "packed" ? "A free day on board instead of the tour" : null,
                x?.Price ?? 0, basePlan, plan));
        }
        return new(days, days.Sum(x => x.TourCost), prefs);
    }
}
