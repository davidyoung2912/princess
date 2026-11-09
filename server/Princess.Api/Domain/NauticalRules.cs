using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>The ship itself: what she is, her size and her propulsion. Metres, knots, gross tonnes.</summary>
public sealed record VesselDto(
    string Id, string Name, string ShipClass, string Flag, string PortOfRegistry, int GrossTonnage, double LengthM, double BeamM, double DraftM, double AirDraftM,
    double ServiceSpeedKnots, double MaxSpeedKnots, string Propulsion, int Decks, int YearBuilt);

/// <summary>How the ship is being steered and carried: heading true and magnetic, course made good, speeds, turn rate and the current setting her.</summary>
public sealed record CourseDto(
    int HeadingTrue, int HeadingMagnetic, double VariationDegrees, int CourseOverGround, double SpeedOverGroundKnots, double SpeedThroughWaterKnots, double RateOfTurnDegreesPerMinute,
    int CurrentSetDegrees, double CurrentDriftKnots, string CurrentName, string Steering);

public sealed record NearestLandDto(string Name, int BearingDegrees, string Compass, int DistanceNm, int ClearanceUnderKeelM);

/// <summary>The next port by the straight line, with the pilot boarding time when the ship takes one. <c>PilotShipTime</c> is "HH:mm" on the ship's clock.</summary>
public sealed record NextPortDto(string Port, int BearingDegrees, int StraightLineNm, int TrackNm, int? PilotDay, string? PilotShipTime);

/// <summary>The tide at the ship's longitude. <c>State</c> is rising or falling; <c>Cycle</c> is spring, neap or between (from the moon).</summary>
public sealed record TideDto(string State, double HeightM, double RangeM, string Cycle, long NextHighAt, string NextHighShipTime, long NextLowAt, string NextLowShipTime);

/// <summary>The noon report: the distance made good in the last 24 hours and the average speed.</summary>
public sealed record RunDto(int Last24HoursNm, double Last24HoursAverageKnots, int ToGoNm);

/// <summary>The engine room and the ship's motion. <c>BowThrusters</c> is off or standby.</summary>
public sealed record PlantDto(
    int GeneratorsOnline, int GeneratorsTotal, double PropulsionMw, int ShaftRpm, int FuelTankPercent, double FuelTonnesPerHour, bool StabilisersOut, double RollDegrees, double PitchDegrees,
    string BowThrusters);

/// <summary>The bridge watch: which watch it is on the ship's clock, who keeps it and what they see with. <c>Name</c> is middle, morning, forenoon, afternoon, evening or first.</summary>
public sealed record WatchDto(string Name, string From, string To, int BridgeOfficers, int Lookouts, int RadarRangeNm, bool NavigationLightsOn);

/// <summary>Another vessel on the radar. <c>Alert</c> when the closest point of approach is under a nautical mile.</summary>
public sealed record TrafficDto(string Kind, int BearingDegrees, double DistanceNm, int CourseDegrees, double SpeedKnots, double ClosestApproachNm, int MinutesToClosest, bool Alert);

public sealed record NauticalDto(
    long Now, VesselDto Vessel, CourseDto Course, NearestLandDto NearestLand, NextPortDto? NextPort, TideDto Tide, RunDto Run, PlantDto Plant, WatchDto Watch, TrafficDto[] Traffic, string Source);

/// <summary>
/// The simulated bridge and engine room: the figures a navigating officer reads that the position and sea feeds do not carry. Worked out from the
/// ship's track, the clock and the moon; a real bridge feed replaces it behind <c>IShipNavigation</c> and keeps the shape.
/// </summary>
public static class NauticalRules
{
    private const double Rad = Math.PI / 180;
    private const long Hour = 3_600_000;
    private const double TidalPeriodHours = 12.4206;
    private const double LunarMonthDays = 29.530588;

    private static Vessel VesselOf(string shipId) => shipId switch
    {
        "sky-princess" => new Vessel(shipId, "Sky Princess", "Royal", 144_216, 330, 38.4, 8.5, 62, 22, 23, "Diesel-electric", 19, 2019),
        "sapphire-princess" => new Vessel(shipId, "Sapphire Princess", "Grand", 115_875, 290, 36, 8.1, 59, 22, 23.5, "Diesel-electric", 18, 2004),
        _ => new Vessel("sun-princess", "Sun Princess", "Sphere", 177_882, 345.4, 42.4, 8.6, 61, 20, 22, "Dual-fuel LNG and marine diesel", 21, 2024),
    };

    private sealed record Vessel(string Id, string Name, string Class, int Gross, double Length, double Beam, double Draft, double AirDraft, double Service, double Max, string Propulsion, int Decks, int Built);

    private static readonly (string Name, double Lat, double Lon)[] Land =
    [
        ("Florida Keys", 24.95, -80.5), ("Fort Lauderdale", 26.1, -80.1), ("Cuba, north coast", 23.1, -82.4), ("Cabo San Antonio, Cuba", 21.87, -84.95), ("Cozumel", 20.45, -86.95),
        ("Yucatán coast", 21.0, -87.0), ("Belize Barrier Reef", 17.5, -88.05), ("Roatán", 16.35, -86.5), ("Utila", 16.1, -86.9), ("Banco Chinchorro", 18.6, -87.35),
    ];

    private static readonly (string Kind, double Speed)[] Kinds =
        [("cargo", 14), ("tanker", 12), ("cruise", 18), ("fishing", 5), ("sailing", 6), ("ferry", 16), ("tug", 8)];

    private static double Round1(double v) => Math.Round(v, 1);

    private static double Norm(double deg) => ((deg % 360) + 360) % 360;

    /// <summary>The age of the moon in days, from the new moon of 6 January 2000.</summary>
    private static double MoonAge(DateTime utc) => ((utc - new DateTime(2000, 1, 6, 18, 14, 0, DateTimeKind.Utc)).TotalDays % LunarMonthDays + LunarMonthDays) % LunarMonthDays;

    private static (string Time, int Day) ShipWall(Timeline timeline, DateTime utc)
    {
        var (date, time) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        return (time.ToString("HH:mm", CultureInfo.InvariantCulture), date.DayNumber - timeline.Departure.DayNumber + 1);
    }

    private static DateTime Utc(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    public static NauticalDto Nautical(Timeline timeline, long ms, string shipId)
    {
        var utc = Utc(ms);
        var pos = NavigationRules.Position(timeline, ms);
        var sea = NavigationRules.Sea(timeline, ms);
        var v = VesselOf(shipId);
        var underway = pos.InPort is null;
        var (_, shipTime) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        var hour = shipTime.Hour;

        // Current: the Gulf Stream runs hard north through the Straits, the Yucatán current bends in through the channel, elsewhere the Caribbean current drifts west.
        double set, drift;
        string currentName;
        var wobble = OnboardFeedRules.Hash31($"cur{ms / (3 * Hour)}") % 10 / 10.0;
        if (pos.Lat is >= 24.0 and <= 27.5 && pos.Lon is >= -81.5 and <= -79.5) { set = 10; drift = Round1(2.0 + wobble); currentName = "Gulf Stream"; }
        else if (pos.Lat is >= 20.5 and <= 23.5 && pos.Lon is >= -87.0 and <= -84.5) { set = 5; drift = Round1(1.2 + wobble / 2); currentName = "Yucatán Current"; }
        else { set = 285; drift = Round1(0.3 + wobble / 2); currentName = "Caribbean Current"; }
        if (!underway) drift = Round1(drift / 2);

        var sog = pos.SpeedKnots;
        var along = drift * Math.Cos((set - pos.HeadingDegrees) * Rad);
        var cross = drift * Math.Sin((set - pos.HeadingDegrees) * Rad);
        var stw = underway ? Math.Max(0, Round1(sog - along)) : 0;
        var cog = underway && sog > 0 ? (int)Math.Round(Norm(pos.HeadingDegrees + Math.Atan2(cross, sog) / Rad)) % 360 : pos.HeadingDegrees;
        var variation = Round1(-5.5 + (pos.Lon + 80) * -0.3);
        var earlier = NavigationRules.Position(timeline, ms - 5 * 60_000);
        var turn = ((pos.HeadingDegrees - earlier.HeadingDegrees + 540) % 360 - 180) / 5.0;
        var inApproach = pos.NextPort is not null && pos.Arrival is { } a0 && a0.At - ms < Hour && underway;
        var steering = !underway ? "Alongside" : inApproach ? "Hand steering" : "Track control";
        var course = new CourseDto(
            pos.HeadingDegrees, (int)Math.Round(Norm(pos.HeadingDegrees - variation)) % 360, variation, cog, sog, stw, Round1(turn), (int)set, drift, currentName, steering);

        // Nearest land.
        var near = Land.Select(l => (l.Name, Dist: NavigationRules.Nm(pos.Lat, pos.Lon, l.Lat, l.Lon), Brg: NavigationRules.Bearing(pos.Lat, pos.Lon, l.Lat, l.Lon))).OrderBy(l => l.Dist).First();
        var nearest = new NearestLandDto(near.Name, (int)Math.Round(near.Brg) % 360, NavigationRules.Compass(near.Brg), (int)Math.Round(near.Dist), (int)Math.Max(0, Math.Round(sea.DepthM - v.Draft)));

        // Next port, and the pilot an hour before arrival.
        NextPortDto? next = null;
        if (pos.NextPort is { } np && pos.Arrival is { } arr)
        {
            var port = Itinerary.PortById(np);
            var pilotAt = Utc(arr.At).AddMinutes(-45);
            var (pt, pd) = ShipWall(timeline, pilotAt);
            next = new NextPortDto(
                np, (int)Math.Round(NavigationRules.Bearing(pos.Lat, pos.Lon, port.Lat, port.Lon)) % 360, (int)Math.Round(NavigationRules.Nm(pos.Lat, pos.Lon, port.Lat, port.Lon)),
                pos.NmRemaining, port.Tender ? null : pd, port.Tender ? null : pt);
        }

        // Tide: a twice-daily cycle with the phase moving with longitude; the range follows the moon.
        var cycles = ms / (double)Hour / TidalPeriodHours - pos.Lon / 360;
        var spring = Math.Abs(Math.Cos(2 * Math.PI * MoonAge(utc) / (LunarMonthDays / 2)));
        var range = Round1(0.3 + 0.3 * spring);
        var tideNow = Round1(range / 2 * (1 + Math.Cos(2 * Math.PI * cycles)));
        var highAt = Ms(DateTime.UnixEpoch.AddHours((Math.Floor(cycles) + 1 + pos.Lon / 360) * TidalPeriodHours));
        var lowAt = Ms(DateTime.UnixEpoch.AddHours((Math.Floor(cycles - 0.5) + 1.5 + pos.Lon / 360) * TidalPeriodHours));
        var tide = new TideDto(
            highAt < lowAt ? "rising" : "falling", tideNow, range, spring > 0.8 ? "spring" : spring < 0.2 ? "neap" : "between",
            highAt, ShipWall(timeline, Utc(highAt)).Time, lowAt, ShipWall(timeline, Utc(lowAt)).Time);

        // The noon report.
        var dayAgo = NavigationRules.Position(timeline, ms - 24 * Hour);
        var run24 = Math.Max(0, pos.VoyageNmSailed - dayAgo.VoyageNmSailed);
        var run = new RunDto(run24, Round1(run24 / 24.0), Math.Max(0, pos.VoyageNmTotal - pos.VoyageNmSailed));

        // The plant: power rises with the cube of speed; the motion follows the sea.
        var power = Round1(35 * Math.Pow(sog / 22, 3));
        var gens = !underway ? 2 : sog >= 18 ? 5 : sog >= 12 ? 4 : 3;
        var voyageDays = Math.Max(0, (pos.Day ?? 1) - 1);
        var roll = Round1(sea.SwellM * 1.2 + sea.WaveM * 0.6);
        var plant = new PlantDto(
            gens, 6, power, (int)Math.Round(sog / 22 * 150), Math.Max(5, 96 - voyageDays * 2 - (int)(OnboardFeedRules.Hash31($"fuel{ms / (6 * Hour)}") % 2)), Round1(1.5 + power * 0.19),
            underway && (sea.SwellM >= 1.5 || sea.WaveM >= 1.0), underway ? roll : 0.2, underway ? Round1(sea.WaveM * 0.5) : 0.1, inApproach || (!underway && pos.NextPort is not null) ? "standby" : "off");

        // The bridge watch, on the ship's clock.
        var start = hour / 4 * 4;
        string[] names = ["middle", "morning", "forenoon", "afternoon", "evening", "first"];
        var dark = hour is < 6 or >= 18;
        var coastal = near.Dist < 25;
        var watch = new WatchDto(
            names[hour / 4], $"{start:00}:00", $"{(start + 4) % 24:00}:00", dark || coastal || inApproach ? 3 : 2, dark ? 2 : 1, coastal ? 6 : 12, dark);

        // Other vessels: more near the Florida coast, fewer in open water; steady for ten minutes at a time.
        var bucket = ms / (10 * 60_000);
        var busy = pos.Lat < 26.8 && pos.Lon > -80.6;
        var count = 1 + (int)(OnboardFeedRules.Hash31($"ntc{bucket}") % 3) + (busy ? 3 : 0);
        var traffic = new List<TrafficDto>();
        for (var i = 0; i < count; i++)
        {
            var h = OnboardFeedRules.Hash31($"ves{bucket}-{i}");
            var (kind, speed) = Kinds[(int)(h % (uint)Kinds.Length)];
            var dist = Round1(2 + (h / 7 % 180) / 10.0);
            var cpa = Round1(dist * (0.1 + (h / 11 % 80) / 100.0));
            traffic.Add(new TrafficDto(kind, (int)(h / 13 % 360), dist, (int)(h / 17 % 360), speed, cpa, (int)Math.Round(dist / (speed + Math.Max(sog, 1)) * 60), cpa < 1.0));
        }

        return new NauticalDto(
            ms, new VesselDto(v.Id, v.Name, v.Class, "Bermuda", "Hamilton", v.Gross, v.Length, v.Beam, v.Draft, v.AirDraft, v.Service, v.Max, v.Propulsion, v.Decks, v.Built),
            course, nearest, next, tide, run, plant, watch, [.. traffic.OrderBy(t => t.DistanceNm)], FeedRules.Sim);
    }
}
