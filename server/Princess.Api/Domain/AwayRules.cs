using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>
/// Away From Ship on the server: whether a guest is off the ship (their own presence row for the port day), the moment they should be at the pier gate or
/// tender landing, and the "head back" notices sent while they are away. Ported from <c>src/domain/awayFromShip.ts</c> and the pilot's defaults in
/// <c>src/domain/portPilot.ts</c> (a moderate queue and a 45 minute buffer unless the guest chose their own). Pure: no clock, no store.
/// </summary>
public static class AwayRules
{
    public const int GateWalkMinutes = 15;
    public const int PierQueueMinutes = 15;
    public const int TenderQueueMinutes = 25;
    public const int DefaultBufferMinutes = 45;
    /// <summary>The first notice comes this long before the landing time.</summary>
    public const int HeadsUpMinutes = 30;

    /// <summary>When the guest should be at the pier gate (or the tender landing): all-aboard, less the buffer, the queue and the walk (or, on a tender day, the last tender). Milliseconds since 1970.</summary>
    public static long LandingByMs(long allAboardAt, bool tender, int? buffer)
    {
        var b = buffer is { } v && v is >= 5 and <= 120 ? v : DefaultBufferMinutes;
        var minutes = tender ? AboardRules.LastTenderMinutes + TenderQueueMinutes + b : GateWalkMinutes + PierQueueMinutes + b;
        return allAboardAt - minutes * 60_000L;
    }

    /// <summary>A notice built by <see cref="ReturnNotices"/>.</summary>
    public static bool IsReturnNotice(PushNotice n) => n.Key.StartsWith("awayReturn:", StringComparison.Ordinal);

    /// <summary>The guest said they are leaving, or are ashore.</summary>
    public static bool IsAway(string? status) => status is "ashore" or "leaving";

    /// <summary>The row key the app uses for a person's presence on a port day: the date, a bar, and the person's id with anything but letters, digits, underscore and hyphen written as a colon and four hex digits.</summary>
    public static string PresenceKey(string date, Guid person) => $"{date}|{Enc(person.ToString())}";

    private static string Enc(string s)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var c in s) sb.Append(char.IsAsciiLetterOrDigit(c) || c is '_' or '-' ? c.ToString() : $":{(int)c:x4}");
        return sb.ToString();
    }

    /// <summary>The status in a presence row's JSON, or null when it is not there or not readable.</summary>
    public static string? StatusOf(string? json)
    {
        try { return JsonNode.Parse(json ?? "null")?["status"]?.GetValue<string>(); }
        catch (Exception e) when (e is System.Text.Json.JsonException or InvalidOperationException) { return null; }
    }

    /// <summary>A presence row's JSON, in the shape the app writes: <c>{ status, at }</c>.</summary>
    public static string PresenceJson(string status, long at) => new JsonObject { ["status"] = status, ["at"] = at }.ToJsonString();

    /// <summary>
    /// What an away guest is told. One heads-up while the landing time is within <see cref="HeadsUpMinutes"/>, then one when it has come; each goes once (the key holds the date and which),
    /// and once all-aboard has passed neither is built. Both are safety notices: missing the ship is not something to hold back for quiet hours or a budget.
    /// </summary>
    public static List<PushNotice> ReturnNotices(PortDayWithState day, int? buffer, DateTime now)
    {
        var nowMs = TripRules.ToMs(now);
        var list = new List<PushNotice>();
        if (nowMs >= day.AllAboardAt) return list;
        var landing = LandingByMs(day.AllAboardAt, day.Tender, buffer);
        var place = day.Tender ? "tender landing" : "pier gate";
        var left = Math.Max(0, (int)Math.Ceiling((day.AllAboardAt - nowMs) / 60_000.0));
        var parameters = new Dictionary<string, object> { ["port"] = day.Port, ["date"] = day.Date, ["time"] = day.AllAboardShip, ["minutes"] = left };
        if (nowMs >= landing)
            list.Add(new($"awayReturn:{day.Date}:now", "allAboard", "critical", true, 99, "/", "Stanley: time to head back to the ship",
                $"All aboard is at {day.AllAboardShip} ship time, in about {left} minutes. Head for the {place} now.", parameters));
        else if (nowMs >= landing - HeadsUpMinutes * 60_000L)
            list.Add(new($"awayReturn:{day.Date}:soon", "allAboard", "critical", true, 97, "/", "Stanley: start thinking about the way back",
                $"All aboard is at {day.AllAboardShip} ship time. Be at the {place} in about {Math.Max(0, (int)Math.Ceiling((landing - nowMs) / 60_000.0))} minutes.", parameters));
        return list;
    }
}
