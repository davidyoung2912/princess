namespace Princess.Api.Domain;

public sealed record AboardState(long At, int MinutesLeft, string Level, int[] Reminders, int? NextReminder);

/// <summary>A port day with its all-aboard time shown in ship time and local port time ("9:30 am").</summary>
public sealed record PortDay(
    int Day, string Port, string Date, string AllAboardShip, string AllAboardLocal, long AllAboardAt, long ArriveAt, long DepartAt, string ShipZone, string PortZone, bool Tender);

public sealed record PortDayWithState(
    int Day, string Port, string Date, string AllAboardShip, string AllAboardLocal, long AllAboardAt, long ArriveAt, long DepartAt, string ShipZone, string PortZone, bool Tender, AboardState State);

public sealed record TenderGroup(string Id, string Name, int Offset);

public sealed record TenderView(TenderGroup Group, long CallAt, string Status, int DelayMinutes, int WaitMinutes, long LastTenderAt);

public sealed record Contact(string Label, string Number, string Note);

public sealed record EmergencyCard(string Guest, string Stateroom, int Deck, string Muster, MusterStation? MusterPlace, IReadOnlyList<Contact> Contacts, string Script);

public sealed record WeatherToday(string Summary, int HighF, int LowF, string Sea);

/// <summary>
/// Ported from <c>src/domain/allaboard.ts</c> (the all-aboard countdown and tenders), <c>safety.ts</c> (the muster drill and emergency card) and the day's weather of <c>onboardMock.ts</c>.
/// Times, groups and waits are authored concept values.
/// </summary>
public static class AboardRules
{
    public static readonly int[] ReminderThresholds = [120, 60, 30];

    /// <summary>The sailing leaves 30 minutes after all-aboard on the authored days (all aboard 16:30, depart 17:00).</summary>
    public const int SailAfterMinutes = 30;

    private static long Ms(DateTime utc) => TripRules.ToMs(utc);

    /// <summary>Where a guest stands against the all-aboard time: plenty of time, under two hours (soon), under thirty minutes (now), past it but before sailing (late), or the ship has gone.</summary>
    public static AboardState StateOf(DateTime allAboardAt, DateTime now)
    {
        var minutesLeft = (int)Math.Max(0, Math.Ceiling((allAboardAt - now).TotalMinutes));
        var sailAt = allAboardAt.AddMinutes(SailAfterMinutes);
        var level = now >= sailAt ? "gone" : now >= allAboardAt ? "late" : minutesLeft <= 30 ? "now" : minutesLeft <= 120 ? "soon" : "plenty";
        var reminders = ReminderThresholds.Where(m => minutesLeft <= m && now < allAboardAt).ToArray();
        int? next = ReminderThresholds.OrderByDescending(m => m).Where(m => m < minutesLeft).Select(m => (int?)m).FirstOrDefault();
        return new AboardState(Ms(allAboardAt), minutesLeft, level, reminders, next);
    }

    /// <summary>A clock time as "9:14 am" in a named time zone.</summary>
    public static string ClockTime(DateTime utc, string zone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));
        var h = local.Hour % 12 == 0 ? 12 : local.Hour % 12;
        return $"{h}:{local.Minute:00} {(local.Hour < 12 ? "am" : "pm")}";
    }

    /// <summary>The port day a moment falls in, or the nearest one still to come, or null when none is left.</summary>
    public static PortDay? PortDayAt(DateOnly departure, DateTime now)
    {
        foreach (var x in Itinerary.Days(departure).Where(d => d.Port is not ("sea" or "fll")))
        {
            var zone = Itinerary.Ports[x.Port].Zone;
            if (now > Itinerary.LocalToUtc(x.Date, x.Depart!.Value, zone)) continue;
            var allAboard = Itinerary.AllAboardAt(departure, x.Day)!.Value;
            var shipZone = Itinerary.ShipZoneAt(departure, allAboard);
            return new PortDay(
                x.Day, x.Port, x.Date.ToString("yyyy-MM-dd"), ClockTime(allAboard, shipZone), ClockTime(allAboard, zone), Ms(allAboard), Ms(Itinerary.LocalToUtc(x.Date, x.Arrive!.Value, zone)),
                Ms(Itinerary.LocalToUtc(x.Date, x.Depart.Value, zone)), shipZone, zone, Itinerary.Ports[x.Port].Tender);
        }
        return null;
    }

    public static PortDayWithState WithState(PortDay d, DateTime now) =>
        new(d.Day, d.Port, d.Date, d.AllAboardShip, d.AllAboardLocal, d.AllAboardAt, d.ArriveAt, d.DepartAt, d.ShipZone, d.PortZone, d.Tender, StateOf(DateTimeOffset.FromUnixTimeMilliseconds(d.AllAboardAt).UtcDateTime, now));

    // ---- Tender (POR-04) ----

    /// <summary>Ticket groups called in order from the first call; ship-tour guests and priority guests go first.</summary>
    public static readonly IReadOnlyList<TenderGroup> TenderGroups =
    [
        new("tour", "Ship tours", 0), new("priority", "Priority and assistance", 15), new("g1", "Group 1", 30), new("g2", "Group 2", 60), new("g3", "Group 3", 90), new("g4", "Group 4", 120),
    ];

    /// <summary>The first call, local port time, after the ship anchors.</summary>
    public const string FirstCall = "07:45";

    /// <summary>The last tender leaves the landing this long before all-aboard.</summary>
    public const int LastTenderMinutes = 45;

    /// <summary>A guest's group: ship-tour guests first, priority or assistance guests next, the rest spread over four groups.</summary>
    public static TenderGroup TenderGroupFor(bool shipTour, bool priority, bool assistance, string seed) =>
        shipTour ? TenderGroups[0] : priority || assistance ? TenderGroups[1] : TenderGroups[2 + (int)(CabinRules.Hash(seed) % 4)];

    /// <summary>Tender state for a port day. <paramref name="delayMinutes"/> is the scenario's late start; a delayed operation calls every group that much later.</summary>
    public static TenderView TenderViewOf(PortDay day, TenderGroup group, DateTime now, int delayMinutes)
    {
        var scheduled = Itinerary.LocalToUtc(DateOnly.ParseExact(day.Date, "yyyy-MM-dd"), TimeOnly.ParseExact(FirstCall, "HH:mm"), day.PortZone);
        var first = scheduled.AddMinutes(delayMinutes);
        var callAt = first.AddMinutes(group.Offset);
        var status = now < scheduled.AddMinutes(-30) ? "before"
            : delayMinutes > 0 && now < first ? "delayed"
            : now < callAt.AddMinutes(-5) ? "waiting"
            : now < callAt.AddMinutes(30) ? "calling"
            : "running";
        var wait = status == "running" ? 10 + (int)(CabinRules.Hash($"{day.Date}|{(long)Math.Floor(Ms(now) / 900_000.0)}") % 11) : status == "calling" ? 15 : 0;
        return new TenderView(group, Ms(callAt), status, delayMinutes, wait, day.AllAboardAt - LastTenderMinutes * 60_000L);
    }

    /// <summary>Whether the ship may tender instead of docking: Roatán in the weather scenario (POR-04).</summary>
    public static bool MayTenderInstead(string port, bool weather) => weather && port == "roatan";

    // ---- Weather (the mocked service in data model section 8) ----

    private static readonly string[] Seas = ["Calm sea and a light breeze.", "A gentle swell and a moderate breeze.", "A slight sea and a fresh breeze."];

    public static WeatherToday WeatherOn(DateOnly date, bool rough)
    {
        var w = PlanRules.WeatherFor(date);
        var summary = w.Rain == "high" ? "Showers likely, warm between them" : w.Rain == "some" ? "Sunny with a passing shower or two" : "Mostly sunny";
        return new WeatherToday(summary, w.HighF, w.LowF, rough ? "A rougher sea is expected. The ship may tender where it planned to dock." : Seas[CabinRules.Hash(date.ToString("yyyy-MM-dd")) % Seas.Length]);
    }

    // ---- The muster drill and emergency card (safety.ts) ----

    public const int DrillDay = 1;
    public const string DrillTime = "14:00";
    public const string MedicalNumber = "555-0112", CabinEmergency = "911", GuestServicesNumber = "555-0100", EmergencyNumber = "555-0111";

    /// <summary>People may check in from an hour before the drill until 18 hours after it.</summary>
    public const int MusterOpensMinutes = 60, MusterClosesHours = 18;

    public static DateTime DrillAt(DateOnly departure) => Itinerary.LocalToUtc(departure.AddDays(DrillDay - 1), TimeOnly.ParseExact(DrillTime, "HH:mm"), Itinerary.ShipHomeZone);

    public static readonly IReadOnlyList<Contact> EmergencyContacts =
    [
        new("cabin", CabinEmergency, "From any cabin or ship phone"),
        new("mobile", EmergencyNumber, "From your own phone on the ship’s network"),
        new("medical", MedicalNumber, "Medical Center, Deck 4 forward"),
        new("guestServices", GuestServicesNumber, "Guest Services, Deck 6 forward"),
    ];

    /// <summary>The card a guest keeps offline: stateroom, station, who to call, and the words to say.</summary>
    public static EmergencyCard EmergencyCardOf(string guest, string stateroom, int deck, string muster) =>
        new(guest, stateroom, deck, muster, ProgramRules.MusterByLabel(muster), EmergencyContacts, $"This is {guest}. I need help in stateroom {stateroom}, deck {deck}.");
}
