namespace Princess.Api.Domain;

/// <summary>What the Dream, Discover and Book pack looks at: only whether the guest has a confirmed trip still to sail.</summary>
public sealed record PlanningFacts(bool HasUpcomingTrip);

public sealed record PlanningFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record PlanningDto(bool Planning, IReadOnlyList<PlanningFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The Dream, Discover and Book pack, first part (P9f, docs/stanley-actions-and-proactive-plan.md section 12): SR-1.3 price watch, SR-2.1 cabin like this, SR-2.4 what you might regret,
/// SR-2.5 package break-even and SR-3.3 what happens if, for a guest with no confirmed trip still to sail. Pure and deterministic. It reads no fare, cabin, review or policy, holds nothing,
/// books nothing and sends nothing; each finding is a screen to open.
/// </summary>
public static class StanleyPlanningRules
{
    public static IReadOnlyList<string> NotChecked(PlanningFacts f) =>
    [
        "Fares, cabins and cancellation dates (I do not read them; each screen shows its own)",
        "Which sailings you have saved (I cannot see them from here)",
        "Weekly shortlists, price falls, holds and share-the-cost links (not built yet)",
    ];

    public static IReadOnlyList<PlanningFinding> Findings(PlanningFacts f)
    {
        if (f.HasUpcomingTrip) return [];
        return
        [
            new("price-watch", "SR-1.3", "Keep an eye on a price", "The saved sailings screen is where the sailings you like sit side by side. I read no fare for you and set no alert.", "/home/saved"),
            new("cabin", "SR-2.1", "Find a cabin like this", "The cabins screen lets you compare cabins side by side. I hold nothing and choose nothing for you.", "/home/cabins"),
            new("regret", "SR-2.4", "Decide with the facts", "The decision screen puts what matters about a sailing in one place. I make no promise about what past guests thought.", "/home/decide"),
            new("package", "SR-2.5", "Does a package pay?", "The cost screen works out your cost from the habits you give it. I enter nothing for you.", "/home/cruise/cost"),
            new("what-if", "SR-3.3", "What if plans change?", "The booking screen shows the cancellation terms for your dates before you pay. I pay nothing and book nothing.", "/book"),
        ];
    }

    public static PlanningDto Build(PlanningFacts f, string asOf) => new(!f.HasUpcomingTrip, Findings(f), NotChecked(f), asOf);
}
