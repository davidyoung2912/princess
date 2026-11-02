using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>One line of the party's change log: what kind of thing changed, a short label taken from it, and when (epoch ms).</summary>
public sealed record PartyLogEntry(string Kind, string Label, long At, bool Deleted);

/// <summary>
/// Sharing inside a party (next-level plan N4). Every person decides for themself what the rest of the booking may see; everything is off until they say so,
/// and the medical card is never shared. Pure: no store and no clock, so every rule is unit tested.
/// </summary>
public static class PartyRules
{
    /// <summary>The things a person may share with the party. The medical card has no switch because it is never shared.</summary>
    public static readonly IReadOnlyList<string> Facets = ["plans", "status", "spending", "photos"];

    /// <summary>The share links a guest may make, and how long they last at most.</summary>
    public static readonly IReadOnlySet<string> LinkKinds = new HashSet<string> { "caregiver", "advisor" };
    public const int MaxLinks = 6;
    public const int MaxLabel = 40;
    public const int MaxNote = 200;
    public const int LinkDays = 120;

    /// <summary>The kinds of port row that make up the party's shared plan, and so the change log.</summary>
    public static readonly IReadOnlySet<string> LogKinds = new HashSet<string> { "poll", "idea", "meet", "item", "party" };
    public const int MaxLog = 30;

    /// <summary>Whether the person turned this facet on. A missing, malformed or unknown value is off.</summary>
    public static bool Shares(JsonNode? sharing, string facet) =>
        Facets.Contains(facet) && sharing is JsonObject o && o[facet] is JsonValue v && v.TryGetValue<bool>(out var on) && on;

    /// <summary>The sharing document as saved: the four switches, all false unless explicitly true.</summary>
    public static JsonObject Clean(JsonNode? sharing)
    {
        var o = new JsonObject();
        foreach (var f in Facets) o[f] = Shares(sharing, f);
        return o;
    }

    /// <summary>Whether <paramref name="viewer"/> may see <paramref name="subject"/>'s status in the organiser view: the person themself, their booker for a supervised child, or anyone when the person shares it.</summary>
    public static bool MayViewStatus(long viewerId, long subjectId, bool subjectSupervised, long? subjectBookerId, JsonNode? subjectSharing) =>
        viewerId == subjectId || (subjectSupervised && subjectBookerId == viewerId) || Shares(subjectSharing, "status");

    /// <summary>A short, plain label for a row's data, or an empty string when it has none.</summary>
    public static string LabelOf(JsonNode? data)
    {
        if (data is not JsonObject o) return "";
        foreach (var name in new[] { "question", "text", "place", "title", "name" })
            if (o[name] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s)) return s.Trim().Length > 60 ? s.Trim()[..60] : s.Trim();
        return "";
    }

    /// <summary>The newest changes to the shared plan, newest first. Rows without a plan kind are left out.</summary>
    public static List<PartyLogEntry> Log(IEnumerable<(string Kind, JsonNode? Data, long At, bool Deleted)> rows) =>
        [.. rows.Where(r => LogKinds.Contains(r.Kind)).OrderByDescending(r => r.At).Take(MaxLog).Select(r => new PartyLogEntry(r.Kind, LabelOf(r.Data), r.At, r.Deleted))];

    /// <summary>A link label cut to the limit, or null when it is empty.</summary>
    public static string? CleanLabel(string? label)
    {
        var t = label?.Trim();
        return string.IsNullOrEmpty(t) ? null : t.Length > MaxLabel ? t[..MaxLabel] : t;
    }

    public static string CleanNote(string? note)
    {
        var t = note?.Trim() ?? "";
        return t.Length > MaxNote ? t[..MaxNote] : t;
    }

    /// <summary>The problem title for a link that cannot be made, or null when it can.</summary>
    public static string? LinkProblem(string? kind, string? label, bool isBooker, int existing)
    {
        if (kind is null || !LinkKinds.Contains(kind) || CleanLabel(label) is null) return "badShareLink";
        if (kind == "advisor" && !isBooker) return "bookerOnly";
        return existing >= MaxLinks ? "tooManyLinks" : null;
    }

    /// <summary>Whether a link is still good: not past its end.</summary>
    public static bool Live(DateTime? expiresAt, DateTime now) => expiresAt is null || expiresAt > now;
}
