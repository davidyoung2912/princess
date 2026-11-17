using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>What the Get to the ship and Embark pack looks at. Dates and the check-in state only.</summary>
public sealed record EmbarkFacts(DateOnly Today, DateOnly Departure, string CheckinState, DateTime CheckinClosesAt);

public sealed record EmbarkFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record EmbarkDto(bool HasTrip, IReadOnlyList<EmbarkFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The first part of the Get to the ship and Embark pack (P9c, docs/stanley-actions-and-proactive-plan.md sections 12.6 and 12.7): SR-6.1 check-in is open, SR-6.6 phone and money set-up in the last three days,
/// SR-7.2 muster on the day of sailing. Pure and deterministic. It never fills in or submits check-in, sets anything or sends; each finding is a screen to open.
/// </summary>
public static class StanleyEmbarkRules
{
    public const int PhoneDays = 3;
    private const string Checkin = "/home/check-in", Phone = "/plan/phone", Muster = "/ship/muster";

    private static string Long(DateOnly d) => d.ToString("dddd d MMMM", CultureInfo.InvariantCulture);

    public static IReadOnlyList<string> NotChecked(EmbarkFacts f) =>
    [
        "Whether you have already set up your phone plan or card (I cannot see them)",
        "Your muster station and the walk from your cabin (I only point to the muster screen)",
        "Flights and traffic on the way to the terminal",
    ];

    public static IReadOnlyList<EmbarkFinding> Findings(EmbarkFacts f)
    {
        var list = new List<EmbarkFinding>();
        var toGo = f.Departure.DayNumber - f.Today.DayNumber;
        if (toGo < 0) return list;
        if (f.CheckinState == "open")
            list.Add(new("checkin-open", "SR-6.1", "Online check-in is open",
                $"It closes {Long(DateOnly.FromDateTime(f.CheckinClosesAt))}. I do not fill it in or send it for you; the screen has each step.", Checkin));
        if (toGo is >= 1 and <= PhoneDays)
            list.Add(new("phone-money", "SR-6.6", toGo == 1 ? "You sail tomorrow: phone and card" : $"You sail in {toGo} days: phone and card",
                "A short checklist for roaming and for using your card abroad. Tick off what you have done.", Phone));
        if (toGo == 0)
            list.Add(new("muster", "SR-7.2", "Sailing day: find your muster station",
                "Muster happens before the ship sails. The muster screen shows your station.", Muster));
        return list;
    }

    public static EmbarkDto Build(EmbarkFacts f, string asOf) => new(true, Findings(f), NotChecked(f), asOf);
}
