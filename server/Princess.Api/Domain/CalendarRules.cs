using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>One calendar entry. Either all-day (<see cref="Date"/> only) or at a moment (<see cref="Start"/>, UTC) with an optional reminder.</summary>
public sealed record CalendarEntry(string Uid, string Summary, string Description, string Location, DateOnly? Date, DateTime? Start, int? Minutes, int? RemindBefore);

/// <summary>
/// The subscribable calendar (next-level plan N3.4): payments, the itinerary and the port-day all-aboard times, as a feed that updates when the plan does.
/// Ports <c>buildIcsCalendar</c> of <c>src/domain/calendar.ts</c>. The address holds a random token; only its hash is stored, so a guest can replace it to cancel the old one.
/// </summary>
public static class CalendarRules
{
    public static string NewToken() => Base64Url(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public static bool PlausibleToken(string? token) => token is { Length: 43 } && token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    private static string Base64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static List<CalendarEntry> Entries(string number, DateOnly departure, DateOnly? finalDue, bool paid)
    {
        var list = new List<CalendarEntry>();
        if (finalDue is { } due && !paid)
            list.Add(new($"payment-{number}", "Princess: final payment due", "Pay the balance in the app before this date.", "", due, null, null, null));
        foreach (var d in Itinerary.Days(departure))
        {
            var place = d.Port == "sea" ? "" : Itinerary.Ports[d.Port].Name;
            var title = d.Port == "sea" ? $"Day {d.Day}: at sea" : $"Day {d.Day}: {place}";
            list.Add(new($"day-{number}-{d.Day}", title, d.Port == "sea" ? "A day at sea." : $"Ship day {d.Day}.", d.Port == "sea" ? "" : place, d.Date, null, null, null));
            if (Itinerary.AllAboardAt(departure, d.Day) is { } allAboard)
                list.Add(new($"allaboard-{number}-{d.Day}", $"All aboard: {place}", "Be back on the ship by this time. The ship leaves 30 minutes later.", place, null, allAboard, 30, 60));
        }
        return list;
    }

    private static string Esc(string t) => t.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r\n", "\\n").Replace("\n", "\\n");
    private static string Utc(DateTime d) => d.ToString("yyyyMMdd'T'HHmmss'Z'");

    private static IEnumerable<string> Fold(string line)
    {
        var rest = line;
        while (rest.Length > 75) { yield return rest[..75]; rest = " " + rest[75..]; }
        yield return rest;
    }

    public static string Build(IEnumerable<CalendarEntry> entries, DateTime stamp)
    {
        var lines = new List<string> { "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Princess//Trip feed//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Princess trip", "REFRESH-INTERVAL;VALUE=DURATION:PT6H" };
        foreach (var e in entries)
        {
            lines.Add("BEGIN:VEVENT");
            lines.Add($"UID:{e.Uid}@princess");
            lines.Add($"DTSTAMP:{Utc(stamp)}");
            if (e.Date is { } day)
            {
                lines.Add($"DTSTART;VALUE=DATE:{day:yyyyMMdd}");
                lines.Add($"DTEND;VALUE=DATE:{day.AddDays(1):yyyyMMdd}");
            }
            else if (e.Start is { } start)
            {
                lines.Add($"DTSTART:{Utc(start)}");
                lines.Add($"DTEND:{Utc(start.AddMinutes(e.Minutes ?? 30))}");
            }
            lines.Add($"SUMMARY:{Esc(e.Summary)}");
            lines.Add($"DESCRIPTION:{Esc(e.Description)}");
            if (e.Location.Length > 0) lines.Add($"LOCATION:{Esc(e.Location)}");
            if (e.RemindBefore is { } before)
            {
                lines.AddRange(["BEGIN:VALARM", "ACTION:DISPLAY", $"DESCRIPTION:{Esc(e.Summary)}", $"TRIGGER:-PT{before}M", "END:VALARM"]);
            }
            lines.Add("END:VEVENT");
        }
        lines.Add("END:VCALENDAR");
        return string.Join("\r\n", lines.SelectMany(Fold)) + "\r\n";
    }
}
