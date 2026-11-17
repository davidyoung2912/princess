using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>What the Manage and Prebook pack looks at. Counts only: no names, and travellers are positions.</summary>
public sealed record PrebookFacts(
    DateOnly Today, DateOnly Departure, int Nights, int Adults, int Tours, int Dinners, DateOnly? FinalDue, DateOnly CheckinOpens, IReadOnlyList<PollGap> Polls);

public sealed record PrebookFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record PrebookDto(bool HasTrip, IReadOnlyList<PrebookFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The first part of the Manage and Prebook pack (P9b, docs/stanley-actions-and-proactive-plan.md section 14): SR-4.5 "what to expect" (one note, one action) and SR-5.4 "dinner for everyone" (a party of three or more
/// adults with no dinner poll gets a screen to start one). Pure and deterministic. It never starts a poll, books or sends; each finding is a screen to open.
/// </summary>
public static class StanleyPrebookRules
{
    public const int MinParty = 3, ExpectDays = 60;
    private const string Dining = "/dining-today", Excursions = "/excursions-explorer", Poll = "/plan/group-poll", Check = "/plan/autopilot";

    private static string Long(DateOnly d) => d.ToString("dddd d MMMM", CultureInfo.InvariantCulture);
    private static string Days(int n) => n == 1 ? "1 day" : $"{n} days";

    public static IReadOnlyList<string> NotChecked(PrebookFacts f) =>
    [
        "What the dinner room has free (I do not see table availability)",
        "Who in your party wants which dinner time (a poll asks them; I never answer for anyone)",
    ];

    public static IReadOnlyList<PrebookFinding> Findings(PrebookFacts f)
    {
        var list = new List<PrebookFinding>();
        var toGo = f.Departure.DayNumber - f.Today.DayNumber;
        if (toGo > 0 && toGo <= ExpectDays)
            list.Add(Expect(f, toGo));
        if (toGo > 0 && f.Adults >= MinParty && !f.Polls.Any(p => p.Question.Contains("dinner", StringComparison.OrdinalIgnoreCase)))
            list.Add(new("dinner-poll", "SR-5.4", $"{f.Adults} of you are sailing and there is no dinner poll",
                "A short poll asks each person for a dinner time or a night out. Starting it sends nothing until you press send, and nobody's silence counts as a yes.", Poll));
        return list;
    }

    private static PrebookFinding Expect(PrebookFacts f, int toGo)
    {
        var next = new List<(DateOnly Date, string Text)>();
        if (f.FinalDue is { } due && due >= f.Today) next.Add((due, $"final payment is due {Long(due)}"));
        if (f.CheckinOpens >= f.Today) next.Add((f.CheckinOpens, $"online check-in opens {Long(f.CheckinOpens)}"));
        var soonest = next.OrderBy(n => n.Date).FirstOrDefault();
        var have = $"{(f.Dinners == 0 ? "no dinner" : f.Dinners == 1 ? "1 dinner" : $"{f.Dinners} dinners")} and {(f.Tours == 0 ? "no tour" : f.Tours == 1 ? "1 tour" : $"{f.Tours} tours")} booked";
        var detail = $"You sail in {Days(toGo)}. You have {have}." + (soonest.Text is null ? "" : $" Next date: {soonest.Text}.");
        var (title, route) = f.Dinners == 0 ? ("Next step: choose a dinner", Dining) : f.Tours == 0 ? ("Next step: look at tours", Excursions) : ("Next step: run the trip check-up", Check);
        return new("expect", "SR-4.5", title, detail, route);
    }

    public static PrebookDto Build(PrebookFacts f, string asOf) => new(true, Findings(f), NotChecked(f), asOf);
}
