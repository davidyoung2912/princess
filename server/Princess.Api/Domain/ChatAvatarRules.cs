namespace Princess.Api.Domain;

/// <summary>A guest's chat avatar (phase 9c): one of the pictures in <c>dbo.ChatAvatars</c> (50, drawn by DiceBear and stored by <c>scripts/seed_avatars.py</c>), never an upload. The choice is the picture's id, for example <c>bottts-31</c>.</summary>
public static class ChatAvatarRules
{
    /// <summary>The shape of an id, checked before the database is asked, so nothing free-form reaches a query or a URL.</summary>
    public static bool WellFormed(string? id) =>
        id is { Length: > 0 and <= 30 } && id.All(c => c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-');

    /// <summary>The id to keep: trimmed and lower-cased, or null for blank (back to the initials). Null also for a malformed id, which the caller refuses.</summary>
    public static string? Normalise(string? id) => string.IsNullOrWhiteSpace(id) ? null : id.Trim().ToLowerInvariant() is var v && WellFormed(v) ? v : null;
}
