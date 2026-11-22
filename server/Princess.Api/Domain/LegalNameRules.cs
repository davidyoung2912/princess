namespace Princess.Api.Domain;

/// <summary>A person has one legal name. Code that wants a first name or a last initial splits it at the last space, the same way the database's computed FirstName and LastName columns do.</summary>
public static class LegalNameRules
{
    public const int Max = 120;

    /// <summary>The name tidied (outer spaces gone, inner runs of spaces made one), or null when empty or too long.</summary>
    public static string? Clean(string? text)
    {
        var name = text is null ? null : string.Join(' ', text.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        return string.IsNullOrEmpty(name) || name.Length > Max ? null : name;
    }

    /// <summary>Everything before the last space, or the whole name when it is one word.</summary>
    public static string First(string? legalName)
    {
        var n = legalName?.Trim() ?? "";
        var i = n.LastIndexOf(' ');
        return i < 0 ? n : n[..i].TrimEnd();
    }

    /// <summary>The word after the last space, or empty when the name is one word.</summary>
    public static string Last(string? legalName)
    {
        var n = legalName?.Trim() ?? "";
        var i = n.LastIndexOf(' ');
        return i < 0 ? "" : n[(i + 1)..];
    }
}
