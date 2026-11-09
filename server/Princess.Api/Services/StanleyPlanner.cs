using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley's planner and sea-time intelligence (docs/stanley-gap-analysis-and-plan.md, phase 9) for the signed-in guest's own trip. It reads the guest's booked tours and dinner tables and the sailing's days,
/// and hands them to <see cref="StanleyPlannerRules"/>; nothing is booked, moved or paid here, and nothing is stored. The group status needs no sign-in and keeps nothing.
/// </summary>
public sealed class StanleyPlannerService(IStanleyTrips trips, ITripStore tripStore, IPlanStore plan, IProgramChanges programChanges, IUserClock clock, IClock serverClock)
{
    private sealed record Ctx(StanleyTrip Trip, Timeline Timeline, string ShipId, string SailingId, bool Kids, List<PlannerReserved> Reserved);

    private async Task<Ctx> LoadAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var trip = await trips.LoadAsync(user, sailingId, ct) ?? throw ApiException.NotFound();
        var sailing = trip.SailingId ?? throw ApiException.NotFound();
        var booking = (await tripStore.ListForUserAsync(user.Id, ct)).FirstOrDefault(b => b.Status == "confirmed" && b.SailingId == sailing) ?? throw ApiException.NotFound();
        var ship = AboardPlans.ShipOfSailing(sailing);
        var places = AboardPlans.For(ship)?.Places.Select(p => p.Id).ToHashSet() ?? [];
        var reserved = new List<PlannerReserved>();
        foreach (var x in await plan.ListToursAsync(booking.BookingId, ct))
            if (x.Status == "booked" && ExcursionRules.ById(x.ExcursionId) is { } e)
                reserved.Add(new(x.Day, e.Id, e.Name, "tour", e.Start, (int)Pricing.JsRound(e.Hours * 60), null));
        foreach (var x in await plan.ListTablesAsync(booking.BookingId, ct))
        {
            var venue = DiningRules.VenueById(x.VenueId);
            reserved.Add(new(x.Day, x.VenueId, venue?.Name ?? "Dinner", "dinner", x.Time, DayPlanRules.DinnerMinutes, places.Contains(x.VenueId) ? x.VenueId : null));
        }
        return new(trip, trip.Timeline, ship, sailing, trip.Ages.Any(a => a < ExcursionRules.AdultAge), reserved);
    }

    private static string Mobility(string? m) => StanleyPlannerRules.CleanMobility(m) ?? throw ApiException.Invalid("mobility");

    private static void CheckDay(Ctx c, int day)
    {
        if (day < 1 || day > c.Timeline.Days.Count) throw ApiException.Invalid("day");
    }

    private static string Scenario(string? s) => s is null ? "mixed" : StanleyPlannerRules.Scenarios.Contains(s) ? s : throw ApiException.Invalid("scenario");

    public async Task<PlannerDayDto> ShapeAsync(UserRecord user, PlannerShapeRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badPlanner");
        if (!StanleyPlannerRules.ValidTraveller(body.Traveller)) throw ApiException.Invalid("traveller");
        var mobility = Mobility(body.Mobility);
        var scenario = Scenario(body.Scenario);
        var c = await LoadAsync(user, body.SailingId, ct);
        CheckDay(c, body.Day);
        return StanleyPlannerRules.Shape(c.Timeline, body.Day, scenario, mobility, c.Kids, c.Reserved, programChanges.Current(), c.ShipId, c.SailingId, body.Traveller);
    }

    public async Task<PlannerHourDto> HourAsync(UserRecord user, PlannerHourRequest? body, CancellationToken ct)
    {
        if (body is null || !StanleyPlannerRules.ValidTime(body.From)) throw ApiException.Invalid("badPlanner");
        var mobility = Mobility(body.Mobility);
        var c = await LoadAsync(user, body.SailingId, ct);
        CheckDay(c, body.Day);
        var feed = programChanges.Current();
        var shaped = StanleyPlannerRules.Shape(c.Timeline, body.Day, "mixed", mobility, c.Kids, c.Reserved, feed, c.ShipId, c.SailingId);
        // What the guest already holds blocks the hour; Stanley's own suggestions do not.
        var held = shaped.Segments.Where(s => s.Source == "reserved").ToList();
        return StanleyPlannerRules.Hour(c.Timeline, body.Day, body.From!, body.PlaceId, held, mobility, c.Kids, feed, c.ShipId);
    }

    public async Task<PlannerEveningDto> EveningAsync(UserRecord user, PlannerEveningRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badPlanner");
        var mobility = Mobility(body.Mobility);
        var c = await LoadAsync(user, body.SailingId, ct);
        CheckDay(c, body.Day);
        var dinner = c.Reserved.Where(r => r.Day == body.Day && r.Kind == "dinner").OrderBy(r => r.Start, StringComparer.Ordinal).FirstOrDefault();
        return StanleyPlannerRules.Evening(c.Timeline, body.Day, mobility, c.Kids, dinner, programChanges.Current(), c.ShipId);
    }

    public async Task<PlannerPreviewDto> PreviewAsync(UserRecord user, PlannerPreviewRequest? body, CancellationToken ct)
    {
        if (body is null || ExcursionRules.ById(body.ExcursionId) is not { } x) throw ApiException.Invalid("excursion");
        var mobility = Mobility(body.Mobility);
        var scenario = Scenario(body.Scenario);
        var c = await LoadAsync(user, body.SailingId, ct);
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        return StanleyPlannerRules.Preview(c.Timeline, c.SailingId, x, scenario, mobility, c.Kids, c.Reserved, programChanges.Current(), c.ShipId, c.Trip.Ages, today) ?? throw ApiException.Invalid("excursion");
    }

    public async Task<MeetingDto> MeetingAsync(UserRecord user, PlannerMeetingRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badPlanner");
        var c = await LoadAsync(user, body.SailingId, ct);
        string? allAboard = null;
        if (body.Day is { } day)
        {
            CheckDay(c, day);
            var d = c.Timeline.Days[day - 1];
            if (c.Timeline.IsCall(d) && d.AllAboard is { } a) allAboard = a.ToString("HH:mm");
        }
        return StanleyPlannerRules.Meeting(body.PlaceId, body.Time, body.Note, c.ShipId, allAboard) ?? throw ApiException.Invalid("meeting");
    }

    public async Task<TourCompareDto> CompareAsync(UserRecord user, PlannerCompareRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("excursion");
        var c = await LoadAsync(user, body.SailingId, ct);
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        return StanleyPlannerRules.CompareTours(c.Timeline, c.SailingId, body.A, body.B, c.Trip.Ages, today) ?? throw ApiException.Invalid("excursion");
    }

    public GroupStatusDto GroupStatus(GroupStatusRequest? body)
    {
        if (StanleyPlannerRules.GroupProblem(body) is { } problem) throw ApiException.Invalid(problem);
        return StanleyPlannerRules.GroupStatus(body!, TripRules.ToMs(serverClock.UtcNow));
    }
}
