using System.Globalization;
using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>When the guest wants each brief. Both are off until the guest turns one on (D7); the times are ship-clock times of day.</summary>
public sealed record BriefSettings(bool Morning = false, string MorningAt = "07:30", bool Evening = false, string EveningAt = "19:00");

/// <summary>One line of a brief and, where there is one, the screen that has the detail.</summary>
public sealed record BriefLine(string Text, string? Route);

/// <summary>A composed brief: its kind (morning or evening), the day it is about, a title and its lines.</summary>
public sealed record BriefDto(string Kind, string Date, string Title, IReadOnlyList<BriefLine> Lines);

/// <summary>What the guest sees on the brief settings: the choices, whether the CL-04 permission is on, and the next time each brief is due (epoch ms) or null.</summary>
public sealed record BriefStateDto(BriefSettings Settings, bool Allowed, long? NextMorning, long? NextEvening);

public sealed record BriefSettingsRequest(bool? Morning, string? MorningAt, bool? Evening, string? EveningAt);

/// <summary>The facts a brief is built from. Names and numbers never enter it: a brief holds ports, times and the names of things the guest booked.</summary>
public sealed record BriefFacts(
    DateOnly Date, int Nights, ItineraryDay? Today, ItineraryDay? Tomorrow,
    IReadOnlyList<CheckTour> Tours, IReadOnlyList<StanleyItem> Meals, IReadOnlyList<CheckDeadline> Deadlines);

/// <summary>
/// The morning brief and evening look-ahead (ACT-06, permission row CL-04). Pure and deterministic. A brief is built only when the guest is on a sailing day; before and after the cruise there
/// is nothing to say, so none is sent. What changed overnight is not repeated here: it stays on its own screen, and the brief says so rather than going quiet about it.
/// </summary>
public static class StanleyBriefRules
{
    public const string Morning = "morning", Evening = "evening", ClassId = "brief", StateKey = "stanleyBrief";
    public const int DeadlineDays = 3, EarlyStartMinutes = 8 * 60;
    private const string Plan = "/plan/autopilot";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static bool KindOk(string? kind) => kind is Morning or Evening;

    public static BriefSettings Parse(string? json)
    {
        try
        {
            var s = JsonSerializer.Deserialize<BriefSettings>(json ?? "null", Json);
            if (s is not null) return Clean(s);
        }
        catch (JsonException) { }
        return new();
    }

    public static string ToJson(BriefSettings s) => JsonSerializer.Serialize(s, Json);

    private static BriefSettings Clean(BriefSettings s) =>
        s with { MorningAt = StanleyReminderRules.TimeOk(s.MorningAt) ? s.MorningAt : "07:30", EveningAt = StanleyReminderRules.TimeOk(s.EveningAt) ? s.EveningAt : "19:00" };

    /// <summary>The settings after a request: only what was sent changes, and a time must be a valid 24-hour time. Null (with <paramref name="problem"/>) when it is not.</summary>
    public static BriefSettings? Apply(BriefSettings current, BriefSettingsRequest? body, out string? problem)
    {
        problem = null;
        if (body is null) { problem = "body"; return null; }
        if (body.MorningAt is not null && !StanleyReminderRules.TimeOk(body.MorningAt)) { problem = "morningAt"; return null; }
        if (body.EveningAt is not null && !StanleyReminderRules.TimeOk(body.EveningAt)) { problem = "eveningAt"; return null; }
        return current with
        {
            Morning = body.Morning ?? current.Morning, MorningAt = body.MorningAt ?? current.MorningAt,
            Evening = body.Evening ?? current.Evening, EveningAt = body.EveningAt ?? current.EveningAt,
        };
    }

    public static bool Wanted(BriefSettings s, string kind) => kind == Morning ? s.Morning : kind == Evening && s.Evening;
    public static string TimeOf(BriefSettings s, string kind) => kind == Morning ? s.MorningAt : s.EveningAt;

    /// <summary>The idempotency key of one brief on one ship-clock day, so the same brief is queued and sent once.</summary>
    public static string Key(long userId, string kind, DateOnly shipDate) => $"brief:{userId}:{kind}:{shipDate:yyyyMMdd}";

    /// <summary>The kind in a key made by <see cref="Key"/>, or null for any other key.</summary>
    public static string? KindOfKey(string key)
    {
        var parts = key.Split(':');
        return parts.Length == 4 && parts[0] == "brief" && KindOk(parts[2]) ? parts[2] : null;
    }

    private static string Hm(TimeOnly t) => t.ToString("h:mm tt", CultureInfo.InvariantCulture);
    private static int Minutes(string hhmm) => int.Parse(hhmm[..2], CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], CultureInfo.InvariantCulture);
    private static bool AtSea(ItineraryDay d) => d.Arrive is null && d.Depart is null;

    private static IEnumerable<BriefLine> DayLines(BriefFacts f, ItineraryDay day)
    {
        yield return new(AtSea(day) ? $"Day {day.Day}: a day at sea." : $"Day {day.Day}: {day.Port}.", null);
        if (!AtSea(day))
        {
            if (day.Arrive is { } a) yield return new($"The ship arrives at {Hm(a)}.", null);
            if (day.AllAboard is { } b) yield return new($"Be back on board by {Hm(b)}.", null);
        }
        var tours = f.Tours.Where(t => t.Day == day.Day).OrderBy(t => Minutes(t.Start)).ToList();
        foreach (var t in tours) yield return new($"{t.Name} starts at {Hm(TimeOnly.ParseExact(t.Start, "HH:mm", CultureInfo.InvariantCulture))}.", "/excursions-explorer");
        var meals = f.Meals.Where(m => m.Day == day.Day && m.Time is not null).OrderBy(m => Minutes(m.Time!)).ToList();
        foreach (var m in meals) yield return new($"{m.Name} at {Hm(TimeOnly.ParseExact(m.Time!, "HH:mm", CultureInfo.InvariantCulture))}.", "/dining-today");
        if (meals.Count == 0) yield return new("No dinner is booked yet.", "/dining-today");
        if (!AtSea(day) && tours.Count == 0) yield return new("Nothing is booked for this port.", "/excursions-explorer");
    }

    /// <summary>
    /// The brief of this kind, or null when the guest is not on a sailing day it covers. Morning is today; evening is tomorrow (an early start is called out) and any date coming within
    /// <see cref="DeadlineDays"/> days. The last line points to the screen that lists changes, because a brief never claims nothing changed.
    /// </summary>
    public static BriefDto? Compose(string kind, BriefFacts f)
    {
        var day = kind == Evening ? f.Tomorrow : f.Today;
        if (day is null || !KindOk(kind)) return null;
        var lines = DayLines(f, day).ToList();
        var starts = f.Tours.Where(t => t.Day == day.Day).Select(t => Minutes(t.Start)).ToList();
        if (kind == Evening && starts.Count > 0 && starts.Min() < EarlyStartMinutes)
            lines.Insert(1, new("That is an early start. Set your alarm.", Plan));
        foreach (var d in f.Deadlines.Where(d => d.DaysLeft is >= 0 and <= DeadlineDays).Take(3))
            lines.Add(new(d.DaysLeft == 0 ? $"{d.Title}: today." : $"{d.Title}: in {d.DaysLeft} day{(d.DaysLeft == 1 ? "" : "s")}.", d.Fix.Route));
        lines.Add(new("To see what changed, open your changes.", Plan));
        var title = kind == Evening ? "Tomorrow at a glance" : "Today at a glance";
        return new(kind, day.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), title, lines);
    }

    /// <summary>The thread message for a brief: title then one line each, within the thread's length limit.</summary>
    public static string Body(BriefDto b) => string.Join("\n", b.Lines.Select(l => l.Text));
}
