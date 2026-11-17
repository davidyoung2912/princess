namespace Princess.Api.Domain;

/// <summary>A default Stanley suggests from what the guest told him, with where it came from. It is shown, never applied: the guest sets it on the screen.</summary>
public sealed record ChecklistDefault(string Label, string Source);

/// <summary>One thing still to do. <see cref="Traveller"/> is a position ("Traveller 2") or 0 for the whole booking; <see cref="Route"/> is the screen that does it.</summary>
public sealed record StanleyChecklistItem(string Id, int Traveller, string Kind, string Title, string Route, ChecklistDefault? Default);

/// <summary>What the guest is shown: what is outstanding in a sensible order, how much is done, and what the list cannot see.</summary>
public sealed record ChecklistDto(bool HasTrip, IReadOnlyList<StanleyChecklistItem> Items, int Done, int Total, bool Complete, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>A traveller by position only, with the check-in steps still open for them.</summary>
public sealed record ChecklistPerson(int Position, bool Child, IReadOnlyList<string> Left);

public sealed record ChecklistFacts(
    string CheckinState, IReadOnlyList<ChecklistPerson> People, IReadOnlyList<string> BookingLeft, int GuestStepsTotal, int BookingStepsTotal,
    int Nights, int ToursBooked, int DinnersBooked, string? DiningPreference);

/// <summary>
/// The trip checklist concierge (ACT-02) and smart defaults (ACT-04), docs/stanley-actions-and-proactive-plan.md section 4. Pure and deterministic. It lists what is outstanding per traveller (check-in steps,
/// then dining and tours for the booking), each with the screen that does it, and ticks off by being recomputed from the real state. A remembered dinner preference is shown as a default with its source; it is
/// never applied for the guest. Documents are not repeated here: the trip check-up owns them.
/// </summary>
public static class StanleyChecklistRules
{
    private const string Checkin = "/home/check-in", Dining = "/plan/dining", Excursions = "/plan/excursions";
    public const int DinnerNights = 7;

    private static readonly Dictionary<string, string> Titles = new()
    {
        ["confirm"] = "Confirm details", ["document"] = "Add a travel document", ["photo"] = "Add a photo", ["emergency"] = "Add an emergency contact",
        ["payment"] = "Choose the card for onboard charges", ["contract"] = "Accept the booking terms", ["health"] = "Answer the health questions", ["arrival"] = "Choose an arrival time",
    };

    private static string Who(ChecklistFacts f, int position) => f.People.Count == 1 ? "" : $"Traveller {position}: ";

    public static IReadOnlyList<string> NotChecked(ChecklistFacts f) =>
        ["Documents and passport validity (the trip check-up looks at those)", "Whether a step you marked done on paper is right", .. f.CheckinState == "notOpen" ? new[] { "Check-in steps (online check-in has not opened yet)" } : []];

    public static IReadOnlyList<StanleyChecklistItem> Items(ChecklistFacts f)
    {
        var list = new List<StanleyChecklistItem>();
        if (f.CheckinState == "open")
        {
            foreach (var step in CheckinRules.StepOrder)
            {
                if (CheckinRules.IsGuestStep(step))
                    foreach (var p in f.People.Where(p => p.Left.Contains(step)))
                        list.Add(new($"checkin:{step}:{p.Position}", p.Position, "checkin", Who(f, p.Position) + Titles[step], Checkin, null));
                else if (f.BookingLeft.Contains(step))
                    list.Add(new($"checkin:{step}", 0, "checkin", Titles[step], Checkin, null));
            }
        }
        if (f.Nights > 0 && f.DinnersBooked == 0)
            list.Add(new("dining:none", 0, "dining", "Book a dinner", Dining,
                f.DiningPreference is { Length: > 0 } d ? new($"Your {d} sitting", "You told me this; I have not set it for you") : null));
        if (f.Nights > 0 && f.ToursBooked == 0)
            list.Add(new("tours:none", 0, "excursions", "Look at tours for your ports", Excursions, null));
        return list;
    }

    public static ChecklistDto Build(ChecklistFacts f, string asOf)
    {
        var items = Items(f);
        var total = f.CheckinState == "open" ? f.People.Count * f.GuestStepsTotal + f.BookingStepsTotal : 0;
        var left = items.Count(i => i.Kind == "checkin");
        var done = Math.Max(0, total - left);
        return new(true, items, done, total, items.Count == 0, NotChecked(f), asOf);
    }

    /// <summary>The dinner preference to show, from the guest's own remembered items only: memory must be on, the kind is not sensitive, and a trip item must be for this sailing.</summary>
    public static string? DiningPreference(IEnumerable<StanleyMemoryRow> items, bool enabled, string? sailingId) =>
        StanleyMemoryRules.ForAnswers(items, enabled, sailingId).Select(x => x.Split(": ")).Where(p => p[0] == "dining" && p[1] is "early" or "late").Select(p => p[1]).FirstOrDefault();
}
