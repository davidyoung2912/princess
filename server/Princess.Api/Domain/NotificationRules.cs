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
            // One-tap do-not-disturb from Chat: the end time in milliseconds, 0 when off. It ends by itself (see ChatUrgencyRules.DndOn).
            ["dnd"] = new JsonObject { ["until"] = Millis((o?["dnd"] as JsonObject)?["until"]) },
        };
    }

    private static long Millis(JsonNode? n) =>
        n is JsonValue v && v.TryGetValue<long>(out var l) && l > 0 ? l : 0;

    private static bool Flag(JsonNode? n, bool fallback) =>
        n is JsonValue v && v.TryGetValue<bool>(out var b) ? b : fallback;

    private static string Time(JsonNode? n, string fallback) =>
        n is JsonValue v && v.TryGetValue<string>(out var s) && Clock().IsMatch(s) ? s : fallback;

    public sealed record Notice(string Id, string Category, Dictionary<string, object> Params);

    public sealed record NoticeInput(string Payment, string FinalDue, int DocumentsMissing, int PassportProblems, string CheckinState, string CheckinOpens, string? InstalmentDate = null, long InstalmentCents = 0, string Today = "", string? TenderPort = null, string TenderDate = "", string TenderBand = "", int TenderPercent = 0, string? FlightNumber = null, string FlightDate = "", string FlightState = "", int FlightDelay = 0, bool InstalmentAutoFailed = false, string? InstalmentTakenDate = null, long InstalmentTakenCents = 0);

    /// <summary>What the guest should hear about now, most urgent first. Derived from their trip, so it can never disagree with it.</summary>
    public static List<Notice> BuildNotices(NoticeInput i)
    {
        var list = new List<Notice>();
        if (i.Payment == "overdue") list.Add(new("payOverdue", "critical", new() { ["date"] = i.FinalDue }));
        if (i.PassportProblems > 0) list.Add(new("passportProblem", "critical", new() { ["count"] = i.PassportProblems }));
        if (i.Payment == "dueSoon") list.Add(new("payDue", "payments", new() { ["date"] = i.FinalDue }));
        if (i.InstalmentDate is not null && string.CompareOrdinal(i.InstalmentDate, DateOnly.ParseExact(i.Today, "yyyy-MM-dd").AddDays(InstalmentRules.RemindDays).ToString("yyyy-MM-dd")) <= 0)
            list.Add(new(i.InstalmentAutoFailed ? "instalmentAutoFailed" : "instalmentDue", "payments", new() { ["date"] = i.InstalmentDate, ["amount"] = i.InstalmentCents }));
        if (i.InstalmentTakenDate is not null) list.Add(new("instalmentTaken", "payments", new() { ["date"] = i.InstalmentTakenDate, ["amount"] = i.InstalmentTakenCents }));
        if (i.DocumentsMissing > 0) list.Add(new("documentsMissing", "documents", new() { ["count"] = i.DocumentsMissing }));
        if (i.TenderPort is not null) list.Add(new("tenderWatch", "checkin", new() { ["port"] = i.TenderPort, ["date"] = i.TenderDate, ["band"] = i.TenderBand, ["percent"] = i.TenderPercent }));
        if (i.FlightNumber is not null) list.Add(new("flightWatch", "checkin", new() { ["flight"] = i.FlightNumber, ["date"] = i.FlightDate, ["state"] = i.FlightState, ["minutes"] = i.FlightDelay }));
        if (i.CheckinState != "done") list.Add(new("checkinOpens", "checkin", new() { ["date"] = i.CheckinOpens, ["open"] = i.CheckinState == "open" ? 1 : 0 }));
        return list;
    }

    public static readonly string[] NoticeIds = ["payOverdue", "payDue", "instalmentDue", "instalmentAutoFailed", "instalmentTaken", "passportProblem", "documentsMissing", "tenderWatch", "flightWatch", "checkinOpens"];

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
