using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>What a guest wants from one day (the client's <c>DayWish</c>). <see cref="MaxTour"/> is cents per adult, or null for no limit.</summary>
public sealed record DayWishDto(IReadOnlyList<string> Tours, IReadOnlyList<string> Events, string Mobility, bool WithKids, long? MaxTour);

/// <summary>One thing in a day plan (the client's <c>PlanEntry</c> plus why it was chosen). A tour starts in port time, the rest in ship time.</summary>
public sealed record PlanEntryDto(string Id, string Title, string Start, int Minutes, string Kind, string? PlaceId, bool Outdoor, string Path, string Why);

/// <summary>A change the ship made to an event today: moved (with its new start) or cancelled.</summary>
public sealed record ShipChangeDto(string Id, string Kind, string? Start, string? Reason);

public sealed record DayPlanDto(int Day, IReadOnlyList<PlanEntryDto> Items, bool Empty, string? BackBy, IReadOnlyList<PlanEntryDto> Alternatives, IReadOnlyList<ShipChangeDto> ShipChanges);

public sealed record DayPlanRequest(string? SailingId, int Day, DayWishDto? Wish);

/// <summary>A day for someone not signed in: no sailing is named (the server chooses), only the day and the wishes.</summary>
public sealed record TrialDayRequest(int Day, DayWishDto? Wish);

public sealed record TrialDayChoice(int Day, string Port, string Place);

/// <summary>The days to choose from and the plan for the one asked for.</summary>
public sealed record TrialDayDto(IReadOnlyList<TrialDayChoice> Days, DayPlanDto Plan);

/// <summary>
/// "Build my day" (PRE-12), ported from <c>src/domain/day.ts</c> and the day parts of <c>src/domain/planChange.ts</c>. Pure: the same wishes always give the same day.
/// It reads only server data (excursions, the programme, the ship's places, the itinerary).
/// </summary>
public static class DayPlanRules
{
    public static readonly string[] Mobilities = ["any", "easy", "wheelchair"];
    public static readonly string[] TourInterests = ["water", "culture", "nature", "adventure", "relax"];
    public static readonly string[] EventInterests = ["shows", "music", "games", "wellness", "learning", "family", "nightlife"];
    private static readonly string[] Activities = ["easy", "moderate", "strenuous"];
    private static readonly HashSet<string> OutdoorPlaces = ["lido-pool", "promenade", "sea-view", "sun-bar"];

    public const string DinnerStart = "18:30";
    public const int DinnerMinutes = 90;
    public const long MaxTourCents = 99_999_900;

    public static bool Valid(DayWishDto? w) =>
        w is not null && Mobilities.Contains(w.Mobility)
        && w.Tours is { Count: <= 5 } && w.Tours.All(TourInterests.Contains)
        && w.Events is { Count: <= 7 } && w.Events.All(EventInterests.Contains)
        && (w.MaxTour is null || w.MaxTour is >= 0 and <= MaxTourCents);

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2], CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], CultureInfo.InvariantCulture);

    private static Excursion? BestTour(Timeline timeline, int day, DayWishDto w)
    {
        var d = timeline.Days[day - 1];
        if (!timeline.IsCall(d)) return null;
        var level = Array.IndexOf(Activities, w.Mobility == "any" ? "strenuous" : "easy");
        return ExcursionRules.Catalogue
            .Where(x => x.Port == d.Port
                && Array.IndexOf(Activities, x.Activity) <= level
                && (w.MaxTour is not { } cap || x.Price <= cap)
                && (!w.WithKids || x.Family)
                && (w.Mobility != "wheelchair" || x.Wheelchair)
                && ExcursionRules.TimingProblem(x, d) is null)
            .OrderByDescending(x => x.Interests.Count(w.Tours.Contains) * 10 + x.Rating)
            .ThenBy(x => x.Id, StringComparer.Ordinal)
            .FirstOrDefault();
    }

    private static string[] Ages(bool withKids) => withKids ? ["all", "kids", "teens"] : ["all", "adults"];

    /// <summary>Up to <paramref name="limit"/> events that suit the wishes, are still on, and do not crowd each other.</summary>
    private static List<DatedEvent> PickEvents(Timeline timeline, int day, DayWishDto w, int limit)
    {
        var ages = Ages(w.WithKids);
        var places = ShipReference.Get().Places.ToDictionary(p => p.Id);
        var open = ProgramRules.On(timeline, day, false)
            .Where(e => e.Status == "on" && ages.Contains(e.Age))
            .Where(e => w.Mobility == "any" || (places.TryGetValue(e.PlaceId, out var p) && p.StepFree))
            .Where(e => w.Events.Count == 0 || w.Events.Contains(e.Interest));
        var chosen = new List<DatedEvent>();
        foreach (var e in open)
        {
            if (chosen.Count >= limit) break;
            // At least an hour between starts, so the day is spread rather than packed.
            if (chosen.Count > 0 && (e.StartAt < chosen[^1].EndAt || e.StartAt - chosen[^1].StartAt < 60 * 60_000L)) continue;
            chosen.Add(e);
        }
        return chosen;
    }

    private static string Money(long cents) =>
        cents % 100 == 0 ? "$" + (cents / 100).ToString("N0", CultureInfo.InvariantCulture) : "$" + (cents / 100.0).ToString("N2", CultureInfo.InvariantCulture);

    private static PlanEntryDto FromEvent(DatedEvent e, string why) => new(e.Id, e.Title, e.Start, e.Minutes, "event", e.PlaceId, OutdoorPlaces.Contains(e.PlaceId), "/plan", why);

    /// <summary>The day as entries: a tour that fits the ship's day, up to three events on a sea day or one on a port day, and dinner on the first seven days. In time order.</summary>
    public static (List<PlanEntryDto> Items, string? BackBy) Build(Timeline timeline, int day, DayWishDto w)
    {
        var d = timeline.Days[day - 1];
        var items = new List<PlanEntryDto>();
        var tour = BestTour(timeline, day, w);
        if (tour is not null)
            items.Add(new(tour.Id, tour.Name, tour.Start, (int)Pricing.JsRound(tour.Hours * 60), "tour", null, true, "/plan/excursions",
                tour.Interests.Any(w.Tours.Contains) ? "matches what you like" : "the best rated that fits the ship’s day"));
        foreach (var e in PickEvents(timeline, day, w, d.Port == "sea" ? 3 : 1))
            items.Add(FromEvent(e, e.Extra > 0 ? $"extra cost {Money(e.Extra)} each" : "included in your fare"));
        if (day <= 7)
            items.Add(new("eclipse", "Dinner in the Eclipse Dining Room", DinnerStart, DinnerMinutes, "dinner", null, false, "/plan/dining", w.Mobility == "any" ? "main dining room, included" : "main dining room, level access"));
        return ([.. items.OrderBy(i => Minutes(i.Start)).ThenBy(i => i.Id, StringComparer.Ordinal)], tour is null ? null : ExcursionRules.BackBy(tour, d));
    }

    /// <summary>The day plus what is around it: other included events that could join it, and the ship's own changes today.</summary>
    public static DayPlanDto Plan(Timeline timeline, int day, DayWishDto w, IReadOnlyList<PlanChange> shipFeed)
    {
        var (items, backBy) = Build(timeline, day, w);
        var today = ProgramRules.On(timeline, day, true, shipFeed);
        var ages = Ages(w.WithKids);
        var alternatives = today.Where(e => e.Status == "on" && ages.Contains(e.Age) && e.Extra == 0).Select(e => FromEvent(e, "included in your fare")).ToList();
        var changes = today.Where(e => e.Status is "moved" or "cancelled").Select(e => new ShipChangeDto(e.Id, e.Status, e.Status == "moved" ? e.Start : null, e.Reason)).ToList();
        return new(day, items, !items.Any(i => i.Kind != "dinner"), backBy, alternatives, changes);
    }
}
