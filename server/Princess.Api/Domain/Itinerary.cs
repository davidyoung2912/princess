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
}
