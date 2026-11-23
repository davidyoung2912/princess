using System.Text.RegularExpressions;

namespace Princess.Api.Services.Mcp;

/// <summary>
/// Treats what an external MCP server returns as untrusted (docs/mcp-integration-plan.md, principle 6). Text is shortened, stripped of control characters
/// and markup, and dropped whole when it reads like an instruction to a model; links must be plain https addresses. Nothing here makes the text safe to
/// obey. It only makes it safe to show and to hand to the model as data, which is the only way it is ever used.
/// </summary>
public static partial class McpSanitiser
{
    [GeneratedRegex(@"<[^>]{0,200}>")] private static partial Regex Markup();
    [GeneratedRegex(@"[\p{Cc}\p{Cf}]")] private static partial Regex Control();
    [GeneratedRegex(@"\s+")] private static partial Regex Spaces();
    [GeneratedRegex(@"ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|messages)|disregard (all |the )?(previous|prior|above)|system prompt|you are now |new instructions:|developer message|\btool_use\b|\bassistant:|\bsystem:", RegexOptions.IgnoreCase)]
    private static partial Regex Injection();

    /// <summary>Plain one-line-ish text of at most <paramref name="max"/> characters, or null when it is empty or reads like an instruction.</summary>
    public static string? Text(string? raw, int max = 400)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (Injection().IsMatch(raw)) return null;
        var s = Markup().Replace(raw, " ");
        s = Control().Replace(s, " ");
        s = Spaces().Replace(s, " ").Trim();
        if (s.Length == 0) return null;
        return s.Length > max ? s[..max].TrimEnd() + "…" : s;
    }

    /// <summary>An https address with a host, no embedded credentials and no whitespace, up to 300 characters; otherwise null.</summary>
    public static string? Url(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > 300 || raw.Any(char.IsWhiteSpace)) return null;
        return Uri.TryCreate(raw, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps && u.UserInfo.Length == 0 && u.Host.Contains('.') ? u.AbsoluteUri : null;
    }

    /// <summary>A coordinate pair inside the valid ranges, or false.</summary>
    public static bool Coordinates(double lat, double lng) => double.IsFinite(lat) && double.IsFinite(lng) && Math.Abs(lat) <= 90 && Math.Abs(lng) <= 180;
}
