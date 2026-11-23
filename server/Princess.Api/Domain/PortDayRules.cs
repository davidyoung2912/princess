using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>A place the walking planner may choose: a port guide attraction with a map point.</summary>
public sealed record PortDayCandidate(string Name, string Tier, string Why, double Lat, double Lng);

public sealed record PortDayStop(string Name, string Tier, double Lat, double Lng, string ArriveAt, string LeaveAt, int WalkFromPrevious);

/// <summary><see cref="Reason"/> is null when there is a plan, else <c>noTime</c> or <c>fewPlaces</c>.</summary>
public sealed record PortDayPlanDto(IReadOnlyList<PortDayStop> Stops, int Usable, int Walking, int Visiting, int Meal, int Spare, int ReturnWalk, string HeadBackBy, string AllAboard, string? Reason);

/// <summary>
/// The walking port-day planner (docs/mcp-integration-plan.md, phase 4), the same rules as <c>src/maps/portDay.ts</c> so the page and Stanley agree: pick the
/// walking places, order them by nearest next stop and fit them between getting ashore and a buffer before the ship's published all-aboard time. The return time
/// comes only from the ship's schedule. The data has no pier position, so the walk is counted from the first stop and back to it.
/// </summary>
public static class PortDayRules
{
    public const double StreetFactor = 1.25;
    public const double SteadyKmh = 4.5;
    public const double EasyKmh = 3.2;
    public const int GetAshoreDock = 20, GetAshoreTender = 60, BufferDock = 60, BufferTender = 90;
    public const int DefaultVisit = 45, DefaultMaxStops = 6;
    private const double EarthKm = 6371.0088;

    public static double DistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        static double Rad(double d) => d * Math.PI / 180;
        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var h = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Pow(Math.Sin(dLng / 2), 2);
        return 2 * EarthKm * Math.Asin(Math.Min(1, Math.Sqrt(h)));
    }

    public static int WalkMinutes(double km, bool easy) =>
        km > 0 ? Math.Max(1, (int)Math.Round(km * StreetFactor / (easy ? EasyKmh : SteadyKmh) * 60, MidpointRounding.AwayFromZero)) : 0;

    public static int ToMinutes(string hhmm) => int.Parse(hhmm.AsSpan(0, 2), CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm.AsSpan(3, 2), CultureInfo.InvariantCulture);

    public static string Clock(int minutes)
    {
        var m = ((minutes % 1440) + 1440) % 1440;
        return $"{m / 60:00}:{m % 60:00}";
    }

    private static double Km(PortDayCandidate a, PortDayCandidate b) => DistanceKm(a.Lat, a.Lng, b.Lat, b.Lng);

    /// <summary>Walking places: a walk-off tier, or any place within 1.5 km of the first walk-off place.</summary>
    public static List<PortDayCandidate> Walkable(IReadOnlyList<PortDayCandidate> all)
    {
        static bool Off(PortDayCandidate c) => c.Tier.StartsWith("walk-off", StringComparison.OrdinalIgnoreCase);
        var first = all.FirstOrDefault(Off);
        return first is null ? [] : [.. all.Where(c => Off(c) || Km(first, c) <= 1.5)];
    }

    private static List<int> NearestOrder(IReadOnlyList<PortDayCandidate> points)
    {
        var left = Enumerable.Range(1, Math.Max(0, points.Count - 1)).ToList();
        var order = new List<int> { 0 };
        var here = points[0];
        while (left.Count > 0)
        {
            var best = left.OrderBy(i => Km(here, points[i])).First();
            left.Remove(best);
            order.Add(best);
            here = points[best];
        }
        return order;
    }

    private static (List<int> Order, int Walk, int Back, int Total) Cost(IReadOnlyList<PortDayCandidate> list, bool easy, int visit, int meal)
    {
        var order = NearestOrder(list);
        var walk = 0;
        for (var i = 1; i < order.Count; i++) walk += WalkMinutes(Km(list[order[i - 1]], list[order[i]]), easy);
        var back = WalkMinutes(Km(list[order[^1]], list[order[0]]), easy);
        return (order, walk, back, walk + back + list.Count * visit + meal);
    }

    public static PortDayPlanDto Plan(IReadOnlyList<PortDayCandidate> candidates, string arrive, string allAboard, bool tender, bool easy, int mealMinutes, int visit = DefaultVisit, int maxStops = DefaultMaxStops)
    {
        var meal = Math.Max(0, mealMinutes);
        var buffer = tender ? BufferTender : BufferDock;
        var start = ToMinutes(arrive) + (tender ? GetAshoreTender : GetAshoreDock);
        var aboard = ToMinutes(allAboard);
        var usable = aboard - buffer - start;
        PortDayPlanDto Empty(string reason) => new([], Math.Max(0, usable), 0, 0, 0, Math.Max(0, usable), 0, Clock(aboard - buffer), allAboard, reason);
        if (usable < visit) return Empty("noTime");
        var pool = Walkable(candidates);
        if (pool.Count < 2) return Empty("fewPlaces");

        var first = pool[0];
        var chosen = new List<PortDayCandidate> { first };
        foreach (var c in pool.Skip(1).OrderBy(c => Km(first, c)))
        {
            if (chosen.Count >= maxStops) break;
            if (Cost([.. chosen, c], easy, visit, meal).Total <= usable) chosen.Add(c);
        }
        if (chosen.Count < 2) return Empty("fewPlaces");

        var final = Cost(chosen, easy, visit, meal);
        var stops = new List<PortDayStop>();
        var t = start;
        PortDayCandidate? prev = null;
        foreach (var i in final.Order)
        {
            var c = chosen[i];
            var w = prev is null ? 0 : WalkMinutes(Km(prev, c), easy);
            t += w;
            stops.Add(new PortDayStop(c.Name, c.Tier, c.Lat, c.Lng, Clock(t), Clock(t + visit), w));
            t += visit;
            prev = c;
        }
        t += meal;
        return new PortDayPlanDto(stops, usable, final.Walk + final.Back, chosen.Count * visit, meal, usable - final.Total, final.Back, Clock(t), allAboard, null);
    }

    /// <summary>
    /// Short plain notes from the day's sky for a plan: rain inside the hours ashore, heat and strong sun. Never says a plan is unsafe or that rain will not come;
    /// it is a forecast (or an estimate), and the notes say what to bring or change. <paramref name="source"/> is the sky's own source label.
    /// </summary>
    public static List<string> WeatherNotes(SkyDto sky, string arrive, string allAboard)
    {
        var notes = new List<string>();
        var from = ToMinutes(arrive);
        var to = ToMinutes(allAboard);
        if (sky.RainFrom is { Length: >= 5 } rf && sky.RainTo is { Length: >= 5 } rt)
        {
            var rainFrom = ToMinutes(rf);
            var rainTo = ToMinutes(rt);
            if (rainFrom < to && rainTo > from)
                notes.Add($"Rain is likely from {rf} to {rt}, which overlaps your time ashore. Do the outdoor stops outside that window, and keep a museum, church or cafe in mind to shelter in.");
        }
        if (sky.TempF >= 90) notes.Add($"Hot, about {sky.TempF} F. Carry water, take the walk in the shade where you can, and plan a cool stop at midday.");
        if (sky.Uv >= 8) notes.Add($"Very strong sun (UV {sky.Uv}). Hat, sunscreen and sunglasses.");
        if (notes.Count == 0) notes.Add($"No weather problem is expected: about {sky.TempF} F, UV {sky.Uv}. Conditions can change; check the sky before you go.");
        return notes;
    }
}
