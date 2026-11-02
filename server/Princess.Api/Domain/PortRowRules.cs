using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// The port day's shared record as rows (multi-device plan 2, Phase 6). The server checks the shape and keeps the later change of each row; what a row means
/// (a person's "I'm back", an expense) stays with the app.
/// </summary>
public static partial class PortRowRules
{
    public static readonly IReadOnlySet<string> Kinds = new HashSet<string> { "presence", "plan", "planB", "setting", "meet", "meetState", "party", "item" };

    public const int MaxOps = 100;
    public const int MaxRows = 1_000;
    public const int MaxJson = 2_000;
    /// <summary>A deleted row is kept this long, so a device that was off the network still learns of the delete.</summary>
    public const int TombstoneDays = 30;
    /// <summary>A device clock this far ahead of the server is cut back, so one wrong clock cannot win every clash for ever.</summary>
    public const long FutureSlackMs = 5 * 60_000;

    [GeneratedRegex(@"^[A-Za-z0-9_|:-]{1,90}$")]
    private static partial Regex KeyShape();

    /// <summary>The problem title for a change that cannot be kept, or null when it can.</summary>
    public static string? Problem(string? kind, string? key, JsonNode? data, bool deleted, long at)
    {
        if (kind is null || !Kinds.Contains(kind) || key is null || !KeyShape().IsMatch(key) || at < 0) return "badPortRow";
        if (deleted) return null;
        if (data is null) return "badPortRow";
        var text = data.ToJsonString();
        return text == "null" || text.Length > MaxJson ? "badPortRow" : null;
    }

    public static long ClampAt(long at, long nowMs) => Math.Min(Math.Max(at, 0), nowMs + FutureSlackMs);
}
