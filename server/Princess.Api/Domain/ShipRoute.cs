using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>A place a route starts or ends at: a listed place of the ship, a cabin, or a whole deck.</summary>
public sealed record RoutePlace(string Id, string Name, int Deck, string Section, string Kind, bool StepFree, string? Note);

/// <summary>A way between two places in words, or why there is none. <c>Problem</c> is one of <c>unknown</c>, <c>same</c>, <c>notStepFree</c> (with <c>Instead</c>, a step-free place of the same kind) or <c>noWay</c>.</summary>
public sealed record RouteDto(string? Problem, List<string> Steps, int Minutes, bool StepFree, bool Rerouted, string? Instead);

/// <summary>
/// The way between two places on a ship, from the ship's deck plan (docs/stanley-gap-analysis-and-plan.md, the carry-over list: <c>get_route</c> was an outline because the server held no corridor graph). The
/// graph is the one the device's route finder uses: a hall for each section of each deck, a lift node for each bank on each deck, and a shaft joining the decks of a bank. The shortest way is found with
/// Dijkstra, so the same places, lifts and step-free rules apply in chat and on the map. A closed bank is left out and the way goes round it. Pure.
/// </summary>
public static class ShipRoute
{
    public static readonly string[] Sections = ["forward", "midship", "aft"];
    private static readonly Regex DeckWord = new(@"^\s*deck\s*(\d{1,2})(?:\s+(forward|midship|aft))?\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CabinWord = new(@"^\s*(?:cabin|stateroom|room)?\s*:?\s*(\d{4,5})\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static string Hall(int deck, string section) => $"hall:{deck}:{section}";
    private static string Lift(string bank, int deck) => $"lift:{bank}:{deck}";

    /// <summary>A cabin's place: the deck is the number without its last three digits, and low numbers are forward and high numbers aft (authored, as on most ships; verify against the real deck plan before real use).</summary>
    public static RoutePlace? CabinPlace(string number)
    {
        if (!Regex.IsMatch(number, @"^\d{4,5}$")) return null;
        var deck = int.Parse(number[..^3], CultureInfo.InvariantCulture);
        var room = int.Parse(number[^3..], CultureInfo.InvariantCulture);
        if (deck is < 2 or > 20) return null;
        return new RoutePlace("cabin:" + number, "Cabin " + number, deck, room < 200 ? "forward" : room < 350 ? "midship" : "aft", "service", true, null);
    }

    /// <summary>A place by id or name from the ship's plan, a cabin ("8123", "cabin 8123"), or a deck ("deck 9", "deck 9 aft"; midship when no end is given). Null when it is none of them.</summary>
    public static RoutePlace? Locate(string? text, AboardPlanDto plan)
    {
        var t = (text ?? "").Trim();
        if (t.Length == 0) return null;
        var place = plan.Places.FirstOrDefault(p => p.Id == t || p.Name.Equals(t, StringComparison.OrdinalIgnoreCase));
        if (place is not null) return new RoutePlace(place.Id, place.Name, place.Deck, place.Section, place.Kind, place.StepFree, place.Note);
        if (CabinWord.Match(t) is { Success: true } c) return CabinPlace(c.Groups[1].Value);
        if (DeckWord.Match(t) is { Success: true } d) return new RoutePlace("deck:" + d.Groups[1].Value, "Deck " + d.Groups[1].Value, int.Parse(d.Groups[1].Value, CultureInfo.InvariantCulture), d.Groups[2].Success ? d.Groups[2].Value.ToLowerInvariant() : "midship", "service", true, null);
        return null;
    }

    private sealed record Edge(string To, double Cost);

    private static Dictionary<string, List<Edge>> Graph(AboardPlanDto plan, IEnumerable<int> extraDecks, ISet<string> closed)
    {
        var g = new Dictionary<string, List<Edge>>();
        void Link(string a, string b, double cost)
        {
            if (!g.TryGetValue(a, out var la)) g[a] = la = [];
            if (!g.TryGetValue(b, out var lb)) g[b] = lb = [];
            la.Add(new Edge(b, cost));
            lb.Add(new Edge(a, cost));
        }
        var decks = plan.Places.Select(p => p.Deck).Concat(extraDecks).ToList();
        for (var deck = decks.Min(); deck <= decks.Max(); deck++)
        {
            // Walking along an upper deck costs a little less: ties go to riding first and walking where the destination is.
            var walk = 3 + 0.001 * (30 - deck);
            for (var i = 1; i < Sections.Length; i++) Link(Hall(deck, Sections[i - 1]), Hall(deck, Sections[i]), walk);
            foreach (var e in plan.Elevators)
            {
                if (closed.Contains(e.Bank)) continue;
                Link(Hall(deck, e.Section), Lift(e.Bank, deck), 1);
                Link(Lift(e.Bank, deck), "shaft:" + e.Bank, 2 + deck / 3.0);
            }
        }
        return g;
    }

    private static List<string>? Shortest(Dictionary<string, List<Edge>> g, string from, string to)
    {
        if (!g.ContainsKey(from) || !g.ContainsKey(to)) return null;
        var dist = new Dictionary<string, double> { [from] = 0 };
        var prev = new Dictionary<string, string>();
        var open = new HashSet<string> { from };
        while (open.Count > 0)
        {
            var cur = open.OrderBy(n => dist[n]).ThenBy(n => n, StringComparer.Ordinal).First();
            open.Remove(cur);
            if (cur == to) break;
            foreach (var e in g[cur])
            {
                var d = dist[cur] + e.Cost;
                if (!dist.TryGetValue(e.To, out var known) || d < known) { dist[e.To] = d; prev[e.To] = cur; open.Add(e.To); }
            }
        }
        if (!dist.ContainsKey(to)) return null;
        var path = new List<string> { to };
        while (path[0] != from) path.Insert(0, prev[path[0]]);
        return path;
    }

    private sealed record Waypoint(bool IsLift, int Deck, string Section, string Bank);

    private static List<Waypoint> Way(AboardPlanDto plan, List<string> path) =>
        [.. path.Select(n => n.Split(':')).Where(p => p[0] is "hall" or "lift").Select(p => p[0] == "hall"
            ? new Waypoint(false, int.Parse(p[1], CultureInfo.InvariantCulture), p[2], "")
            : new Waypoint(true, int.Parse(p[2], CultureInfo.InvariantCulture), plan.Elevators.First(e => e.Bank == p[1]).Section, p[1]))];

    private static List<string> Steps(AboardPlanDto plan, List<Waypoint> way, RoutePlace to)
    {
        var steps = new List<string>();
        var rode = false;
        var i = 0;
        while (i < way.Count)
        {
            var w = way[i];
            var j = i;
            while (j + 1 < way.Count && way[j + 1].IsLift == w.IsLift) j++;
            var last = way[j];
            if (!w.IsLift)
            {
                if (j > i || !rode)
                {
                    var hop = Array.IndexOf(Sections, last.Section) - Array.IndexOf(Sections, w.Section);
                    steps.Add(hop == 0 ? $"Stay at the {w.Section} end of deck {w.Deck}." : $"Walk {(hop > 0 ? "aft, towards the stern" : "forward, towards the bow")} along deck {w.Deck}.");
                }
            }
            else
            {
                var side = plan.Elevators.First(e => e.Bank == w.Bank).Side;
                steps.Add($"Take the {w.Bank} lifts ({w.Section}, {side} side) from deck {w.Deck} to deck {last.Deck}.");
                rode = true;
            }
            i = j + 1;
        }
        steps.Add($"{to.Name} is on deck {to.Deck}, {to.Section}.{(string.IsNullOrEmpty(to.Note) ? "" : " " + to.Note + ".")}");
        return steps;
    }

    private static RoutePlace? Instead(RoutePlace blocked, AboardPlanDto plan) =>
        plan.Places.Where(p => p.Kind == blocked.Kind && p.StepFree && p.Id != blocked.Id).OrderBy(p => Math.Abs(p.Deck - blocked.Deck)).Select(p => new RoutePlace(p.Id, p.Name, p.Deck, p.Section, p.Kind, p.StepFree, p.Note)).FirstOrDefault();

    /// <summary>The way between two places. With <paramref name="stepFree"/> both ends must be step-free (otherwise the nearest step-free place of the same kind is offered). <paramref name="closed"/> names lift banks to avoid.</summary>
    public static RouteDto Between(RoutePlace? a, RoutePlace? b, AboardPlanDto plan, bool stepFree, ISet<string>? closed = null)
    {
        if (a is null || b is null) return new("unknown", [], 0, false, false, null);
        if (a.Id == b.Id) return new("same", [], 0, a.StepFree, false, null);
        if (stepFree && new[] { a, b }.FirstOrDefault(p => !p.StepFree) is { } blocked) return new("notStepFree", [], 0, false, false, Instead(blocked, plan)?.Name);
        closed ??= new HashSet<string>();
        var decks = new[] { a.Deck, b.Deck };
        var path = Shortest(Graph(plan, decks, closed), Hall(a.Deck, a.Section), Hall(b.Deck, b.Section));
        if (path is null) return new("noWay", [], 0, false, false, null);
        var usual = closed.Count > 0 ? Shortest(Graph(plan, decks, new HashSet<string>()), Hall(a.Deck, a.Section), Hall(b.Deck, b.Section)) : path;
        var hop = Math.Abs(Array.IndexOf(Sections, a.Section) - Array.IndexOf(Sections, b.Section));
        var minutes = a.Deck == b.Deck ? 2 + 3 * hop : 4 + (int)Math.Ceiling(Math.Abs(a.Deck - b.Deck) / 3.0) + 3 * hop;
        return new(null, Steps(plan, Way(plan, path), b), minutes, a.StepFree && b.StepFree, closed.Count > 0 && usual is not null && !usual.SequenceEqual(path), null);
    }
}
