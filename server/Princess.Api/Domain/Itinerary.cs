namespace Princess.Api.Domain;

public sealed record Port(string Id, string Name, string Zone, bool Tender, double Lat, double Lon);

/// <summary>One day of the sailing. Times are local to the port on a port day (and the ship's clock otherwise).</summary>
public sealed record ItineraryDay(int Day, DateOnly Date, string Port, TimeOnly? Arrive, TimeOnly? AllAboard, TimeOnly? Depart, int? ClockChangeHours = null, TimeOnly? ClockChangeAt = null);

/// <summary>The four ports and the zones of the older Western A route, kept for callers that have only a departure date; a sailing's own days and ports come from <see cref="Timeline"/> and <see cref="TimelineBook"/>.</summary>
public static class Itinerary
{
    public const string ShipHomeZone = "America/New_York";
    public const string ShipWestZone = "America/Belize";

    public static readonly IReadOnlyDictionary<string, Port> Ports = new Dictionary<string, Port>
    {
        ["fll"] = new("fll", "Fort Lauderdale (Port Everglades)", "America/New_York", false, 26.0925, -80.117),
        ["cozumel"] = new("cozumel", "Cozumel, Mexico", "America/Cancun", false, 20.423, -86.9223),
        ["belize"] = new("belize", "Belize City, Belize", "America/Belize", true, 17.4995, -88.1976),
        ["roatan"] = new("roatan", "Roatán, Honduras", "America/Tegucigalpa", false, 16.3194, -86.53),
    };

    private static TimeOnly T(string hhmm) => TimeOnly.ParseExact(hhmm, "HH:mm");

    /// <summary>A port by id: the served catalogue first (any port of any sailing), then the four ports of the older Western A route.</summary>
    public static Port? PortOf(string id) => TimelineBook.Port(id) ?? (Ports.TryGetValue(id, out var p) ? p : null);

    /// <summary>A port by id; an unknown id is an error (the catalogue and the day rows must agree).</summary>
    public static Port PortById(string id) => PortOf(id) ?? throw new KeyNotFoundException($"No port '{id}'.");

    /// <summary>The time zone of a port, or the ship's home zone for <c>sea</c> or an unknown id.</summary>
    public static string ZoneOf(string id) => PortOf(id)?.Zone ?? ShipHomeZone;

    /// <summary>The eight days of the older Western A route from a departure date.</summary>
    internal static List<ItineraryDay> LegacyDays(DateOnly departure)
    {
        DateOnly D(int n) => departure.AddDays(n - 1);
        return
        [
            new(1, D(1), "fll", null, null, T("15:00")),
            new(2, D(2), "sea", null, null, null),
            new(3, D(3), "cozumel", T("07:00"), T("16:30"), T("17:00")),
            new(4, D(4), "belize", T("07:00"), T("16:00"), T("17:00")),
            new(5, D(5), "roatan", T("08:00"), T("16:30"), T("17:00")),
            new(6, D(6), "sea", null, null, null),
            new(7, D(7), "sea", null, null, null),
            new(8, D(8), "fll", T("06:00"), null, null),
        ];
    }

    // ---- The older single-route API, kept for callers with only a departure date. A sailing's own timeline is a Timeline. ----

    public static List<ItineraryDay> Days(DateOnly departure) => LegacyDays(departure);

    public static string ShipZoneOnDate(DateOnly departure, DateOnly date) => Timeline.Legacy(departure).ShipZoneOnDate(date);

    /// <summary>The instant a wall clock in <paramref name="zone"/> shows this date and time.</summary>
    public static DateTime LocalToUtc(DateOnly date, TimeOnly time, string zone)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(zone);
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (tz.IsInvalidTime(local)) local = local.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(local, tz);
    }

    public static string ShipZoneAt(DateOnly departure, DateTime utc) => Timeline.Legacy(departure).ShipZoneAt(utc);

    public static (DateOnly Date, TimeOnly Time) LocalAt(DateTime utc, string zone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));
        return (DateOnly.FromDateTime(local), TimeOnly.FromDateTime(local));
    }

    public static bool AtSea(DateOnly departure, DateTime utc) => Timeline.Legacy(departure).AtSea(utc);

    public static bool Aboard(DateOnly departure, DateTime utc, int nights = 7) =>
        utc >= LocalToUtc(departure, new TimeOnly(11, 0), ShipHomeZone) && utc < LocalToUtc(departure.AddDays(nights), new TimeOnly(6, 0), ShipHomeZone);

    public static DateTime? AllAboardAt(DateOnly departure, int day) => Timeline.Legacy(departure).AllAboardAt(day);

    public static (string Port, int? Day) PortAt(DateOnly departure, DateTime utc) => Timeline.Legacy(departure).PortAt(utc);

    /// <summary>A change of the ship's clock: the moment (02:00 ship time overnight) and the hours the clock moves, negative is back.</summary>
    public sealed record ClockChange(DateTime At, int Hours);

    public static List<ClockChange> ShipClockChanges(DateOnly departure) => Timeline.Legacy(departure).ClockChanges();
}
