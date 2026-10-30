namespace Princess.Api.Domain;

public sealed record Port(string Id, string Name, string Zone, bool Tender);

/// <summary>One day of the sailing. Times are local to the port on a port day (and the ship's clock otherwise).</summary>
public sealed record ItineraryDay(int Day, DateOnly Date, string Port, TimeOnly? Arrive, TimeOnly? AllAboard, TimeOnly? Depart);

/// <summary>Ported from <c>itinerary</c>, <c>PORTS</c> and <c>shipZoneOnDate</c> in <c>src/domain/sailings.ts</c>. Every sailing runs the same eight days from its departure date.</summary>
public static class Itinerary
{
    public const string ShipHomeZone = "America/New_York";
    public const string ShipWestZone = "America/Belize";

    public static readonly IReadOnlyDictionary<string, Port> Ports = new Dictionary<string, Port>
    {
        ["fll"] = new("fll", "Fort Lauderdale (Port Everglades)", "America/New_York", false),
        ["cozumel"] = new("cozumel", "Cozumel, Mexico", "America/Cancun", false),
        ["belize"] = new("belize", "Belize City, Belize", "America/Belize", true),
        ["roatan"] = new("roatan", "Roatán, Honduras", "America/Tegucigalpa", false),
    };

    private static TimeOnly T(string hhmm) => TimeOnly.ParseExact(hhmm, "HH:mm");

    public static List<ItineraryDay> Days(DateOnly departure)
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

    /// <summary>The zone the ship's clocks follow on a calendar date: Belize time on days 4 to 6 (both changes happen at 02:00), Eastern otherwise.</summary>
    public static string ShipZoneOnDate(DateOnly departure, DateOnly date)
    {
        var n = date.DayNumber - departure.DayNumber + 1;
        return n is >= 4 and <= 6 ? ShipWestZone : ShipHomeZone;
    }

    /// <summary>The instant a wall clock in <paramref name="zone"/> shows this date and time.</summary>
    public static DateTime LocalToUtc(DateOnly date, TimeOnly time, string zone)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(zone);
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (tz.IsInvalidTime(local)) local = local.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(local, tz);
    }

    /// <summary>The zone the ship's clocks follow at a moment (<c>shipZoneAt</c>): Eastern, Belize time from 02:00 on day 4, Eastern again from 02:00 on day 7.</summary>
    public static string ShipZoneAt(DateOnly departure, DateTime utc)
    {
        var west = LocalToUtc(departure.AddDays(3), new TimeOnly(2, 0), ShipHomeZone);
        var home = LocalToUtc(departure.AddDays(6), new TimeOnly(2, 0), ShipWestZone);
        return utc >= home ? ShipHomeZone : utc >= west ? ShipWestZone : ShipHomeZone;
    }

    public static (DateOnly Date, TimeOnly Time) LocalAt(DateTime utc, string zone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zone));
        return (DateOnly.FromDateTime(local), TimeOnly.FromDateTime(local));
    }

    /// <summary>Whether the ship is at sea at a moment (<c>portAt</c>): a day with no port, or a port day before arrival or after departure. Fort Lauderdale days count as port.</summary>
    public static bool AtSea(DateOnly departure, DateTime utc)
    {
        var (date, _) = LocalAt(utc, ShipZoneAt(departure, utc));
        var today = Days(departure).FirstOrDefault(d => d.Date == date);
        if (today is null || today.Port == "sea") return true;
        if (today.Port == "fll") return false;
        var zone = Ports[today.Port].Zone;
        return !(utc >= LocalToUtc(date, today.Arrive!.Value, zone) && utc < LocalToUtc(date, today.Depart!.Value, zone));
    }

    /// <summary>Whether the guest can be on board: from 11:00 on embarkation day until 06:00 on the last morning (the stages <c>embarkation</c> to <c>farewell</c>).</summary>
    public static bool Aboard(DateOnly departure, DateTime utc) =>
        utc >= LocalToUtc(departure, new TimeOnly(11, 0), ShipHomeZone) && utc < LocalToUtc(departure.AddDays(7), new TimeOnly(6, 0), ShipHomeZone);

    /// <summary>The moment all guests must be back aboard on a port day, or null on a day with none.</summary>
    public static DateTime? AllAboardAt(DateOnly departure, int day)
    {
        var d = Days(departure)[day - 1];
        return d.AllAboard is { } a && d.Port is not ("sea" or "fll") ? LocalToUtc(d.Date, a, Ports[d.Port].Zone) : null;
    }
}
