using Princess.Api.Audit;

namespace Princess.Api.Domain;

/// <summary>
/// Staff counts for Stanley in chat (docs/chat-stanley-plan.md, phase 7): his calls per day and how many of his suggestions guests used. Counts only, from the audit rows that hold a kind and an outcome and never any text
/// or person. Pure: the endpoint reads the rows and this works out the numbers.
/// </summary>
public static class ChatStanleyUseRules
{
    /// <summary>The calls counted, by the audit action each writes.</summary>
    public static readonly string[] CallActions = ["chat.reword", "chat.icebreakers", "chat.catchUp", "chat.askStanley", "chat.check"];

    /// <summary>The audit action a guest's tap on Use this writes, and the kinds of suggestion it can name.</summary>
    public const string UsedAction = "chat.suggestionUsed";
    public static readonly string[] UsedKinds = ["reword", "icebreakers", "reply"];

    /// <summary>The kind a client names, or null when it is not one of <see cref="UsedKinds"/>.</summary>
    public static string? ParseUsed(string? kind) => kind is { } k && UsedKinds.Contains(k) ? k : null;

    /// <summary>Fewer suggestions than this and the share is not shown: a share of a handful says nothing.</summary>
    public const int MinSuggestions = 20;

    public sealed record Day(string Date, int Calls);
    public sealed record Kind(string Action, int Calls);
    public sealed record Summary(int Days, List<Day> PerDay, List<Kind> ByKind, int Suggestions, int Used, double? UsedShare, bool Truncated);

    /// <summary>Whether a call gave a suggestion a guest could use: a reword that worked, an opener, or a look at a message (it always offers replies).</summary>
    public static bool Suggested(string action, string? detail) => action switch
    {
        "chat.reword" => detail is not null && detail.EndsWith(":ok", StringComparison.Ordinal),
        "chat.icebreakers" => detail is null || !detail.EndsWith(":none", StringComparison.Ordinal) && !detail.EndsWith(":failed", StringComparison.Ordinal) && !detail.EndsWith(":limit", StringComparison.Ordinal),
        "chat.check" => true,
        _ => false,
    };

    /// <summary>
    /// The numbers for the last <paramref name="days"/> days ending at <paramref name="now"/>. <paramref name="truncated"/> says a query hit its row cap, so the counts are a floor. The share is used over suggested, null until
    /// <see cref="MinSuggestions"/> were given, and never above 1 (a guest can use a suggestion more than once).
    /// </summary>
    public static Summary Summarise(IEnumerable<AuditEntry> rows, DateTime now, int days, bool truncated)
    {
        var from = now.Date.AddDays(-(days - 1));
        var list = rows.Where(r => r.At >= from).ToList();
        var calls = list.Where(r => CallActions.Contains(r.Action)).ToList();
        var perDay = Enumerable.Range(0, days).Select(i => from.AddDays(i)).Select(d => new Day(d.ToString("yyyy-MM-dd"), calls.Count(c => c.At.Date == d))).ToList();
        var byKind = CallActions.Select(a => new Kind(a, calls.Count(c => c.Action == a))).ToList();
        var suggestions = calls.Count(c => Suggested(c.Action, c.Detail));
        var used = list.Count(r => r.Action == UsedAction);
        double? share = suggestions >= MinSuggestions ? Math.Min(1.0, (double)used / suggestions) : null;
        return new(days, perDay, byKind, suggestions, used, share, truncated);
    }
}
