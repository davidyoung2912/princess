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

    public const string MeetMarker = "grp:meet:", HelperKey = "stanley.helperCopies";
    public const int MeetLeadMax = 120;

    /// <summary>The reminder a member sets for a group plan they said Going to: the plan's title as the group wrote it, and how soon it starts.</summary>
    public static string MeetingText(string title, int leadMin) =>
        StanleyReminderRules.Clean(leadMin <= 0 ? $"{title} is starting now." : $"{title} starts in {StanleyReminderRules.LeadWords(leadMin)}.");

    /// <summary>The moment (UTC) <paramref name="leadMin"/> minutes before a plan's time on its date in the ship's zone, or null when the time cannot be read.</summary>
    public static DateTime? MeetingDue(DateOnly date, string? hhmm, int leadMin, string zoneId) =>
        StanleyReminderRules.TimeOk(hhmm) ? Itinerary.LocalToUtc(date, TimeOnly.ParseExact(hhmm!, "HH:mm", System.Globalization.CultureInfo.InvariantCulture), zoneId).AddMinutes(-leadMin) : null;

    /// <summary>
    /// REM-D04: which of a guest's reminders a helper may be sent a copy of. Only the ones that keep a person safe or on time for the ship (all aboard, the ones Stanley sets for the cabin, the bags and the guardian's all-aboard copies),
    /// never one marked private, and never a reminder the guest wrote for themselves.
    /// </summary>
    public static bool HelperCopy(string? anchorType, string? anchorId, bool isPrivate)
    {
        if (isPrivate) return false;
        if (anchorType == "allAboard" || anchorType == "guardian") return true;
        return anchorType == "auto" && anchorId is not null && new[] { ":aboard:", ":exit:", ":bags:" }.Any(k => anchorId.Contains(k, StringComparison.Ordinal));
    }

    /// <summary>The words a helper is sent: the guest's first name in front, so the helper knows whose it is.</summary>
    public static string HelperText(string guestFirst, string text) => StanleyReminderRules.Clean($"{guestFirst}: {text}");

    /// <summary>The guest's choice to let a helper have copies, as kept: on or off, and when it last changed.</summary>
    public sealed record HelperCopyChoice(bool On, DateTime? At);

    public static HelperCopyChoice ParseChoice(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new(false, null);
        try
        {
            using var d = System.Text.Json.JsonDocument.Parse(json);
            var on = d.RootElement.TryGetProperty("on", out var o) && o.ValueKind == System.Text.Json.JsonValueKind.True;
            DateTime? at = d.RootElement.TryGetProperty("at", out var a) && a.ValueKind == System.Text.Json.JsonValueKind.String && DateTime.TryParse(a.GetString(), null, System.Globalization.DateTimeStyles.RoundtripKind, out var t) ? t : null;
            return new(on, at);
        }
        catch (System.Text.Json.JsonException) { return new(false, null); }
    }

    public static string ChoiceJson(bool on, DateTime at) => System.Text.Json.JsonSerializer.Serialize(new { on, at = at.ToString("O") });

    public sealed record HelperCopiesDto(bool On, string? Since, int Helpers, List<string> NotChecked);
    public sealed record HelperCopiesRequest(bool? On);
    public sealed record MeetingReminderRequest(Guid GroupId, Guid PlanId, int? LeadMin);
    public sealed record MeetingReminderDto(string Id, string Text, DateTime DueAt);

    public static readonly string[] NotChecked =
    [
        "Only a child's all-aboard time is copied to you. The child gets no reminder and no message, and nobody else is told.",
    ];

    public static readonly string[] HelperNotChecked =
    [
        "A helper is sent copies of your all-aboard, cabin-exit and bag-night reminders, with your first name in front. Never one marked private, and never one you wrote yourself.",
        "It lasts only while the helper link you gave is live with the Stanley permission, and you can switch it off here at any time.",
    ];
}
