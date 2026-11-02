using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>The AI concierge (multi-device plan 2, Phase 2). The model key never leaves the server.</summary>
public static class ConciergeEndpoints
{
    public static void MapConciergeEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/me/staff-requests", async (StaffRequestDto body, ICurrentUser me, IUserClock clock, IStaffQueue queue, CancellationToken ct) =>
            {
                if (!StaffRules.Valid(body, out var kind, out var reason)) throw ApiException.Invalid("badStaffRequest");
                var user = await me.LoadAsync(ct);
                return Results.Ok(await queue.EnqueueAsync(user.PublicId, kind, reason, await clock.NowAsync(user, ct), ct));
            })
            .WithTags("Concierge")
            .WithSummary("Asks guest services for a call back (reason urgent, changes, health or other), a caregiver visit or a sensory kit, and returns the guest's place in the queue and when to expect the call. 400 badStaffRequest for anything else.");

        api.MapPost("/me/concierge", async (ConciergeRequestDto body, ICurrentUser me, ConciergeService svc, CancellationToken ct) =>
                Results.Ok(await svc.AskAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Concierge")
            .WithSummary("Asks the concierge. Send the thread so far (newest last, ending with the guest's message, at most 60 messages, the guest's message at most 500 characters). Emergency, medical, legal and 'talk to a person' messages are never sent to a model: source handoff with the kind. Otherwise a model answers from the tools (source claude), or the scripted concierge does (source scripted, with fallback saying why: limit, auth, rate, network or bad). 400 badConcierge for a thread it cannot answer.");

        api.MapPost("/me/autopilot/plan", async (AutopilotPlanRequest body, AutopilotService svc, CancellationToken ct) => Results.Ok(await svc.PlanAsync(body, ct)))
            .WithTags("Concierge")
            .WithSummary("Builds one conflict-free week for a sailing from the pace (relaxed, balanced, packed), mobility, family, tour likes, event likes, the most to spend on a tour per adult (cents) and whether to avoid early starts. Answers { days[{ day, port, items[{ kind, id, title, start, why }], restDay, alternative, tourCost }], totalTours, prefs }. Nothing is booked or kept. 400 badAutopilot for unknown preferences or sailing.");

        api.MapPost("/me/day-plan", async (DayPlanRequest body, AutopilotService svc, CancellationToken ct) => Results.Ok(await svc.DayAsync(body, ct)))
            .WithTags("Concierge")
            .WithSummary("Builds one day (1 to 8) of a sailing from the guest's wishes (tour likes, event likes, mobility, children, most to spend on a tour in cents): a tour that fits the ship's day, events and dinner, with why each was chosen. Also answers the included events that could join the day and the ship's own changes today (events moved or cancelled). Nothing is booked or kept. 400 badDayPlan for an unknown wish, day or sailing.");
    }
}
