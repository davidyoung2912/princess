using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>Something the guest already holds on the day: a booked tour (<see cref="Start"/> in port time) or a dinner table (ship time).</summary>
public sealed record PlannerReserved(int Day, string Id, string Title, string Kind, string Start, int Minutes, string? PlaceId);

/// <summary>One thing in the plan with its instants. <see cref="Clock"/> names the clock <see cref="Start"/> and <see cref="End"/> are on (port or ship); <see cref="Cost"/> is free, included or paid.</summary>
public sealed record PlannerSegment(string Id, string Title, string Kind, string Source, string Start, string End, string Clock, long StartAt, long EndAt, string? PlaceId, string Cost, long Cents);

/// <summary>A problem with the day. <c>hard</c> blocks "ready"; <c>soft</c> is a warning the guest may accept.</summary>
public sealed record PlannerConflict(string Severity, string Code, IReadOnlyList<string> Ids, string Text);

public sealed record PlannerWindow(string Start, string End, int Minutes, long StartAt, long EndAt);

/// <summary>What is known about a traveller's access and pace. <see cref="Source"/> is verified, reported or unknown; a name is only for wording.</summary>
public sealed record TravellerProfile(string? Name, string Mobility, string Pace, string Source);

public sealed record TravellerChange(string Id, string Severity, string Text);

public sealed record TravellerCheckDto(string Name, string Source, IReadOnlyList<TravellerChange> Changes, bool HumanCheck, string Note);

public sealed record PlannerDayDto(int Day, string Scenario, IReadOnlyList<PlannerSegment> Segments, IReadOnlyList<PlannerConflict> Conflicts, bool Ready, string? BackBy, IReadOnlyList<PlannerWindow> Windows, IReadOnlyList<string> Notes, TravellerCheckDto? Traveller);

public sealed record PlannerOption(string Kind, string Id, string Title, string Start, int Minutes, string? Place, string Cost, long Cents, int Walk, IReadOnlyList<string> Meets, string Why);

public sealed record PlannerHourDto(string From, string To, IReadOnlyList<PlannerOption> Options, string Occupancy);

public sealed record PlannerStep(string Kind, string Title, string Start, string End, string? Place, int WalkFromPrevious, string Cost, string Source, string? Route);

public sealed record PlannerEveningDto(IReadOnlyList<PlannerStep> Steps, IReadOnlyList<string> Notes, bool Complete);

public sealed record MeetingDto(string Text, string PlaceName, int Deck, string Section);

public sealed record PlannerPreviewDto(int Day, string Excursion, string? Problem, bool ReadyBefore, bool ReadyAfter, IReadOnlyList<PlannerConflict> NewConflicts, IReadOnlyList<string> Lost, long PriceChangeCents, string? FreeCancelUntil, bool FreeCancelOpen);

public sealed record TourCompareRow(string Key, string A, string B, bool Differs);

public sealed record TourCompareDto(string NameA, string NameB, IReadOnlyList<TourCompareRow> Rows, IReadOnlyList<string> Risks, IReadOnlyList<string> Missing);

public sealed record PlannerShapeRequest(string? SailingId, int Day, string? Scenario, string? Mobility, TravellerProfile? Traveller);
public sealed record PlannerHourRequest(string? SailingId, int Day, string? From, string? PlaceId, string? Mobility);
public sealed record PlannerEveningRequest(string? SailingId, int Day, string? Mobility);
public sealed record PlannerPreviewRequest(string? SailingId, string? ExcursionId, string? Scenario, string? Mobility);
public sealed record PlannerMeetingRequest(string? SailingId, int? Day, string? PlaceId, string? Time, string? Note);
public sealed record PlannerCompareRequest(string? SailingId, string? A, string? B);

public sealed record GroupOption(string Id, string Label);
/// <summary>One member's answers by option id (yes, maybe or no). No reason is accepted or kept; an empty or missing map means the member has not answered.</summary>
public sealed record GroupMember(string Name, IReadOnlyDictionary<string, string>? Answers);
public sealed record GroupStatusRequest(string? Question, IReadOnlyList<GroupOption>? Options, IReadOnlyList<GroupMember>? Members, long? CreatedAt, long? ClosesAt, bool? Closed, bool? Organiser);
public sealed record GroupOptionTally(string Id, string Label, int Yes, int Maybe, int No);
public sealed record GroupSuggestion(string Kind, IReadOnlyList<string> OptionIds, string Text);
public sealed record GroupStatusDto(string State, int Answered, int Silent, IReadOnlyList<GroupOptionTally> Tally, GroupSuggestion Suggestion, bool ReminderDue, string? ReminderText, IReadOnlyList<string> Remains, IReadOnlyList<string> Controls, string Note);

/// <summary>
/// Stanley's planner, group diplomat and sea-time intelligence (docs/stanley-gap-analysis-and-plan.md, phase 9). Pure: it builds on <see cref="DayPlanRules"/>, <see cref="ProgramRules"/> and <see cref="ExcursionRules"/>,
/// so it cannot offer an opening that does not exist (an event that is off, a tour with no places left, a tour that does not fit the ship's day). Every time is turned into a moment in UTC first, using the
/// port's clock for a tour and the ship's clock for everything else, so a clock change or a port in another zone cannot hide a clash.
/// </summary>
public static partial class StanleyPlannerRules
{
    public static readonly string[] Scenarios = ["relaxed", "active", "family", "culture", "food", "mixed"];
    public static readonly string[] Paces = ["relaxed", "steady", "active"];
    public static readonly string[] Sources = ["verified", "reported", "unknown"];

    /// <summary>The shortest gap worth calling a free window, in minutes.</summary>
    public const int WindowMinutes = 45;
    public const int NoteMax = 100;
    public const int NameMax = 30;
    public const string Occupancy = "There is no live crowd data. Quiet here means only that no programme event is on at that place during the hour.";

    [GeneratedRegex(@"^([01]\d|2[0-3]):[0-5]\d$")]
    private static partial Regex Hhmm();

    public static bool ValidTime(string? t) => t is not null && Hhmm().IsMatch(t);

    public static string? CleanMobility(string? m) => m is null ? "any" : DayPlanRules.Mobilities.Contains(m) ? m : null;

    public static bool ValidTraveller(TravellerProfile? p) =>
        p is null || (DayPlanRules.Mobilities.Contains(p.Mobility) && Paces.Contains(p.Pace) && Sources.Contains(p.Source) && (p.Name ?? "").Length <= NameMax);

    private static IReadOnlyList<DeckPlaceDto> Places(string? shipId) => (AboardPlans.For(shipId ?? ShipDining.SunId) ?? AboardPlans.For(ShipDining.SunId)!).Places;

    private static long Ms(DateTime utc) => TripRules.ToMs(utc);
    private static DateTime Utc(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;
    private static string Hm(DateTime utc, string zone) => Itinerary.LocalAt(utc, zone).Time.ToString("HH:mm", CultureInfo.InvariantCulture);
    private static string Money(long cents) => "$" + (cents / 100m).ToString("0.##", CultureInfo.InvariantCulture);
    private static string[] Ages(bool kids) => kids ? ["all", "kids", "teens"] : ["all", "adults"];

    // ---- Scenarios ----

    /// <summary>The wishes behind a scenario. The programme has no food interest, so "food" favours a culture tour and an evening out; dinner is always in the plan.</summary>
    public static DayWishDto WishFor(string scenario, string mobility, bool kids) => scenario switch
    {
        "relaxed" => new(["relax", "nature"], ["wellness", "music"], mobility == "any" ? "easy" : mobility, kids, null),
        "active" => new(["adventure", "water"], ["games", "wellness"], mobility, kids, null),
        "family" => new(["nature", "water"], ["family"], mobility, true, null),
        "culture" => new(["culture"], ["learning", "shows"], mobility, kids, null),
        "food" => new(["culture", "relax"], ["shows", "nightlife"], mobility, kids, null),
        _ => new([], [], mobility, kids, null),
    };

    // ---- Segments ----

    private static PlannerSegment Make(Timeline t, DateOnly date, string id, string title, string kind, string source, string start, int minutes, bool port, string portId, string? place, string cost, long cents)
    {
        var zone = port ? Itinerary.ZoneOf(portId) : t.ShipZoneOnDate(date);
        var begins = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(start, "HH:mm"), zone);
        var ends = begins.AddMinutes(minutes);
        return new(id, title, kind, source, start, Hm(ends, zone), port ? "port" : "ship", Ms(begins), Ms(ends), place, cost, cents);
    }

    private static PlannerSegment FromReserved(Timeline t, DateOnly date, PlannerReserved r)
    {
        var x = r.Kind == "tour" ? ExcursionRules.ById(r.Id) : null;
        return Make(t, date, r.Id, r.Title, r.Kind, "reserved", r.Start, r.Minutes, x is not null, x?.Port ?? "", r.PlaceId, x is null ? "included" : "paid", x?.Price ?? 0);
    }

    private static PlannerSegment FromEntry(Timeline t, DateOnly date, PlanEntryDto i)
    {
        if (i.Kind == "tour" && ExcursionRules.ById(i.Id) is { } x)
            return Make(t, date, i.Id, i.Title, "tour", "suggested", i.Start, i.Minutes, true, x.Port, null, "paid", x.Price);
        var extra = i.Kind == "event" ? ProgramRules.ById(i.Id)?.Extra ?? 0 : 0;
        return Make(t, date, i.Id, i.Title, i.Kind, "suggested", i.Start, i.Minutes, false, "", i.PlaceId ?? (i.Kind == "dinner" ? i.Id : null), extra > 0 ? "paid" : "included", extra);
    }

    private static bool Overlaps(PlannerSegment a, PlannerSegment b) => a.StartAt < b.EndAt && b.StartAt < a.EndAt;

    /// <summary>Minutes of walking between two places: 3, plus 2 for each deck apart and 2 more when the ends of the ship differ. Slower for easy and wheelchair travel. 5 when a place is not on the plan.</summary>
    public static int Walk(string? origin, string? target, string? shipId, string mobility)
    {
        if (origin is null || target is null) return 5;
        if (origin == target) return 0;
        var places = Places(shipId);
        var a = places.FirstOrDefault(p => p.Id == origin);
        var b = places.FirstOrDefault(p => p.Id == target);
        if (a is null || b is null) return 5;
        var basic = 3 + 2 * Math.Abs(a.Deck - b.Deck) + (a.Section != b.Section ? 2 : 0);
        var factor = mobility == "wheelchair" ? 2.0 : mobility == "easy" ? 1.5 : 1.0;
        return (int)Math.Ceiling(basic * factor);
    }

    /// <summary>The span a segment holds the guest: a tour also holds the time to get ashore before it and back aboard after it.</summary>
    private static (long From, long To) Held(PlannerSegment s)
    {
        if (s.Kind != "tour" || ExcursionRules.ById(s.Id) is not { } x) return (s.StartAt, s.EndAt);
        var (o, back) = ExcursionRules.LandingBuffer(x.Port);
        return (s.StartAt - o * 60_000L, s.EndAt + back * 60_000L);
    }

    // ---- Conflicts ----

    public static List<PlannerConflict> Check(Timeline t, int day, IReadOnlyList<PlannerSegment> segments, string? shipId, string mobility)
    {
        var list = new List<PlannerConflict>();
        var d = t.Days[day - 1];
        var ordered = segments.OrderBy(s => s.StartAt).ThenBy(s => s.Id, StringComparer.Ordinal).ToList();
        foreach (var s in ordered.Where(s => s.Kind == "tour"))
        {
            if (ExcursionRules.ById(s.Id) is not { } x) continue;
            if (x.Port != d.Port) { list.Add(new("hard", "wrongPort", [s.Id], $"{s.Title} is in {Itinerary.PortById(x.Port).Name}, not where the ship is on day {day}.")); continue; }
            var p = ExcursionRules.TimingProblem(x, d);
            if (p == "tooEarly") list.Add(new("hard", "tourTooEarly", [s.Id], $"{s.Title} starts before you can be ashore and at the meeting point."));
            else if (p == "tooLate") list.Add(new("hard", "tourTooLate", [s.Id], $"{s.Title} would not leave time to be back aboard before all aboard."));
        }
        for (var i = 0; i < ordered.Count; i++)
            for (var j = i + 1; j < ordered.Count && ordered[j].StartAt < ordered[i].EndAt; j++)
                list.Add(new("hard", "overlap", [ordered[i].Id, ordered[j].Id], $"{ordered[i].Title} and {ordered[j].Title} overlap."));
        for (var i = 0; i + 1 < ordered.Count; i++)
        {
            var a = ordered[i];
            var b = ordered[i + 1];
            if (b.StartAt < a.EndAt) continue;
            var gap = (int)((b.StartAt - a.EndAt) / 60_000L);
            if (a.Kind == "tour" && b.Kind != "tour" && ExcursionRules.ById(a.Id) is { } ta)
            {
                var need = ExcursionRules.LandingBuffer(ta.Port).Back;
                if (gap < need) list.Add(new("hard", "backTight", [a.Id, b.Id], $"{b.Title} starts {gap} minutes after {a.Title} ends; getting back aboard takes {need}."));
            }
            else if (b.Kind == "tour" && a.Kind != "tour" && ExcursionRules.ById(b.Id) is { } tb)
            {
                var need = ExcursionRules.LandingBuffer(tb.Port).Out;
                if (gap < need) list.Add(new("hard", "outTight", [a.Id, b.Id], $"{b.Title} starts {gap} minutes after {a.Title} ends; getting ashore takes {need}."));
            }
            else if (a.Kind != "tour" && b.Kind != "tour")
            {
                var walk = Walk(a.PlaceId, b.PlaceId, shipId, mobility);
                if (gap < walk) list.Add(new("soft", "walkTight", [a.Id, b.Id], $"Walking from {a.Title} to {b.Title} takes about {walk} minutes and you have {gap}."));
            }
        }
        return list;
    }

    public static List<PlannerWindow> Windows(Timeline t, int day, IReadOnlyList<PlannerSegment> segments)
    {
        var date = t.Departure.AddDays(day - 1);
        var zone = t.ShipZoneOnDate(date);
        var cursor = Ms(Itinerary.LocalToUtc(date, new TimeOnly(8, 0), zone));
        var end = Ms(Itinerary.LocalToUtc(date, new TimeOnly(22, 30), zone));
        var list = new List<PlannerWindow>();
        void Add(long begin, long finish)
        {
            if (finish - begin < WindowMinutes * 60_000L) return;
            list.Add(new(Hm(Utc(begin), zone), Hm(Utc(finish), zone), (int)((finish - begin) / 60_000L), begin, finish));
        }
        foreach (var s in segments.OrderBy(s => s.StartAt))
        {
            var (begin, finish) = Held(s);
            Add(cursor, begin);
            cursor = Math.Max(cursor, finish);
        }
        Add(cursor, end);
        return list;
    }

    // ---- Shaping the day ----

    /// <summary>
    /// The day for a scenario on top of what the guest already holds. A suggestion is dropped (and the reason noted) when it is the same as something held, overlaps it, has no places left, or would create a hard conflict;
    /// what the guest holds is never moved. The day is ready when it has something in it and no hard conflict.
    /// </summary>
    public static PlannerDayDto Shape(Timeline t, int day, string scenario, string mobility, bool kids, IReadOnlyList<PlannerReserved> reserved, IReadOnlyList<PlanChange> feed, string? shipId, string? sailingId, TravellerProfile? traveller = null)
    {
        var date = t.Departure.AddDays(day - 1);
        var wish = WishFor(scenario, mobility, kids);
        var (items, backBy) = DayPlanRules.Build(t, day, wish, shipId);
        reserved = [.. reserved.Where(r => r.Day == day)];
        var segments = reserved.Select(r => FromReserved(t, date, r)).ToList();
        var notes = new List<string>();
        foreach (var i in items)
        {
            if (reserved.Any(r => r.Id == i.Id) || (i.Kind == "dinner" && reserved.Any(r => r.Kind == "dinner"))) continue;
            if (i.Kind == "tour" && sailingId is not null && ExcursionRules.ById(i.Id) is { } x && ExcursionRules.SpotsLeft(x, sailingId) == 0) { notes.Add($"Left out {i.Title}: no places are left."); continue; }
            var seg = FromEntry(t, date, i);
            if (segments.FirstOrDefault(s => Overlaps(s, seg)) is { } clash) { notes.Add($"Left out {i.Title}: it overlaps {clash.Title}, which you already have."); continue; }
            var tentative = new List<PlannerSegment>(segments) { seg };
            if (Check(t, day, tentative, shipId, mobility).Any(c => c.Severity == "hard" && c.Ids.Contains(seg.Id))) { notes.Add($"Left out {i.Title}: it would not leave enough time around what you already have."); continue; }
            segments.Add(seg);
        }
        segments = [.. segments.OrderBy(s => s.StartAt).ThenBy(s => s.Id, StringComparer.Ordinal)];
        var conflicts = Check(t, day, segments, shipId, mobility);
        TravellerCheckDto? check = traveller is null ? null : CheckTraveller(t, day, segments, traveller, shipId, conflicts);
        return new(day, scenario, segments, conflicts, segments.Count > 0 && conflicts.All(c => c.Severity != "hard"), backBy, Windows(t, day, segments), notes, check);
    }

    // ---- Free hour and venues ----

    private static bool Reachable(DeckPlaceDto? p, string mobility) => mobility == "any" || p is { StepFree: true };

    /// <summary>
    /// Up to three ways to spend the hour from <paramref name="at"/> (ship time): programme events that are on, start in time to walk there and do not run into the plan, and places to sit that have no event on
    /// during the hour (an explicit meaning of "quiet"; there is no crowd data). Each is labelled free, included or paid.
    /// </summary>
    public static PlannerHourDto Hour(Timeline t, int day, string at, string? here, IReadOnlyList<PlannerSegment> plan, string mobility, bool kids, IReadOnlyList<PlanChange> feed, string? shipId)
    {
        var date = t.Departure.AddDays(day - 1);
        var zone = t.ShipZoneOnDate(date);
        var start = Ms(Itinerary.LocalToUtc(date, TimeOnly.ParseExact(at, "HH:mm"), zone));
        var end = start + 3_600_000L;
        foreach (var s in plan)
        {
            var (a, b) = Held(s);
            if (a <= start && b > start) return new(at, at, [], Occupancy);
            if (a > start) end = Math.Min(end, a);
        }
        var to = Hm(Utc(end), zone);
        if (end <= start) return new(at, at, [], Occupancy);
        var places = Places(shipId).ToDictionary(p => p.Id);
        var today = ProgramRules.On(t, day, true, feed, shipId).Where(e => e.Status != "cancelled").ToList();
        var busy = today.Where(e => e.StartAt < end && e.EndAt > start).Select(e => e.PlaceId).ToHashSet();
        var ages = Ages(kids);
        var events = today
            .Where(e => e.Status == "on" && ages.Contains(e.Age) && e.StartAt <= end && e.EndAt > start)
            .Where(e => Reachable(places.GetValueOrDefault(e.PlaceId), mobility))
            .Select(e => (E: e, Walk: Walk(here, e.PlaceId, shipId, mobility)))
            .Where(x => x.E.StartAt >= start + x.Walk * 60_000L)
            .Where(x => !plan.Any(s => { var (a, b) = Held(s); return x.E.StartAt < b && x.E.EndAt > a; }))
            .OrderBy(x => x.E.Extra > 0 ? 1 : 0).ThenBy(x => x.E.StartAt).ThenBy(x => x.E.Id, StringComparer.Ordinal)
            .Select(x => new PlannerOption("event", x.E.Id, x.E.Title, x.E.Start, x.E.Minutes, places.GetValueOrDefault(x.E.PlaceId)?.Name, x.E.Extra > 0 ? "paid" : "included", x.E.Extra,
                x.Walk, MeetsOf(places.GetValueOrDefault(x.E.PlaceId), x.Walk, false), x.E.Extra > 0 ? $"Starts at {x.E.Start}, extra cost {Money(x.E.Extra)} each." : $"Starts at {x.E.Start}, included in your fare."))
            .ToList();
        var venues = places.Values
            .Where(p => p.Kind is "bar" or "pool" or "family" && (kids || p.Kind != "family") && !busy.Contains(p.Id) && Reachable(p, mobility))
            .Select(p => (P: p, Walk: Walk(here, p.Id, shipId, mobility)))
            .OrderBy(x => kids && x.P.Kind == "family" ? 0 : 1).ThenBy(x => x.Walk).ThenBy(x => x.P.Id, StringComparer.Ordinal)
            .Select(x => new PlannerOption("place", x.P.Id, x.P.Name, at, 60, x.P.Name, "free", 0, x.Walk, MeetsOf(x.P, x.Walk, true),
                x.P.Kind == "bar" ? "Free to sit; drinks are charged." : "Free to use."))
            .ToList();
        var take = Math.Min(events.Count, 2);
        var options = events.Take(take).Concat(venues.Take(3 - take)).ToList();
        if (options.Count < 3) options.AddRange(events.Skip(take).Take(3 - options.Count));
        return new(at, to, options, Occupancy);
    }

    private static List<string> MeetsOf(DeckPlaceDto? p, int walk, bool quiet)
    {
        var meets = new List<string>();
        if (quiet) meets.Add("quiet");
        if (walk <= 5) meets.Add("nearby");
        if (p?.Kind == "family") meets.Add("childFriendly");
        return meets;
    }

    // ---- Plan my evening ----

    /// <summary>Dinner, then a show, then a quiet last drink, in order with the walk between each. Dinner is the guest's own table when they have one. Booking dinner is done on the dining screen.</summary>
    public static PlannerEveningDto Evening(Timeline t, int day, string mobility, bool kids, PlannerReserved? dinner, IReadOnlyList<PlanChange> feed, string? shipId)
    {
        var notes = new List<string>();
        if (day < 1 || day > t.Days.Count) return new([], ["That day is not on this sailing."], false);
        if (day == t.Days.Count && dinner is null) return new([], ["The last morning has no evening."], false);
        var date = t.Departure.AddDays(day - 1);
        var zone = t.ShipZoneOnDate(date);
        var places = Places(shipId).ToDictionary(p => p.Id);
        var steps = new List<PlannerStep>();
        var main = AboardPlans.Room(shipId, "eclipse") ?? "eclipse";
        var dStart = dinner?.Start ?? DayPlanRules.DinnerStart;
        var dMinutes = dinner?.Minutes ?? DayPlanRules.DinnerMinutes;
        var dPlace = dinner?.PlaceId ?? main;
        var dFrom = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(dStart, "HH:mm"), zone);
        var dTo = dFrom.AddMinutes(dMinutes);
        steps.Add(new("dinner", dinner?.Title ?? $"Dinner in the {AboardPlans.MainDiningName(shipId)}", dStart, Hm(dTo, zone), places.GetValueOrDefault(dPlace)?.Name, 0, "included", dinner is null ? "suggested" : "reserved", "/plan/dining"));
        if (dinner is null) notes.Add("Dinner is not booked yet. Book it on the dining screen; nothing is booked from here.");

        var ages = Ages(kids);
        var cutoff = Ms(Itinerary.LocalToUtc(date, new TimeOnly(22, 30), zone));
        var after = Ms(dTo);
        var shows = ProgramRules.On(t, day, true, feed, shipId)
            .Where(e => e.Status == "on" && e.Interest == "shows" && ages.Contains(e.Age) && Reachable(places.GetValueOrDefault(e.PlaceId), mobility) && e.StartAt <= cutoff)
            .Select(e => (E: e, Walk: Walk(dPlace, e.PlaceId, shipId, mobility)))
            .Where(x => x.E.StartAt >= after + x.Walk * 60_000L)
            .OrderBy(x => x.E.Extra > 0 ? 1 : 0).ThenBy(x => x.E.StartAt).ThenBy(x => x.E.Id, StringComparer.Ordinal)
            .Select(x => ((DatedEvent E, int Walk)?)x).FirstOrDefault();
        var lastPlace = dPlace;
        var lastEnd = after;
        if (shows is { } s)
        {
            steps.Add(new("show", s.E.Title, s.E.Start, Hm(Utc(s.E.EndAt), zone), places.GetValueOrDefault(s.E.PlaceId)?.Name, s.Walk, s.E.Extra > 0 ? "paid" : "included", "suggested", "/plan/day"));
            lastPlace = s.E.PlaceId;
            lastEnd = s.E.EndAt;
        }
        else notes.Add("No show starts after dinner in time for the walk, so the evening goes from dinner to a drink.");

        var today = ProgramRules.On(t, day, true, feed, shipId).Where(e => e.Status != "cancelled").ToList();
        var bar = places.Values
            .Where(p => p.Kind == "bar" && Reachable(p, mobility))
            .Select(p => (P: p, Walk: Walk(lastPlace, p.Id, shipId, mobility)))
            .Where(x => !today.Any(e => e.PlaceId == x.P.Id && e.StartAt < lastEnd + (x.Walk + 60) * 60_000L && e.EndAt > lastEnd + x.Walk * 60_000L))
            .OrderBy(x => x.Walk).ThenBy(x => x.P.Id, StringComparer.Ordinal)
            .Select(x => ((DeckPlaceDto P, int Walk)?)x).FirstOrDefault();
        if (bar is { } b)
        {
            var at = lastEnd + b.Walk * 60_000L;
            steps.Add(new("drink", $"A quiet last drink at {b.P.Name}", Hm(Utc(at), zone), Hm(Utc(at + 3_600_000L), zone), b.P.Name, b.Walk, "free", "suggested", null));
            notes.Add(Occupancy);
        }
        else notes.Add("No bar is free of events for the hour after, so no last drink is suggested.");
        return new(steps, notes, steps.Count == 3);
    }

    // ---- Meeting-point message ----

    /// <summary>The message text for a meeting place and time; null for a place the ship does not have or a time that is not HH:mm. The guest sends it. <paramref name="allAboard"/> adds the reminder on a port day.</summary>
    public static MeetingDto? Meeting(string? placeId, string? time, string? note, string? shipId, string? allAboard = null)
    {
        if (!ValidTime(time) || Places(shipId).FirstOrDefault(p => p.Id == placeId) is not { } p) return null;
        var n = (note ?? "").Trim();
        if (n.Length > NoteMax) n = n[..NoteMax];
        var text = $"Let's meet at {p.Name}, deck {p.Deck} ({p.Section}), at {time} ship time." + (n.Length > 0 ? " " + n : "") + (allAboard is null ? "" : $" Reminder: all aboard is {allAboard} port time.");
        return new(text, p.Name, p.Deck, p.Section);
    }

    // ---- How does this day work for a named traveller ----

    public static TravellerCheckDto CheckTraveller(Timeline t, int day, IReadOnlyList<PlannerSegment> segments, TravellerProfile p, string? shipId, IReadOnlyList<PlannerConflict>? baseConflicts = null)
    {
        var name = string.IsNullOrWhiteSpace(p.Name) ? "this traveller" : p.Name.Trim();
        var changes = new List<TravellerChange>();
        var places = Places(shipId).ToDictionary(x => x.Id);
        var human = false;
        foreach (var s in segments)
        {
            if (s.Kind == "tour" && ExcursionRules.ById(s.Id) is { } x)
            {
                if (p.Mobility == "wheelchair" && !x.Wheelchair)
                {
                    var alt = ExcursionRules.Catalogue.FirstOrDefault(o => o.Port == x.Port && o.Wheelchair);
                    changes.Add(new(s.Id, "change", $"{x.Name} is not offered for wheelchair users." + (alt is null ? "" : $" {alt.Name} is.")));
                }
                else if (p.Mobility != "any" && x.ConfirmAccess)
                {
                    human = true;
                    changes.Add(new(s.Id, "check", $"{x.Name} is step-free only if the boat, van or tender landing allows it. Confirm with the operator before relying on it."));
                }
                if (x.Activity == "strenuous" && p.Pace != "active") changes.Add(new(s.Id, "change", $"{x.Name} is strenuous, more than a {p.Pace} pace suits."));
                else if (x.Hours >= 4 && p.Pace == "relaxed") changes.Add(new(s.Id, "check", $"{x.Name} takes {x.Hours:0.#} hours, a long outing at a relaxed pace."));
            }
            else if (s.Kind == "event" && p.Mobility != "any" && s.PlaceId is not null && places.TryGetValue(s.PlaceId, out var place) && !place.StepFree)
                changes.Add(new(s.Id, "change", $"{s.Title} is at {place.Name}, which is not step-free."));
        }
        var baseline = (baseConflicts ?? Check(t, day, segments, shipId, "any")).Where(c => c.Code == "walkTight").Select(c => string.Join('|', c.Ids)).ToHashSet();
        foreach (var c in Check(t, day, segments, shipId, p.Mobility).Where(c => c.Code == "walkTight" && !baseline.Contains(string.Join('|', c.Ids))))
            changes.Add(new(c.Ids[0], "change", c.Text.Replace("takes about", $"takes {name} about")));
        var busy = segments.Count(s => s.Kind is "tour" or "event");
        if (p.Pace == "relaxed" && busy >= 3) changes.Add(new(segments[0].Id, "check", $"{busy} things in one day is full for a relaxed pace. Consider dropping one."));

        human |= p.Mobility != "any" && p.Source != "verified";
        var note = p.Mobility == "any" ? "No access needs were given, so only pace was checked."
            : p.Source == "verified" ? "Access details are marked verified."
            : $"Access details are {(p.Source == "reported" ? "guest-reported" : "unknown")}, not verified. Have a person check the route before you rely on it.";
        return new(name, p.Source, changes, human, note);
    }

    // ---- Compare two excursions ----

    private static readonly Dictionary<string, (string? Transport, string Includes)> TourFacts = new()
    {
        ["coz-snorkel"] = ("Boat", "Gear and a guide in the water"),
        ["coz-ruins"] = ("Air-conditioned coach", "A guide on the history"),
        ["coz-beach"] = ("Taxi, a short ride", "A lounger, shade and a lunch credit"),
        ["coz-glass"] = ("Boat", "A glass-bottom boat ride and an hour in town"),
        ["bze-altunha"] = ("Coach", "A guide and time to climb the main pyramid"),
        ["bze-cave"] = ("On foot and by tube", "A guide, a tube and a walk through the forest"),
        ["bze-reef"] = ("Boat", "Gear and a guide"),
        ["bze-walk"] = ("On foot", "A guided walk"),
        ["rtb-zip"] = (null, "A harness fitting and ten zip lines"),
        ["rtb-snorkel"] = (null, "Gear and a guide"),
        ["rtb-wildlife"] = (null, "A keeper to talk to"),
        ["rtb-drive"] = ("Van", "Three photo stops and half an hour on the beach"),
    };

    public static TourCompareDto? CompareTours(Timeline t, string sailingId, string? aId, string? bId, IReadOnlyList<int> ages, DateOnly today)
    {
        if (ExcursionRules.ById(aId) is not { } a || ExcursionRules.ById(bId) is not { } b || a.Id == b.Id) return null;
        var rows = new List<TourCompareRow>();
        var missing = new List<string>();
        var risks = new List<string>();
        void Row(string key, string x, string y) => rows.Add(new(key, x, y, x != y));
        string Day(Excursion e) { var d = ExcursionRules.DayOf(t, e); return $"Day {d.Day}, {d.Date.ToString("ddd d MMM", CultureInfo.InvariantCulture)}, {Itinerary.PortById(e.Port).Name}"; }
        string Back(Excursion e) => $"Back at the landing by {ExcursionRules.BackBy(e, ExcursionRules.DayOf(t, e))} port time; meet: {e.Meeting.TrimEnd('.').ToLowerInvariant()}";
        string Price(Excursion e) => ages.Count == 0 ? Money(e.Price) + " an adult" : Money(ages.Sum(g => ExcursionRules.GuestPrice(e, g))) + $" for {ages.Count} {(ages.Count == 1 ? "guest" : "guests")}";
        string Transport(Excursion e)
        {
            var tr = TourFacts.GetValueOrDefault(e.Id).Transport;
            if (tr is null) missing.Add($"The listing for {e.Name} does not say how you get there.");
            return tr ?? "Not stated";
        }
        Row("when", Day(a), Day(b));
        Row("start", a.Start + " port time", b.Start + " port time");
        Row("duration", $"{a.Hours:0.#} hours", $"{b.Hours:0.#} hours");
        Row("exertion", a.Activity, b.Activity);
        Row("transport", Transport(a), Transport(b));
        Row("return", Back(a), Back(b));
        Row("price", Price(a), Price(b));
        Row("included", TourFacts.GetValueOrDefault(a.Id).Includes ?? "Not stated", TourFacts.GetValueOrDefault(b.Id).Includes ?? "Not stated");
        Row("stepFree", a.Wheelchair ? (a.ConfirmAccess ? "Yes, confirm with the operator" : "Yes") : "No", b.Wheelchair ? (b.ConfirmAccess ? "Yes, confirm with the operator" : "Yes") : "No");
        Row("places", $"{ExcursionRules.SpotsLeft(a, sailingId)} left", $"{ExcursionRules.SpotsLeft(b, sailingId)} left");
        foreach (var e in new[] { a, b })
        {
            if (ages.Any(g => g < ExcursionRules.MinAge(e))) risks.Add($"{e.Name} has a minimum age of {ExcursionRules.MinAge(e)}, and someone in your party is younger.");
            if (ages.Count > 0 && !ages.Any(g => g >= ExcursionRules.AdultAge)) risks.Add($"{e.Name} needs an adult in the group.");
            if (ExcursionRules.TimingProblem(e, ExcursionRules.DayOf(t, e)) is { } p) risks.Add($"{e.Name} does not fit the ship's day ({(p == "tooEarly" ? "too early to be ashore" : "too late to be back")}).");
            if (ExcursionRules.NeedsTender(e)) risks.Add($"{e.Name} is at a tender port, so getting ashore and back takes longer.");
            if (ExcursionRules.SpotsLeft(e, sailingId) == 0) risks.Add($"{e.Name} is sold out.");
            if (ExcursionRules.DaysToTour(today, t, e) < 0) risks.Add($"{e.Name} has already run.");
        }
        return new(a.Name, b.Name, rows, risks, missing);
    }

    // ---- Consequence preview ----

    /// <summary>What adding a tour does to the whole day: new conflicts, suggestions it displaces, the price for the party and the date after which cancelling costs the fee.</summary>
    public static PlannerPreviewDto? Preview(Timeline t, string sailingId, Excursion x, string scenario, string mobility, bool kids, IReadOnlyList<PlannerReserved> reserved, IReadOnlyList<PlanChange> feed, string? shipId, IReadOnlyList<int> ages, DateOnly today)
    {
        var d = ExcursionRules.DayOf(t, x);
        var dayReserved = (IReadOnlyList<PlannerReserved>)[.. reserved.Where(r => r.Day == d.Day)];
        var before = Shape(t, d.Day, scenario, mobility, kids, dayReserved, feed, shipId, sailingId);
        string? problem = null;
        if (reserved.Any(r => r.Id == x.Id)) problem = "alreadyBooked";
        else if (ExcursionRules.SpotsLeft(x, sailingId) == 0) problem = "soldOut";
        else if (ExcursionRules.DaysToTour(today, t, x) < 0) problem = "closed";
        IReadOnlyList<PlannerReserved> held = problem is null ? [.. dayReserved, new PlannerReserved(d.Day, x.Id, x.Name, "tour", x.Start, (int)Pricing.JsRound(x.Hours * 60), null)] : dayReserved;
        var after = Shape(t, d.Day, scenario, mobility, kids, held, feed, shipId, sailingId);
        string Key(PlannerConflict c) => c.Code + ":" + string.Join('|', c.Ids);
        var known = before.Conflicts.Select(Key).ToHashSet();
        var lost = before.Segments.Where(s => s.Source == "suggested" && after.Segments.All(a => a.Id != s.Id)).Select(s => s.Title).ToList();
        var price = problem is null ? (ages.Count == 0 ? x.Price : ages.Sum(g => ExcursionRules.GuestPrice(x, g))) : 0;
        var until = d.Date.AddDays(-ExcursionRules.FreeCancelDays);
        return new(d.Day, x.Name, problem, before.Ready, after.Ready, [.. after.Conflicts.Where(c => !known.Contains(Key(c)))], lost, price, until.ToString("yyyy-MM-dd"), today <= until);
    }

    // ---- Group diplomat ----

    public const int GroupMembersMax = 20;
    public const int GroupQuestionMax = 120;
    public const int GroupLabelMax = 40;
    private static readonly string[] Answers = ["yes", "maybe", "no"];

    public static string? GroupProblem(GroupStatusRequest? r)
    {
        if (r is null || string.IsNullOrWhiteSpace(r.Question) || r.Question.Length > GroupQuestionMax) return "question";
        if (r.Options is not { Count: >= 2 and <= 6 } || r.Options.Any(o => string.IsNullOrWhiteSpace(o.Id) || o.Id.Length > 40 || string.IsNullOrWhiteSpace(o.Label) || o.Label.Length > GroupLabelMax) || r.Options.Select(o => o.Id).Distinct().Count() != r.Options.Count) return "options";
        if (r.Members is not { Count: >= 1 and <= GroupMembersMax } || r.Members.Any(m => string.IsNullOrWhiteSpace(m.Name) || m.Name.Length > NameMax)) return "members";
        var ids = r.Options.Select(o => o.Id).ToHashSet();
        if (r.Members.Any(m => m.Answers is { } a && a.Any(kv => !ids.Contains(kv.Key) || !Answers.Contains(kv.Value)))) return "answers";
        return r.CreatedAt is < 0 || r.ClosesAt is < 0 ? "times" : null;
    }

    /// <summary>
    /// The state of a group poll from its answers. Only answers that were given count: silence is never a yes. Results are totals per option (no reasons, and who said no is not named). A clear
    /// choice needs an option with no objection and the most yes answers; with objections everywhere, the option with the fewest is offered as a compromise to ask about.
    /// </summary>
    public static GroupStatusDto GroupStatus(GroupStatusRequest r, long nowMs)
    {
        var options = r.Options!;
        var members = r.Members!;
        var answered = members.Count(m => m.Answers is { Count: > 0 });
        var silent = members.Count - answered;
        var tally = options.Select(o => new GroupOptionTally(o.Id, o.Label,
            members.Count(m => m.Answers?.GetValueOrDefault(o.Id) == "yes"), members.Count(m => m.Answers?.GetValueOrDefault(o.Id) == "maybe"), members.Count(m => m.Answers?.GetValueOrDefault(o.Id) == "no"))).ToList();
        var state = r.Closed == true ? "closed" : r.ClosesAt is { } c && c <= nowMs ? "expired" : "open";

        GroupSuggestion suggestion;
        if (answered == 0) suggestion = new("none", [], "Nobody has answered yet.");
        else
        {
            var clean = tally.Where(x => x.No == 0 && x.Yes > 0).ToList();
            if (clean.Count > 0)
            {
                var top = clean.Max(x => (x.Yes, x.Maybe));
                var best = clean.Where(x => (x.Yes, x.Maybe) == top).ToList();
                var ids = best.Select(x => x.Id).ToList();
                var all = silent == 0;
                suggestion = best.Count > 1 ? new("tie", ids, $"{string.Join(" and ", best.Select(x => x.Label))} are level with no objections.")
                    : new(all ? "clear" : "leading", ids, all ? $"{best[0].Label} has no objections and the most yes answers." : $"{best[0].Label} leads with no objections, but {silent} {(silent == 1 ? "person has" : "people have")} not answered, and that is not counted as a yes.");
            }
            else
            {
                var low = tally.Min(x => x.No);
                var pick = tally.Where(x => x.No == low).OrderByDescending(x => x.Yes).ThenByDescending(x => x.Maybe).ThenBy(x => x.Id, StringComparer.Ordinal).First();
                suggestion = new("compromise", [pick.Id], $"Every option has an objection. {pick.Label} has the fewest ({pick.No}); ask whether those people could live with it.");
            }
        }
        var half = r.CreatedAt is { } made ? (r.ClosesAt is { } close ? made + (close - made) / 2 : made + 24 * 3_600_000L) : long.MaxValue;
        var due = state == "open" && silent > 0 && nowMs >= half;
        var reminder = due ? $"Nudge: \"{r.Question!.Trim()}\" is still open and {silent} of {members.Count} have not answered yet. Please add your answer when you can." : null;
        var remains = new List<string>();
        if (silent > 0) remains.Add($"{silent} {(silent == 1 ? "person has" : "people have")} not answered.");
        if (state == "open") remains.Add("Close the poll when everyone has answered, or when the closing time passes.");
        if (suggestion.Kind is "clear" or "compromise" or "leading" or "tie" && state != "open")
            remains.Add(suggestion.Kind == "tie" ? "Break the tie." : $"Confirm the choice with the group, then book it.");
        var controls = r.Organiser == true ? new[] { "remind", "extend", "close" } : new[] { "answer" };
        return new(state, answered, silent, tally, suggestion, due, reminder, remains, controls, "No answer is not a yes. Only answers given are counted, and no reasons are kept.");
    }
}
