using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>A change of the ship's clock: the moment, the hours it moves (negative is back) and the cruise day of the morning it happens.</summary>
public sealed record ShipClockChangeDto(long At, int Hours, int Day);

/// <summary>When the ship reaches a port: the moment, the ship's clock then and the cruise day.</summary>
public sealed record ArrivalDto(long At, string ShipTime, int Day);

/// <summary>Ship time against the local time of the port the ship is in or heading for. Offsets are minutes from UTC; <c>DifferenceMinutes</c> is local minus ship.</summary>
public sealed record ShipClockDto(string ShipTime, int ShipOffsetMinutes, string ShipZone, string LocalPlace, string LocalTime, int LocalOffsetMinutes, int DifferenceMinutes, ShipClockChangeDto? NextChange);

/// <summary>Where the ship is and how it is moving. <c>InPort</c> is the port id while alongside, else null; <c>NextPort</c> is null once the last port is reached.</summary>
public sealed record ShipPositionDto(
    long Now, int? Day, double Lat, double Lon, double SpeedKnots, int HeadingDegrees, string Compass, string? InPort, string LastPort, string? NextPort,
    int NmSailed, int NmRemaining, int LegPercent, int VoyageNmSailed, int VoyageNmTotal, ArrivalDto? Arrival, ShipClockDto Clock, string Source);

/// <summary>The water and weather at the ship. Metric: metres, degrees Celsius, knots. <c>DepthClass</c> is shelf, slope, deep or trench; <c>SeaState</c> is the WMO code 0 to 9.</summary>
public sealed record SeaConditionsDto(
    long Now, double Lat, double Lon, int DepthM, string DepthClass, double WaterTempC, int WindKnots, string WindFrom, int Beaufort, int SeaState,
    double WaveM, double SwellM, int SwellPeriodSeconds, string SwellFrom, string Source);

public sealed record SeaZoneDto(string Id, string Name, string Habitat, string[] Wildlife);

/// <summary>A place the ship passes. <c>Side</c> is port, starboard or ahead (on the track); <c>PassesAt</c> is the time of closest approach (ms).</summary>
public sealed record LandmarkDto(string Id, string Name, string Kind, string Blurb, double Lat, double Lon, int ClosestNm, string Side, long PassesAt, string ShipTime, int Day, int DistanceNm);

public sealed record AlongTheWayDto(long Now, SeaZoneDto Zone, LandmarkDto[] Passing, LandmarkDto[] Ahead, LandmarkDto[] Behind, string Source);

/// <summary>
/// The simulated ship's track and the sea around it. Authored waypoints (with the depth of the water at each) between the ports, a constant speed
/// along each leg worked out from the posted sailing times, and weather that depends only on the clock. A real position feed replaces this behind
/// <c>IShipNavigation</c> and keeps the shape.
/// </summary>
public static class NavigationRules
{
    private const double Rad = Math.PI / 180;
    private const double EarthNm = 3440.065;
    private const long Hour = 3_600_000;

    private static readonly string[] Points16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

    public static string Compass(double degrees) => Points16[(int)Math.Round(((degrees % 360) + 360) % 360 / 22.5) % 16];

    public static bool ValidQuery(string? departure, long now) => OnboardFeedRules.ValidDate(departure) && OnboardFeedRules.ValidMoment(now);

    // ---------- geometry ----------

    internal static double Nm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = (lat2 - lat1) * Rad;
        var dLon = (lon2 - lon1) * Rad;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Rad) * Math.Cos(lat2 * Rad) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * EarthNm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    internal static double Bearing(double lat1, double lon1, double lat2, double lon2)
    {
        var dLon = (lon2 - lon1) * Rad;
        var y = Math.Sin(dLon) * Math.Cos(lat2 * Rad);
        var x = Math.Cos(lat1 * Rad) * Math.Sin(lat2 * Rad) - Math.Sin(lat1 * Rad) * Math.Cos(lat2 * Rad) * Math.Cos(dLon);
        return ((Math.Atan2(y, x) / Rad) + 360) % 360;
    }

    // ---------- the track ----------

    private sealed record Wp(double Lat, double Lon, int Depth);

    private sealed record Fix(double Lat, double Lon, int Depth, double Heading);

    private sealed class Track
    {
        public required string From { get; init; }
        public required string To { get; init; }
        public required Wp[] Points { get; init; }
        public double[] Cum { get; private set; } = [];
        public double Total { get; private set; }

        public Track Measure()
        {
            Cum = new double[Points.Length];
            for (var i = 1; i < Points.Length; i++) Cum[i] = Cum[i - 1] + Nm(Points[i - 1].Lat, Points[i - 1].Lon, Points[i].Lat, Points[i].Lon);
            Total = Cum[^1];
            return this;
        }

        /// <summary>The position, depth and course at a distance along the track.</summary>
        public Fix At(double nm)
        {
            nm = Math.Clamp(nm, 0, Total);
            var i = 1;
            while (i < Points.Length - 1 && Cum[i] < nm) i++;
            var a = Points[i - 1];
            var b = Points[i];
            var span = Cum[i] - Cum[i - 1];
            var f = span <= 0 ? 0 : (nm - Cum[i - 1]) / span;
            return new Fix(a.Lat + (b.Lat - a.Lat) * f, a.Lon + (b.Lon - a.Lon) * f, (int)Math.Round(a.Depth + (b.Depth - a.Depth) * f), Bearing(a.Lat, a.Lon, b.Lat, b.Lon));
        }
    }

    private static Wp P(string port, int depth) => new(Itinerary.PortById(port).Lat, Itinerary.PortById(port).Lon, depth);

    // Four legs, in sailing order. Depths are in metres and rounded: shelf and reef water is shallow, the Yucatan Channel and the Bartlett Trough are deep.
    private static readonly Track[] Authored =
    [
        new Track
        {
            From = "fll", To = "cozumel",
            Points = [P("fll", 12), new(26.09, -79.95, 150), new(25.75, -79.85, 300), new(25.0, -79.9, 700), new(24.0, -80.9, 800), new(23.95, -81.8, 900), new(23.3, -84.4, 2500),
                      new(22.2, -85.6, 2200), new(21.2, -86.0, 2000), new(21.3, -86.3, 1500), new(20.75, -86.85, 600), new(20.5, -86.98, 400), P("cozumel", 20)],
        }.Measure(),
        new Track
        {
            From = "cozumel", To = "belize",
            Points = [P("cozumel", 20), new(20.2, -87.0, 300), new(19.3, -86.7, 800), new(18.2, -87.3, 400), new(17.65, -87.8, 25), P("belize", 5)],
        }.Measure(),
        new Track
        {
            From = "belize", To = "roatan",
            Points = [P("belize", 5), new(17.4, -87.6, 25), new(16.9, -87.0, 60), new(16.5, -86.7, 150), P("roatan", 12)],
        }.Measure(),
        new Track
        {
            From = "roatan", To = "fll",
            Points = [P("roatan", 12), new(16.8, -86.3, 1500), new(17.8, -85.9, 4300), new(19.5, -85.4, 4000), new(21.6, -85.5, 2000), new(22.9, -84.6, 2600), new(23.5, -83.4, 1800),
                      new(23.95, -81.0, 800), new(24.8, -79.9, 700), new(25.7, -79.9, 300), new(26.09, -79.95, 150), P("fll", 12)],
        }.Measure(),
    ];

    /// <summary>The length of the authored Western A route in nautical miles.</summary>
    public static int VoyageNmTotal => (int)Math.Round(Authored.Sum(t => t.Total));

    /// <summary>The track of every leg of a route. The four authored legs are used where the route follows them; any other leg is a straight line between the two ports, deep in the middle.</summary>
    private static Track[] TracksFor(List<Stop> stops) => Routes.GetOrAdd(string.Join('>', stops.Select(s => s.Port)), _ =>
        [.. stops.Zip(stops.Skip(1), (a, b) => Authored.FirstOrDefault(t => t.From == a.Port && t.To == b.Port) ?? Generated(a.Port, b.Port))]);

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Track[]> Routes = new();

    private static Track Generated(string from, string to)
    {
        var a = Itinerary.PortById(from);
        var b = Itinerary.PortById(to);
        return new Track { From = from, To = to, Points = [new(a.Lat, a.Lon, 20), new((a.Lat + b.Lat) / 2, (a.Lon + b.Lon) / 2, 1500), new(b.Lat, b.Lon, 20)] }.Measure();
    }

    // ---------- the timetable ----------

    private sealed record Stop(string Port, DateTime? Arrive, DateTime? Depart);

    // The stops of a timeline never change, and a request resolves the ship's position several times (and every feed minute again), so they are built once per timeline.
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Timeline, List<Stop>> StopsOf = new();

    private static List<Stop> Stops(Timeline timeline) => StopsOf.GetValue(timeline, BuildStops);

    private static List<Stop> BuildStops(Timeline timeline)
    {
        var list = new List<Stop>();
        foreach (var d in timeline.Days)
        {
            if (d.Port == "sea") continue;
            var zone = Itinerary.PortById(d.Port).Zone;
            var arrive = d.Arrive is { } a ? Itinerary.LocalToUtc(d.Date, a, zone) : (DateTime?)null;
            var depart = d.Depart is { } p ? Itinerary.LocalToUtc(d.Date, p, zone) : (DateTime?)null;
            // An overnight stay is one stop: it arrives on the first day and leaves on the last.
            if (list.Count > 0 && list[^1].Port == d.Port) list[^1] = list[^1] with { Depart = depart };
            else list.Add(new Stop(d.Port, arrive, depart));
        }
        return list;
    }

    /// <summary>Where in the timetable a moment falls: the leg, whether the ship is under way on it, how far along (0 to 1), and the stop index while alongside.</summary>
    private sealed record Place(int Leg, bool Underway, double Fraction, int StopIndex, bool Ended);

    private static Place Locate(List<Stop> stops, int legs, DateTime utc)
    {
        for (var i = 0; i < stops.Count; i++)
        {
            var s = stops[i];
            if (i > 0 && utc < s.Arrive!.Value)
            {
                var from = stops[i - 1].Depart!.Value;
                var f = (utc - from).TotalSeconds / (s.Arrive.Value - from).TotalSeconds;
                return new Place(i - 1, true, Math.Clamp(f, 0, 1), -1, false);
            }
            if (s.Depart is null) return new Place(legs - 1, false, 1, i, true);
            if (utc < s.Depart.Value) return new Place(i, false, 0, i, false);
        }
        return new Place(legs - 1, false, 1, stops.Count - 1, true);
    }

    private static DateTime Utc(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    private sealed record Situation(Place Place, Fix Fix, double Along, Track Track, List<Stop> Stops, Track[] Tracks);

    private static Situation Resolve(Timeline timeline, long ms)
    {
        var stops = Stops(timeline);
        var tracks = TracksFor(stops);
        var place = Locate(stops, tracks.Length, Utc(ms));
        var track = tracks[place.Leg];
        var along = place.Underway ? place.Fraction * track.Total : place.Ended ? track.Total : 0;
        return new Situation(place, track.At(along), along, track, stops, tracks);
    }

    // ---------- position ----------

    public static ShipPositionDto Position(Timeline timeline, long ms)
    {
        var n = Resolve(timeline, ms);
        var utc = Utc(ms);
        var p = n.Place;
        var hours = (n.Stops[p.Leg + 1].Arrive!.Value - n.Stops[p.Leg].Depart!.Value).TotalHours;
        var speed = p.Underway ? Math.Round(n.Track.Total / hours * 10) / 10 : 0;
        string? inPort = p.Underway ? null : n.Stops[p.StopIndex].Port;
        var last = p.Underway ? n.Track.From : inPort!;
        var next = p.Ended ? null : n.Track.To;
        var sailed = p.Underway ? (int)Math.Round(n.Along) : 0;
        var remaining = p.Ended ? 0 : (int)Math.Round(n.Track.Total - (p.Underway ? n.Along : 0));
        var done = n.Tracks.Take(p.Leg).Sum(t => t.Total) + (p.Underway ? n.Along : p.Ended ? n.Track.Total : 0);
        var day = timeline.PortAt(utc).Day;
        var local = inPort ?? n.Track.To;
        ArrivalDto? arrival = null;
        if (!p.Ended)
        {
            var due = n.Stops[p.Leg + 1].Arrive!.Value;
            var (time, arrivalDay) = ShipWall(timeline, due);
            arrival = new ArrivalDto(Ms(due), time, arrivalDay);
        }
        return new ShipPositionDto(
            ms, day, Math.Round(n.Fix.Lat, 4), Math.Round(n.Fix.Lon, 4), speed, (int)Math.Round(n.Fix.Heading) % 360, Compass(n.Fix.Heading), inPort, last, next,
            sailed, remaining, p.Underway ? (int)Math.Round(p.Fraction * 100) : 0, (int)Math.Round(done), (int)Math.Round(n.Tracks.Sum(t => t.Total)), arrival, Clock(timeline, utc, local), FeedRules.Sim);
    }

    /// <summary>The ship's wall clock (HH:mm) and cruise day at a moment.</summary>
    private static (string Time, int Day) ShipWall(Timeline timeline, DateTime utc)
    {
        var (date, time) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        return (time.ToString("HH:mm", CultureInfo.InvariantCulture), date.DayNumber - timeline.Departure.DayNumber + 1);
    }

    private static ShipClockDto Clock(Timeline timeline, DateTime utc, string localPort)
    {
        var shipZone = timeline.ShipZoneAt(utc);
        var shipTz = TimeZoneInfo.FindSystemTimeZoneById(shipZone);
        var localTz = TimeZoneInfo.FindSystemTimeZoneById(Itinerary.PortById(localPort).Zone);
        var shipOffset = (int)shipTz.GetUtcOffset(utc).TotalMinutes;
        var localOffset = (int)localTz.GetUtcOffset(utc).TotalMinutes;
        string Hhmm(DateTime u, int off) => u.AddMinutes(off).ToString("HH:mm", CultureInfo.InvariantCulture);
        var change = timeline.ClockChanges().FirstOrDefault(c => c.At > utc);
        return new ShipClockDto(
            Hhmm(utc, shipOffset), shipOffset, shipZone == timeline.HomeZone ? "home" : "other", localPort, Hhmm(utc, localOffset), localOffset, localOffset - shipOffset,
            change is null ? null : new ShipClockChangeDto(Ms(change.At), change.Hours, ShipWall(timeline, change.At.AddMilliseconds(-1)).Day));
    }

    // ---------- the sea ----------

    internal static readonly double[] MonthlyWaterC = [26, 25.5, 26, 27, 28.3, 29.2, 29.8, 30.2, 30.2, 29.5, 28.3, 27];

    internal static readonly int[] WindFromDegrees = [45, 68, 90, 113];

    private static double Lerp(Func<long, double> at, long ms, long span)
    {
        var k = ms / span;
        var f = (ms % span) / (double)span;
        var a = at(k);
        return a + (at(k + 1) - a) * f;
    }

    internal static double WindAt(long ms) => Lerp(k => 8 + OnboardFeedRules.Hash31($"wind{k}") % 11, ms, 6 * Hour);

    public static int BeaufortOf(double knots) => knots switch
    {
        < 1 => 0, < 4 => 1, < 7 => 2, < 11 => 3, < 17 => 4, < 22 => 5, < 28 => 6, < 34 => 7, < 41 => 8, < 48 => 9, < 56 => 10, < 64 => 11, _ => 12,
    };

    private static readonly double[] SeaStateBounds = [0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];

    public static int SeaStateOf(double waveM)
    {
        if (waveM <= 0) return 0;
        for (var i = 0; i < SeaStateBounds.Length; i++) if (waveM < SeaStateBounds[i]) return i + 1;
        return 9;
    }

    public static string DepthClassOf(int metres) => metres < 200 ? "shelf" : metres < 2000 ? "slope" : metres < 4000 ? "deep" : "trench";

    public static SeaConditionsDto Sea(Timeline timeline, long ms)
    {
        var n = Resolve(timeline, ms);
        var utc = Utc(ms);
        var wind = WindAt(ms);
        var wave = Math.Round(0.02 * Math.Pow(wind, 1.5), 1);
        var swell = Math.Round(Lerp(k => 0.5 + OnboardFeedRules.Hash31($"swell{k}") % 14 / 10.0, ms, 12 * Hour), 1);
        var period = (int)Math.Round(Lerp(k => 6 + OnboardFeedRules.Hash31($"period{k}") % 5, ms, 12 * Hour));
        var bucket = ms / (6 * Hour);
        var windFrom = WindFromDegrees[(int)(OnboardFeedRules.Hash31($"from{bucket}") % (uint)WindFromDegrees.Length)];
        var swellFrom = WindFromDegrees[(int)(OnboardFeedRules.Hash31($"sfrom{ms / (12 * Hour)}") % (uint)WindFromDegrees.Length)];
        var north = Math.Max(0, n.Fix.Lat - 20) * (utc.Month is 12 or <= 4 ? 0.25 : 0.08);
        var jitter = ((int)(OnboardFeedRules.Hash31($"temp{ms / Hour}") % 7) - 3) / 10.0;
        var water = Math.Round(MonthlyWaterC[utc.Month - 1] - north + jitter, 1);
        return new SeaConditionsDto(
            ms, Math.Round(n.Fix.Lat, 4), Math.Round(n.Fix.Lon, 4), n.Fix.Depth, DepthClassOf(n.Fix.Depth), water, (int)Math.Round(wind), Compass(windFrom), BeaufortOf(wind), SeaStateOf(wave),
            wave, swell, period, Compass(swellFrom), FeedRules.Sim);
    }

    // ---------- along the way ----------

    private sealed record Poi(string Id, string Name, string Kind, double Lat, double Lon, double Reach, string Blurb);

    private static readonly Poi[] Pois =
    [
        new("hillsboro", "Hillsboro Inlet Light", "lighthouse", 26.257, -80.083, 20, "A black-and-white tower built in 1907; its beam reaches 28 nautical miles, among the strongest on the east coast of the United States."),
        new("gulfstream", "The Gulf Stream", "current", 25.5, -79.95, 30, "A warm river inside the ocean, up to 50 miles wide and moving at as much as 4 knots. It carried Spanish treasure fleets home and still speeds ships north."),
        new("fowey", "Fowey Rocks Light", "lighthouse", 25.59, -80.097, 20, "An 1878 iron tower on the edge of the Florida reef, called the Eye of Miami by the mariners who steered by it."),
        new("alligator", "Alligator Reef Light", "lighthouse", 24.85, -80.62, 30, "A skeletal iron lighthouse on a reef where the ship USS Alligator ran aground in 1822 while hunting pirates."),
        new("straits", "Straits of Florida", "strait", 24.0, -81.5, 40, "The deep channel between the Florida Keys and Cuba, about 90 miles wide, where the Gulf Stream begins its run north."),
        new("treasure", "The treasure fleet road", "route", 24.6, -80.3, 30, "From the 1500s, Spanish ships loaded with silver from Mexico and Peru gathered at Havana and rode the Gulf Stream through this passage."),
        new("sanantonio", "Cabo San Antonio", "lighthouse", 21.87, -84.95, 40, "The western tip of Cuba. Its lighthouse, first lit in 1849, marks the Caribbean side of the Yucatán Channel."),
        new("yucatan", "Yucatán Channel", "strait", 21.7, -85.8, 40, "About 100 miles of open water between Cuba and Mexico where the Caribbean pours into the Gulf of Mexico, the start of the Gulf Stream system."),
        new("mayacoast", "The Maya trading coast", "history", 20.2, -87.0, 25, "Maya traders paddled dugout canoes along this coast, carrying salt, honey and jade; Cozumel was a pilgrimage island sacred to the goddess Ixchel."),
        new("chinchorro", "Banco Chinchorro", "reef", 18.6, -87.35, 30, "The largest coral atoll in the northern hemisphere, a protected reserve with more than a hundred shipwrecks on its reefs."),
        new("bluehole", "Great Blue Hole", "natural", 17.316, -87.535, 25, "A circular marine sinkhole 300 metres wide and 125 metres deep on Lighthouse Reef, once a dry cave, drowned as the sea rose."),
        new("barrier", "Belize Barrier Reef", "reef", 17.6, -88.0, 25, "The second-largest barrier reef in the world, nearly 200 miles long, with its seven protected sites listed by UNESCO."),
        new("utila", "Utila", "island", 16.09, -86.93, 40, "The smallest of the Bay Islands, known for whale sharks that visit the water offshore through the year."),
        new("bartlett", "The Bartlett Trough", "trench", 17.8, -85.9, 40, "The deepest water of the Caribbean, a trench that falls to more than 7,600 metres in the Cayman Trough to the east."),
        new("havana", "North of Cuba", "history", 23.2, -83.6, 40, "Havana’s harbour lies over the horizon to the south. For centuries this was the busiest stretch of sea lane in the Americas."),
    ];

    private sealed record Pass(int Leg, Poi Poi, double AlongNm, double ClosestNm, string Side);

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, List<Pass>> PassCache = new();

    /// <summary>The landmarks each leg passes within reach. A route far from every authored landmark has none.</summary>
    private static List<Pass> PassesFor(Track[] tracks) => PassCache.GetOrAdd(string.Join('>', tracks.Select(t => t.From + ':' + t.To)), _ =>
    {
        var list = new List<Pass>();
        for (var leg = 0; leg < tracks.Length; leg++)
        {
            var track = tracks[leg];
            foreach (var poi in Pois)
            {
                var best = double.MaxValue;
                var at = 0.0;
                for (var d = 0.0; d <= track.Total; d += 1)
                {
                    var f = track.At(d);
                    var dist = Nm(f.Lat, f.Lon, poi.Lat, poi.Lon);
                    if (dist < best) { best = dist; at = d; }
                }
                if (best > poi.Reach) continue;
                var fix = track.At(at);
                var rel = ((Bearing(fix.Lat, fix.Lon, poi.Lat, poi.Lon) - fix.Heading + 540) % 360) - 180;
                list.Add(new Pass(leg, poi, at, best, best < 2 ? "ahead" : rel > 0 ? "starboard" : "port"));
            }
        }
        return list;
    });

    private sealed record Zone(string Id, string Name, double Lat, double Lon, double Radius, string Habitat, string[] Wildlife);

    private static readonly Zone[] Zones =
    [
        new("everglades", "Port Everglades coast", 26.09, -80.12, 40, "A shallow shelf with a living coral reef tract close to shore. Look for turtles and rays in the clear water near the harbour.", ["dolphins", "turtle", "ray", "frigatebird"]),
        new("straits", "Gulf Stream and Florida Straits", 24.8, -80.0, 120, "Fast, warm, deep blue water. Weed lines gather along the edge of the current, and flying fish and the dolphins that chase them are common here.", ["flyingFish", "dolphins", "frigatebird"]),
        new("cubashelf", "Deep water north of Cuba", 23.0, -84.0, 90, "Open blue water more than a mile deep, where pods of pilot whales and sperm whales have been seen from passing ships.", ["whale", "dolphins", "flyingFish"]),
        new("yucatan", "Yucatán Channel", 21.5, -85.7, 80, "The current squeezing through the channel lifts cool, nutrient-rich water, a feeding ground for tuna, dolphins and migrating seabirds.", ["dolphins", "flyingFish", "frigatebird", "whale"]),
        new("mesoamerican", "Mesoamerican Reef", 19.0, -87.1, 90, "A chain of reefs along the Yucatán coast. Turtles graze the sea grass and eagle rays cruise the reef edge.", ["turtle", "ray", "dolphins"]),
        new("belizecays", "Belize cays and atolls", 17.4, -87.8, 60, "Shallow turquoise water over a barrier reef and atolls. Dolphins follow the ship in, and rays and turtles feed on the flats.", ["dolphins", "turtle", "ray"]),
        new("bartlett", "The Bartlett Trough", 17.7, -85.9, 70, "Deep, open ocean with little shore to hold wildlife, but frigatebirds patrol the surface and flying fish skim the swell.", ["flyingFish", "frigatebird", "whale"]),
        new("bayislands", "The Bay Islands", 16.4, -86.6, 50, "Fringing reefs and steep drop-offs. Turtles, rays and spotted dolphins are regular visitors.", ["turtle", "ray", "dolphins"]),
    ];

    private static readonly Zone OpenCaribbean = new("open", "The open Caribbean", 0, 0, 0, "Open tropical water. Flying fish skim the waves ahead of the bow, and frigatebirds ride the wind above the wake.", ["flyingFish", "frigatebird", "dolphins"]);

    private static SeaZoneDto ZoneAt(double lat, double lon)
    {
        var best = OpenCaribbean;
        var bestRatio = double.MaxValue;
        foreach (var z in Zones)
        {
            var ratio = Nm(lat, lon, z.Lat, z.Lon) / z.Radius;
            if (ratio <= 1 && ratio < bestRatio) { best = z; bestRatio = ratio; }
        }
        return new SeaZoneDto(best.Id, best.Name, best.Habitat, best.Wildlife);
    }

    public static AlongTheWayDto Along(Timeline timeline, long ms)
    {
        var n = Resolve(timeline, ms);
        var all = PassesFor(n.Tracks)
            .Select(p =>
            {
                var from = n.Stops[p.Leg].Depart!.Value;
                var hours = (n.Stops[p.Leg + 1].Arrive!.Value - from).TotalHours;
                var passes = from.AddHours(hours * p.AlongNm / n.Tracks[p.Leg].Total);
                var (time, day) = ShipWall(timeline, passes);
                var poi = p.Poi;
                return new LandmarkDto(
                    poi.Id, poi.Name, poi.Kind, poi.Blurb, poi.Lat, poi.Lon, (int)Math.Round(p.ClosestNm), p.Side, Ms(passes), time, day,
                    (int)Math.Round(Nm(n.Fix.Lat, n.Fix.Lon, poi.Lat, poi.Lon)));
            })
            .OrderBy(l => l.PassesAt)
            .ToList();
        var passing = all.Where(l => Math.Abs(l.PassesAt - ms) <= Hour).ToArray();
        var ahead = all.Where(l => l.PassesAt > ms + Hour).Take(4).ToArray();
        var behind = all.Where(l => l.PassesAt < ms - Hour).OrderByDescending(l => l.PassesAt).Take(3).ToArray();
        return new AlongTheWayDto(ms, ZoneAt(n.Fix.Lat, n.Fix.Lon), passing, ahead, behind, FeedRules.Sim);
    }
}
