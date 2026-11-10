using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>One thing the server may tell a guest's phone. <see cref="Key"/> is stable for the same occasion, so it is sent once; <see cref="Bypass"/> notices skip the budget, quiet hours and calm mode.</summary>
public sealed record PushNotice(string Key, string Kind, string Category, bool Bypass, int Priority, string Path, string Title, string Body, Dictionary<string, object> Params);

/// <summary>The settings a phone sends with its subscription: the unprompted-suggestions-a-day budget, calm mode and the events it wants to hear about.</summary>
public sealed record PushSettings(int Budget, bool Calm, IReadOnlyList<string> Watch);

public sealed record PushDecision(bool Send, string? Reason);

/// <summary>What the first five notices are built from. Everything here is already known to the server.</summary>
public sealed record PushInput(
    DateTime Now, string Payment, string FinalDue, PortDayWithState? PortDay, bool ArrivedInPort, int AlertBefore, bool SomeoneNotBack,
    IReadOnlyList<PlanChange> Changes, IReadOnlyCollection<string> Watched, int DayNumber, IReadOnlyList<DisruptionDef> Disruptions, long? ReminderAt = null, IReadOnlyList<string>? PostcardIds = null, int? PlanBuffer = null,
    InstalmentPayment? Instalment = null, (string Port, string Date, string Band, int Percent)? Tender = null, (string Flight, string Date, string State, int DelayMinutes)? Flight = null,
    bool InstalmentFailed = false, InstalmentPayment? InstalmentTaken = null, IReadOnlyList<ChangeCard>? StanleyCards = null, IReadOnlyList<StanleyReminderDue>? Reminders = null, IReadOnlyList<string>? HelperPrepared = null);

/// <summary>
/// The server side of reaching the guest (next-level plan N3.2 and N3.3). Ports the budget of <c>src/domain/nudges.ts</c>; the quiet hours are the guest's own saved preferences.
/// Pure: no clock, no store, so every rule is unit tested.
/// </summary>
public static class PushRules
{
    public static readonly int[] BudgetChoices = [0, 1, 3, 5];
    public const int DefaultBudget = 3;
    public const int MaxWatch = 20;
    public const int MaxDevices = 5;
    public const int MaxLog = 50;
    public const int MaxEndpoint = 450;

    public static readonly string[] Kinds = ["allAboard", "backAboard", "scheduleChange", "disruption", "payment", "reminder", "travel", "reservation", "case", "change", "helper"];

    /// <summary>Minutes before all-aboard at which the escalation speaks (90, 60, 30 and 10).</summary>
    public static readonly int[] AllAboardSteps = [90, 60, 30, 10];

    /// <summary>The steps for one guest: the usual ones plus their own safety buffer from the port-day plan (5 to 120 minutes), so one alert lands as that buffer begins.</summary>
    public static int[] StepsFor(int? planBuffer) =>
        planBuffer is { } b && b is >= 5 and <= 120 ? [.. AllAboardSteps.Append(b).Distinct().OrderByDescending(x => x)] : AllAboardSteps;

    public static PushSettings NormalizeSettings(int? budget, bool? calm, IEnumerable<string>? watch) => new(
        budget is { } b && BudgetChoices.Contains(b) ? b : DefaultBudget,
        calm ?? false,
        [.. (watch ?? []).Where(w => !string.IsNullOrWhiteSpace(w) && w.Length <= 40 && w.All(c => char.IsLetterOrDigit(c) || c is '-' or '_')).Distinct().Take(MaxWatch)]);

    /// <summary>A push service address from the browser: https, within the column, nothing that is not a plain URL.</summary>
    public static bool ValidEndpoint(string? endpoint) =>
        endpoint is { Length: > 12 and <= MaxEndpoint } && Uri.TryCreate(endpoint, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps;

    public static bool ValidKey(string? key) => key is { Length: > 0 and <= 200 } && key.All(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '=');

    /// <summary>
    /// The link a tap opens (MOB-07, COM-06): the screen, the trip the alert was built for, and for a ship change which one. The screen compares these with what is current
    /// and says so when they differ; the trip is a booking number, never anything secret. Only plain characters go in, so a stray id cannot make a malformed address.
    /// </summary>
    public static PushNotice WithLink(PushNotice n, string? trip)
    {
        var query = new List<string>();
        if (Plain(trip)) query.Add($"trip={trip}");
        if (n.Kind == "disruption" && n.Params.TryGetValue("id", out var id) && id is string s && Plain(s)) query.Add($"update={s}");
        // Other kinds of alert name what they are about: a dining reservation, a case, or a port and its day (MOB-07, COM-06).
        foreach (var key in new[] { "reservation", "case", "port" })
            if (n.Params.TryGetValue(key, out var v) && v is string text && Plain(text)) query.Add($"{key}={text}");
        if (n.Params.ContainsKey("port") && n.Params.TryGetValue("date", out var d) && d is string day && DateOnly.TryParseExact(day, "yyyy-MM-dd", out _)) query.Add($"date={day}");
        return query.Count == 0 ? n : n with { Path = $"{n.Path}?{string.Join('&', query)}" };
    }

    /// <summary>
    /// Push previews show on a locked screen, so the title and body of a notice that would name money, a flight or a reason the ship gave
    /// (free text) are swapped for a plain line; the app shows the detail once opened (MNG-05). Safety, port and plain reminder notices carry
    /// nothing private and are left as they are. The kind, path and params are untouched, so the link and the alert log still work.
    /// </summary>
    public static PushNotice Redact(PushNotice n) => n.Kind switch
    {
        "payment" or "travel" or "scheduleChange" or "case" => n with { Title = "Stanley: something to look at", Body = "Open the app to see the details." },
        "change" when n.Params.TryGetValue("change", out var kind) && kind as string == ChangeKinds.Flight => n with { Title = "Stanley: something to look at", Body = "Open the app to see the details." },
        _ => n,
    };

    private static bool Plain(string? v) => v is { Length: > 0 and <= 40 } && v.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    /// <summary>The notices that apply now, most worth saying first. A notice that has not come true yet (for example all-aboard in three hours) is not built.</summary>
    public static List<PushNotice> Build(PushInput i)
    {
        var list = new List<PushNotice>();

        if (i.PortDay is { } day && i.ArrivedInPort && i.Now < DateTimeOffset.FromUnixTimeMilliseconds(day.AllAboardAt).UtcDateTime)
        {
            var left = day.State.MinutesLeft;
            if (StepsFor(i.PlanBuffer).Where(s => left <= s).Cast<int?>().Min() is { } step)
            {
                list.Add(new($"allAboard:{day.Date}:{step}", "allAboard", "critical", true, 100, "/ship/port",
                    "Stanley: time to head back", $"All aboard is at {day.AllAboardShip} ship time, in about {left} minutes. I would start back now.",
                    new() { ["port"] = day.Port, ["time"] = day.AllAboardShip, ["minutes"] = left }));
            }
            if (i.SomeoneNotBack && left <= i.AlertBefore)
            {
                list.Add(new($"backAboard:{day.Date}", "backAboard", "critical", false, 90, "/ship/port",
                    "Stanley: is everyone back?", $"Someone in your group is not marked back yet. All aboard is at {day.AllAboardShip}. Shall we check?",
                    new() { ["port"] = day.Port, ["time"] = day.AllAboardShip }));
            }
        }

        foreach (var d in i.Disruptions)
        {
            list.Add(new($"disruption:{d.Id}", "disruption", "critical", d.Severity == "critical", d.Severity == "critical" ? 95 : 70, "/home/updates",
                "Stanley: a change to your trip", "The ship has made a change that affects you. Open the app and I will show you.",
                new() { ["id"] = d.Id, ["severity"] = d.Severity }));
        }

        foreach (var c in i.Changes.Where(c => i.Watched.Contains(c.EventId) && c.Day >= i.DayNumber && c.Day <= i.DayNumber + 1))
        {
            list.Add(new($"change:{c.EventId}:{c.Kind}:{c.Start}", "scheduleChange", "critical", false, 80, "/home/updates",
                c.Kind == "cancelled" ? "Stanley: an event you saved is cancelled" : "Stanley: an event you saved has moved",
                c.Reason ?? "Open the app to see the new time.",
                new() { ["event"] = c.EventId, ["change"] = c.Kind, ["start"] = c.Start ?? "" }));
        }

        if (i.Payment is "overdue" or "dueSoon")
        {
            var overdue = i.Payment == "overdue";
            list.Add(new($"payment:{i.Payment}:{i.FinalDue}", "payment", "payments", overdue, overdue ? 92 : 60, "/me/payments",
                overdue ? "Stanley: your payment is overdue" : "Stanley: your payment is due soon", $"The final payment date is {i.FinalDue}. I would pay what is due first.",
                new() { ["date"] = i.FinalDue, ["overdue"] = overdue ? 1 : 0 }));
        }

        // An instalment from the guest's kept plan, from a week before its date (the same window as the notice in the centre).
        if (i.Instalment is { } inst && string.CompareOrdinal(inst.Date, DateOnly.FromDateTime(i.Now).AddDays(InstalmentRules.RemindDays).ToString("yyyy-MM-dd")) <= 0)
        {
            // When the automatic payment could not be taken, say so instead of the reminder (as the centre does).
            if (i.InstalmentFailed)
                list.Add(new($"instalmentFailed:{inst.Date}", "payment", "payments", false, 70, "/me/payments",
                    "Stanley: an instalment could not be taken", $"We could not take your instalment due {inst.Date}. Please pay it on the Pay Your Balance screen.",
                    new() { ["date"] = inst.Date, ["amount"] = inst.Cents }));
            else
                list.Add(new($"instalment:{inst.Date}", "payment", "payments", false, 55, "/me/payments",
                    "Stanley: an instalment is coming up", $"Your instalment is due {inst.Date}. It is on the Pay Your Balance screen.",
                    new() { ["date"] = inst.Date, ["amount"] = inst.Cents }));
        }
        if (i.InstalmentTaken is { } taken)
        {
            list.Add(new($"instalmentTaken:{taken.Date}", "payment", "payments", false, 45, "/me/payments",
                "Stanley: your instalment was paid", $"Your instalment due {taken.Date} was taken from your card.",
                new() { ["date"] = taken.Date, ["amount"] = taken.Cents }));
        }

        // Tender boats that may run late, and an onward flight that is late or cancelled: a plain heads-up, within the guest's own limits.
        if (i.Tender is { } t)
        {
            list.Add(new($"tender:{t.Port}:{t.Date}:{t.Band}", "travel", "checkin", false, 50, $"/home/ports/{t.Port}",
                "Stanley: tender boats may be affected", $"The tender boats at {t.Port} on {t.Date} look {t.Band}. Open the port page for what to do.",
                new() { ["port"] = t.Port, ["date"] = t.Date, ["band"] = t.Band }));
        }
        if (i.Flight is { } f)
        {
            list.Add(new($"flight:{f.Flight}:{f.Date}:{f.State}:{f.DelayMinutes}", "travel", "checkin", false, 65, "/home/disembark/onward",
                f.State == "cancelled" ? "Stanley: your flight is cancelled" : "Stanley: your flight is running late",
                f.State == "cancelled" ? $"Flight {f.Flight} on {f.Date} has been cancelled." : $"Flight {f.Flight} on {f.Date} is about {f.DelayMinutes} minutes late.",
                new() { ["flight"] = f.Flight, ["date"] = f.Date, ["state"] = f.State, ["minutes"] = f.DelayMinutes }));
        }

        // Changes from Stanley's change engine (phase 11) that are worth the phone: a reservation that is lost, a deadline risk, a case that has an answer. Never a forecast and never a tip.
        // The key holds the card's fingerprint, so a change whose facts moved is a new notice, and one that did not is sent once. Only safety notices skip the guest's limits.
        foreach (var c in (i.StanleyCards ?? []).Where(StanleyChangeRules.PushWorthy))
        {
            var isCase = c.Kind == ChangeKinds.Case;
            var lostReservation = c.Consequence == ChangeConsequence.LostReservation;
            var kind = isCase ? "case" : lostReservation ? "reservation" : "change";
            var link = new Dictionary<string, object> { ["change"] = c.Kind, ["consequence"] = c.Consequence };
            if (isCase && c.Affects.FirstOrDefault() is { } a) link["case"] = a.Name;
            if (lostReservation && c.Affects.FirstOrDefault() is { } r) link["reservation"] = $"{r.Kind}-{r.Day}";
            list.Add(new($"change:{c.Id}:{c.Fingerprint}", kind, isCase ? "checkin" : "critical", c.Consequence == ChangeConsequence.Safety, c.Consequence == ChangeConsequence.Safety ? 96 : lostReservation ? 85 : 40,
                c.Recommended.Route ?? "/home/updates", $"Stanley: {c.Title}", c.What, link));
        }

        // "Remind me in a week": one plain note once the time the guest chose has passed. It is a suggestion, so it keeps to the budget, quiet hours and calm mode.
        if (i.ReminderAt is { } at && TripRules.ToMs(i.Now) >= at)
        {
            list.Add(new($"reminder:{at}", "reminder", "offers", false, 20, "/home",
                "Stanley: a week has passed", "You asked to think things over. Your notes are in the app whenever you are ready.",
                new() { ["at"] = at }));
        }

        // A reminder the guest asked Stanley for: the words they chose, once, when the time they chose comes (and not at all if it is long past). It is theirs, so it is not held for the budget, quiet hours or calm mode.
        foreach (var r in StanleyReminderRules.Sendable(i.Reminders ?? [], TripRules.ToMs(i.Now)))
            list.Add(new($"stanleyReminder:{r.Id}", "reminder", "checkin", false, 85, "/home", "Stanley: your reminder", r.Text, new() { ["requested"] = true }));

        // Something a helper prepared for the guest: one plain note per prepared item, with no names or details in it (the guest reads it on their helper page). It is a suggestion, so it keeps to the budget, quiet hours and calm mode.
        foreach (var id in i.HelperPrepared ?? [])
            list.Add(new($"helper:{id}", "helper", "checkin", false, 30, "/me/helper",
                "Stanley: something is waiting for you", "Someone helping you has prepared a request. Nothing happens until you look and confirm it.",
                new() { ["prepared"] = id }));

        // A postcard the guest wrote to their future self: one plain note, with no words of theirs in it, once per postcard.
        if (i.PostcardIds is { Count: > 0 } cards)
        {
            list.Add(new($"postcard:{cards[0]}", "reminder", "offers", false, 20, "/home",
                "Stanley: a postcard from you", "You left yourself a note for this trip. It is on Home whenever you are ready.",
                new() { ["postcard"] = cards[0] }));
        }

        return [.. list.OrderByDescending(n => n.Bypass).ThenByDescending(n => n.Priority)];
    }

    /// <summary>Whether a local time of day (HH:mm) falls in quiet hours, which may cross midnight.</summary>
    public static bool InQuiet(TimeOnly local, bool on, string from, string to)
    {
        if (!on || !TimeOnly.TryParse(from, out var f) || !TimeOnly.TryParse(to, out var t) || f == t) return false;
        return f < t ? local >= f && local < t : local >= f || local < t;
    }

    /// <summary>
    /// Send now or hold, and why. Notices that bypass (safety, and a payment that is overdue) always go. The rest wait for the guest's own limits:
    /// the push channel for the category, calm mode, quiet hours, then the day's budget. A held notice is tried again at the next check.
    /// </summary>
    public static PushDecision Decide(PushNotice n, JsonObject prefs, PushSettings s, TimeOnly local, int sentToday)
    {
        if (n.Bypass) return new(true, null);
        var channel = (prefs["channels"] as JsonObject)?[n.Category] as JsonObject;
        if (channel?["push"] is JsonValue p && p.TryGetValue<bool>(out var on) && !on) return new(false, "channelOff");
        if (n.Params.ContainsKey("requested")) return new(true, null);
        if (s.Calm) return new(false, "calm");
        var quiet = prefs["quiet"] as JsonObject;
        if (InQuiet(local, Flag(quiet?["on"]), Text(quiet?["from"], "22:00"), Text(quiet?["to"], "07:00"))) return new(false, "quiet");
        if (sentToday >= s.Budget) return new(false, "budget");
        return new(true, null);
    }

    /// <summary>
    /// Whether a notice also goes by email or text (X14). Each follows the guest's own channel choice for the notice's category (critical cannot be turned off).
    /// Texts keep to quiet hours unless the notice is a safety one; email has no hours. Neither uses the phone budget, and calm mode (a phone setting) does not apply.
    /// </summary>
    /// <summary>How long a safety alert may sit unacknowledged before it also goes by text, or by email when there is no confirmed phone (COM-04).</summary>
    public static readonly TimeSpan FallbackAfter = TimeSpan.FromMinutes(10);
    /// <summary>After this long an unacknowledged alert is stale, and a late text about it would mislead.</summary>
    public static readonly TimeSpan FallbackExpires = TimeSpan.FromHours(3);

    /// <summary>
    /// The keys of safety alerts that reached a phone, have not been acknowledged, are between <see cref="FallbackAfter"/> and <see cref="FallbackExpires"/> old and have not
    /// already been sent by text or email. The log is newest first; the other-channel rows are keyed "sms:" and "email:" plus the alert's key.
    /// </summary>
    public static List<string> FallbackDue(IReadOnlyList<Data.PushDeliveryRow> log, DateTime now)
    {
        var other = log.Select(l => l.NoticeKey).Where(k => k.StartsWith("sms:", StringComparison.Ordinal) || k.StartsWith("email:", StringComparison.Ordinal)).ToHashSet();
        return [.. log
            .Where(l => l.Outcome == "sent" && l.Bypass && !l.Acked && !l.NoticeKey.StartsWith("sms:", StringComparison.Ordinal) && !l.NoticeKey.StartsWith("email:", StringComparison.Ordinal))
            .Where(l => now - l.At >= FallbackAfter && now - l.At <= FallbackExpires)
            .Where(l => !other.Contains("sms:" + l.NoticeKey) && !other.Contains("email:" + l.NoticeKey))
            .Select(l => l.NoticeKey).Distinct()];
    }

    public static bool Reach(PushNotice n, JsonObject prefs, string channel, TimeOnly local)
    {
        if (channel is not ("email" or "sms")) return false;
        if (n.Bypass) return true;
        var row = (prefs["channels"] as JsonObject)?[n.Category] as JsonObject;
        if (!(row?[channel] is JsonValue v && v.TryGetValue<bool>(out var on) && on)) return false;
        var quiet = prefs["quiet"] as JsonObject;
        return !(channel == "sms" && InQuiet(local, Flag(quiet?["on"]), Text(quiet?["from"], "22:00"), Text(quiet?["to"], "07:00")));
    }

    private static bool Flag(JsonNode? n) => n is JsonValue v && v.TryGetValue<bool>(out var b) && b;
    private static string Text(JsonNode? n, string fallback) => n is JsonValue v && v.TryGetValue<string>(out var s) ? s : fallback;
}
