using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The week optimiser (multi-device plan 3, Phase 4). It reads only server data (the excursion catalogue, the programme, the ship's places, the itinerary)
/// and the preferences in the request, so it keeps nothing and books nothing. The sailing must be one the server knows.
/// </summary>
public sealed class AutopilotService(ICurrentUser me, ITripStore trips, IProgramChanges programChanges, IClock clock)
{
    private async Task<DateOnly> DepartureAsync(string? sailingId, string problem, CancellationToken ct)
    {
        await me.LoadAsync(ct);
        if (string.IsNullOrWhiteSpace(sailingId)) throw ApiException.Invalid(problem);
        var sailing = (await trips.ListSailingsAsync(ct)).FirstOrDefault(s => s.Id == sailingId) ?? throw ApiException.Invalid(problem);
        return DateOnly.FromDateTime(sailing.Departure);
    }

    public async Task<WeekDto> PlanAsync(AutopilotPlanRequest? body, CancellationToken ct)
    {
        if (body is null || !AutopilotRules.Valid(body.Prefs)) throw ApiException.Invalid("badAutopilot");
        return AutopilotRules.OptimiseWeek(await DepartureAsync(body.SailingId, "badAutopilot", ct), body.Prefs!);
    }

    /// <summary>One day: the plan for the guest's wishes, what could join it, and the ship's own changes today.</summary>
    public async Task<DayPlanDto> DayAsync(DayPlanRequest? body, CancellationToken ct)
    {
        if (body is null || body.Day is < 1 or > 8 || !DayPlanRules.Valid(body.Wish)) throw ApiException.Invalid("badDayPlan");
        return DayPlanRules.Plan(await DepartureAsync(body.SailingId, "badDayPlan", ct), body.Day, body.Wish!, programChanges.Current());
    }

    /// <summary>
    /// "A day on this ship" for someone who has not signed in (N6.1): the same day the signed-in screen builds, from the wishes in the request alone. A visitor's device holds no
    /// sailings yet (those need a sign-in), so the server picks the sailing, the next one to leave (else the last), and answers the days to choose from as well. It reads only
    /// ship-level data (the catalogue, the programme, the itinerary), keeps nothing and ties nothing to a person.
    /// </summary>
    public async Task<TrialDayDto> TrialDayAsync(TrialDayRequest? body, CancellationToken ct)
    {
        if (body is null || body.Day is < 1 or > 8 || !DayPlanRules.Valid(body.Wish)) throw ApiException.Invalid("badDayPlan");
        var sailings = (await trips.ListSailingsAsync(ct)).OrderBy(s => s.Departure).ToList();
        var today = clock.UtcNow;
        var sailing = sailings.FirstOrDefault(s => s.Departure >= today.Date) ?? sailings.LastOrDefault() ?? throw ApiException.Invalid("badDayPlan");
        var departure = DateOnly.FromDateTime(sailing.Departure);
        var days = Itinerary.Days(departure).Select(d => new TrialDayChoice(d.Day, d.Port, d.Port == "sea" ? "At sea" : Itinerary.Ports[d.Port].Name)).ToList();
        return new TrialDayDto(days, DayPlanRules.Plan(departure, body.Day, body.Wish!, programChanges.Current()));
    }
}
