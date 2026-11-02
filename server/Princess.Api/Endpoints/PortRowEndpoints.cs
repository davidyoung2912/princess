using Princess.Api.Auth;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>The port day's presence, plan, meeting places and split ledger as rows (multi-device plan 2, Phase 6).</summary>
public static class PortRowEndpoints
{
    public static void MapPortRowEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/port-rows", async (string number, ICurrentUser me, PortRowService svc, CancellationToken ct) =>
                Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Port day")
            .WithSummary("Every row of the booking's port-day record, deleted rows included (any guest on the booking).");

        api.MapPost("/bookings/{number}/port-rows", async (string number, PortRowsRequest body, ICurrentUser me, PortRowService svc, CancellationToken ct) =>
                Results.Ok(await svc.ApplyAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithTags("Port day")
            .WithSummary("Changes rows: 1 to 100 of { kind, key, data, at, deleted }. The later at wins each row and a delete is a row that stays. Returns every row. 400 badPortRow or tooManyOps, 409 tooManyRows, 403 supervised for a child.");
    }
}
