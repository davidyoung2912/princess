namespace Princess.Api.Domain;

/// <summary>A ticketed show or class on one day of the cruise. <see cref="StartAt"/> is the instant it begins (the ship's clock for that night).</summary>
public sealed record ShowEvent(string Id, int Day, string Title, string PlaceId, DateTime StartAt, string Age);

/// <summary>Shows and classes with limited seats, ported from <c>src/domain/tickets.ts</c> and the ticketed rows of <c>program.ts</c>. Only ticketed events are listed here.</summary>
public static class ShowRules
{
    public const int MaxSeats = 8;
    private const int Adult = 18;

    private sealed record Def(string Id, int[] Days, string Start, string Title, string PlaceId, string Age, int Capacity, bool AfterAllAboard);

    private static readonly int[] Sea = [2, 6, 7];
    private static readonly int[] PortDays = [3, 4, 5];

    private static readonly Def[] Defs =
    [
        new("welcome-show", [1], "20:30", "Welcome aboard show", "arena", "all", 900, false),
        new("cooking", Sea, "11:00", "Cooking demo with the executive chef", "eclipse", "all", 40, false),
        new("art-talk", [2, 6], "15:00", "Art talk: the ship’s collection", "piazza", "all", 80, false),
        new("spa-tour", [2, 6], "11:30", "Spa tour and tasting", "lotus", "adults", 20, false),
        new("stage-show", [2, 6, 7], "20:30", "Main stage production", "arena", "all", 700, false),
        new("stage-early", [2], "18:30", "Main stage production, early show", "arena", "all", 700, false),
        new("dome-show", [2, 3, 5, 6], "22:00", "Acrobatic show in the Dome", "dome", "all", 300, false),
        new("wine", [2, 6], "16:00", "Wine tasting", "bellinis", "adults", 24, false),
        new("farewell-show", [7], "19:30", "Farewell show", "arena", "all", 900, false),
        new("port-show", PortDays, "20:30", "Main stage production", "arena", "all", 700, true),
        new("port-quiet", PortDays, "17:45", "Quiet hour in the spa", "lotus", "adults", 12, true),
    ];

    public static bool IsTicketed(string? eventId) => Defs.Any(d => d.Id == eventId);

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
        var cap = Defs.First(d => d.Id == eventId).Capacity;
        if (Full.Contains($"{eventId}|{day}")) return cap;
        var share = 55 + (int)(Fnv($"{eventId}|{day}") % 46);
        return Math.Min(cap, cap * share / 100);
    }

    /// <summary>Seats left on one day. <paramref name="heldOnSailing"/> counts every active ticket on the sailing, not only the caller's.</summary>
    public static int SeatsLeft(string eventId, int day, int heldOnSailing) => Math.Max(0, Defs.First(d => d.Id == eventId).Capacity - TakenByOthers(eventId, day) - heldOnSailing);

    /// <summary>The ticketed events on a day, in time order. A port-day event is listed only once the ship is back aboard.</summary>
    public static List<ShowEvent> On(DateOnly departure, int day)
    {
        if (day is < 1 or > 8) return [];
        var date = departure.AddDays(day - 1);
        var zone = Itinerary.ShipZoneOnDate(departure, date);
        var aboard = Itinerary.AllAboardAt(departure, day);
        var list = new List<ShowEvent>();
        foreach (var d in Defs.Where(d => d.Days.Contains(day)))
        {
            var start = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(d.Start, "HH:mm"), zone);
            if (d.AfterAllAboard && aboard is { } a && start < a) continue;
            list.Add(new ShowEvent(d.Id, day, d.Title, d.PlaceId, start, d.Age));
        }
        return [.. list.OrderBy(e => e.StartAt).ThenBy(e => e.Title, StringComparer.Ordinal)];
    }

    public static ShowEvent? Find(DateOnly departure, string eventId, int day) => On(departure, day).FirstOrDefault(e => e.Id == eventId);

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
