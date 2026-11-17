using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// What a reminder request means, before it is a time. <c>Kind</c> is clock (a time of day, on a date when one was said), relative (an interval from now) or anchored (a lead before all aboard or a plan item).
/// <c>At</c> is HH:MM; <c>Date</c> is a ship-clock date when the guest named a day; <c>Anchor</c> is "allAboard" or a plan item id; <c>OffsetMin</c> is how long before the anchor.
/// </summary>
public sealed record ReminderSpec(string Kind, string Text, string? At = null, DateOnly? Date = null, int? InMinutes = null, string? Anchor = null, int OffsetMin = 0, bool Private = false)
{
    public Dictionary<string, string> ToArgs()
    {
        var a = new Dictionary<string, string> { ["text"] = Text };
        if (Kind != StanleyReminderRules.KindClock) a["when"] = Kind;
        if (At is not null) a["at"] = At;
        if (Date is { } d) a["date"] = d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        if (InMinutes is { } m) a["in"] = m.ToString(CultureInfo.InvariantCulture);
        if (Anchor is not null) { a["anchor"] = Anchor; a["offset"] = OffsetMin.ToString(CultureInfo.InvariantCulture); }
        if (Private) a["private"] = "1";
        return a;
    }
}

/// <summary>The outcome of reading a reminder request: a spec, or one short question, or a refusal with where to go instead. Never more than one.</summary>
public sealed record ReminderRead(ReminderSpec? Spec, string? Ask, string? Refuse)
{
    public static ReminderRead Of(ReminderSpec s) => new(s, null, null);
    public static ReminderRead Question(string q) => new(null, q, null);
    public static ReminderRead Refusal(string r) => new(null, null, r);
}

/// <summary>
/// The deterministic reminder grammar (docs/stanley-reminders-requirements.md section 15): clock, day, relative and anchored words, with the ask-don't-guess and refusal rules. It never schedules a time it cannot show:
/// a phrase it cannot read is a question or a refusal, not a guess. Pure; <paramref name="nowLocal"/> is the ship's wall clock now (null reads a bare hour the older way, 1 to 9 as the evening).
/// A model is not used here; it may be asked later only for phrases this grammar returns a question for.
/// </summary>
public static class ReminderParser
{
    public const string Example = "For example: in 30 minutes, at 4:15 pm, tomorrow at 7 am, or 45 minutes before all aboard.";

    private static readonly string[] Days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    private static readonly Dictionary<string, int> Words = new() { ["a"] = 1, ["an"] = 1, ["one"] = 1, ["two"] = 2, ["three"] = 3, ["four"] = 4, ["five"] = 5, ["six"] = 6, ["seven"] = 7, ["eight"] = 8, ["nine"] = 9, ["ten"] = 10, ["fifteen"] = 15, ["twenty"] = 20, ["thirty"] = 30, ["forty five"] = 45 };
    private static readonly Regex Lead = new(@"^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:remind me|set (?:a|an) (?:reminder|alarm)|reminder)\b[,:]?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Other = new(@"\bremind\s+(?!me\b)(?:us|him|her|them|everyone|[a-z]+)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Repeat = new(@"\b(?:every|each|daily|nightly|twice a day|hourly|repeat(?:ing)?|weekly)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Vague = new(@"\b(?:later|soon|in a bit|in a while|in a moment|sometime|at some point)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Unread = new(@"\b(?:on )?day\s+\d{1,2}\b|\bformal night\b|\bsea day\b|\bembarkation day\b|\bthe last night\b|\bwhen (?:we|i|the ship) (?:dock|arrive|get|land|sail)\b|\bwhen check-?in opens\b|\bafter (?:dinner|breakfast|lunch|the show)\b|\bif (?:it|the)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Link = new(@"https?://\S+|www\.\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private const string Num = @"(?:\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty[ -]five)";
    private static readonly Regex Before = new($@"\b(?<n>{Num}|half an?|an? hour and a half|an? hour and a quarter|a quarter of an)\s*(?<u>minutes?|mins?|hours?|hrs?|h)?\s*(?<half>and a half)?\s+before\s+(?<what>.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BeforeBare = new(@"\bbefore\s+(?<what>(?:all[ -]aboard|the ship sails).*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Relative = new($@"\bin\s+(?<n>{Num}|half an|an? hour and a half)\s*(?<u>minutes?|mins?|hours?|hrs?|h)\b(?:\s+and a half)?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DayWord = new(@"\b(?<d>tomorrow|tonight|today|this (?:morning|afternoon|evening)|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Clock = new(@"(?:\b(?:at|by|around)\s+|@\s*)?(?:(?<k>half past|quarter past|quarter to)\s+(?<h>\d{1,2})|\b(?<w>noon|midnight)\b|(?<![\d:])(?<h>\d{1,2})(?::(?<m>\d\d))?\s*(?<ap>a\.?m\.?|p\.?m\.?)?(?![\d:a-z])(?:\s+in the\s+(?<part>morning|afternoon|evening)|\s+at night)?)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>The reminder in <paramref name="message"/>, or the question or refusal that takes its place. Null when it does not ask for a reminder at all.</summary>
    public static ReminderRead? Read(string message, StanleyActionContext ctx, DateTime? nowLocal = null)
    {
        var s = Link.Replace(message.Trim(), " ");
        if (!Lead.IsMatch(s) && !Regex.IsMatch(s, @"\bremind\b", RegexOptions.IgnoreCase)) return null;
        if (Other.IsMatch(s)) return ReminderRead.Refusal("I can only remind you. To tell someone else, send them a message in chat, or share the time with them from your calendar.");
        if (Repeat.IsMatch(s)) return ReminderRead.Refusal("Repeating reminders are not here yet. Tell me the next time you want it, and I will set that one.");
        s = Lead.Replace(s, " ");
        if (Unread.IsMatch(s)) return ReminderRead.Question("I cannot read that kind of time yet. Give me a clock time, such as at 7 pm, or tomorrow at 9 am. " + Example);

        // Anchored: "45 minutes before all aboard", "an hour before the show".
        if (ReadAnchored(s, ctx) is { } anchored) return anchored;

        // Relative: "in 30 minutes".
        var rel = Relative.Match(s);
        if (rel.Success)
        {
            var mins = Minutes(rel.Groups["n"].Value, rel.Groups["u"].Value, rel.Value);
            if (mins is null or < 1) return ReminderRead.Question("How long from now? " + Example);
            if (mins > 24 * 60) return ReminderRead.Question("That is more than a day away. Say the day and time, such as tomorrow at 7 am.");
            return ReminderRead.Of(Finish(new ReminderSpec(StanleyReminderRules.KindRelative, "", InMinutes: mins), s.Remove(rel.Index, rel.Length)));
        }

        var day = DayWord.Match(s);
        var rest = day.Success ? s.Remove(day.Index, day.Length) : s;
        var clock = FindClock(rest);
        if (clock is null) return ReminderRead.Question((Vague.IsMatch(s) ? "What time? " : "I need a time for that. ") + Example);
        var (c, span) = clock.Value;
        rest = rest.Remove(span.Index, span.Length);
        string? at;
        DateOnly? date = null;
        var dayName = day.Success ? day.Groups["d"].Value.ToLowerInvariant() : "";
        if (c.Hour is null) at = c.Fixed;
        else
        {
            var h = c.Hour.Value;
            var m = c.Minute;
            if (c.Part is not null) h = Part(h, c.Part);
            else if (dayName.StartsWith("this ", StringComparison.Ordinal)) h = Part(h, dayName[5..]);
            else if (dayName == "tonight" && h is >= 1 and <= 11) h += 12;
            if (c.Meridiem is "pm" && h < 12) h += 12;
            if (c.Meridiem is "am" && h == 12) h = 0;
            if (h > 23 || m > 59 || (c.Meridiem is not null && c.Hour is > 12 or 0)) return ReminderRead.Question("I could not read that time. " + Example);
            var plain = c.Meridiem is null && c.Part is null && !dayName.StartsWith("this ", StringComparison.Ordinal) && dayName != "tonight" && c.Hour is >= 1 and <= 12;
            if (plain && nowLocal is { } nl)
            {
                // A bare hour: offer only the times that are still ahead within a day, and ask when there is more than one.
                var ask = BareHour(c.Hour.Value, m, dayName, nl);
                if (ask is not null) return ReminderRead.Question(ask);
                h = BareResolved(c.Hour!.Value, m, dayName, nl);
            }
            else if (plain && c.Hour is >= 1 and <= 9) h += 12;
            at = $"{h:00}:{m:00}";
        }

        if (nowLocal is { } now)
        {
            if (dayName == "tomorrow" && now.Hour < 4) return ReminderRead.Question($"Tonight ({F(now, "ddd d MMM")}) or tomorrow ({F(now.AddDays(1), "ddd d MMM")})? Say \"tonight at {at}\" or \"{F(now.AddDays(1), "dddd")} at {at}\".");
            date = DateFor(dayName, now);
            if (dayName == "today" || dayName == "tonight" || dayName.StartsWith("this ", StringComparison.Ordinal))
            {
                var moment = date!.Value.ToDateTime(TimeOnly.ParseExact(at!, "HH:mm", CultureInfo.InvariantCulture));
                if (moment <= now)
                {
                    var next = NextAfter(at!, now);
                    return ReminderRead.Question($"{at} has passed. The next {at} is {F(next, "ddd d MMM, h:mm tt")}. Say \"tomorrow at {at}\" if you want that one.");
                }
            }
        }
        return ReminderRead.Of(Finish(new ReminderSpec(StanleyReminderRules.KindClock, "", At: at, Date: date), rest));
    }

    // ---- anchored ------------------------------------------------------------------------------------------------------------------

    private static ReminderRead? ReadAnchored(string s, StanleyActionContext ctx)
    {
        var m = Before.Match(s);
        string what;
        int offset;
        string text;
        if (m.Success)
        {
            var n = m.Groups["n"].Value.ToLowerInvariant();
            int? mins = n.StartsWith("an hour and a half", StringComparison.Ordinal) ? 90 : n.StartsWith("an hour and a quarter", StringComparison.Ordinal) ? 75 : n.StartsWith("half a", StringComparison.Ordinal) ? 30 : n.StartsWith("a quarter", StringComparison.Ordinal) ? 15
                : Minutes(n, m.Groups["u"].Value, m.Value);
            if (mins is null or < 1) return ReminderRead.Question("How long before? " + Example);
            if (m.Groups["half"].Success) mins += 30;
            offset = mins.Value;
            what = m.Groups["what"].Value;
            text = s.Remove(m.Index);
        }
        else
        {
            var b = BeforeBare.Match(s);
            if (!b.Success) return null;
            return ReminderRead.Question("How long before all aboard? For example: 45 minutes before all aboard.");
        }
        // The anchor phrase runs up to a "to ..." that starts the words of the reminder.
        var split = Regex.Match(what, @"\s(?:to|that|about)\s+(?<t>.+)$", RegexOptions.IgnoreCase);
        var phrase = split.Success ? what[..split.Index] : what;
        text += " " + (split.Success ? split.Groups["t"].Value : "");
        if (Regex.IsMatch(phrase, @"all[ -]aboard|ship sails|sail(?:ing)? time", RegexOptions.IgnoreCase))
        {
            if (ctx.AllAboard is null) return ReminderRead.Question("I do not have an all aboard time to follow today. Give me a clock time instead. " + Example);
            return ReminderRead.Of(Finish(new ReminderSpec(StanleyReminderRules.KindAnchored, "", At: ctx.AllAboard.At, Anchor: StanleyReminderRules.AllAboard, OffsetMin: offset), text));
        }
        var plan = (ctx.Plan ?? []).Where(p => p.Listed).ToList();
        var tokens = Regex.Split(phrase.ToLowerInvariant(), @"[^a-z0-9]+").Where(w => w.Length > 3 && w is not ("the" or "my" or "tour" or "with")).ToHashSet();
        var scored = plan.Select(p => (p, n: Regex.Split(p.Title.ToLowerInvariant(), @"[^a-z0-9]+").Count(w => w.Length > 3 && tokens.Contains(w)))).Where(x => x.n > 0).OrderByDescending(x => x.n).ToList();
        if (scored.Count == 0) return ReminderRead.Question(plan.Count == 0 ? "I cannot see your plan to follow an item in it. Give me a clock time instead. " + Example : "I cannot find that in your plan. Try its name, or give me a clock time.");
        var best = scored.Where(x => x.n == scored[0].n).ToList();
        if (best.Count > 1) return ReminderRead.Question("Which one: " + string.Join(" or ", best.Take(4).Select(x => $"{x.p.Title} at {x.p.Start}")) + "? Say its name.");
        var item = best[0].p;
        return ReminderRead.Of(Finish(new ReminderSpec(StanleyReminderRules.KindAnchored, "", At: item.Start, Anchor: item.Id, OffsetMin: offset), text));
    }

    // ---- pieces --------------------------------------------------------------------------------------------------------------------

    private sealed record Found(int? Hour, int Minute, string? Meridiem, string? Part, string? Fixed);

    private static (Found, Match)? FindClock(string s)
    {
        foreach (Match m in Clock.Matches(s))
        {
            var cue = m.Value.TrimStart().StartsWith("at ", StringComparison.OrdinalIgnoreCase) || m.Value.TrimStart().StartsWith("by ", StringComparison.OrdinalIgnoreCase) || m.Value.TrimStart().StartsWith("around ", StringComparison.OrdinalIgnoreCase) || m.Value.TrimStart().StartsWith('@');
            if (m.Groups["w"].Success) return (new Found(null, 0, null, null, m.Groups["w"].Value.Equals("noon", StringComparison.OrdinalIgnoreCase) ? "12:00" : "00:00"), m);
            if (!m.Groups["h"].Success) continue;
            var h = int.Parse(m.Groups["h"].Value, CultureInfo.InvariantCulture);
            if (m.Groups["k"].Success)
            {
                var k = m.Groups["k"].Value.ToLowerInvariant();
                if (h is < 1 or > 12) continue;
                var (hh, mm) = k switch { "half past" => (h, 30), "quarter past" => (h, 15), _ => (h == 1 ? 12 : h - 1, 45) };
                return (new Found(hh, mm, null, null, null), m);
            }
            var ap = m.Groups["ap"].Success ? m.Groups["ap"].Value.Replace(".", "").ToLowerInvariant() : null;
            var part = m.Groups["part"].Success ? m.Groups["part"].Value.ToLowerInvariant() : m.Value.Contains("at night", StringComparison.OrdinalIgnoreCase) ? "evening" : null;
            if (!cue && ap is null && !m.Groups["m"].Success && part is null) continue;
            return (new Found(h, m.Groups["m"].Success ? int.Parse(m.Groups["m"].Value, CultureInfo.InvariantCulture) : 0, ap, part, null), m);
        }
        return null;
    }

    private static int Part(int h, string part) => part switch { "morning" => h == 12 ? 0 : h, "afternoon" or "evening" => h < 12 ? h + 12 : h, _ => h };

    /// <summary>The question for a bare hour ("at 5"), or null when only one time is still ahead within a day. Both are offered when both are.</summary>
    private static string? BareHour(int hour, int minute, string dayName, DateTime now)
    {
        var options = BareOptions(hour, minute, dayName, now);
        return options.Count > 1 ? $"Do you mean {F(options[0], "h:mm tt")} {Day(options[0], now)} or {F(options[1], "h:mm tt")} {Day(options[1], now)}? Say it with am or pm." : null;
    }

    private static int BareResolved(int hour, int minute, string dayName, DateTime now)
    {
        var options = BareOptions(hour, minute, dayName, now);
        return options.Count == 0 ? (hour <= 9 ? hour + 12 : hour) : options[0].Hour;
    }

    /// <summary>
    /// The times a bare hour can mean. With a day named (tomorrow, a weekday, today) it is that day's morning or evening, whichever is still ahead; with none it is the next occurrences within a day.
    /// </summary>
    private static List<DateTime> BareOptions(int hour, int minute, string dayName, DateTime now)
    {
        var h12 = hour % 12;
        var named = DateFor(dayName, now);
        var d = (named ?? DateOnly.FromDateTime(now)).ToDateTime(TimeOnly.MinValue);
        var candidates = new List<DateTime> { d.AddHours(h12).AddMinutes(minute), d.AddHours(h12 + 12).AddMinutes(minute) };
        if (named is null) candidates.Add(d.AddDays(1).AddHours(h12).AddMinutes(minute));
        return [.. candidates.Where(c => c > now && (named is not null || c <= now.AddHours(24))).OrderBy(c => c)];
    }

    private static string F(DateTime d, string format) => d.ToString(format, CultureInfo.InvariantCulture);

    private static string Day(DateTime when, DateTime now) => when.Date == now.Date ? "today" : when.Date == now.Date.AddDays(1) ? "tomorrow" : F(when, "ddd d MMM");

    /// <summary>The date a day word means on the ship's calendar; null for no day word. A weekday is the next one, never today.</summary>
    private static DateOnly? DateFor(string dayName, DateTime now)
    {
        if (dayName.Length == 0 || dayName is "today" or "tonight" || dayName.StartsWith("this ", StringComparison.Ordinal)) return dayName.Length == 0 ? null : DateOnly.FromDateTime(now);
        if (dayName == "tomorrow") return DateOnly.FromDateTime(now).AddDays(1);
        var target = Array.IndexOf(Days, dayName);
        var diff = (target - (int)now.DayOfWeek + 7) % 7;
        return DateOnly.FromDateTime(now).AddDays(diff == 0 ? 7 : diff);
    }

    private static DateTime NextAfter(string at, DateTime now)
    {
        var t = TimeOnly.ParseExact(at!, "HH:mm", CultureInfo.InvariantCulture);
        var d = now.Date.Add(t.ToTimeSpan());
        return d <= now ? d.AddDays(1) : d;
    }

    private static int? Minutes(string n, string unit, string whole)
    {
        var lower = n.ToLowerInvariant().Replace('-', ' ');
        var w = whole.ToLowerInvariant();
        if (w.Contains("hour and a half", StringComparison.Ordinal)) return 90;
        if (lower.StartsWith("half an", StringComparison.Ordinal) || lower == "half a") return 30;
        int value;
        if (!int.TryParse(lower, NumberStyles.None, CultureInfo.InvariantCulture, out value) && !Words.TryGetValue(lower, out value)) return null;
        var u = unit.ToLowerInvariant();
        var mins = u.StartsWith('h') ? value * 60 : u.StartsWith('m') ? value : (int?)null;
        if (mins is null) return null;
        return w.Contains("and a half", StringComparison.Ordinal) ? mins + (u.StartsWith('h') ? 30 : 0) : mins;
    }

    /// <summary>The words of the reminder: what is left once the time words are taken out, without the joining words, a link or markup; "Reminder" when nothing is left. Health words make it private.</summary>
    private static ReminderSpec Finish(ReminderSpec spec, string leftover)
    {
        var t = Regex.Replace(leftover, @"\b(?:remind me|please)\b", " ", RegexOptions.IgnoreCase);
        t = Regex.Replace(t, @"\s+", " ").Trim(' ', ',', '.', '!', '?', ':', ';');
        t = Regex.Replace(t, @"^(?:(?:to|that|about|for|and|then|on|at|in)\b\s*)+", "", RegexOptions.IgnoreCase).Trim();
        t = Regex.Replace(t, @"(?:\s+(?:at|on|in|by|for|and))+$", "", RegexOptions.IgnoreCase).Trim();
        var clean = StanleyReminderRules.Clean(t);
        return spec with { Text = clean, Private = StanleyReminderRules.IsHealth(clean) };
    }
}
