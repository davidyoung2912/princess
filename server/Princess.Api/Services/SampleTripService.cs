using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Until a guest has booked, the Explorers need some trip to describe, so the guest picks one sample itinerary: the next sailing of Sun Princess, Sky Princess or Sapphire Princess.
/// Nothing is kept about it but the choice; once they have a current booking the sample is no longer offered or used.
/// </summary>
public sealed class SampleTripService(ITripStore trips, IUserStore users, IUserClock clock)
{
    /// <summary>The stand-in for a booking number in a sample-trip route; no real booking number looks like it.</summary>
    public const string Number = "sample-trip";

    private static readonly string[] Ships = [ShipDining.SunId, "sky-princess", "sapphire-princess"];

    /// <summary>Whether the guest has a current trip (the same test the account context uses).</summary>
    public async Task<bool> HasTripAsync(UserRecord actor, DateOnly today, CancellationToken ct) =>
        (await trips.ListForUserAsync(actor.Id, ct)).Any(b => b.Status == "confirmed" && b.Kind != "agent" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today);

    /// <summary>One sailing per ship: the next to depart, or the latest when none is ahead.</summary>
    public async Task<List<SailingRow>> OptionsAsync(DateOnly today, CancellationToken ct)
    {
        var all = await trips.ListSailingsAsync(ct);
        var list = new List<SailingRow>();
        foreach (var ship in Ships)
        {
            var mine = all.Where(s => s.ShipId == ship).OrderBy(s => s.Departure).ToList();
            var pick = mine.FirstOrDefault(s => DateOnly.FromDateTime(s.Departure) >= today) ?? mine.LastOrDefault();
            if (pick is not null) list.Add(pick);
        }
        return list;
    }

    /// <summary>The sailing the guest's sample is on: their choice if it is still one of the options, else the first ship's. Null only when no sailing exists.</summary>
    public async Task<SailingRow?> ChosenAsync(UserRecord actor, CancellationToken ct)
    {
        var today = TripRules.Today(await clock.NowAsync(actor, ct));
        var options = await OptionsAsync(today, ct);
        return options.FirstOrDefault(s => s.Id == actor.SampleSailingId) ?? options.FirstOrDefault();
    }

    public async Task<SampleTripDto> GetAsync(UserRecord actor, CancellationToken ct)
    {
        var today = TripRules.Today(await clock.NowAsync(actor, ct));
        var options = await OptionsAsync(today, ct);
        var chosen = options.FirstOrDefault(s => s.Id == actor.SampleSailingId) ?? options.FirstOrDefault();
        return new(!await HasTripAsync(actor, today, ct), chosen?.Id ?? "",
            [.. options.Select(s => new SampleOptionDto(s.Id, s.ShipId, StanleyPersonaRules.ShipNameFromId(s.ShipId) ?? s.ShipId, DateOnly.FromDateTime(s.Departure).ToString("yyyy-MM-dd"), s.Nights))]);
    }

    public async Task<SampleTripDto> ChooseAsync(UserRecord actor, SampleTripRequest? body, CancellationToken ct)
    {
        var today = TripRules.Today(await clock.NowAsync(actor, ct));
        var option = (await OptionsAsync(today, ct)).FirstOrDefault(s => s.Id == body?.SailingId) ?? throw ApiException.Invalid("sailing");
        await users.SetSampleSailingAsync(actor.Id, option.Id, ct);
        actor.SampleSailingId = option.Id;
        return await GetAsync(actor, ct);
    }
}
