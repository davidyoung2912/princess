using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Multi-device account state (docs/multi-device-plan.md, data model section 6.8).</summary>
public static class StateEndpoints
{
    public static void MapStateEndpoints(this IEndpointRouteBuilder api)
    {
        var mine = api.MapGroup("/me/state").WithTags("State");
        mine.MapGet("", async (ICurrentUser me, StateService svc, CancellationToken ct) =>
                Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), false, null, ct)))
            .WithSummary("Every document you have saved, with its version, so a new device can load in one call.");
        mine.MapGet("/{key}", async (string key, ICurrentUser me, StateService svc, CancellationToken ct) =>
                await svc.GetAsync(await me.LoadAsync(ct), false, null, key, ct) is { } d ? Results.Ok(d) : Results.Text("null", "application/json"))
            .WithSummary("One document, or null when nothing is saved. 400 for a key that is not allowed.");
        mine.MapPut("/{key}", async (string key, SaveStateRequest body, ICurrentUser me, StateService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveAsync(await me.LoadAsync(ct), false, null, key, body, ct)))
            .WithSummary("Saves a document based on the version the device last saw. 409 stale when another device saved first, 400 for a bad key, a non-object or too large a body.");
        mine.MapDelete("/{key}", async (string key, ICurrentUser me, StateService svc, CancellationToken ct) =>
            {
                await svc.DeleteAsync(await me.LoadAsync(ct), false, null, key, ct);
                return Results.NoContent();
            })
            .WithSummary("Deletes a document.");

        mine.MapDelete("", async (ICurrentUser me, StateService svc, CancellationToken ct) =>
            {
                await svc.DeleteAllAsync(await me.LoadAsync(ct), ct);
                return Results.NoContent();
            })
            .WithSummary("Deletes every document you have saved (privacy: delete my data). Booking documents shared with other guests are not touched.");
        api.MapGet("/me/export", async (ICurrentUser me, StateService svc, CancellationToken ct) =>
                Results.Ok(await svc.ExportAsync(await me.LoadAsync(ct), ct)))
            .WithTags("State").WithSummary("Privacy export of account state: your documents and the documents of each booking you are on.");

        var booking = api.MapGroup("/bookings/{number}/state").WithTags("State");
        booking.MapGet("", async (string number, ICurrentUser me, StateService svc, CancellationToken ct) =>
                Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), true, number, ct)))
            .WithSummary("Every document kept for the booking (any guest on it).");
        booking.MapGet("/{key}", async (string number, string key, ICurrentUser me, StateService svc, CancellationToken ct) =>
                await svc.GetAsync(await me.LoadAsync(ct), true, number, key, ct) is { } d ? Results.Ok(d) : Results.Text("null", "application/json"))
            .WithSummary("One booking document, or null when nothing is saved.");
        booking.MapPut("/{key}", async (string number, string key, SaveStateRequest body, ICurrentUser me, StateService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveAsync(await me.LoadAsync(ct), true, number, key, body, ct)))
            .WithSummary("Saves a booking document (adult guests). 409 stale when another device saved first.");
        booking.MapDelete("/{key}", async (string number, string key, ICurrentUser me, StateService svc, CancellationToken ct) =>
            {
                await svc.DeleteAsync(await me.LoadAsync(ct), true, number, key, ct);
                return Results.NoContent();
            })
            .WithSummary("Deletes a booking document (adult guests).");
    }
}
