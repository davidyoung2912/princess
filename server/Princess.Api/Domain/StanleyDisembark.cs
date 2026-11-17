namespace Princess.Api.Domain;

/// <summary>What the Disembark pack looks at. Dates only: the day the ship gets in is the departure date plus the nights.</summary>
public sealed record DisembarkFacts(DateOnly Today, DateOnly Departure, int Nights);

public sealed record DisembarkFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record DisembarkDto(bool HasTrip, IReadOnlyList<DisembarkFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The first part of the Disembark pack (P9d, docs/stanley-actions-and-proactive-plan.md section 12.10): SR-10.1 bag night, SR-10.2 final bill, SR-10.3 customs ready, SR-10.4 tips explained and SR-10.6 leave nothing behind.
/// Pure and deterministic. It never fills in a customs declaration, prints a tag or picks an exit time; each finding is a screen to open.
/// </summary>
public static class StanleyDisembarkRules
{
    private const string Bags = "/home/disembark/bags", Customs = "/home/disembark/customs", FinalBill = "/me/bill/final", Tips = "/me/money", Sweep = "/home/disembark/sweep";

    public static IReadOnlyList<string> NotChecked(DisembarkFacts f) =>
    [
        "Whether your bags are tagged or your customs form is done (I cannot see them)",
        "Your exit time and your onward flight or transfer",
        "Whether your final bill is right or your tips are what you want (I point to the screens; the Value and bill card looks for repeats)",
    ];

    public static IReadOnlyList<DisembarkFinding> Findings(DisembarkFacts f)
    {
        var list = new List<DisembarkFinding>();
        var toGo = f.Departure.AddDays(f.Nights).DayNumber - f.Today.DayNumber; // days until the ship gets in
        if (f.Nights < 1 || toGo < 0 || toGo > 1) return list;
        if (toGo == 1)
        {
            list.Add(new("bag-night", "SR-10.1", "Last evening: bags",
                "Bags go out tonight. The bags screen has the tags and the exit-time choice; I do not choose an exit time for you.", Bags));
            list.Add(new("final-bill", "SR-10.2", "Final bill",
                "Look over the final bill tonight, while the Guest Services desk can still fix a mistake. I do not dispute a charge or send a question for you.", FinalBill));
            list.Add(new("tips-explained", "SR-10.4", "Tips",
                "The money screen shows the gratuities and what a change would cost. Any change is yours to make; I change nothing.", Tips));
            list.Add(new("customs-ready", "SR-10.3", "Customs form",
                "The customs screen has the declaration. I do not fill it in or submit it for you.", Customs));
        }
        else
            list.Add(new("leave-nothing", "SR-10.6", "Last morning: leave nothing behind",
                "A last-look checklist: safe, drawers, chargers and anything in the pool or show lounge.", Sweep));
        return list;
    }

    public static DisembarkDto Build(DisembarkFacts f, string asOf) => new(true, Findings(f), NotChecked(f), asOf);
}
