namespace Princess.Api.Domain;

/// <summary>One thing in the ledger, reduced to what the review needs: its kind and whether it still stands or was undone.</summary>
public sealed record LedgerTally(string Kind, bool Undone);

/// <summary>A suggestion to change how much Stanley asks. <c>Direction</c> is <c>more</c> (offer to do it for the guest) or <c>ask-first</c>; it is only ever shown, never applied.</summary>
public sealed record LevelSuggestion(string Id, string Direction, string Kind, string Text, string Route);

public sealed record TripSoFarDto(bool Enabled, int Done, int Confirmed, int Undone, IReadOnlyList<LevelSuggestion> Suggestions, IReadOnlyList<string> NotMeasured, string? AsOf);

/// <summary>
/// "Stanley's trip so far" (19.5) and level suggestions (19.3), docs/stanley-actions-and-proactive-plan.md section 19. Pure and deterministic. Counts come only from the ledger (what was done, what was undone); nothing is claimed that is not counted.
/// A suggestion needs three confirmed acts of one kind with none undone (offer more), or two undone acts of one kind (offer to ask first). It is a sentence and a screen to open: it never changes the guest's level or switches anything on.
/// </summary>
public static class StanleyTripSoFarRules
{
    public const int ConfirmsForMore = 3, UndosForAskFirst = 2;
    private const string Route = "/me/stanley-can";

    public static IReadOnlyList<string> NotMeasured() =>
    [
        "Time saved (I count what I did, not minutes)",
        "Whether a suggestion was right for you, unless you undid it",
    ];

    private static string Phrase(string kind) => kind switch
    {
        StanleyActionKinds.OrderItem => "your orders",
        StanleyActionKinds.AddExcursion => "the tours I put in your cart",
        StanleyActionKinds.MoveDinner => "moving your dinner",
        StanleyActionKinds.ReserveDinner => "my dinner suggestions",
        StanleyActionKinds.DraftCase => "the cases I drafted",
        StanleyActionKinds.PlanChange => "your plan changes",
        StanleyActionKinds.RemindMe => "your reminders",
        StanleyActionKinds.CreatePoll => "the polls I set up",
        StanleyActionKinds.ChangeSeating => "your seating changes",
        _ => "",
    };

    public static IReadOnlyList<LevelSuggestion> Suggestions(IReadOnlyList<LedgerTally> rows)
    {
        var list = new List<LevelSuggestion>();
        foreach (var g in rows.Where(r => Phrase(r.Kind).Length > 0).GroupBy(r => r.Kind).OrderBy(g => g.Key, StringComparer.Ordinal))
        {
            var undone = g.Count(r => r.Undone);
            var kept = g.Count() - undone;
            var what = Phrase(g.Key);
            if (undone >= UndosForAskFirst)
                list.Add(new($"ask:{g.Key}", "ask-first", g.Key, $"You have undone {what} {undone} times. Want me to ask first from now on? You can check how much I do on my own.", Route));
            else if (undone == 0 && kept >= ConfirmsForMore)
                list.Add(new($"more:{g.Key}", "more", g.Key, $"You have said yes to {what} {kept} times. Want me to do more of this for you? Nothing changes unless you choose it.", Route));
        }
        return list;
    }

    public static TripSoFarDto Build(IReadOnlyList<LedgerTally> rows, string asOf)
    {
        var undone = rows.Count(r => r.Undone);
        return new(true, rows.Count - undone, rows.Count, undone, Suggestions(rows), NotMeasured(), asOf);
    }
}
