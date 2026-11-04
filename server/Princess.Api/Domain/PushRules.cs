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
    IReadOnlyList<PlanChange> Changes, IReadOnlyCollection<string> Watched, int DayNumber, IReadOnlyList<DisruptionDef> Disruptions, long? ReminderAt = null, IReadOnlyList<string>? PostcardIds = null);

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

    public static readonly string[] Kinds = ["allAboard", "backAboard", "scheduleChange", "disruption", "payment", "reminder"];

    /// <summary>Hours before all-aboard at which the escalation speaks (the last hour only, then the final half hour and ten minutes).</summary>
    public static readonly int[] AllAboardSteps = [60, 30, 10];

    public static PushSettings NormalizeSettings(int? budget, bool? calm, IEnumerable<string>? watch) => new(
        budget is { } b && BudgetChoices.Contains(b) ? b : DefaultBudget,
        calm ?? false,
        [.. (watch ?? []).Where(w => !string.IsNullOrWhiteSpace(w) && w.Length <= 40 && w.All(c => char.IsLetterOrDigit(c) || c is '-' or '_')).Distinct().Take(MaxWatch)]);

    /// <summary>A push service address from the browser: https, within the column, nothing that is not a plain URL.</summary>
    public static bool ValidEndpoint(string? endpoint) =>
        endpoint is { Length: > 12 and <= MaxEndpoint } && Uri.TryCreate(endpoint, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps;

    public static bool ValidKey(string? key) => key is { Length: > 0 and <= 200 } && key.All(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '=');

    /// <summary>The notices that apply now, most worth saying first. A notice that has not come true yet (for example all-aboard in three hours) is not built.</summary>
    public static List<PushNotice> Build(PushInput i)
    {
        var list = new List<PushNotice>();

        if (i.PortDay is { } day && i.ArrivedInPort && i.Now < DateTimeOffset.FromUnixTimeMilliseconds(day.AllAboardAt).UtcDateTime)
        {
            var left = day.State.MinutesLeft;
            if (AllAboardSteps.Where(s => left <= s).Cast<int?>().Min() is { } step)
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

        // "Remind me in a week": one plain note once the time the guest chose has passed. It is a suggestion, so it keeps to the budget, quiet hours and calm mode.
        if (i.ReminderAt is { } at && TripRules.ToMs(i.Now) >= at)
        {
            list.Add(new($"reminder:{at}", "reminder", "offers", false, 20, "/home",
                "Stanley: a week has passed", "You asked to think things over. Your notes are in the app whenever you are ready.",
                new() { ["at"] = at }));
        }

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
        if (s.Calm) return new(false, "calm");
        var quiet = prefs["quiet"] as JsonObject;
        if (InQuiet(local, Flag(quiet?["on"]), Text(quiet?["from"], "22:00"), Text(quiet?["to"], "07:00"))) return new(false, "quiet");
        if (sentToday >= s.Budget) return new(false, "budget");
        return new(true, null);
    }

    private static bool Flag(JsonNode? n) => n is JsonValue v && v.TryGetValue<bool>(out var b) && b;
    private static string Text(JsonNode? n, string fallback) => n is JsonValue v && v.TryGetValue<string>(out var s) ? s : fallback;
}
