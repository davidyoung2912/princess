using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>Ported from <c>src/domain/notifications.ts</c> and the ticket status in <c>help.ts</c>.</summary>
public static partial class NotificationRules
{
    public static readonly string[] Categories = ["critical", "payments", "documents", "checkin", "offers"];
    public static readonly string[] Channels = ["push", "email", "sms"];

    private static readonly Dictionary<string, (bool Push, bool Email, bool Sms)> Defaults = new()
    {
        ["critical"] = (true, true, true),
        ["payments"] = (true, true, false),
        ["documents"] = (true, true, false),
        ["checkin"] = (true, true, false),
        ["offers"] = (false, false, false),
    };

    [GeneratedRegex(@"^([01]\d|2[0-3]):[0-5]\d$")]
    private static partial Regex Clock();

    /// <summary>Preferences from untrusted data. Critical notices (itinerary changes, port closures, safety) cannot be turned off on any channel.</summary>
    public static JsonObject NormalizePrefs(JsonNode? raw)
    {
        var o = raw as JsonObject;
        var ch = o?["channels"] as JsonObject;
        var q = o?["quiet"] as JsonObject;
        var channels = new JsonObject();
        foreach (var c in Categories)
        {
            var row = ch?[c] as JsonObject;
            var d = Defaults[c];
            channels[c] = new JsonObject
            {
                ["push"] = Flag(row?["push"], d.Push),
                ["email"] = Flag(row?["email"], d.Email),
                ["sms"] = Flag(row?["sms"], d.Sms),
            };
        }
        channels["critical"] = new JsonObject { ["push"] = true, ["email"] = true, ["sms"] = true };
        return new JsonObject
        {
            ["channels"] = channels,
            ["quiet"] = new JsonObject { ["on"] = Flag(q?["on"], false), ["from"] = Time(q?["from"], "22:00"), ["to"] = Time(q?["to"], "07:00") },
        };
    }

    private static bool Flag(JsonNode? n, bool fallback) =>
        n is JsonValue v && v.TryGetValue<bool>(out var b) ? b : fallback;

    private static string Time(JsonNode? n, string fallback) =>
        n is JsonValue v && v.TryGetValue<string>(out var s) && Clock().IsMatch(s) ? s : fallback;

    public sealed record Notice(string Id, string Category, Dictionary<string, object> Params);

    public sealed record NoticeInput(string Payment, string FinalDue, int DocumentsMissing, int PassportProblems, string CheckinState, string CheckinOpens);

    /// <summary>What the guest should hear about now, most urgent first. Derived from their trip, so it can never disagree with it.</summary>
    public static List<Notice> BuildNotices(NoticeInput i)
    {
        var list = new List<Notice>();
        if (i.Payment == "overdue") list.Add(new("payOverdue", "critical", new() { ["date"] = i.FinalDue }));
        if (i.PassportProblems > 0) list.Add(new("passportProblem", "critical", new() { ["count"] = i.PassportProblems }));
        if (i.Payment == "dueSoon") list.Add(new("payDue", "payments", new() { ["date"] = i.FinalDue }));
        if (i.DocumentsMissing > 0) list.Add(new("documentsMissing", "documents", new() { ["count"] = i.DocumentsMissing }));
        if (i.CheckinState != "done") list.Add(new("checkinOpens", "checkin", new() { ["date"] = i.CheckinOpens, ["open"] = i.CheckinState == "open" ? 1 : 0 }));
        return list;
    }

    public static readonly string[] NoticeIds = ["payOverdue", "payDue", "passportProblem", "documentsMissing", "checkinOpens"];

    public static readonly TimeSpan TicketReceived = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan TicketInProgress = TimeSpan.FromMinutes(60);

    /// <summary>How far along a callback or email request is, from its age (the crew side is simulated); a stored status never goes backwards.</summary>
    public static string TicketStatus(DateTime createdAt, DateTime now, string stored)
    {
        var age = now - createdAt;
        var derived = age < TicketReceived ? 0 : age < TicketInProgress ? 1 : 2;
        var floor = stored switch { "done" => 2, "inProgress" => 1, _ => 0 };
        return Math.Max(derived, floor) switch { 0 => "received", 1 => "inProgress", _ => "resolved" };
    }

}
