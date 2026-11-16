using Princess.Api.Auth;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>The six Explorer pages (docs/explorer-harmony-plan.md). Any guest on the booking reads; the plan toggle is <c>PUT /bookings/{number}/onboard/plan/{eventId}</c>.</summary>
public static class ExplorerEndpoints
{
    public static void MapExplorerEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/bookings/{number}/onboard/explorer").WithTags("Explorers");

        g.MapGet("/{kind}", async (string number, string kind, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.DayAsync(await me.LoadAsync(ct), number, kind, day, ct)))
            .WithSummary("Every venue of one Explorer (dining, entertainment, shopping, spa, exercise or activities) on the guest's ship, each with its hours and events for cruise day `day`, and the events the caller has planned that day. 404 explorer; 400 day.");

        g.MapGet("/{kind}/{venueId}", async (string number, string kind, string venueId, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.VenueAsync(await me.LoadAsync(ct), number, kind, venueId, day, ct)))
            .WithSummary("One venue with its hours, all its events and its menus for cruise day `day`. 404 explorer or venue; 400 day.");
    }
}
