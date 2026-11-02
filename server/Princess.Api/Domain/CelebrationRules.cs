using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>Birthdays and anniversaries the guests tell the ship about (small delights D2-5). Only the month and day are kept.</summary>
public static partial class CelebrationRules
{
    public const int MaxItems = 12;
    public const int MaxLabel = 40;

    [GeneratedRegex("^[A-Za-z0-9_-]{1,40}$")]
    private static partial Regex IdPattern();

    /// <summary>The label with its spaces collapsed, or null when it is empty or too long.</summary>
    public static string? CleanLabel(string? label)
    {
        var l = string.Join(' ', (label ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return l.Length is >= 1 and <= MaxLabel ? l : null;
    }

    /// <summary>"MM-DD" for "YYYY-MM-DD" or "MM-DD" when it is a real day of the year (29 February counts), otherwise null.</summary>
    public static string? MonthDay(string? date)
    {
        var d = date ?? "";
        if (d.Length == 10 && d[4] == '-') d = d[5..];
        if (d.Length != 5 || d[2] != '-' || !int.TryParse(d[..2], out var m) || !int.TryParse(d[3..], out var day) || d.Any(ch => ch != '-' && !char.IsAsciiDigit(ch))) return null;
        return m is >= 1 and <= 12 && day >= 1 && day <= DateTime.DaysInMonth(2024, m) ? d : null;
    }

    /// <summary>The problem title for a list that cannot be saved, or null when it can.</summary>
    public static string? Problem(IReadOnlyList<CelebrationInputView>? items)
    {
        if (items is null) return "badCelebrations";
        if (items.Count > MaxItems) return "tooManyCelebrations";
        foreach (var i in items)
        {
            if (i.Id is null || !IdPattern().IsMatch(i.Id)) return "badCelebrations";
            if (CleanLabel(i.Label) is null) return "badLabel";
            if (MonthDay(i.Date) is null) return "badDate";
        }
        return items.Select(i => i.Id).Distinct().Count() == items.Count ? null : "badCelebrations";
    }
}

/// <summary>What the rules read from a request item, so the rules do not depend on the contract type.</summary>
public sealed record CelebrationInputView(string? Id, string? Label, string? Date);
