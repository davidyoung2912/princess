using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>One step of a bundle: when, what, how it stands (booked already, or a suggestion nothing has been done for) and the screen that does it.</summary>
public sealed record BundleStep(string Id, string Start, int Minutes, string Kind, string Title, string Status, string Why, string Route);

/// <summary>A bundle: the ordered steps of an evening or a day at a chosen pace, the time to be back aboard, and what it could not check. Nothing in it has been booked.</summary>
public sealed record BundleDto(bool HasPlan, string Scope, string Pace, int Day, string? Port, string? BackBy, IReadOnlyList<BundleStep> Steps, IReadOnlyList<string> Clashes, IReadOnlyList<string> NotChecked);

/// <summary>A draft for the guest to read, change and send themselves. Stanley never sends it.</summary>
public sealed record DraftNoteDto(string Kind, string Text, IReadOnlyList<string> Inputs);

/// <summary>The facts a bundle is built from: the sailing day, what the guest booked and what the ship offers. No names, numbers or party details.</summary>
public sealed record BundleFacts(Timeline Timeline, int Day, IReadOnlyList<CheckTour> Tours, IReadOnlyList<StanleyItem> Meals, bool WithKids, string Mobility);

/// <summary>
/// Bundles (ACT-01) and drafts for approval (ACT-03), docs/stanley-actions-and-proactive-plan.md section 4. Pure and deterministic. A bundle is a read-only ordered plan for an evening or a day built on the
/// day planner: booked tours and dinners are kept as they are, the rest are suggestions, a pace (relaxed, balanced, packed) sets how many, and a clash or a tight finish before all aboard is said out loud.
/// Each step is a screen to open; the guest does each one there, so nothing here books, holds, pays or sends.
/// </summary>
public static class StanleyBundleRules
{
    public const string Evening = "evening", FullDay = "day", Relaxed = "relaxed", Balanced = "balanced", Packed = "packed";
    public const int EveningFrom = 17 * 60, TightMinutes = 30, MaxPaceSteps = 3;
    public static readonly string[] Scopes = [Evening, FullDay];
    public static readonly string[] Paces = [Relaxed, Balanced, Packed];
    public static readonly string[] Drafts = ["party-plan", "late-note"];

    public static bool ScopeOk(string? s) => s is Evening or FullDay;
    public static bool PaceOk(string? p) => p is Relaxed or Balanced or Packed;
    public static bool DraftOk(string? k) => k is "party-plan" or "late-note";

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2], CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], CultureInfo.InvariantCulture);
    private static string Hm(int minutes) => $"{minutes / 60:00}:{minutes % 60:00}";
    private static string Clock(int minutes) => TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(minutes)).ToString("h:mm tt", CultureInfo.InvariantCulture);

    /// <summary>How many suggested things of each pace go with the booked ones (dinner is separate and always offered).</summary>
    public static int Slots(string pace) => pace switch { Relaxed => 1, Packed => MaxPaceSteps, _ => 2 };

    public static IReadOnlyList<string> NotChecked() =>
        ["Walking times between places (steps are in time order only)", "Whether a show or table still has space (nothing is held)", "Whether a step suits a traveller's pace or access"];

    public static BundleDto Build(string scope, string pace, BundleFacts f)
    {
        if (f.Day < 1 || f.Day > f.Timeline.Days.Count) return new(false, scope, pace, f.Day, null, null, [], [], NotChecked());
        var day = f.Timeline.Days[f.Day - 1];
        var wish = new DayWishDto([], [], f.Mobility, f.WithKids, null);
        var (suggested, backBy) = DayPlanRules.Build(f.Timeline, f.Day, wish);
        var steps = new List<BundleStep>();

        // Booked things are kept exactly as booked.
        foreach (var t in f.Tours.Where(t => t.Day == f.Day && (scope == FullDay || Minutes(t.Start) + (int)Math.Round(t.Hours * 60) > EveningFrom)))
            steps.Add(new($"tour:{t.Name}", t.Start, (int)Math.Round(t.Hours * 60), "tour", t.Name, "booked", "you booked this", "/plan/excursions"));
        var bookedMeals = f.Meals.Where(m => m.Day == f.Day && m.Time is not null).ToList();
        foreach (var m in bookedMeals)
            steps.Add(new($"dinner:{m.Name}", m.Time!, DayPlanRules.DinnerMinutes, "dinner", m.Name, "booked", "you booked this", "/plan/dining"));

        // Suggestions: dinner only when none is booked, then up to the pace's number of other things; a tour is suggested only when none is booked.
        var haveTour = steps.Any(s => s.Kind == "tour");
        var room = Slots(pace);
        foreach (var s in suggested.OrderBy(s => Minutes(s.Start)).ThenBy(s => s.Id, StringComparer.Ordinal))
        {
            if (s.Kind == "dinner") { if (bookedMeals.Count == 0) steps.Add(new($"dinner:{s.Id}", s.Start, s.Minutes, "dinner", s.Title, "suggested", s.Why, s.Path)); continue; }
            if (scope == Evening && Minutes(s.Start) < EveningFrom) continue;
            if (s.Kind == "tour" && (haveTour || scope == Evening)) continue;
            if (room <= 0) continue;
            if (steps.Any(x => Overlaps(x.Start, x.Minutes, s.Start, s.Minutes))) continue;   // never stack a suggestion on something already in the plan
            steps.Add(new($"{s.Kind}:{s.Id}", s.Start, s.Minutes, s.Kind, s.Title, "suggested", s.Why, s.Path));
            room--;
        }
        var ordered = steps.OrderBy(s => Minutes(s.Start)).ThenBy(s => s.Id, StringComparer.Ordinal).ToList();
        var back = day.AllAboard is { } b ? Hm(b.Hour * 60 + b.Minute) : null;
        return new(ordered.Count > 0, scope, pace, f.Day, day.Port == "sea" ? "sea" : day.Port, back, ordered, Clashes(ordered, day), NotChecked());
    }

    private static bool Overlaps(string startA, int minA, string startB, int minB)
    {
        int a = Minutes(startA), b = Minutes(startB);
        return a < b + minB && b < a + minA;
    }

    /// <summary>Overlaps between any two steps, and a step that ends within <see cref="TightMinutes"/> of all aboard or after it. Said in words so a guest can act on it.</summary>
    public static IReadOnlyList<string> Clashes(IReadOnlyList<BundleStep> steps, ItineraryDay day)
    {
        var list = new List<string>();
        for (var i = 0; i < steps.Count; i++)
            for (var j = i + 1; j < steps.Count; j++)
                if (Overlaps(steps[i].Start, steps[i].Minutes, steps[j].Start, steps[j].Minutes))
                    list.Add($"{steps[i].Title} and {steps[j].Title} overlap.");
        if (day.AllAboard is { } a && day.Port != "sea")
        {
            var limit = a.Hour * 60 + a.Minute;
            foreach (var s in steps.Where(s => s.Kind == "tour"))
            {
                var end = Minutes(s.Start) + s.Minutes;
                if (end > limit) list.Add($"{s.Title} ends after all aboard ({Clock(limit)}).");
                else if (limit - end < TightMinutes) list.Add($"{s.Title} ends only {limit - end} minutes before all aboard.");
            }
        }
        return list;
    }

    /// <summary>A short note for the guest to check, change and send. It names times and places only, never a person, and says plainly that nothing has been sent.</summary>
    public static DraftNoteDto? Draft(string kind, BundleDto bundle)
    {
        if (!DraftOk(kind) || !bundle.HasPlan) return null;
        var lines = new List<string>();
        if (kind == "late-note")
        {
            lines.Add(bundle.BackBy is { } back ? $"Hello, I may be late back to the ship. All aboard is {Clock(Minutes(back))}." : "Hello, I may be late to our plans.");
            lines.Add("Please do not wait for me. I will message when I am close.");
            return new(kind, string.Join("\n", lines), ["all aboard time"]);
        }
        lines.Add(bundle.Scope == Evening ? $"Plan for tonight (day {bundle.Day}):" : $"Plan for today (day {bundle.Day}):");
        foreach (var s in bundle.Steps) lines.Add($"{Clock(Minutes(s.Start))}  {s.Title}{(s.Status == "suggested" ? " (idea, not booked)" : "")}");
        if (bundle.BackBy is { } b2) lines.Add($"Back on board by {Clock(Minutes(b2))}.");
        return new(kind, string.Join("\n", lines), ["booked tours and dinner", "suggested ideas", "all aboard time"]);
    }
}
