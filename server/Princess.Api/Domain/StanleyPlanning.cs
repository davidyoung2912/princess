namespace Princess.Api.Domain;

/// <summary>What the Dream, Discover and Book pack looks at: only whether the guest has a confirmed trip still to sail.</summary>
public sealed record PlanningFacts(bool HasUpcomingTrip);

public sealed record PlanningFinding(string Id, string Rule, string Title, string Detail, string Route);

public sealed record PlanningDto(bool Planning, IReadOnlyList<PlanningFinding> Findings, IReadOnlyList<string> NotChecked, string? AsOf);

/// <summary>
/// The Dream, Discover and Book pack, first part (P9f, docs/stanley-actions-and-proactive-plan.md section 12): SR-1.3 price watch, SR-2.1 cabin like this, SR-2.4 what you might regret,
/// SR-2.5 package break-even, SR-3.3 what happens if, and (second part) SR-1.1 shortlist, SR-1.2 referee, SR-3.4 share the cost and SR-3.5 deposits, for a guest with no confirmed trip still to sail. Pure and deterministic. It reads no fare, cabin, review or policy, holds nothing,
/// books nothing and sends nothing; each finding is a screen to open.
/// </summary>
public static class StanleyPlanningRules
{
    public static IReadOnlyList<string> NotChecked(PlanningFacts f) =>
    [
        "Fares, cabins and cancellation dates (I do not read them; each screen shows its own)",
        "Which sailings you have saved (I cannot see them from here)",
        "Price falls, holds and filling in travellers (not built yet)",
    ];

    public static IReadOnlyList<PlanningFinding> Findings(PlanningFacts f)
    {
        if (f.HasUpcomingTrip) return [];
        return
        [
            new("shortlist", "SR-1.1", "Your shortlist", "The quiz screen keeps the answers that narrow your sailings down. I keep no weekly list and re-run nothing for you.", "/home/quiz"),
            new("referee", "SR-1.2", "When two picks disagree", "The compare screen sets two sailings side by side, and the group poll screen lets a party vote. I ask nobody and start no poll.", "/home/saved/compare"),
            new("price-watch", "SR-1.3", "Keep an eye on a price", "The saved sailings screen is where the sailings you like sit side by side. I read no fare for you and set no alert.", "/home/saved"),
            new("cabin", "SR-2.1", "Find a cabin like this", "The cabins screen lets you compare cabins side by side. I hold nothing and choose nothing for you.", "/home/cabins"),
            new("regret", "SR-2.4", "Decide with the facts", "The decision screen puts what matters about a sailing in one place. I make no promise about what past guests thought.", "/home/decide"),
            new("package", "SR-2.5", "Does a package pay?", "The cost screen works out your cost from the habits you give it. I enter nothing for you.", "/home/cruise/cost"),
            new("share-cost", "SR-3.4", "Share the cost", "The split costs screen works out each person's share. I create no payment link and send nothing.", "/plan/split"),
            new("what-if", "SR-3.3", "What if plans change?", "The booking screen shows the cancellation terms for your dates before you pay. I pay nothing and book nothing.", "/book"),
            new("deposit", "SR-3.5", "Deposits and balances", "The payments screen shows what is due and when. I set no reminder and pay nothing.", "/me/payments"),
        ];
    }

    public static PlanningDto Build(PlanningFacts f, string asOf) => new(!f.HasUpcomingTrip, Findings(f), NotChecked(f), asOf);
}
