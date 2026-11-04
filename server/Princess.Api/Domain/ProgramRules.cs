namespace Princess.Api.Domain;

/// <summary>One thing on the daily programme. <see cref="Extra"/> is cents per person (0 is in the fare).</summary>
public sealed record ShipEvent(string Id, string[] When, string Start, int Minutes, string Title, string PlaceId, string Age, string Interest, long Extra, bool AfterAllAboard);

/// <summary>An event on a given day with its instants and any mid-day change applied. Field names follow <c>DatedEvent</c> in <c>src/domain/program.ts</c>.</summary>
public sealed record DatedEvent(
    string Id, string[] When, string Start, int Minutes, string Title, string PlaceId, string Age, string Interest, long Extra, bool AfterAllAboard,
    int Day, string Date, long StartAt, long EndAt, string Status, string? Was, string? Reason);

public sealed record PlanChange(string EventId, int Day, string Kind, string? Start, string Reason);

/// <summary>The programme as the client reads it: every event with the days it runs, and the mid-day changes now in force (shown only when a plan-change scenario is on).</summary>
public sealed record ProgramReferenceDto(string Version, IReadOnlyList<ShipEvent> Events, IReadOnlyList<PlanChange> PlanChanges);

public sealed record MusterStation(string Letter, string Name, string PlaceId, int Deck);

/// <summary>Ported from <c>src/domain/program.ts</c> (the daily programme, "Patter") and the muster stations of <c>src/domain/deck.ts</c>. Titles, times and prices are authored concept values.</summary>
public static class ProgramRules
{
    private static ShipEvent Ev(string id, string[] when, string start, int minutes, string title, string place, string age, string interest, long extra = 0, bool after = false) =>
        new(id, when, start, minutes, title, place, age, interest, extra, after);

    private static readonly string[] Sea = ["sea"];
    private static readonly string[] Port = ["port"];
    private static readonly string[] Nights = ["night"];

    public static readonly IReadOnlyList<ShipEvent> Events =
    [
        Ev("muster", ["embark"], "14:00", 30, "Muster drill: go to your station", "piazza", "all", "learning"),
        Ev("sailaway", ["embark"], "15:00", 60, "Sail-away party", "lido-pool", "all", "music"),
        Ev("welcome-piazza", ["embark"], "19:00", 45, "Welcome music in the Piazza", "piazza", "all", "music"),
        Ev("welcome-show", ["embark"], "20:30", 60, "Welcome aboard show", "arena", "all", "shows"),
        Ev("kids-open-house", ["embark"], "16:30", 60, "Kids’ club open house", "firefly", "kids", "family"),
        Ev("teen-open-house", ["embark"], "17:00", 45, "Teen lounge meet-up", "underground", "teens", "family"),

        Ev("stretch", Sea, "08:00", 45, "Morning stretch", "fitness", "adults", "wellness"),
        Ev("trivia", Sea, "10:30", 45, "Team trivia", "live", "all", "games"),
        Ev("cooking", Sea, "11:00", 60, "Cooking demo with the executive chef", "eclipse", "all", "learning"),
        Ev("bingo", Sea, "14:00", 60, "Bingo", "live", "adults", "games", 2500),
        Ev("art-talk", ["seaMid"], "15:00", 45, "Art talk: the ship’s collection", "piazza", "all", "learning"),
        Ev("craft", Sea, "10:00", 60, "Craft time", "firefly", "kids", "family"),
        Ev("tween-games", Sea, "13:30", 60, "Tween games afternoon", "neon-grove", "kids", "family"),
        Ev("teen-night", Sea, "21:30", 90, "Teen dance night", "underground", "teens", "nightlife"),
        Ev("spa-tour", ["seaMid"], "11:30", 30, "Spa tour and tasting", "lotus", "adults", "wellness"),
        Ev("stage-show", ["sea"], "20:30", 60, "Main stage production", "arena", "all", "shows"),
        Ev("stage-early", ["firstSea"], "18:30", 60, "Main stage production, early show", "arena", "all", "shows"),
        Ev("jazz", Nights, "21:30", 90, "Live jazz", "crooners", "adults", "music"),
        Ev("piazza-band", Nights, "17:30", 45, "Piazza live band", "piazza", "all", "music"),
        Ev("dome-show", ["seaMid", "portOdd"], "22:00", 45, "Acrobatic show in the Dome", "dome", "all", "shows"),
        Ev("dome-dj", ["sea"], "23:00", 90, "Dance party in the Dome", "dome", "adults", "nightlife"),
        Ev("movie", Nights, "20:00", 120, "Movie under the stars", "lido-pool", "all", "family"),
        Ev("wine", ["seaMid"], "16:00", 60, "Wine tasting", "bellinis", "adults", "learning", 3500),
        Ev("farewell-show", ["last"], "19:30", 60, "Farewell show", "arena", "all", "shows"),
        Ev("packing", ["last"], "15:00", 40, "Disembarkation talk", "piazza", "all", "learning"),

        Ev("port-lecture", Port, "19:00", 40, "Tomorrow’s port: talk and questions", "piazza", "all", "learning", 0, true),
        Ev("port-music", Port, "18:00", 60, "Sail-away steel drums", "lido-pool", "all", "music", 0, true),
        Ev("port-show", Port, "20:30", 60, "Main stage production", "arena", "all", "shows", 0, true),
        Ev("port-kids", Port, "19:30", 60, "Evening kids’ club", "firefly", "kids", "family", 0, true),
        Ev("port-quiet", Port, "17:45", 60, "Quiet hour in the spa", "lotus", "adults", "wellness", 2500, true),
    ];

    public static ProgramReferenceDto Reference(IReadOnlyList<PlanChange> feed, string? shipId = null)
    {
        var events = ShipPrograms.Of(shipId);
        var text = string.Join('|', events.Select(e => $"{e.Id}:{string.Join(',', e.When)}:{e.Start}:{e.Minutes}:{e.Title}:{e.PlaceId}:{e.Age}:{e.Interest}:{e.Extra}:{e.AfterAllAboard}"))
            + "#" + string.Join('|', feed.Select(c => $"{c.EventId}:{c.Day}:{c.Kind}:{c.Start}:{c.Reason}"));
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, events, feed);
    }

    public static ShipEvent? ById(string? id, string? shipId = null) => ShipPrograms.Of(shipId).FirstOrDefault(e => e.Id == id);

    /// <summary>A change the ship makes mid-day (OB-08): the scenario "Daily plan changes mid-day".</summary>
    public static readonly IReadOnlyList<PlanChange> PlanChanges =
    [
        new("stage-show", 2, "moved", "21:15", "The ship is running behind the weather. The show starts 45 minutes later."),
        new("trivia", 2, "cancelled", null, "The host is unwell. Bingo at 2:00 pm is on as planned."),
    ];

    /// <summary>The events on a day of the cruise, in time order, with any mid-day changes applied when <paramref name="changes"/> is on. A port-day event is listed only once the ship is back aboard.</summary>
    public static List<DatedEvent> On(Timeline timeline, int day, bool changes, IReadOnlyList<PlanChange>? feed = null, string? shipId = null)
    {
        feed ??= PlanChanges;
        if (day is < 1 or > Itinerary.MaxDay) return [];
        var date = timeline.Departure.AddDays(day - 1);
        var zone = timeline.ShipZoneOnDate(date);
        var aboard = timeline.AllAboardAt(day);
        var list = new List<DatedEvent>();
        foreach (var e in ShipPrograms.Of(shipId).Where(e => DayKinds.Runs(timeline, day, e.When)))
        {
            var change = changes ? feed.FirstOrDefault(c => c.EventId == e.Id && c.Day == day) : null;
            var start = change is { Kind: "moved", Start: { } s } ? s : e.Start;
            var startAt = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(start, "HH:mm"), zone);
            if (e.AfterAllAboard && aboard is { } a && startAt < a) continue;
            list.Add(new DatedEvent(
                e.Id, e.When, start, e.Minutes, e.Title, e.PlaceId, e.Age, e.Interest, e.Extra, e.AfterAllAboard, day, date.ToString("yyyy-MM-dd"),
                TripRules.ToMs(startAt), TripRules.ToMs(startAt.AddMinutes(e.Minutes)), change?.Kind ?? "on", change?.Kind == "moved" ? e.Start : null, change?.Reason));
        }
        return [.. list.OrderBy(e => e.StartAt).ThenBy(e => e.Title, StringComparer.InvariantCulture)];
    }

    // ---- Muster stations (deck.ts) ----

    /// <summary>Muster stations match the six elevator banks, so the station letter on the boarding pass is also the nearest bank.</summary>
    public static readonly IReadOnlyDictionary<string, MusterStation> MusterStations = new Dictionary<string, MusterStation>
    {
        ["A"] = new("A", "Princess Arena, port side", "arena", 7),
        ["B"] = new("B", "Princess Live!, starboard side", "live", 7),
        ["C"] = new("C", "The Piazza, port side", "piazza", 7),
        ["D"] = new("D", "The Piazza, starboard side", "piazza", 7),
        ["E"] = new("E", "Eclipse Dining Room", "eclipse", 7),
        ["F"] = new("F", "Soleil Dining Room", "soleil", 6),
    };

    /// <summary>The place names the muster stations stand in.</summary>
    private static readonly Dictionary<string, string> PlaceNames = new()
    {
        ["arena"] = "Princess Arena", ["live"] = "Princess Live!", ["piazza"] = "The Piazza", ["eclipse"] = "Eclipse Dining Room", ["soleil"] = "Soleil Dining Room",
    };

    public static string PlaceName(string placeId) => PlaceNames.GetValueOrDefault(placeId, "");

    /// <summary>The station for a label such as "Station C"; unknown labels give null.</summary>
    public static MusterStation? MusterByLabel(string label)
    {
        var t = label.Trim();
        return t.Length == 9 && t.StartsWith("Station ", StringComparison.Ordinal) && MusterStations.TryGetValue(t[8..], out var m) ? m : null;
    }
}
