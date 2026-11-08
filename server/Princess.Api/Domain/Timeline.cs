namespace Princess.Api.Domain;

/// <summary>
/// The days of one sailing and everything worked out from them: where the ship is at a moment, which clock it keeps, when guests must be aboard.
/// Built from <c>ref.ItineraryDays</c> (<see cref="TimelineBook"/>), so any length, route or number of clock changes works; a departure date with no sailing behind it
/// gets the old eight-day Western A route (<see cref="Legacy"/>), which is what the rules and their tests were written against.
/// </summary>
public sealed class Timeline
{
    private static readonly TimeOnly ChangeAt = new(2, 0);

    private readonly record struct Step(int Day, string From, string To, DateTime At, int Hours);

    private readonly List<Step> _steps;

    public string? SailingId { get; }
    public DateOnly Departure { get; }
    public IReadOnlyList<ItineraryDay> Days { get; }
    /// <summary>The zone the ship's clocks follow when it leaves, the zone of the first port.</summary>
    public string HomeZone { get; }
    public int Nights => Days.Count - 1;
    public DateOnly LastDay => Departure.AddDays(Nights);
    /// <summary>The zone the clocks follow on the last morning.</summary>
    public string FinalZone => _steps.Count == 0 ? HomeZone : _steps[^1].To;

    private Timeline(string? sailingId, DateOnly departure, IReadOnlyList<ItineraryDay> days, string home, List<(int Day, string To)> zones)
    {
        SailingId = sailingId; Departure = departure; Days = days; HomeZone = home;
        _steps = [];
        var prev = home;
        foreach (var (day, to) in zones)
        {
            var at = Itinerary.LocalToUtc(departure.AddDays(day - 1), ChangeAt, prev);
            var hours = (TimeZoneInfo.FindSystemTimeZoneById(to).GetUtcOffset(at) - TimeZoneInfo.FindSystemTimeZoneById(prev).GetUtcOffset(at.AddMilliseconds(-1))).TotalHours;
            _steps.Add(new Step(day, prev, to, at, (int)Math.Round(hours)));
            prev = to;
        }
    }

    public static implicit operator Timeline(DateOnly departure) => Legacy(departure);

    /// <summary>The Sun Princess Western A route from a departure date: Eastern time, Belize time from 02:00 on day 4, Eastern again from 02:00 on day 7.</summary>
    public static Timeline Legacy(DateOnly departure) =>
        new(null, departure, Itinerary.LegacyDays(departure), Itinerary.ShipHomeZone, [(4, Itinerary.ShipWestZone), (7, Itinerary.ShipHomeZone)]);

    /// <summary>The timeline of a sailing from its day rows. The ship's clock changes where a day says so; the new zone is the one (the home zone, or a port on the route) whose offset matches.</summary>
    public static Timeline FromDays(string? sailingId, DateOnly departure, IReadOnlyList<ItineraryDay> days)
    {
        var home = Itinerary.PortOf(days[0].Port)?.Zone ?? Itinerary.ShipHomeZone;
        var candidates = new List<string> { home };
        candidates.AddRange(days.Select(d => Itinerary.PortOf(d.Port)?.Zone).OfType<string>().Distinct());
        var zones = new List<(int, string)>();
        var prev = home;
        foreach (var d in days.Where(d => d.ClockChangeHours is not (null or 0)))
        {
            var at = Itinerary.LocalToUtc(d.Date, d.ClockChangeAt ?? ChangeAt, prev);
            var target = TimeZoneInfo.FindSystemTimeZoneById(prev).GetUtcOffset(at.AddMilliseconds(-1)) + TimeSpan.FromHours(d.ClockChangeHours!.Value);
            var next = candidates.FirstOrDefault(z => TimeZoneInfo.FindSystemTimeZoneById(z).GetUtcOffset(at) == target) ?? FixedZone(target);
            zones.Add((d.Day, next));
            prev = next;
        }
        return new Timeline(sailingId, departure, days, home, zones);
    }

    /// <summary>An IANA fixed-offset zone (<c>Etc/GMT-5</c> is five hours east of UTC).</summary>
    private static string FixedZone(TimeSpan offset)
    {
        var h = (int)Math.Round(offset.TotalHours);
        return h == 0 ? "Etc/UTC" : $"Etc/GMT{(h > 0 ? "-" : "+")}{Math.Abs(h)}";
    }

    /// <summary>Whether the day is a port of call: a port day that is neither the first (embarkation) nor the last (disembarkation).</summary>
    public bool IsCall(ItineraryDay d) => d.Port != "sea" && !Endpoint(d);

    private bool Endpoint(ItineraryDay d) => d.Day == 1 || d.Day == Days.Count;

    /// <summary>The zone the ship's clocks follow on a calendar date: the zone after every change made on or before that day.</summary>
    public string ShipZoneOnDate(DateOnly date)
    {
        var n = date.DayNumber - Departure.DayNumber + 1;
        return _steps.LastOrDefault(s => s.Day <= n) is { To: not null } s ? s.To : HomeZone;
    }

    /// <summary>The zone the ship's clocks follow at a moment.</summary>
    public string ShipZoneAt(DateTime utc)
    {
        var zone = HomeZone;
        foreach (var s in _steps) if (utc >= s.At) zone = s.To;
        return zone;
    }

    /// <summary>Each change of the ship's clock: the moment and the hours the clock moves, negative is back.</summary>
    public List<Itinerary.ClockChange> ClockChanges() => [.. _steps.Select(s => new Itinerary.ClockChange(s.At, s.Hours))];

    private static TimeOnly Open(TimeOnly? t) => t ?? new TimeOnly(0, 0);
    private static TimeOnly Close(TimeOnly? t) => t ?? new TimeOnly(23, 59, 59);

    private bool InPort(ItineraryDay d, DateTime utc)
    {
        var zone = Itinerary.ZoneOf(d.Port);
        return utc >= Itinerary.LocalToUtc(d.Date, Open(d.Arrive), zone) && utc < Itinerary.LocalToUtc(d.Date, Close(d.Depart), zone);
    }

    /// <summary>Whether the ship is at sea at a moment: a sea day, or a port day before arrival or after departure. The first and last days count as in port.</summary>
    public bool AtSea(DateTime utc)
    {
        var (date, _) = Itinerary.LocalAt(utc, ShipZoneAt(utc));
        var today = Days.FirstOrDefault(d => d.Date == date);
        if (today is null || today.Port == "sea") return true;
        return !Endpoint(today) && !InPort(today, utc);
    }

    /// <summary>Whether the guest can be on board: from 11:00 on embarkation day until 06:00 on the last morning.</summary>
    public bool Aboard(DateTime utc) =>
        utc >= Itinerary.LocalToUtc(Departure, new TimeOnly(11, 0), HomeZone) && utc < Itinerary.LocalToUtc(LastDay, new TimeOnly(6, 0), FinalZone);

    /// <summary>The moment all guests must be back aboard on a port day, or null on a day with none (sea days and the first and last days).</summary>
    public DateTime? AllAboardAt(int day)
    {
        if (day < 1 || day > Days.Count) return null;
        var d = Days[day - 1];
        return d.AllAboard is { } a && d.Port != "sea" && !Endpoint(d) ? Itinerary.LocalToUtc(d.Date, a, Itinerary.ZoneOf(d.Port)) : null;
    }

    /// <summary>The port the ship is at (or <c>sea</c>) at a moment and the cruise day, going by calendar day in ship time and the posted hours.</summary>
    public (string Port, int? Day) PortAt(DateTime utc)
    {
        var first = Itinerary.LocalToUtc(Days[0].Date, new TimeOnly(0, 0), HomeZone);
        var last = Itinerary.LocalToUtc(Days[^1].Date, new TimeOnly(23, 59), FinalZone);
        if (utc < first || utc > last.AddHours(24)) return ("sea", null);
        var (date, _) = Itinerary.LocalAt(utc, ShipZoneAt(utc));
        var today = Days.FirstOrDefault(d => d.Date == date);
        if (today is null) return ("sea", null);
        if (today.Port == "sea" || Endpoint(today)) return (today.Port, today.Day);
        return (InPort(today, utc) ? today.Port : "sea", today.Day);
    }
}

/// <summary>
/// The day rows and ports of every sailing, set whenever the sailings are loaded (like <see cref="FareBook"/>). Empty until the first load (tests, a cold start),
/// when every sailing gets the old Western A route.
/// </summary>
public static class TimelineBook
{
    private sealed record Raw(DateOnly Departure, List<ItineraryDay> Days);

    private static volatile IReadOnlyDictionary<string, Raw> _days = new Dictionary<string, Raw>();
    private static volatile IReadOnlyDictionary<string, Port> _ports = new Dictionary<string, Port>();
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Timeline> Built = new();

    public static void Set(IEnumerable<(string SailingId, DateOnly Departure)> sailings, IEnumerable<(string SailingId, ItineraryDay Day)> days, IEnumerable<Port> ports)
    {
        var byId = days.GroupBy(d => d.SailingId).ToDictionary(g => g.Key, g => g.Select(x => x.Day).OrderBy(d => d.Day).ToList());
        _ports = ports.ToDictionary(p => p.Id);
        _days = sailings.Where(s => byId.ContainsKey(s.SailingId)).ToDictionary(s => s.SailingId, s => new Raw(s.Departure, byId[s.SailingId]));
        Built.Clear();
    }

    public static void Clear() { _days = new Dictionary<string, Raw>(); _ports = new Dictionary<string, Port>(); Built.Clear(); }

    public static Port? Port(string id) => _ports.GetValueOrDefault(id);

    /// <summary>The timeline of a sailing: from its day rows when it has them, otherwise the old route from the departure date.</summary>
    public static Timeline For(string? sailingId, DateOnly departure)
    {
        if (sailingId is null || !_days.TryGetValue(sailingId, out var raw) || raw.Departure != departure || raw.Days.Count < 2) return Timeline.Legacy(departure);
        return Built.GetOrAdd(sailingId, _ => Timeline.FromDays(sailingId, departure, raw.Days));
    }
}
