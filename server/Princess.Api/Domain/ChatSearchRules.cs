namespace Princess.Api.Domain;

/// <summary>
/// Chat search and export (docs/chat-features-research.md, phase 9). Pure rules: what a search may ask, how it is matched and how a hit is shown.
/// Search only ever looks at messages the person may already read (their own window, nobody they blocked), in conversations they belong to.
/// </summary>
public static class ChatSearchRules
{
    public const int MinQuery = 2;
    public const int MaxQuery = 60;
    public const int PageSize = 20;
    public const int MaxPage = 50;
    /// <summary>The most messages one export holds. A longer chat is cut to its newest messages and says so.</summary>
    public const int MaxExport = 5000;
    /// <summary>Characters of text kept either side of the match in a hit.</summary>
    public const int SnippetBefore = 40;
    public const int SnippetLength = 140;

    public static int ClampPage(int? limit) => limit is null or <= 0 ? PageSize : Math.Min(limit.Value, MaxPage);

    /// <summary>The words to look for: trimmed, inner spaces folded, <see cref="MinQuery"/> to <see cref="MaxQuery"/> characters. Null when it is too short or too long.</summary>
    public static string? CleanQuery(string? query)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;
        var q = string.Join(' ', query.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return q.Length is >= MinQuery and <= MaxQuery ? q : null;
    }

    /// <summary>A SQL <c>LIKE</c> pattern that matches the words anywhere, with the wildcard characters in the query taken literally (use with <c>ESCAPE '\'</c>).</summary>
    public static string LikePattern(string clean) => "%" + clean.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_").Replace("[", "\\[") + "%";

    /// <summary>The part of the message around the first match, with an ellipsis where it was cut. The whole text when it is short.</summary>
    public static string Snippet(string text, string clean)
    {
        if (text.Length <= SnippetLength) return text;
        var at = text.IndexOf(clean, StringComparison.OrdinalIgnoreCase);
        var start = Math.Clamp((at < 0 ? 0 : at) - SnippetBefore, 0, text.Length - 1);
        var length = Math.Min(SnippetLength, text.Length - start);
        return (start > 0 ? "…" : "") + text.Substring(start, length).Trim() + (start + length < text.Length ? "…" : "");
    }

    /// <summary>Only a conversation between people is searched or exported: not Stanley's (his cards have their own screens) and not a channel or room (other guests' public words).</summary>
    public static bool Searchable(string kind) => kind is ChatConversationRules.Party or ChatConversationRules.Direct or ChatConversationRules.Group;
}
