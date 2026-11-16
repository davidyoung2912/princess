namespace Princess.Api.Domain;

public sealed record ExplorerVenueDto(
    string Id, string ShipId, string Explorer, string Kind, string Title, string Short, string Long, string PlaceId, string DeckLabel,
    long? Cover, int? MinAge, string Bookable, int Order, string[] Features, string[] Accessibility);

/// <summary>A venue's hours for one day, worked out here so the app only compares them with the clock. Times are ship time "HH:mm"; empty windows mean closed all day.</summary>
public sealed record HoursDayDto(List<string[]> Windows, List<string[]> Staffed, string? ClosedBecause);

/// <summary>An event on one day with its instants and any mid-day change applied. <see cref="Left"/> is the places not yet taken by others, when the event has a limit.</summary>
public sealed record ExplorerEventDto(
    string Id, string VenueId, int Day, string Date, string Start, int Minutes, long StartAt, long EndAt, string Title, string Detail, string Age, string Interest, long Extra,
    string Status, string? Was, string? Reason, int? Capacity, int? Left);

public sealed record VenueDayDto(ExplorerVenueDto Venue, HoursDayDto Hours, List<ExplorerEventDto> Events, List<MealMenuDef> Menus);

/// <summary>A shore excursion the caller has booked on a cruise day, as one line of the day's plan: when it starts and ends (ship time, instants) and where to meet.</summary>
public sealed record DayTourDto(string Id, string ExcursionId, string Name, string Port, string Meeting, int Day, string Date, string Start, long StartAt, long EndAt);

public sealed record ExplorerDayDto(
    string Explorer, string ShipId, int Day, int? CurrentDay, string Date, string Port, string ShipZone, long? SailawayAt, List<VenueDayDto> Venues, List<string> Mine, Dictionary<string, int>? Reminders = null);

/// <summary>
/// The rules of the Explorer pages: a venue's hours on a day, the events and menus of a day, and the limits on pins. Ported from <c>src/domain/explorer</c>
/// (<c>hours.ts</c>, <c>dayMapping.ts</c>); both are tested against the sample week.
/// </summary>
public static class ExplorerRules
{
    /// <summary>The most screens a guest can pin. A new pin past it replaces the oldest, as on the device before.</summary>
    public const int MaxScreenPins = 5;

    /// <summary>The most venues a guest can pin in one Explorer. A new pin past it is refused.</summary>
    public const int MaxVenuePins = 10;

    public static ExplorerVenueDto Dto(string shipId, ExplorerVenue v) =>
        new(v.Id, shipId, v.Explorer, v.Kind, v.Title, v.Short, v.Long, v.PlaceId, v.DeckLabel, v.Cover, v.MinAge, v.Bookable, v.Order, v.Features, v.Accessibility);

    private static int Mins(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    private static string Clock(int m) => $"{m / 60:00}:{m % 60:00}";

    /// <summary>The ship-time "HH:mm" the ship sails on a day, or null at sea or when the day has no sailing.</summary>
    public static string? SailawayTime(Timeline timeline, int day)
    {
        if (day < 1 || day > timeline.Days.Count) return null;
        var d = timeline.Days[day - 1];
        if (d.Port == "sea" || d.Depart is not { } depart) return null;
        var utc = Itinerary.LocalToUtc(d.Date, depart, Itinerary.ZoneOf(d.Port));
        var (_, time) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        return time.ToString("HH:mm");
    }

    /// <summary>The hours of a venue on a day. No matching rule means closed, never open: an unknown is not a promise.</summary>
    public static HoursDayDto Hours(IReadOnlyList<HoursRule> rules, Timeline timeline, int day)
    {
        var rule = rules.FirstOrDefault(r => DayKinds.Runs(timeline, day, r.When));
        if (rule is null) return new([], [], "none");
        if (rule.Kind == "closed") return new([], [], "alongside");
        if (rule.Kind == "fixed") return new([.. Sorted(rule.Windows)], [.. Sorted(rule.Staffed)], null);
        var sail = SailawayTime(timeline, day);
        if (sail is null || rule.AfterMinutes is not { } after || rule.Until is null) return new([], [], "alongside");
        var from = Mins(sail) + after;
        return from >= Mins(rule.Until) ? new([], [], "alongside") : new([[Clock(from), rule.Until]], [], null);
    }

    private static IEnumerable<string[]> Sorted(string[][]? windows) => (windows ?? []).OrderBy(w => Mins(w[0]));

    /// <summary>
    /// The day of an authored week (<c>embark</c>, <c>sea</c>, <c>port</c>, <c>last</c> in <paramref name="template"/>) a day of the sailing uses, as an index, or null.
    /// Day 1 is the embarkation day, the last night the final template day, the morning of disembarkation has none, and every other day takes the next template day of its own kind, wrapping round.
    /// </summary>
    public static int? TemplateIndex(Timeline timeline, int day, IReadOnlyList<string> template)
    {
        var total = timeline.Days.Count;
        if (total == 0 || template.Count == 0 || day < 1 || day > total) return null;
        if (day == 1) return Math.Max(0, IndexOf(template, "embark"));
        if (day == total) return null;
        var nights = total - 1;
        if (day == nights) { var last = LastIndexOf(template, "last"); return last >= 0 ? last : template.Count - 1; }

        var sea = timeline.Days[day - 1].Port == "sea";
        var kind = sea ? "sea" : "port";
        var pool = Enumerable.Range(0, template.Count).Where(i => template[i] == kind).ToList();
        if (pool.Count == 0) pool = [.. Enumerable.Range(0, template.Count).Where(i => template[i] is "sea" or "port")];
        if (pool.Count == 0) return null;
        var nth = 0;
        for (var d = 2; d < day; d++) if (d != nights && (timeline.Days[d - 1].Port == "sea") == sea) nth++;
        return pool[nth % pool.Count];
    }

    private static int IndexOf(IReadOnlyList<string> l, string v) { for (var i = 0; i < l.Count; i++) if (l[i] == v) return i; return -1; }

    private static int LastIndexOf(IReadOnlyList<string> l, string v) { for (var i = l.Count - 1; i >= 0; i--) if (l[i] == v) return i; return -1; }

    /// <summary>The menus a venue serves on a day: those for every day and those for this day of the authored week.</summary>
    public static List<MealMenuDef> MenusOn(ShipExplorer ship, string venueId, Timeline timeline, int day)
    {
        var index = TemplateIndex(timeline, day, ship.MenuTemplate);
        return [.. ship.Menus.Where(m => m.VenueId == venueId && (m.TemplateDay == 0 || (index is { } i && m.TemplateDay == i + 1))).OrderBy(m => Mins(m.From))];
    }

    private static uint Hash(string text)
    {
        uint h = 5381;
        foreach (var ch in text) h = unchecked(h * 33 + ch);
        return h;
    }

    /// <summary>The places left for an event with a limit: what other guests have not taken, the same every time, never below a quarter.</summary>
    public static int? PlacesLeft(ExplorerEventDef e, int day, int mine)
    {
        if (e.Capacity is not { } cap) return null;
        var taken = (int)(Hash($"{e.Id}|{day}") % (uint)((cap * 3) / 4 + 1));
        return Math.Max(0, cap - taken - mine);
    }

    /// <summary>The events of a day in time order, with any mid-day change applied when <paramref name="changes"/> is on. An event after all aboard is listed only once the ship is back.</summary>
    public static List<ExplorerEventDto> EventsOn(ShipExplorer ship, Timeline timeline, int day, bool changes, IReadOnlyList<PlanChange> feed, Func<string, bool>? venueFilter = null)
    {
        if (day < 1 || day > Itinerary.MaxDay || day > timeline.Days.Count) return [];
        var date = timeline.Departure.AddDays(day - 1);
        var zone = timeline.ShipZoneOnDate(date);
        var aboard = timeline.AllAboardAt(day);
        var list = new List<ExplorerEventDto>();
        foreach (var e in ship.Events.Where(e => (venueFilter?.Invoke(e.VenueId) ?? true) && DayKinds.Runs(timeline, day, e.When)))
        {
            var change = changes ? feed.FirstOrDefault(c => c.EventId == e.Id && c.Day == day) : null;
            var start = change is { Kind: "moved", Start: { } s } ? s : e.Start;
            var startAt = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(start, "HH:mm"), zone);
            if (e.AfterAllAboard && aboard is { } a && startAt < a) continue;
            list.Add(new ExplorerEventDto(
                e.Id, e.VenueId, day, date.ToString("yyyy-MM-dd"), start, e.Minutes, TripRules.ToMs(startAt), TripRules.ToMs(startAt.AddMinutes(e.Minutes)), e.Title, e.Detail, e.Age, e.Interest, e.Extra,
                change?.Kind ?? "on", change?.Kind == "moved" ? e.Start : null, change?.Reason, e.Capacity, PlacesLeft(e, day, 0)));
        }
        return [.. list.OrderBy(e => e.StartAt).ThenBy(e => e.Title, StringComparer.InvariantCulture)];
    }

    /// <summary>The venue with its hours, events and (when asked) menus for one day.</summary>
    public static VenueDayDto VenueDay(string shipId, ShipExplorer ship, ExplorerVenue v, Timeline timeline, int day, IReadOnlyList<ExplorerEventDto> dayEvents, bool withMenus) =>
        new(Dto(shipId, v), Hours(v.Hours, timeline, day), [.. dayEvents.Where(e => e.VenueId == v.Id)], withMenus ? MenusOn(ship, v.Id, timeline, day) : []);

    /// <summary>
    /// Whether a favourite key may be added to a guest's list, given the list as it is. Screen pins past <see cref="MaxScreenPins"/> are handled by the caller (the oldest goes);
    /// a venue pin must name a venue that exists and the Explorer must have room. Throws the error the app shows. Keys of other kinds pass.
    /// </summary>
    public static void RequirePinAllowed(IReadOnlyList<string> current, string key)
    {
        if (key.StartsWith("screen:", StringComparison.Ordinal))
        {
            var id = key["screen:".Length..];
            if (id.Length is 0 or > 12 || !id.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' or '.')) throw ApiException.Invalid("screen");
        }
        else if (key.StartsWith("venue:", StringComparison.Ordinal))
        {
            var venue = ExplorerCatalogue.VenueOfPinKey(key) ?? throw ApiException.Invalid("venue");
            var inExplorer = current.Count(k => ExplorerCatalogue.VenueOfPinKey(k) is { } p && p.Venue.Explorer == venue.Venue.Explorer);
            if (inExplorer >= MaxVenuePins) throw ApiException.Invalid("pinsFull");
        }
    }
}
