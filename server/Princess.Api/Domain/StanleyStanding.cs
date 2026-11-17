using System.Globalization;
using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>One template a guest can switch on: its id (RUL-01 to RUL-06, or VAL-03 for a space on a tour), the sentence, what sets it off, the rung it works at and the permission row that must be on.</summary>
public sealed record StandingTemplate(string Id, string Wording, string Trigger, int Rung, string Row, string Param);

/// <summary>
/// A rule the guest made. It holds ids, a day and a time only, never the guest's words. <c>Practice</c> means it works out what it would do and lists it without offering anything.
/// <c>Seen</c> is the last count of free places or tables the watch saw (-1 before the first look, -2 while an opening still stands), which is how an opening is told from a place that was always free.
/// </summary>
public sealed record StandingRule(string Id, string Template, bool Practice, string Target = "", int Day = 0, string Time = "", int Seen = -1);

/// <summary>What is stored for a guest: their rules, and their answer to "More, the same, or less?".</summary>
public sealed record StandingDoc(List<StandingRule>? Rules = null, string Pace = "", string PaceAt = "")
{
    public List<StandingRule> RuleList => Rules ?? [];
}

public sealed record StandingRuleDto(string Id, string Template, string Wording, int Rung, bool Practice, string Target, int Day, string Time, string State);

/// <summary>One thing a rule has to say. <c>Kind</c> is <c>notice</c> (a fact to know), <c>prepared</c> (something lined up for the guest to open and decide) or <c>would</c> (what a rule in practice would have offered; nothing is offered).</summary>
public sealed record StandingItem(string Id, string RuleId, string Template, string Kind, bool Critical, string Title, string Detail, string Route);

/// <summary>Something a watch can name: a restaurant or a tour, by id and name.</summary>
public sealed record StandingChoice(string Id, string Name);

public sealed record StandingDto(
    bool Enabled, bool HasTrip, IReadOnlyList<StandingTemplate> Templates, IReadOnlyList<StandingRuleDto> Rules, IReadOnlyList<StandingItem> Items, IReadOnlyList<StandingItem> Practice,
    int Rolled, int MaxRules, IReadOnlyList<string> NotChecked, string? AsOf, IReadOnlyList<StandingChoice> Tables, IReadOnlyList<StandingChoice> Tours, int Nights = 0, IReadOnlyList<string>? Times = null);

public sealed record StandingPracticeRequest(bool Practice);
public sealed record PaceRequest(string? Answer);
public sealed record StandingRequest(string? Template, string? Target, int? Day, string? Time, bool? Practice);

/// <summary>A change on record that a rule may react to: its kind, the day, a title, how serious it is and what it touches.</summary>
public sealed record StandingChange(string Id, string Kind, int? Day, string Title, string Consequence, bool Critical, IReadOnlyList<ChangeAffect> Affects);

/// <summary>What the rules read. Places left are asked through delegates so the real inventory (or a mock of it) stays behind its interface.</summary>
public sealed record StandingFacts(
    int Day, DateOnly Today, DateTime Now, Timeline Timeline, IReadOnlyList<CheckTour> Tours, IReadOnlyList<StanleyItem> Meals, string CheckinState, DateTime CheckinOpensAt,
    IReadOnlyList<StandingChange> Changes, Func<string, int> PlacesOnTour, Func<string, int, string, int> TablesAt, IReadOnlySet<string> RowsOn);

/// <summary>
/// The rung 3 standing rules (docs/stanley-actions-and-proactive-plan.md section 4.D and 19.2): "when X happens, prepare Y". Pure and deterministic. A rule only ever notices or lines something up
/// for the guest to open and decide; it never books, pays, cancels, holds anything or messages another person. A rule whose permission row is off says so and does nothing. A rule in practice
/// is listed as what it would have done and offers nothing until the guest graduates it.
/// </summary>
public static class StanleyStandingRules
{
    public const int MaxRules = 10, MaxPrepared = 5;
    public const string StateKey = "stanleyStanding";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static readonly IReadOnlyList<StandingTemplate> Templates =
    [
        new("RUL-01", "If my excursion is cancelled or moved, find me a replacement", "A change on record for a day with a tour you booked", 3, "CL-05", "none"),
        new("RUL-02", "Keep my dinner at this time if the show moves", "A programme change on a day you have that dinner", 3, "CL-05", "time"),
        new("RUL-03", "Tell me when check-in opens", "Check-in opens", 1, "CL-02", "none"),
        new("RUL-04", "Tell me if tenders are delayed on port days", "A tender change on record", 1, "CL-02", "none"),
        new("RUL-05", "If a table opens, tell me and line it up", "A table that was full has places", 3, "CL-07", "table"),
        new("RUL-06", "Remind me to set out my formal clothes the night before formal night", "The evening before the night you name", 1, "CL-02", "day"),
        new("VAL-03", "Tell me if this excursion gets space", "A tour that was full has places", 3, "CL-07", "tour"),
    ];

    public static StandingTemplate? Template(string? id) => Templates.FirstOrDefault(t => t.Id == id);

    public static StandingDoc Parse(string? json)
    {
        try
        {
            if (JsonSerializer.Deserialize<StandingDoc>(json ?? "null", Json) is { } d)
                return d with { Rules = [.. d.RuleList.Where(r => Template(r.Template) is not null).Take(MaxRules)], Pace = PaceOk(d.Pace) ? d.Pace : "" };
        }
        catch (JsonException) { }
        return new();
    }

    public static string ToJson(StandingDoc d) => JsonSerializer.Serialize(d, Json);

    public static bool PaceOk(string? pace) => pace is "more" or "same" or "less";

    public static string Wording(StandingRule r) => r.Template switch
    {
        "RUL-02" => $"Keep my dinner at {r.Time} if the show moves",
        "RUL-05" => $"If a table opens at {DiningRules.VenueById(r.Target)?.Name ?? "that restaurant"} on day {r.Day}, tell me and line it up",
        "RUL-06" => $"Remind me to set out my formal clothes the night before day {r.Day}",
        "VAL-03" => $"Tell me if {ExcursionRules.ById(r.Target)?.Name ?? "this excursion"} gets space",
        _ => Template(r.Template)?.Wording ?? "",
    };

    /// <summary>The rule this request makes, or null with the closed reason it cannot: <c>template</c>, <c>full</c> (ten rules), <c>time</c>, <c>day</c>, <c>target</c> or <c>duplicate</c>.</summary>
    public static StandingRule? Make(StandingDoc doc, StandingRequest? body, int nights, string id, out string? problem)
    {
        problem = null;
        if (body is null || Template(body.Template) is not { } t) { problem = "template"; return null; }
        if (doc.RuleList.Count >= MaxRules) { problem = "full"; return null; }
        string target = "", time = "";
        var day = 0;
        switch (t.Param)
        {
            case "time":
                if (!DiningRules.DinnerTimes.Contains(body.Time ?? "")) { problem = "time"; return null; }
                time = body.Time!;
                break;
            case "day":
                if (body.Day is not { } d6 || d6 < 2 || d6 > nights) { problem = "day"; return null; }
                day = d6;
                break;
            case "table":
                if (DiningRules.VenueById(body.Target) is not { } v || v.Kind == "main") { problem = "target"; return null; }
                if (body.Day is not { } d5 || d5 < 1 || d5 > nights) { problem = "day"; return null; }
                target = v.Id; day = d5; time = body.Time is { Length: > 0 } tm && DiningRules.DinnerTimes.Contains(tm) ? tm : "";
                if (body.Time is { Length: > 0 } && time.Length == 0) { problem = "time"; return null; }
                break;
            case "tour":
                if (ExcursionRules.ById(body.Target) is not { } x) { problem = "target"; return null; }
                target = x.Id;
                break;
        }
        var rule = new StandingRule(id, t.Id, body.Practice ?? false, target, day, time);
        if (doc.RuleList.Any(r => r.Template == rule.Template && r.Target == rule.Target && r.Day == rule.Day && r.Time == rule.Time)) { problem = "duplicate"; return null; }
        return rule;
    }

    public static IReadOnlyList<StandingRuleDto> View(StandingDoc doc, IReadOnlySet<string> rowsOn) =>
        [.. doc.RuleList.Select(r => new StandingRuleDto(r.Id, r.Template, Wording(r), Template(r.Template)!.Rung, r.Practice, r.Target, r.Day, r.Time, rowsOn.Contains(Template(r.Template)!.Row) ? (r.Practice ? "practice" : "on") : "needsPermission"))];

    private static string Route(string path) => path;

    /// <summary>The items each rule has right now, and the rules with their new <c>Seen</c> counts (so an opening is noticed once). Items of a rule whose permission is off are not made.</summary>
    public static (IReadOnlyList<StandingItem> Items, IReadOnlyList<StandingRule> Rules, IReadOnlyList<string> NotChecked) Evaluate(StandingDoc doc, StandingFacts f)
    {
        var items = new List<StandingItem>();
        var rules = new List<StandingRule>();
        foreach (var r in doc.RuleList)
        {
            var t = Template(r.Template)!;
            var made = new List<StandingItem>();
            var seen = r.Seen;
            if (f.RowsOn.Contains(t.Row))
            {
                switch (r.Template)
                {
                    case "RUL-01": made.AddRange(Replacement(r, f)); break;
                    case "RUL-02": made.AddRange(KeepDinner(r, f)); break;
                    case "RUL-03": made.AddRange(CheckinOpens(r, f)); break;
                    case "RUL-04": made.AddRange(Tenders(r, f)); break;
                    case "RUL-06": made.AddRange(Formal(r, f)); break;
                    case "RUL-05" or "VAL-03": made.AddRange(Watch(r, f, out seen)); break;
                }
            }
            rules.Add(r with { Seen = seen });
            items.AddRange(r.Practice ? made.Select(i => i with { Kind = "would" }) : made);
        }
        return (items, rules, NotChecked(doc));
    }

    public static IReadOnlyList<string> NotChecked(StandingDoc doc)
    {
        var list = new List<string> { "Rules are checked when you open this screen, not in the background, so I cannot tell you about a change while the app is closed" };
        if (doc.RuleList.Any(r => r.Template is "RUL-05" or "VAL-03")) list.Add("A place I see free may be taken before you open it, and I never hold one for you");
        if (doc.RuleList.Any(r => r.Template == "RUL-02")) list.Add("I tell you when a dinner no longer matches your time; I do not move it myself");
        return list;
    }

    private static StandingItem Item(StandingRule r, string what, string kind, string title, string detail, string route, bool critical = false) =>
        new($"{r.Id}:{what}", r.Id, r.Template, kind, critical, title, detail, route);

    private static IEnumerable<StandingItem> Replacement(StandingRule r, StandingFacts f)
    {
        foreach (var c in f.Changes.Where(c => c.Kind is ChangeKinds.Itinerary or ChangeKinds.PortCall or ChangeKinds.Reservation && c.Consequence != ChangeConsequence.Optional))
            foreach (var a in c.Affects.Where(a => a.Kind == "tour"))
            {
                var booked = ExcursionRules.Catalogue.FirstOrDefault(x => x.Name == a.Name);
                List<string> others = booked is null ? [] : ExcursionRules.Catalogue.Where(x => x.Port == booked.Port && x.Id != booked.Id && f.PlacesOnTour(x.Id) > 0).Take(3).Select(x => x.Name).ToList();
                var detail = others.Count > 0
                    ? $"{a.Name} on day {a.Day} may be affected: {c.Title}. Same-day options with places left: {string.Join(", ", others)}. Nothing is booked until you choose."
                    : $"{a.Name} on day {a.Day} may be affected: {c.Title}. I found no other tour that day with places left. Nothing is booked.";
                yield return Item(r, $"{c.Id}:{a.Name}", "prepared", $"Your tour on day {a.Day} may need a replacement", detail, Route("/excursions-explorer"), c.Critical);
            }
    }

    private static IEnumerable<StandingItem> KeepDinner(StandingRule r, StandingFacts f)
    {
        foreach (var c in f.Changes.Where(c => c.Kind == ChangeKinds.Itinerary && c.Day is not null && c.Consequence != ChangeConsequence.Optional))
        {
            var kept = f.Meals.Any(m => m.Day == c.Day && m.Time == r.Time);
            yield return kept
                ? Item(r, $"{c.Id}:kept", "notice", $"Your dinner on day {c.Day} is still at {r.Time}", $"The programme changed ({c.Title}). Your booked dinner is still at {r.Time}, as you asked. I have not moved it.", Route("/dining-today"))
                : Item(r, $"{c.Id}:cannot", "prepared", $"I cannot keep a dinner at {r.Time} on day {c.Day}", $"The programme changed ({c.Title}) and you have no dinner booked at {r.Time} that day. Open dining to choose one.", Route("/dining-today"), c.Critical);
        }
    }

    private static IEnumerable<StandingItem> CheckinOpens(StandingRule r, StandingFacts f)
    {
        if (f.CheckinState == "open") yield return Item(r, "open", "notice", "Online check-in is open", "You can start it now.", "/home/check-in");
        else if (f.CheckinState == "notOpen" && f.CheckinOpensAt - f.Now <= TimeSpan.FromHours(48) && f.CheckinOpensAt > f.Now)
            yield return Item(r, "soon", "notice", "Online check-in opens soon", $"It opens on {f.CheckinOpensAt.ToString("dddd d MMMM", CultureInfo.InvariantCulture)}.", "/home/check-in");
    }

    private static IEnumerable<StandingItem> Tenders(StandingRule r, StandingFacts f)
    {
        foreach (var c in f.Changes.Where(c => c.Kind == ChangeKinds.Tender))
            yield return Item(r, c.Id, "notice", c.Title, c.Critical ? "The time you have to get back is gone or nearly gone. Leave extra time." : "Tenders may run slowly. Leave extra time to get back.", "/plan/autopilot", c.Critical);
    }

    private static IEnumerable<StandingItem> Formal(StandingRule r, StandingFacts f)
    {
        if (f.Day == r.Day - 1) yield return Item(r, "tonight", "notice", "Set out your formal clothes tonight", $"Tomorrow, day {r.Day}, is the night you named.", "/plan/autopilot");
    }

    private static IEnumerable<StandingItem> Watch(StandingRule r, StandingFacts f, out int seen)
    {
        var places = r.Template == "VAL-03" ? f.PlacesOnTour(r.Target) : f.TablesAt(r.Target, r.Day, r.Time);
        // -2 means "opened and still open": the item stays until the places go again or the rule is removed, so the guest who opens the screen later still sees it.
        var opened = places > 0 && r.Seen is 0 or -2;
        seen = opened ? -2 : places;
        var name = r.Template == "VAL-03" ? ExcursionRules.ById(r.Target)?.Name ?? "That tour" : DiningRules.VenueById(r.Target)?.Name ?? "That restaurant";
        if (!opened) return [];
        var route = r.Template == "VAL-03" ? "/excursions-explorer" : "/dining-today";
        var what = r.Template == "VAL-03" ? $"{name} has places left" : $"A table has opened at {name} on day {r.Day}{(r.Time.Length > 0 ? " at " + r.Time : "")}";
        return [Item(r, $"open:{places}", "prepared", what, "I am not holding it. Open it to book, before someone else does.", route)];
    }

    /// <summary>Items with at most <see cref="MaxPrepared"/> prepared ones kept in the order made; the rest are counted, not shown.</summary>
    public static (IReadOnlyList<StandingItem> Shown, IReadOnlyList<StandingItem> Practice, int Rolled) Limit(IReadOnlyList<StandingItem> items)
    {
        var practice = items.Where(i => i.Kind == "would").ToList();
        var live = items.Where(i => i.Kind != "would").ToList();
        var prepared = live.Where(i => i.Kind == "prepared").Take(MaxPrepared).ToHashSet();
        var shown = live.Where(i => i.Kind != "prepared" || prepared.Contains(i)).OrderBy(i => i.Critical ? 0 : 1).ToList();
        return (shown, practice, live.Count - shown.Count);
    }
}
