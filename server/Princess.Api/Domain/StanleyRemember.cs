namespace Princess.Api.Domain;

/// <summary>What the Remember pack looks at. Dates only: the day the ship gets in is the departure date plus the nights.</summary>
public sealed record RememberFacts(DateOnly Today, DateOnly Departure, int Nights);

public sealed record RememberFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record RememberDto(bool HasTrip, IReadOnlyList<RememberFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The Remember pack, first part (P9f, docs/stanley-actions-and-proactive-plan.md section 12.11): SR-11.1 recap, SR-11.2 feedback and SR-11.5 loyalty explained, on the day the ship gets in.
/// Pure and deterministic. It builds no album, drafts and sends no feedback and reads no loyalty balance; each finding is a screen to open.
/// </summary>
public static class StanleyRememberRules
{
    private const string Memories = "/me/memories", Feedback = "/me/feedback", Loyalty = "/me/loyalty";

    public static IReadOnlyList<string> NotChecked(RememberFacts f) =>
    [
        "Your loyalty balance or tier (I do not read it; the loyalty screen has it)",
        "Whether you have already answered the survey or built an album (I cannot see either)",
        "The days after you get home (this check runs only while the trip is open)",
    ];

    public static IReadOnlyList<RememberFinding> Findings(RememberFacts f)
    {
        var list = new List<RememberFinding>();
        if (f.Nights < 1 || f.Departure.AddDays(f.Nights).DayNumber != f.Today.DayNumber) return list;
        list.Add(new("recap", "SR-11.1", "Keep your memories",
            "The memories screen is where your photos and notes from the trip come together. I build no album for you; you choose what goes in.", Memories));
        list.Add(new("feedback", "SR-11.2", "Tell us how it went",
            "The feedback screen has the survey. I write nothing for you and send nothing; any thank-you to a crew member is yours to write.", Feedback));
        list.Add(new("loyalty", "SR-11.5", "Your loyalty, in plain words",
            "The loyalty screen explains what this voyage counts for. I do not read your balance out.", Loyalty));
        return list;
    }

    public static RememberDto Build(RememberFacts f, string asOf) => new(true, Findings(f), NotChecked(f), asOf);
}
