namespace Princess.Api.Domain;

/// <summary>The sign-in name a guest chooses: unique, at least six characters, letters, digits and . _ - only, and clean of the words chat blocks.</summary>
public static class UsernameRules
{
    public const int Min = 6, Max = 30;

    /// <summary>The name with outer spaces removed, or null when it cannot be a username: too short or long, an odd character, or a blocked word. Case is kept as typed; the database compares without it.</summary>
    public static string? Clean(string? text)
    {
        var name = text?.Trim();
        if (name is null || name.Length < Min || name.Length > Max) return null;
        if (!name.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-')) return null;
        return ProfanityFilter.IsBlocked(name) ? null : name;
    }
}
