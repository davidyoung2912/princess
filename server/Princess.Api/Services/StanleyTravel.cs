using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley's travel-day, port and onward-travel help (docs/stanley-gap-analysis-and-plan.md, phase 10) for the signed-in guest's own trip. The flight and traffic answers come from the provider interfaces
/// (a real feed can replace the simulation with no change here); the port plan, phrases, pack, embark tour and entry sources come from authored reference data. Nothing is booked, sent or stored.
/// </summary>
public sealed class StanleyTravelService(IStanleyTrips trips, ITripStore tripStore, IFinishStore finish, IFlightStatusProvider flights, IRouteConditionsProvider routes, ITranslationProvider translator, IImageTextReader reader, PlanService plan, IClock clock)
{
    private sealed record Ctx(StanleyTrip Trip, BookingRow Booking, Timeline Timeline, string ShipId);

    private async Task<Ctx> LoadAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var trip = await trips.LoadAsync(user, sailingId, ct) ?? throw ApiException.NotFound();
        var sailing = trip.SailingId ?? throw ApiException.NotFound();
        var booking = (await tripStore.ListForUserAsync(user.Id, ct)).FirstOrDefault(b => b.Status == "confirmed" && b.SailingId == sailing) ?? throw ApiException.NotFound();
        return new(trip, booking, trip.Timeline, AboardPlans.ShipOfSailing(sailing));
    }

    private async Task<TagGroup> GroupAsync(UserRecord user, Ctx c, CancellationToken ct)
    {
        var ent = await plan.PartyEntitlementsAsync(user, c.Booking, ct);
        var priority = ent.TryGetValue(c.Booking.BookerUserId, out var e) && e.Perks.Contains("priorityDisembarkation");
        return DisembarkRules.GroupFor($"{c.Booking.Number}|{c.Booking.SailingId}", priority);
    }

    private static string Mobility(string? m) => StanleyPlannerRules.CleanMobility(m) ?? throw ApiException.Invalid("mobility");

    /// <summary>The saved onward flight rechecked against the flight status feed, with the walk-off choice the guest made.</summary>
    public async Task<TravelFlightDto> FlightAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var c = await LoadAsync(user, sailingId, ct);
        var onward = await finish.GetOnwardAsync(c.Booking.BookingId, ct);
        var plan0 = onward is null ? new OnwardPlan("", "", "", "") : new OnwardPlan(onward.Mode, onward.FlightAt, onward.Flight, onward.Note);
        var choice = await finish.GetChoiceAsync(c.Booking.BookingId, ct);
        var group = await GroupAsync(user, c, ct);
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
        return StanleyTravelRules.Phrases(c.Timeline, body.Day, body.Query, translator.Translate) ?? throw ApiException.Invalid("day");
    }

    private const int MaxImageChars = 2_800_000;

    private static bool LooksLikeImage(byte[] b, string contentType) => contentType switch
    {
        "image/jpeg" => b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF,
        "image/png" => b.Length > 4 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47,
        "image/webp" => b.Length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P',
        _ => false,
    };

    /// <summary>Reads a sign or menu from a photo the guest chose to send. Documents are refused. The photo is used for this call only: it is not stored, logged or kept.</summary>
    public async Task<TravelReadingDto> ReadAsync(UserRecord user, TravelReadRequest? body, CancellationToken ct)
    {
        if (body?.Image is not { Length: > 0 } image || image.Length > MaxImageChars || body.ContentType is null) throw ApiException.Invalid("image");
        var bytes = new byte[image.Length * 3 / 4 + 3];
        if (!Convert.TryFromBase64String(image, bytes, out var written)) throw ApiException.Invalid("image");
        bytes = bytes[..written];
        if (!LooksLikeImage(bytes, body.ContentType)) throw ApiException.Invalid("image");
        var c = await LoadAsync(user, body.SailingId, ct);
        if (body.Day < 1 || body.Day > c.Timeline.Days.Count) throw ApiException.Invalid("day");
        return StanleyTravelRules.Reading(reader.Read(bytes, body.ContentType, StanleyTravelRules.PortLanguage(c.Timeline, body.Day)));
    }

    /// <summary>Whether a train, ferry or flight at a typed time can be made from the guest's walk-off choice (or the one named) and way of getting there.</summary>
    public async Task<TravelConnectionDto> ConnectionAsync(UserRecord user, TravelConnectionRequest? body, CancellationToken ct)
    {
        if (body is null) throw ApiException.Invalid("badTravel");
        var c = await LoadAsync(user, body.SailingId, ct);
        var choice = await finish.GetChoiceAsync(c.Booking.BookingId, ct);
        var option = body.OffOption ?? (choice?.Option is { Length: > 0 } o && DisembarkRules.WalkOffIds.Contains(o) ? o : "tagged");
        var group = await GroupAsync(user, c, ct);
        return StanleyTravelRules.Connection(c.Timeline, body.Kind ?? "", body.DepartAt ?? "", body.Mode ?? "", option, group) ?? throw ApiException.Invalid("connection");
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
