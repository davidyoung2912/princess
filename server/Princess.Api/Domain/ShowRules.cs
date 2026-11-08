namespace Princess.Api.Domain;

/// <summary>A ticketed show or class on one day of the cruise. <see cref="StartAt"/> is the instant it begins (the ship's clock for that night).</summary>
public sealed record ShowEvent(string Id, int Day, string Title, string PlaceId, DateTime StartAt, string Age);

/// <summary>Shows and classes with limited seats, ported from <c>src/domain/tickets.ts</c> and the ticketed rows of <c>program.ts</c>. Only ticketed events are listed here.</summary>
public static class ShowRules
{
    public const int MaxSeats = 8;
    private const int Adult = 18;

    /// <summary>The seats of each ticketed event, by event id (the same on every ship; a ship's programme says which of them it runs).</summary>
    private static readonly IReadOnlyDictionary<string, int> Capacity = new Dictionary<string, int>
    {
        ["welcome-show"] = 900, ["cooking"] = 40, ["art-talk"] = 80, ["spa-tour"] = 20, ["stage-show"] = 700, ["stage-early"] = 700,
        ["dome-show"] = 300, ["late-show"] = 300, ["wine"] = 24, ["farewell-show"] = 900, ["port-show"] = 700, ["port-quiet"] = 12,
    };

    public static bool IsTicketed(string? eventId) => eventId is not null && Capacity.ContainsKey(eventId);

    public static bool Exists(string? eventId) => IsTicketed(eventId);

    /// <summary>Events that are always full, so the sold-out state can be seen.</summary>
    private static readonly HashSet<string> Full = ["wine|6", "cooking|7", "dome-show|3"];

    private static uint Fnv(string text)
    {
        uint h = 2166136261;
        foreach (var ch in text) h = unchecked((h ^ ch) * 16777619);
        return h;
    }

    /// <summary>Seats other guests hold: between 55% and 100% of the room.</summary>
    public static int TakenByOthers(string eventId, int day)
    {
        var cap = Capacity[eventId];
        if (Full.Contains($"{eventId}|{day}")) return cap;
        var share = 55 + (int)(Fnv($"{eventId}|{day}") % 46);
        return Math.Min(cap, cap * share / 100);
    }

    /// <summary>Seats left on one day. <paramref name="heldOnSailing"/> counts every active ticket on the sailing, not only the caller's.</summary>
    public static int SeatsLeft(string eventId, int day, int heldOnSailing) => Math.Max(0, Capacity[eventId] - TakenByOthers(eventId, day) - heldOnSailing);

    /// <summary>The ticketed events on a day, in time order. A port-day event is listed only once the ship is back aboard.</summary>
    public static List<ShowEvent> On(Timeline timeline, int day, string? shipId = null)
    {
        if (day < 1 || day > Itinerary.MaxDay || day > timeline.Days.Count) return [];
        var date = timeline.Departure.AddDays(day - 1);
        var zone = timeline.ShipZoneOnDate(date);
        var aboard = timeline.AllAboardAt(day);
        var list = new List<ShowEvent>();
        foreach (var d in ShipPrograms.Of(shipId).Where(d => IsTicketed(d.Id) && DayKinds.Runs(timeline, day, d.When)))
        {
            var start = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(d.Start, "HH:mm"), zone);
            if (d.AfterAllAboard && aboard is { } a && start < a) continue;
            list.Add(new ShowEvent(d.Id, day, d.Title, d.PlaceId, start, d.Age));
        }
        return [.. list.OrderBy(e => e.StartAt).ThenBy(e => e.Title, StringComparer.Ordinal)];
    }

    public static ShowEvent? Find(Timeline timeline, string eventId, int day, string? shipId = null) => On(timeline, day, shipId).FirstOrDefault(e => e.Id == eventId);

    /// <summary>The first reason a seat cannot be reserved, or null. <paramref name="holders"/> are people who already hold a seat for this event and day.</summary>
    public static string? Problem(ShowEvent e, DateTime now, IReadOnlyCollection<(Guid Id, int Age)> guests, IReadOnlyCollection<Guid> holders)
    {
        if (!IsTicketed(e.Id)) return "notTicketed";
        if (now >= e.StartAt) return "started";
        if (guests.Count == 0 || guests.Count > MaxSeats) return "party";
        if (e.Age == "adults" && guests.Any(g => g.Age < Adult)) return "age";
        if (guests.Any(g => holders.Contains(g.Id))) return "duplicate";
        return null;
    }

    /// <summary>A seat can be given back up to the start.</summary>
    public static bool CanReturn(ShowEvent e, DateTime now) => now < e.StartAt;
}
