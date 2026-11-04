using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed record PulseVenueDto(int Observed, int[] Ahead);

/// <summary>Ship pulse levels: for each venue the level at the last five-minute mark and at <c>now</c> plus 0 to 8 half hours.</summary>
public sealed record PulseDto(long Now, long ObservedAt, Dictionary<string, PulseVenueDto> Venues, string Source);

/// <summary>A cruise day's levels for each venue at every half hour from midnight ship time (48 values), for plans that look across the whole day.</summary>
public sealed record PulseDayDto(int Day, long StartAt, Dictionary<string, int[]> Venues, string Source);

public sealed record StormDto(string Source, string Departure, string Returns, bool InSeason, int Percent, string Band, string Phase, string[] LineMay, string[] YouCan, bool Peak);

public sealed record MoonDto(string Phase, string Name, int Lit);

public sealed record SkyNightDto(int Day, string Port, string Sunrise, string Sunset, long SunsetAt, MoonDto Moon, string SunsetSide, string? SailAway, bool SailAwayAtSunset, string[] Stars, bool DarkSky, string FirstLight, string LastLight, string DarkAt, string Source);

public sealed record LoungerDto(int Id, string State, int? ReturnsIn);

public sealed record LoungersDto(long Minute, LoungerDto[] Loungers, string Source);

public sealed record FoundItemDto(string Id, string What, string[] Keywords, string At);

public sealed record FoundListDto(FoundItemDto[] Items, string Source);

public sealed record SightingsDto(int Day, string[] Species, string Source);

public sealed record WatchOpeningDto(long? OpensAt, string Source);

/// <summary>
/// Simulated on-board and planning feeds of multi-device plan 2, Phase 3, ported from the client (<c>pulse.ts</c>, <c>storm.ts</c>, <c>sky.ts</c>,
/// <c>aboardMore.ts</c>, <c>autopilot.ts</c>): same hashes, same tables, same rounding, so the first version of each is identical on every device.
/// A real provider replaces a body and keeps its shape.
/// </summary>
public static class OnboardFeedRules
{
    private const long Min = 60_000;
    private static readonly Regex IsoDate = new(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}$", RegexOptions.Compiled);

    public static bool ValidDate(string? date) => date is not null && IsoDate.IsMatch(date) && DateOnly.TryParseExact(date, "yyyy-MM-dd", out _);

    /// <summary>A moment the feeds will answer for: roughly 2020 to 2100, in epoch milliseconds.</summary>
    public static bool ValidMoment(long at) => at is >= 1_577_836_800_000 and <= 4_102_444_800_000;

    private static DateTime Utc(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;

    // ---------- ship pulse (pulse.ts) ----------

    private static readonly (string Id, string Kind)[] PulseVenues =
    [
        ("lido-pool", "pool"), ("lido", "buffet"), ("eatery", "dining"), ("arena", "theatre"), ("lotus", "spa"), ("guest-services", "service"), ("promenade", "deck"),
    ];

    private static readonly Dictionary<string, int[]> Shape = new()
    {
        ["pool"] = [0, 0, 0, 0, 0, 0, 5, 10, 15, 25, 45, 70, 80, 85, 85, 80, 65, 40, 20, 10, 5, 5, 0, 0],
        ["buffet"] = [0, 0, 0, 0, 0, 5, 30, 75, 80, 55, 25, 45, 85, 80, 40, 25, 30, 55, 80, 70, 40, 15, 5, 0],
        ["dining"] = [0, 0, 0, 0, 0, 0, 10, 40, 60, 40, 20, 50, 70, 55, 30, 25, 30, 45, 60, 55, 35, 20, 10, 0],
        ["theatre"] = [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 15, 15, 10, 10, 15, 20, 25, 35, 55, 80, 90, 90, 50, 20],
        ["spa"] = [0, 0, 0, 0, 0, 0, 0, 10, 30, 55, 70, 75, 70, 70, 75, 70, 55, 35, 15, 0, 0, 0, 0, 0],
        ["service"] = [0, 0, 0, 0, 0, 0, 0, 20, 70, 85, 70, 50, 40, 40, 50, 60, 80, 60, 30, 15, 10, 5, 0, 0],
        ["deck"] = [5, 0, 0, 0, 0, 5, 25, 40, 30, 20, 25, 30, 25, 25, 30, 35, 40, 30, 20, 10, 5, 5, 5, 5],
    };

    private static readonly Dictionary<string, int> AshoreDrop = new() { ["pool"] = 40, ["buffet"] = 35, ["dining"] = 25, ["theatre"] = 15, ["spa"] = 30, ["service"] = -10, ["deck"] = 20 };

    /// <summary>The ship's hour of the day as a fraction (<c>envFor(...).hour</c>).</summary>
    private static double HourAt(Timeline timeline, DateTime utc)
    {
        var (_, time) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        return time.Hour + time.Minute / 60.0;
    }

    /// <summary>Whether guests are ashore (<c>envFor(...).ashore</c>): in a posted port between 09:00 and 16:00 ship time.</summary>
    private static bool AshoreAt(Timeline timeline, DateTime utc)
    {
        var (port, _) = timeline.PortAt(utc);
        var (_, time) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        return port is "cozumel" or "belize" or "roatan" && time.Hour >= 9 && time.Hour < 16;
    }

    /// <summary>The venues are keyed by the ship's own place ids (the main theatre is <c>arena</c> on Sun and <c>princess-theater</c> on Sky and Sapphire); a level is worked out from the Sun id, so the figures match on every ship.</summary>
    /// <summary>The level (0 to 100) of a venue at a moment (<c>levelAt</c>).</summary>
    public static int PulseLevel(string id, long atMs, Timeline timeline)
    {
        var kind = PulseVenues.First(v => v.Id == id).Kind;
        var utc = Utc(atMs);
        var hour = HourAt(timeline, utc);
        var floor = Math.Floor(hour);
        var table = Shape[kind];
        var lo = (int)floor % 24;
        var next = table[(lo + 1) % 24];
        var shape = table[lo] + (next - table[lo]) * (hour - floor);
        var wobble = (int)(ExcursionRules.Hash($"{id}|{(long)Math.Floor(atMs / (double)(15 * Min))}") % 21) - 10;
        var drop = AshoreAt(timeline, utc) ? AshoreDrop[kind] : 0;
        return (int)Math.Max(0, Math.Min(100, Pricing.JsRound(shape + wobble - drop)));
    }

    public static bool ValidPulseDay(string? departure, int day) => ValidDate(departure) && day is >= 1 and <= Itinerary.MaxDay;

    public static PulseDayDto PulseDay(Timeline timeline, int day, string? shipId = null)
    {
        var date = timeline.Departure.AddDays(day - 1);
        var startAt = new DateTimeOffset(Itinerary.LocalToUtc(date, new TimeOnly(0, 0), timeline.ShipZoneOnDate(date)), TimeSpan.Zero).ToUnixTimeMilliseconds();
        var venues = PulseVenues.ToDictionary(v => AboardPlans.Room(shipId, v.Id) ?? v.Id, v => Enumerable.Range(0, 48).Select(i => PulseLevel(v.Id, startAt + i * 30 * Min, timeline)).ToArray());
        return new PulseDayDto(day, startAt, venues, FeedRules.Sim);
    }

    public static PulseDto Pulse(Timeline timeline, long now, string? shipId = null)
    {
        var observedAt = (long)Math.Floor(now / (double)(5 * Min)) * 5 * Min;
        var venues = new Dictionary<string, PulseVenueDto>();
        foreach (var (id, _) in PulseVenues)
            venues[AboardPlans.Room(shipId, id) ?? id] = new PulseVenueDto(PulseLevel(id, observedAt, timeline), Enumerable.Range(0, 9).Select(i => PulseLevel(id, now + i * 30 * Min, timeline)).ToArray());
        return new PulseDto(now, observedAt, venues, FeedRules.Sim);
    }

    // ---------- storm watch (storm.ts) ----------

    private const int SailingNights = 7;
    private static readonly int[] MonthChance = [0, 0, 0, 0, 0, 2, 4, 8, 15, 10, 3, 0];
    private static readonly string[] LineMay = ["reroute", "swap", "shorten", "delay", "cancel"];
    private static readonly string[] YouCan = ["insurance", "flights", "early", "follow", "plan"];

    private static bool HurricaneSeason(string date) => int.Parse(date.AsSpan(5, 2)) - 1 is >= 5 and <= 10;

    public static bool ValidStormQuery(string? departure, int days) => ValidDate(departure) && days is >= -400 and <= 800;

    public static StormDto Storm(string departure, int daysToDeparture)
    {
        var returns = DateOnly.ParseExact(departure, "yyyy-MM-dd").AddDays(SailingNights).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var months = new[] { int.Parse(departure.AsSpan(5, 2)) - 1, int.Parse(returns.AsSpan(5, 2)) - 1 };
        var percent = months.Max(m => MonthChance[m]);
        var band = percent <= 0 ? "none" : percent < 5 ? "low" : percent < 12 ? "some" : "higher";
        var phase = daysToDeparture <= 0 ? "sailing" : daysToDeparture <= 3 ? "near" : daysToDeparture <= 14 ? "watch" : "far";
        return new StormDto(
            FeedRules.Sim, departure, returns, HurricaneSeason(departure) || HurricaneSeason(returns), percent, band, phase,
            band == "none" ? [] : LineMay, band == "none" ? [] : band == "low" ? YouCan.Take(2).ToArray() : YouCan, months.Contains(8));
    }

    // ---------- sun, moon and stars (sky.ts, with the heading table from cabinScore.ts) ----------

    private static readonly Dictionary<int, (double Lat, double Lon)> Positions = new()
    {
        [1] = (26.1, -80.1), [2] = (24.5, -84.5), [3] = (20.5, -86.9), [4] = (17.5, -88.2), [5] = (16.3, -86.5), [6] = (20.5, -85), [7] = (24.5, -82), [8] = (26.1, -80.1),
    };

    private static readonly Dictionary<int, int> Headings = new() { [1] = 135, [2] = 215, [3] = 350, [4] = 90, [5] = 300, [6] = 40, [7] = 20, [8] = 180 };

    private static readonly string[][] Season =
    [
        ["Orion", "Taurus", "Gemini"], ["Orion", "Gemini", "Leo"], ["Leo", "Gemini", "Ursa Major"], ["Leo", "Virgo", "Ursa Major"],
        ["Virgo", "Bootes", "Scorpius"], ["Scorpius", "Sagittarius", "Southern Cross low in the south"], ["Scorpius", "Sagittarius", "Cygnus"], ["Sagittarius", "Cygnus", "Aquila"],
        ["Cygnus", "Pegasus", "Aquila"], ["Pegasus", "Andromeda", "Cassiopeia"], ["Taurus", "Pegasus", "Cassiopeia"], ["Orion", "Taurus", "Gemini"],
    ];

    private static readonly string[] MoonPhases = ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"];
    private static readonly string[] MoonNames = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
    private const double Synodic = 29.530588853;
    private const double Rad = Math.PI / 180;

    private static long Midnight(string date) => new DateTimeOffset(DateOnly.ParseExact(date, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).ToUnixTimeMilliseconds();

    /// <summary>The two moments the sun crosses a height above the horizon (degrees; -0.833 is sunrise and sunset, -6 civil twilight, -12 nautical twilight).</summary>
    private static (long Sunrise, long Sunset) SunTimes(string date, double lat, double lon, double altitude = -0.833)
    {
        var n = (int)((Midnight(date) - Midnight($"{date[..4]}-01-01")) / 86_400_000) + 1;
        var decl = 23.44 * Math.Sin(Rad * (360.0 / 365) * (n - 81));
        var b = Rad * (360.0 / 364) * (n - 81);
        var eotMin = 9.87 * Math.Sin(2 * b) - 7.53 * Math.Cos(b) - 1.5 * Math.Sin(b);
        var h = Math.Acos(Math.Max(-1, Math.Min(1, (Math.Sin(Rad * altitude) - Math.Sin(Rad * lat) * Math.Sin(Rad * decl)) / (Math.Cos(Rad * lat) * Math.Cos(Rad * decl))))) / Rad / 15;
        var noonUtcH = 12 - lon / 15 - eotMin / 60;
        var baseMs = (double)Midnight(date);
        return (Pricing.JsRound(baseMs + (noonUtcH - h) * 3_600_000), Pricing.JsRound(baseMs + (noonUtcH + h) * 3_600_000));
    }

    private static (string Phase, string Name, int Lit) MoonAt(long epoch)
    {
        var newMoon = DateTimeOffset.Parse("2000-01-06T18:14:00Z").ToUnixTimeMilliseconds();
        var age = ((epoch - newMoon) / 86_400_000.0 % Synodic + Synodic) % Synodic;
        var f = age / Synodic;
        var i = (int)Math.Floor(f * 8 + 0.5) % 8;
        return (MoonPhases[i], MoonNames[i], (int)Pricing.JsRound((1 - Math.Cos(2 * Math.PI * f)) / 2 * 100));
    }

    private static double AngleBetween(double a, double b)
    {
        var d = Math.Abs(((a - b) % 360 + 360) % 360);
        return d > 180 ? 360 - d : d;
    }

    /// <summary>Which side of the ship faces the sun in the afternoon (<c>sunSide(heading, 'afternoon')</c>; the sun is at 260 degrees).</summary>
    private static string AfternoonSide(int heading)
    {
        var port = AngleBetween((heading + 270) % 360, 260);
        var starboard = AngleBetween((heading + 90) % 360, 260);
        if (Math.Min(port, starboard) > 60) return "neither";
        return port <= starboard ? "port" : "starboard";
    }

    public static bool ValidSkyQuery(string? departure, int day) => ValidDate(departure) && day is >= 1 and <= Itinerary.MaxDay;

    public static SkyNightDto SkyNight(string departure, int day, string? sailing = null)
    {
        var dep = DateOnly.ParseExact(departure, "yyyy-MM-dd");
        var timeline = TimelineBook.For(sailing, dep);
        var d = timeline.Days[day - 1];
        var (lat, lon) = Positions[day];
        var zone = timeline.ShipZoneOnDate(d.Date);
        var date = d.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var (sunrise, sunset) = SunTimes(date, lat, lon);
        var (civilDawn, civilDusk) = SunTimes(date, lat, lon, -6);
        var (_, nauticalDusk) = SunTimes(date, lat, lon, -12);
        var moon = MoonAt(sunset);
        string Clock(long ms) => Itinerary.LocalAt(Utc(ms), zone).Time.ToString("HH:mm", CultureInfo.InvariantCulture);
        long? sailAt = d.Depart is { } dp ? new DateTimeOffset(Itinerary.LocalToUtc(d.Date, dp, !timeline.IsCall(d) ? zone : Itinerary.PortById(d.Port).Zone), TimeSpan.Zero).ToUnixTimeMilliseconds() : null;
        return new SkyNightDto(
            day, d.Port, Clock(sunrise), Clock(sunset), sunset, new MoonDto(moon.Phase, moon.Name, moon.Lit), AfternoonSide(Headings[day]),
            d.Depart?.ToString("HH:mm", CultureInfo.InvariantCulture), sailAt is { } s && s <= sunset + 45 * Min && s >= sunset - 90 * Min, Season[d.Date.Month - 1], moon.Lit < 70, Clock(civilDawn), Clock(civilDusk), Clock(nauticalDusk), FeedRules.Sim);
    }

    // ---------- loungers (aboardMore.ts) ----------

    private const int Loungers = 8;

    /// <summary>The <c>hash</c> of <c>aboardMore.ts</c>: <c>h * 31 + code</c> in 32 bits.</summary>
    internal static uint Hash31(string text)
    {
        uint h = 0;
        foreach (var c in text) h = unchecked(h * 31 + c);
        return h;
    }

    /// <summary>The other loungers at a minute: free, held (with minutes until it is due back) or left too long. A guest's own hold and reports stay on their device.</summary>
    public static LoungersDto LoungerBoard(long now)
    {
        var minute = (long)Math.Floor(now / (double)Min);
        var rows = Enumerable.Range(1, Loungers).Select(id =>
        {
            var x = (int)((minute + Hash31($"lounger{id}")) % 60);
            return x < 20 ? new LoungerDto(id, "free", null) : x < 45 ? new LoungerDto(id, "held", 45 - x) : new LoungerDto(id, "overdue", null);
        }).ToArray();
        return new LoungersDto(minute, rows, FeedRules.Sim);
    }

    // ---------- lost property (aboardMore.ts) ----------

    private static readonly FoundItemDto[] Found =
    [
        new("f1", "Blue sunglasses case", ["sunglasses", "glasses", "case"], "guest-services"),
        new("f2", "Child’s green hat", ["hat", "cap", "green", "child"], "lido-pool"),
        new("f3", "Black phone charger", ["charger", "cable", "phone"], "eatery"),
        new("f4", "Paperback book", ["book", "paperback"], "guest-services"),
        new("f5", "Silver bracelet", ["bracelet", "jewellery", "jewelry", "silver"], "guest-services"),
    ];

    public static FoundListDto FoundList() => new(Found, FeedRules.Sim);

    // ---------- sightings (aboardMore.ts) ----------

    private static readonly string[] Species = ["dolphins", "flyingFish", "frigatebird", "turtle", "whale", "ray"];

    public static SightingsDto Sightings(int day) =>
        new(day, new[] { Species[(int)(Hash31($"a{day}") % (uint)Species.Length)], Species[(int)(Hash31($"b{day}") % (uint)Species.Length)] }.Distinct().ToArray(), FeedRules.Sim);

    // ---------- slot watch (autopilot.ts) ----------

    private const int WatchLeadMin = 30;

    public static bool ValidWatchQuery(string? id, long created, long slot) =>
        id is { Length: > 0 and <= 64 } && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_') && ValidMoment(created) && ValidMoment(slot) && slot >= created;

    /// <summary>When a place opens in the simulation, or null if it never does before the slot (<c>simulatedOpening</c>).</summary>
    public static WatchOpeningDto WatchOpening(string id, long createdAt, long slotAt)
    {
        var first = (long)Math.Floor(createdAt / (double)(60 * Min)) + 1;
        var last = (long)Math.Floor((slotAt - WatchLeadMin * Min) / (double)(60 * Min));
        for (var b = first; b <= last && b < first + 48; b++)
            if (ExcursionRules.Hash($"{id}|{b}") % 6 == 0) return new WatchOpeningDto(b * 60 * Min, FeedRules.Sim);
        return new WatchOpeningDto(null, FeedRules.Sim);
    }
}
