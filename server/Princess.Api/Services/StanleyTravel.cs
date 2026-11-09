using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley's travel-day, port and onward-travel help (docs/stanley-gap-analysis-and-plan.md, phase 10) for the signed-in guest's own trip. The flight and traffic answers come from the provider interfaces
/// (a real feed can replace the simulation with no change here); the port plan, phrases, pack, embark tour and entry sources come from authored reference data. Nothing is booked, sent or stored.
/// </summary>
public sealed class StanleyTravelService(IStanleyTrips trips, ITripStore tripStore, IFinishStore finish, IFlightStatusProvider flights, IRouteConditionsProvider routes, PlanService plan, IClock clock)
{
    private sealed record Ctx(StanleyTrip Trip, BookingRow Booking, Timeline Timeline, string ShipId);

    private async Task<Ctx> LoadAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var trip = await trips.LoadAsync(user, sailingId, ct) ?? throw ApiException.NotFound();
        var sailing = trip.SailingId ?? throw ApiException.NotFound();
        var booking = (await tripStore.ListForUserAsync(user.Id, ct)).FirstOrDefault(b => b.Status == "confirmed" && b.SailingId == sailing) ?? throw ApiException.NotFound();
        return new(trip, booking, trip.Timeline, AboardPlans.ShipOfSailing(sailing));
    }

    private static string Mobility(string? m) => StanleyPlannerRules.CleanMobility(m) ?? throw ApiException.Invalid("mobility");

    /// <summary>The saved onward flight rechecked against the flight status feed, with the walk-off choice the guest made.</summary>
    public async Task<TravelFlightDto> FlightAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var c = await LoadAsync(user, sailingId, ct);
        var onward = await finish.GetOnwardAsync(c.Booking.BookingId, ct);
        var plan0 = onward is null ? new OnwardPlan("", "", "", "") : new OnwardPlan(onward.Mode, onward.FlightAt, onward.Flight, onward.Note);
        var choice = await finish.GetChoiceAsync(c.Booking.BookingId, ct);
        var ent = await plan.PartyEntitlementsAsync(user, c.Booking, ct);
        var priority = ent.TryGetValue(c.Booking.BookerUserId, out var e) && e.Perks.Contains("priorityDisembarkation");
        var group = DisembarkRules.GroupFor($"{c.Booking.Number}|{c.Booking.SailingId}", priority);
        FlightStatusDto? status = null;
        var number = FeedRules.NormalizeFlight(plan0.Flight);
        if (FeedRules.ValidFlightNumber(number))
        {
            try { status = flights.Status(number, c.Timeline.LastDay.ToString("yyyy-MM-dd")); }
            catch (Exception ex) when (ex is not OperationCanceledException) { status = null; }
        }
        var option = choice?.Option is { Length: > 0 } o && DisembarkRules.WalkOffIds.Contains(o) ? o : "tagged";
        return StanleyTravelRules.Flight(c.Timeline, plan0, option, group, status, clock.UtcNow);
    }

    /// <summary>Traffic and sky on the way to the port on the sailing date, for how busy the guest's arrival window is.</summary>
    public async Task<TravelTrafficDto> TrafficAsync(UserRecord user, TravelTrafficRequest? body, CancellationToken ct)
    {
        if (body is null || body.Crowd is null || !FeedRules.ValidCrowd(body.Crowd)) throw ApiException.Invalid("crowd");
        var c = await LoadAsync(user, body.SailingId, ct);
        return StanleyTravelRules.Traffic(routes.Conditions(c.Timeline.Departure.ToString("yyyy-MM-dd"), body.Crowd), clock.UtcNow);
    }

    public async Task<TravelPortDto> PortAsync(UserRecord user, TravelPortRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badTravel");
        var interests = body.Interests ?? [];
        if (interests.Count > 8 || interests.Any(i => !StanleyTravelRules.ValidInterest(i))) throw ApiException.Invalid("interests");
        var mode = body.Mode ?? "walk";
        if (!StanleyTravelRules.Modes.Contains(mode)) throw ApiException.Invalid("mode");
        var distance = body.Distance ?? "any";
        if (distance is not ("near" or "any")) throw ApiException.Invalid("distance");
        var mobility = Mobility(body.Mobility);
        var c = await LoadAsync(user, body.SailingId, ct);
        return StanleyTravelRules.PortPlan(c.Timeline, body.Day, interests, mode, body.Minutes ?? 240, distance == "near", mobility) ?? throw ApiException.Invalid("day");
    }

    public async Task<TravelPhrasesDto> PhrasesAsync(UserRecord user, TravelPhraseRequest? body, CancellationToken ct)
    {
        if (body is null || body.Query is { Length: > 200 }) throw ApiException.Invalid("badTravel");
        var c = await LoadAsync(user, body.SailingId, ct);
        return StanleyTravelRules.Phrases(c.Timeline, body.Day, body.Query) ?? throw ApiException.Invalid("day");
    }

    public async Task<TravelPortPackDto> PackAsync(UserRecord user, TravelPackRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badTravel");
        var c = await LoadAsync(user, body.SailingId, ct);
        return StanleyTravelRules.PortPack(c.Timeline, body.Day) ?? throw ApiException.Invalid("day");
    }

    public async Task<TravelEmbarkDto> EmbarkAsync(UserRecord user, TravelEmbarkRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badTravel");
        var goals = body.Goals ?? [];
        if (goals.Count > 5 || goals.Any(g => !StanleyTravelRules.Goals.Contains(g))) throw ApiException.Invalid("goals");
        var mobility = Mobility(body.Mobility);
        var c = await LoadAsync(user, body.SailingId, ct);
        return StanleyTravelRules.Embark(c.ShipId, goals, mobility) ?? throw ApiException.NotFound();
    }

    public async Task<TravelEntryDto> EntryAsync(UserRecord user, string? sailingId, CancellationToken ct) =>
        StanleyTravelRules.Entry((await LoadAsync(user, sailingId, ct)).Timeline);
}
