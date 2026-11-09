using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Guest services requests, the autopilot and the day plan. The AI concierge is gone: Stanley is the only conversational surface (<see cref="StanleyEndpoints"/>).</summary>
public static class ConciergeEndpoints
{
    public static void MapConciergeEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/me/staff-requests", async (StaffRequestDto body, ICurrentUser me, IUserClock clock, IStaffQueue queue, IStaffTicketStore tickets, CancellationToken ct) =>
            {
                if (!StaffRules.Valid(body, out var kind, out var reason)) throw ApiException.Invalid("badStaffRequest");
                var user = await me.LoadAsync(ct);
                var ticket = await queue.EnqueueAsync(user.PublicId, kind, reason, await clock.NowAsync(user, ct), ct);
                await tickets.AddAsync(user.Id, ticket, ct);
                return Results.Ok(ticket);
            })
            .WithTags("Concierge")
            .WithSummary("Asks guest services for a call back (reason urgent, changes, health or other), a caregiver visit or a sensory kit, keeps the ticket, and returns the guest's place in the queue and when to expect the call. 400 badStaffRequest for anything else.");

        api.MapGet("/me/staff-requests", async (ICurrentUser me, IUserClock clock, IStaffTicketStore tickets, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                var now = new DateTimeOffset(DateTime.SpecifyKind(await clock.NowAsync(user, ct), DateTimeKind.Utc)).ToUnixTimeMilliseconds();
                var list = await tickets.ListAsync(user.Id, now - StaffRules.LifetimeMs, ct);
                return Results.Ok(list.Select(t => StaffRules.Status(t, now)).ToList());
            })
            .WithTags("Concierge")
            .WithSummary("The caller's guest services requests from the last two hours, newest first, each with its status (waiting, due or lapsed) and the places still ahead.");

        api.MapDelete("/me/staff-requests/{id:guid}", async (Guid id, ICurrentUser me, IUserClock clock, IStaffTicketStore tickets, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                return await tickets.CancelAsync(user.Id, id, await clock.NowAsync(user, ct), ct) ? Results.NoContent() : throw ApiException.NotFound();
            })
            .WithTags("Concierge")
            .WithSummary("Cancels one of the caller's guest services requests. 404 when it is not theirs.");

        api.MapPost("/me/autopilot/plan", async (AutopilotPlanRequest body, AutopilotService svc, CancellationToken ct) => Results.Ok(await svc.PlanAsync(body, ct)))
            .WithTags("Concierge")
            .WithSummary("Builds one conflict-free week for a sailing from the pace (relaxed, balanced, packed), mobility, family, tour likes, event likes, the most to spend on a tour per adult (cents) and whether to avoid early starts. Answers { days[{ day, port, items[{ kind, id, title, start, why }], restDay, alternative, tourCost }], totalTours, prefs }. Nothing is booked or kept. 400 badAutopilot for unknown preferences or sailing.");

        api.MapPost("/me/day-plan", async (DayPlanRequest body, AutopilotService svc, CancellationToken ct) => Results.Ok(await svc.DayAsync(body, ct)))
            .WithTags("Concierge")
            .WithSummary("Builds one day (1 to 8) of a sailing from the guest's wishes (tour likes, event likes, mobility, children, most to spend on a tour in cents): a tour that fits the ship's day, events and dinner, with why each was chosen. Also answers the included events that could join the day and the ship's own changes today (events moved or cancelled). Nothing is booked or kept. 400 badDayPlan for an unknown wish, day or sailing.");

        api.MapPost("/public/trial-day", async (TrialDayRequest body, AutopilotService svc, CancellationToken ct) => Results.Ok(await svc.TrialDayAsync(body, ct)))
            .AllowAnonymous().RequireRateLimiting(CheckinEndpoints.LookupLimiter).WithTags("Concierge")
            .WithSummary("A day on this ship for someone who has not signed in. Takes { day (1 to 8), wish } as /me/day-plan does, but no sailing: the server uses the next one to leave. Answers { days[{ day, port, place }], plan } with plan in the /me/day-plan shape. Ship-level data only; nothing is kept and nothing is tied to a person. Rate-limited by address. 400 badDayPlan.");
    }
}
