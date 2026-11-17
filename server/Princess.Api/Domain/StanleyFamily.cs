namespace Princess.Api.Domain;

/// <summary>What the Family pack looks at: dates and the ages of the travellers on the booking (by position only, never a name).</summary>
public sealed record FamilyFacts(DateOnly Today, DateOnly Departure, IReadOnlyList<int> Ages);

public sealed record FamilyFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record FamilyDto(bool HasTrip, IReadOnlyList<FamilyFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The Family pack, first part (P9e, docs/stanley-actions-and-proactive-plan.md section 14.4): SR-F.1 kids club ready and SR-F.4 everyone's muster.
/// Pure and deterministic. It registers no child, messages no teen and marks nothing done; each finding is a screen for the guardian to open.
/// It says nothing unless the booking has a traveller under 18.
/// </summary>
public static class StanleyFamilyRules
{
    public const int ClubDays = 14;
    private const string Muster = "/ship/muster", Family = "/ship/family";

    public static IReadOnlyList<string> NotChecked(FamilyFacts f) =>
    [
        "Whether a child is registered for the kids club or has marked muster done (I cannot see either)",
        "Age limits on tours and shows, bedtimes and meet-up times (not part of this check yet)",
    ];

    public static IReadOnlyList<FamilyFinding> Findings(FamilyFacts f)
    {
        var list = new List<FamilyFinding>();
        var toGo = f.Departure.DayNumber - f.Today.DayNumber;
        if (toGo < 0 || !f.Ages.Any(a => a < 18)) return list;
        var club = f.Ages.Count(a => a is >= 3 and < 18);
        if (toGo == 0)
            list.Add(new("family-muster", "SR-F.4", "Sailing day: muster for everyone",
                "Every person on the booking has a station, and children must be counted too. The muster screen shows each one. I mark nobody as done.", Muster));
        if (toGo is >= 1 and <= ClubDays && club > 0)
            list.Add(new("kids-club", "SR-F.1", "Kids club: get ready",
                club == 1 ? "One child on the booking is old enough for the kids club. The family screen has the age groups and times. You register them; I do not."
                          : $"{club} children on the booking are old enough for the kids club. The family screen has the age groups and times. You register them; I do not.", Family));
        return list;
    }

    public static FamilyDto Build(FamilyFacts f, string asOf) => new(true, Findings(f), NotChecked(f), asOf);
}
