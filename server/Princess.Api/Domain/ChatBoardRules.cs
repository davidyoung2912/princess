using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>A day board as stored in <c>ChatMessages.Payload</c>: a day of the sailing and up to eight things from the app (their refs; the words are rebuilt for each reader on every read).</summary>
public sealed record ChatBoard(int Day, List<string> Refs);

/// <summary>
/// The pure rules of a day board (docs/chat-bundles-plan.md, phase B6): a group builds one day together. Each member says "I'm in" for any of the items; that is kept as one number per member in
/// <c>ChatResponses.Choice</c>, bit <c>i</c> set meaning in for item <c>i</c> (so no new table). Nothing here touches a store, and nothing books, pays or changes anyone's day.
/// </summary>
public static class ChatBoardRules
{
    public const string Kind = "board";
    public const int MaxItems = 8;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// A board for <paramref name="day"/> (1 to <paramref name="days"/>) from the refs named: empty and repeated refs are dropped, and each one must be a thing with a time (an <c>event:</c> ref) on that same day.
    /// Null when the day is off the sailing, no ref remains, a ref is not one of those, or there are more than <see cref="MaxItems"/>.
    /// </summary>
    public static ChatBoard? Clean(int day, IEnumerable<string?>? refs, int days)
    {
        if (day < 1 || day > days) return null;
        var kept = new List<string>();
        foreach (var raw in refs ?? [])
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            if (ChatBundleRules.PlanRefOf(raw) is not { } planRef || ChatPlanningRules.ParsePlanRef(planRef) is not { } parsed || parsed.Day != day) return null;
            if (!kept.Contains(raw)) kept.Add(raw);
        }
        return kept.Count is 0 or > MaxItems ? null : new ChatBoard(day, kept);
    }

    public static string Serialise(ChatBoard board) => JsonSerializer.Serialize(board, Json);

    public static ChatBoard? Parse(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { return JsonSerializer.Deserialize<ChatBoard>(payload, Json) is { Refs.Count: > 0 and <= MaxItems } b ? b : null; }
        catch (JsonException) { return null; }
    }

    public static bool ValidItem(int item, int count) => item >= 0 && item < count && item < MaxItems;

    /// <summary>Whether bit <paramref name="item"/> is set in <paramref name="mask"/>.</summary>
    public static bool IsIn(int mask, int item) => item is >= 0 and < MaxItems && (mask & (1 << item)) != 0;

    /// <summary>The mask with item <paramref name="item"/> set or cleared; an item that is not on the board changes nothing.</summary>
    public static int With(int mask, int item, bool on) => item is < 0 or >= MaxItems ? mask : on ? mask | (1 << item) : mask & ~(1 << item);

    /// <summary>How many members are in for each of the <paramref name="items"/> items.</summary>
    public static List<int> Counts(IEnumerable<int> masks, int items)
    {
        var counts = new int[items];
        foreach (var m in masks) for (var i = 0; i < items && i < MaxItems; i++) if (IsIn(m, i)) counts[i]++;
        return [.. counts];
    }

    public static string Preview(int day) => $"Day board: day {day}";
}
