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
    public const int MaxPending = 10, TextMax = 80, LateHours = 12;

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
        var t = Regex.Replace((text ?? "").Replace('\n', ' ').Replace('\r', ' '), @"\s+", " ").Trim();
        if (t.Length == 0) t = "Reminder";
        return t.Length > TextMax ? t[..TextMax] : t;
    }

    /// <summary>The ones to send now: due, not more than <see cref="LateHours"/> late.</summary>
    public static List<StanleyReminderDue> Sendable(IEnumerable<StanleyReminderDue> pending, long nowMs) =>
        [.. pending.Where(r => nowMs >= r.DueAtMs && nowMs - r.DueAtMs <= LateHours * 3_600_000L)];
}
