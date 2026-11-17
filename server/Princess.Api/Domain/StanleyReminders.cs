using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>A reminder that is due to be sent: its id (the notice key, so it is sent once), the words the guest chose and the moment it was due (epoch milliseconds).</summary>
public sealed record StanleyReminderDue(Guid Id, string Text, long DueAtMs);

/// <summary>
/// Reminders Stanley sets for a guest, held on the server so they reach the phone with the app closed (docs/stanley-gap-analysis-and-plan.md, the carry-over list: "Remind me" was shown only when the app was open).
/// The guest says a time of day; it is read in the ship's clock (the zone the ship is in at that moment) and is always the next time that happens, within 24 hours. A reminder is sent once, and not at all once it is
/// <see cref="LateHours"/> late, so a phone that was off does not buzz at midnight about a 4:15 pm return. Pure.
/// </summary>
public static class StanleyReminderRules
{
    /// <summary>The guest's own active reminders (section 25.4); a trip has more than ten things.</summary>
    public const int MaxPending = 40, TextMax = 80, LateHours = 12, MaxDays = 30, MaxLeadMin = 24 * 60;
    public const string KindClock = "clock", KindRelative = "relative", KindAnchored = "anchored", AllAboard = "allAboard";
    public const string StateScheduled = "scheduled", StateCancelled = "cancelled";

    public static bool TimeOk(string? hhmm) => hhmm is not null && Regex.IsMatch(hhmm, @"^([01]\d|2[0-3]):[0-5]\d$");

    /// <summary>The next moment (UTC) the wall clock in <paramref name="zoneId"/> shows <paramref name="hhmm"/>, strictly after <paramref name="utcNow"/> and at most 24 hours on.</summary>
    public static DateTime NextDue(DateTime utcNow, string hhmm, string zoneId)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        var now = DateTime.SpecifyKind(utcNow, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(now, zone);
        var at = TimeOnly.ParseExact(hhmm, "HH:mm", System.Globalization.CultureInfo.InvariantCulture);
        var target = local.Date.Add(at.ToTimeSpan());
        if (target <= local) target = target.AddDays(1);
        // A clock change can make the wall time not exist or exist twice; the first valid instant is used.
        if (zone.IsInvalidTime(target)) target = target.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(target, zone);
    }

    public static string Clean(string? text)
    {
        var t = Regex.Replace(Regex.Replace(text ?? "", @"https?://\S+|www\.\S+", " ", RegexOptions.IgnoreCase).Replace('\n', ' ').Replace('\r', ' '), @"\s+", " ").Trim();
        if (t.Length == 0) t = "Reminder";
        return t.Length > TextMax ? t[..TextMax] : t;
    }

    /// <summary>The ones to send now: due, not more than <see cref="LateHours"/> late.</summary>
    public static List<StanleyReminderDue> Sendable(IEnumerable<StanleyReminderDue> pending, long nowMs) =>
        [.. pending.Where(r => nowMs >= r.DueAtMs && nowMs - r.DueAtMs <= LateHours * 3_600_000L)];

    /// <summary>
    /// The moment (UTC) a reminder spec means. Clock: the next time the wall clock in <paramref name="zoneId"/> shows <c>at</c>, or that time on <c>date</c>; relative: <c>in</c> minutes from now; anchored: the anchor's time today
    /// (or on <c>date</c>) less the lead. Null when the spec cannot be read. Never in the past: the caller refuses a moment at or before <paramref name="utcNow"/>.
    /// </summary>
    public static DateTime? Resolve(IReadOnlyDictionary<string, string> args, DateTime utcNow, string zoneId)
    {
        var kind = args.GetValueOrDefault("when", KindClock);
        if (kind == KindRelative)
            return int.TryParse(args.GetValueOrDefault("in"), out var mins) && mins >= 1 ? utcNow.AddMinutes(mins) : null;
        var at = args.GetValueOrDefault("at");
        if (!TimeOk(at)) return null;
        var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        var date = DateOnly.TryParseExact(args.GetValueOrDefault("date"), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var d) ? d : (DateOnly?)null;
        if (kind == KindAnchored)
        {
            if (!int.TryParse(args.GetValueOrDefault("offset"), out var lead) || lead is < 0 or > MaxLeadMin) return null;
            var day = date ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), zone));
            return AtOn(day, at!, zone).AddMinutes(-lead);
        }
        return date is { } given ? AtOn(given, at!, zone) : NextDue(utcNow, at!, zoneId);
    }

    /// <summary>The moment <paramref name="leadMin"/> minutes before <paramref name="hhmm"/> on <paramref name="date"/> in the zone.</summary>
    public static DateTime AnchorMoment(DateTime date, string hhmm, int leadMin, string zoneId) =>
        AtOn(DateOnly.FromDateTime(date), hhmm, TimeZoneInfo.FindSystemTimeZoneById(zoneId)).AddMinutes(-leadMin);

    private static readonly Regex HealthWords = new(@"\b(?:tablets?|pills?|medic\w*|insulin|inhaler|doses?|dosage|prescription|injection|antibiotics?|patch|eye ?drops)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    public static bool IsHealth(string text) => HealthWords.IsMatch(text);

    private static DateTime AtOn(DateOnly date, string hhmm, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(TimeOnly.ParseExact(hhmm, "HH:mm", System.Globalization.CultureInfo.InvariantCulture));
        if (zone.IsInvalidTime(local)) local = local.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(local, zone);
    }

    /// <summary>The moment as the guest reads it: "Tomorrow, Wed 12 Nov, 7:00 AM ship time", with the weekday and date always.</summary>
    public static string Label(DateTime dueUtc, string zoneId, DateTime utcNow)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        var due = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(dueUtc, DateTimeKind.Utc), zone);
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), zone);
        var word = due.Date == now.Date ? "Today, " : due.Date == now.Date.AddDays(1) ? "Tomorrow, " : "";
        return word + due.ToString("ddd d MMM, h:mm tt", System.Globalization.CultureInfo.InvariantCulture) + " ship time";
    }

    /// <summary>The lead before an anchor, in the words of the screen: "45 minutes before", "1 hour before".</summary>
    public static string LeadWords(int minutes) => minutes % 60 == 0 && minutes >= 60 ? $"{minutes / 60} hour{(minutes == 60 ? "" : "s")}" : $"{minutes} minute{(minutes == 1 ? "" : "s")}";
}
