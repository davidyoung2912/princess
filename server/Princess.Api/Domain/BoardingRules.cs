using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

public sealed record StateroomAssignment(string Number, int Deck, bool Accessible, string Muster);

public sealed record TerminalInfo(string Name, string? ChangedFrom);

/// <summary>What a boarding pass QR code carries. <see cref="Version"/> is always 1.</summary>
public sealed record PassData(string Booking, int Seq, string Name, string Departure, string Cabin, string Group);

/// <summary>Ported from <c>src/domain/boarding.ts</c>: the boarding pass and its QR code, the lane, embarkation day and the offline fallbacks (CHK-04, CHK-05, CHK-12, CHK-14, CHK-15). Times and places are authored concept values.</summary>
public static class BoardingRules
{
    public static readonly TerminalInfo UsualTerminal = new("Terminal 2", null);
    public const string OtherTerminal = "Terminal 4";

    /// <summary>Terminal 2 is usual; a sailing can be moved, and the guest is told which one it replaced (CHK-15).</summary>
    public static TerminalInfo TerminalFor(string? stored) =>
        string.IsNullOrWhiteSpace(stored) || stored == UsualTerminal.Name ? UsualTerminal : new TerminalInfo(stored, UsualTerminal.Name);

    // ---- Stateroom, muster station, boarding group ----

    private static readonly string[][] Stations = [["A", "B"], ["C", "D"], ["E", "F"]];

    /// <summary>The muster station follows where the stateroom is: front, middle or back of the ship, port or starboard side.</summary>
    public static string MusterStation(string position, string side) =>
        $"Station {Stations[position switch { "forward" => 0, "midship" => 1, _ => 2 }][side == "port" ? 0 : 1]}";

    /// <summary>
    /// The stateroom for a booking: the one chosen at booking when it is one of the sample staterooms, else a stable pick from the free ones of its room type
    /// (a step-free one when the booker needs it).
    /// </summary>
    public static StateroomAssignment AssignmentFor(string bookingNumber, string sailingId, string category, string? chosen, bool needsStepFree)
    {
        var all = CabinRules.CabinsFor(sailingId, category);
        var cabin = chosen is null ? null : all.FirstOrDefault(c => c.Number == chosen);
        if (cabin is null)
        {
            var free = all.Where(c => c.Available).ToList();
            var pool = needsStepFree && free.Any(c => c.Accessible) ? free.Where(c => c.Accessible).ToList() : free.Where(c => !c.Accessible).ToList();
            cabin = pool.Count > 0 ? pool[(int)(CabinRules.Hash($"{sailingId}|{bookingNumber}") % (uint)pool.Count)] : free.FirstOrDefault() ?? all.FirstOrDefault();
        }
        return cabin is null ? new StateroomAssignment(chosen ?? "TBA", 0, false, "Station A") : new StateroomAssignment(cabin.Number, cabin.Deck, cabin.Accessible, MusterStation(cabin.Position, cabin.Side));
    }

    /// <summary>Priority guests board first; everyone else boards by the arrival window they chose, so the group number follows it.</summary>
    public static string BoardingGroup(bool priority, string? window)
    {
        if (priority) return "Priority";
        if (window is null) return "Not set";
        var i = PlanRules.ArrivalWindows(false).FindIndex(w => w.Start == window);
        return i < 0 ? "Not set" : $"Group {i + 1}";
    }

    /// <summary>Green lane when check-in is finished for everyone; Blue lane when documents must be checked at the desk (CHK-08).</summary>
    public static string LaneFor(bool checkinDone) => checkinDone ? "green" : "blue";

    // ---- The pass and its QR code ----

    private static string Clean(string s) => s.Replace('|', ' ');

    /// <summary>The check value: the first 40 bits of an HMAC of the body under a server key, so a misread or edited code is spotted and nobody can make one up.</summary>
    public static string Sign(string key, string body) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes($"pcp|{body}"))[..5]).ToLowerInvariant();

    /// <summary>The text inside a boarding pass QR code, ending in the check value.</summary>
    public static string EncodePass(string key, PassData p)
    {
        var body = string.Join('|', "PCP1", p.Booking, p.Seq, Clean(p.Name.ToUpperInvariant()), p.Departure, p.Cabin, Clean(p.Group));
        return $"{body}|{Sign(key, body)}";
    }

    public static PassData? DecodePass(string key, string text)
    {
        var parts = text.Split('|');
        if (parts.Length != 8 || parts[0] != "PCP1") return null;
        var expected = Sign(key, string.Join('|', parts[..7]));
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(parts[7]))) return null;
        return int.TryParse(parts[2], out var seq) && seq >= 1 ? new PassData(parts[1], seq, parts[3], parts[4], parts[5], parts[6]) : null;
    }

    /// <summary>The name as printed on a pass: "WHITFIELD/GERALD".</summary>
    public static string PassName(string first, string last) => $"{last}/{first}".ToUpperInvariant();

    // ---- Embarkation day ----

    /// <summary>Ship local time on sailing day (Eastern).</summary>
    public const string TerminalOpens = "11:00", PriorityOpens = "10:30", Staterooms = "13:00", GangwayCloses = "13:30", SailAway = "15:00";

    public static DateTime DepartureAt(DateOnly departure, string hhmm) => Itinerary.LocalToUtc(departure, TimeOnly.ParseExact(hhmm, "HH:mm"), Itinerary.ShipHomeZone);

    /// <summary>The wait to get through the terminal, a guide from how busy the arrival window usually is.</summary>
    public static int WaitMinutes(string crowd) => crowd switch { "quiet" => 10, "busy" => 25, _ => 40 };

    /// <summary>Road traffic near the port follows the crowd in the window.</summary>
    public static string TrafficFor(string crowd) => crowd switch { "quiet" => "light", "busy" => "moderate", _ => "heavy" };

    public static ArrivalWindow? WindowFor(string? start, bool priority) => PlanRules.ArrivalWindows(priority).FirstOrDefault(w => w.Start == start);

    /// <summary>Bags dropped with the porters reach the stateroom within three hours, and not before the staterooms are ready.</summary>
    public const int DeliveryHours = 3;

    public static string LuggageStatus(DateTime? droppedAt, DateTime now, DateTime readyAt)
    {
        if (droppedAt is not { } d) return "notDropped";
        var due = d.AddHours(DeliveryHours);
        return now >= (due > readyAt ? due : readyAt) ? "delivered" : "dropped";
    }

    public static readonly string[] CarryOn = ["documents", "medication", "swimwear", "chargers", "valuables"];

    /// <summary>The embarkation-day companion: the cards in the order a guest meets them (CHK-12).</summary>
    public static readonly string[] Companion = ["terminal", "security", "photo", "gangway", "muster", "cabin"];

    /// <summary>The first card not yet done, or null when all are.</summary>
    public static string? CurrentCompanion(IReadOnlySet<string> done) => Companion.FirstOrDefault(s => !done.Contains(s));

    public static readonly (string Id, string Time)[] Afternoon = [("lunch", "12:00"), ("stateroom", Staterooms), ("muster", "14:00"), ("sailAway", SailAway)];
}
