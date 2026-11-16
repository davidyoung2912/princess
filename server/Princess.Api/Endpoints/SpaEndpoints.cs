using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Spa and salon appointments (Spa Explorer, docs/explorer-harmony-plan.md phase 3). Any guest on the booking reads; an adult guest writes.</summary>
public static class SpaEndpoints
{
    public static void MapSpaEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/bookings/{number}/plan/spa").WithTags("Plan: spa");
        g.MapGet("", async (string number, ICurrentUser me, SpaService svc, CancellationToken ct) =>
                Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The ship's treatments, the appointments booked, the party and the cancellation policy.");
        g.MapGet("/slots", async (string number, string? treatment, int? day, Guid? except, ICurrentUser me, SpaService svc, CancellationToken ct) =>
                Results.Ok(await svc.SlotsAsync(await me.LoadAsync(ct), number, treatment, day ?? 0, except, ct)))
            .WithSummary("The start times of a treatment on a day, with the rooms left. `except` is an appointment being moved. 400 treatment or day.");
        g.MapPost("/appointments", async (string number, SpaReserveRequest body, ICurrentUser me, SpaService svc, CancellationToken ct) =>
                Results.Ok(await svc.ReserveAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Books a treatment. 409 closed, full, clash, tour or age; 400 for a bad treatment, day, time, party or guest.");
        g.MapPost("/appointments/{id:guid}/move", async (string number, Guid id, SpaMoveRequest body, ICurrentUser me, SpaService svc, CancellationToken ct) =>
                Results.Ok(await svc.MoveAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Moves an appointment to another day or time. Any failure leaves it as it was. 409 unchanged, closed, full, clash or tour.");
        g.MapPut("/appointments/{id:guid}", async (string number, Guid id, SpaUpdateRequest body, ICurrentUser me, SpaService svc, CancellationToken ct) =>
                Results.Ok(await svc.UpdateAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Changes who is in an appointment and the note to the therapist.");
        g.MapDelete("/appointments/{id:guid}", async (string number, Guid id, ICurrentUser me, SpaService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels an appointment. Free until 24 hours before; after that half the price is kept.");
    }
}
