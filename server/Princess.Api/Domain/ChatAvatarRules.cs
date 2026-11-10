namespace Princess.Api.Domain;

/// <summary>A guest's chat avatar (phase 9c): a colour and a ship icon, shown with their initials as the fallback. No photo is ever uploaded (moderation, children). Stored as <c>colour:icon</c>.</summary>
public static class ChatAvatarRules
{
    public static readonly string[] Colours = ["sea", "teal", "coral", "gold", "plum", "green"];
    /// <summary><c>initials</c> means no icon: the letters of the name.</summary>
    public static readonly string[] Icons = ["initials", "anchor", "wheel", "lifebuoy", "wave", "star", "compass", "funnel"];

    /// <summary>The stored text for a choice, or null when it is not one of the known colours and icons (so nothing free-form is kept).</summary>
    public static string? Normalise(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var parts = value.Trim().ToLowerInvariant().Split(':');
        return parts.Length == 2 && Colours.Contains(parts[0]) && Icons.Contains(parts[1]) ? $"{parts[0]}:{parts[1]}" : null;
    }
}
