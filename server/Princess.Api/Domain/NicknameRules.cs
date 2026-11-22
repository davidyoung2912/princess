namespace Princess.Api.Domain;

/// <summary>The optional name shown in chat: 2 to 30 letters, digits, spaces and . _ - ', and clean of the words chat blocks. Empty clears it, and the username shows instead.</summary>
public static class NicknameRules
{
    public const int Min = 2, Max = 30;

    /// <summary>True when the text is empty (<paramref name="nickname"/> null) or a fit nickname (tidied); false when it cannot be one.</summary>
    public static bool TryClean(string? text, out string? nickname)
    {
        nickname = null;
        var name = string.Join(' ', (text ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (name.Length == 0) return true;
        if (name.Length < Min || name.Length > Max) return false;
        if (!name.All(c => char.IsLetterOrDigit(c) || c is ' ' or '.' or '_' or '-' or '\'')) return false;
        if (ProfanityFilter.IsBlocked(name)) return false;
        nickname = name;
        return true;
    }
}
