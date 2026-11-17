namespace Princess.Api.Domain;

/// <summary>A child of the booker and the reminder copy made for the guardian about them. Names are first names only.</summary>
public sealed record GuardianCopyDto(string Key, string Child, string Text, DateTime DueAt);

/// <summary>What a guardian run did: who it covered, what was set, what was left for later and why, and what was not read.</summary>
public sealed record GuardianCopiesDto(bool HasChildren, List<string> Children, List<GuardianCopyDto> Made, List<string> Waiting, List<string> NotChecked, string? AsOf);

/// <summary>
/// Reminders R8, guardian copies (docs/stanley-reminders-requirements.md, AC-R8-02), P11 v1. A supervised child has no reminders of their own, so a child's all-aboard time is a reminder on the guardian's list, labelled with the child's
/// first name; the child receives nothing. It runs only when the guardian asks, and each copy is an ordinary reminder the guardian can remove. Group meeting reminders for other members and helper copies (REM-D04) are not built. Pure.
/// </summary>
public static class StanleyGroupRules
{
    public const string Marker = "grp:aboard:";

    /// <summary>One copy per child per port day with an all-aboard time: an hour before, in the child's first name. The key is the child, the date and the class, so a day is never set twice for the same child.</summary>
    public static List<AutoCandidate> GuardianCandidates(CheckupFacts f, IEnumerable<(Guid Id, string First)> children)
    {
        var list = new List<AutoCandidate>();
        if (f.Timeline is null) return list;
        foreach (var (id, first) in children)
            for (var day = 1; day <= f.Timeline.Days.Count; day++)
                if (f.Timeline.AllAboardAt(day) is { } aboard)
                {
                    var d = f.Timeline.Days[day - 1];
                    var place = Itinerary.PortOf(d.Port)?.Name ?? d.Port;
                    list.Add(new($"{Marker}{id:N}:{d.Date:yyyy-MM-dd}", $"{first}: all aboard in {place} is in an hour.", aboard.AddMinutes(-StanleyAutoRules.AboardLeadMinutes)));
                }
        return list;
    }

    public static readonly string[] NotChecked =
    [
        "Only a child's all-aboard time is copied to you. The child gets no reminder and no message, and nobody else is told.",
        "Reminders for a group meeting that each member accepts, copies to a helper and the share sheet for people with no account are not built here.",
    ];
}
