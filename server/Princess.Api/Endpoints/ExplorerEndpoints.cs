using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>The six Explorer pages (docs/explorer-harmony-plan.md). Any guest on the booking reads; the plan toggle is <c>PUT /bookings/{number}/onboard/plan/{eventId}</c>.</summary>
public static class ExplorerEndpoints
{
    public static void MapExplorerEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/onboard/tours", async (string number, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.ToursAsync(await me.LoadAsync(ct), number, day, ct)))
            .WithTags("Explorers")
            .WithSummary("The shore excursions the caller has booked on cruise day `day`, with ship-time start and end, for the Today's Plan timeline. 400 day.");

        api.MapGet("/me/sample-trip", async (ICurrentUser me, SampleTripService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Explorers").WithSummary("The sample itineraries (one sailing each of Sun, Sky and Sapphire Princess) a guest with no booking can use for the Explorers, the one in use, and whether the sample is active (it is not once the guest has a current booking).");

        api.MapPut("/me/sample-trip", async (SampleTripRequest body, ICurrentUser me, SampleTripService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChooseAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Explorers").WithSummary("Chooses the sample itinerary by sailing id. 400 sailing when it is not one of the options.");

        // The same Explorer reads as for a booking, with the sample in place of the booking number (404 once the guest has a trip).
        api.MapGet("/me/sample-trip/onboard/explorer/{kind}", async (string kind, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.DayAsync(await me.LoadAsync(ct), SampleTripService.Number, kind, day, ct)))
            .WithTags("Explorers").WithSummary("One Explorer on cruise day `day` of the guest's sample itinerary, for a guest with no booking. 404 explorer, or when the guest has a trip; 400 day.");

        api.MapGet("/me/sample-trip/onboard/explorer/{kind}/{venueId}", async (string kind, string venueId, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.VenueAsync(await me.LoadAsync(ct), SampleTripService.Number, kind, venueId, day, ct)))
            .WithTags("Explorers").WithSummary("One venue on cruise day `day` of the guest's sample itinerary. 404 explorer or venue, or when the guest has a trip; 400 day.");

        api.MapGet("/me/sample-trip/onboard/tours", async (int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.ToursAsync(await me.LoadAsync(ct), SampleTripService.Number, day, ct)))
            .WithTags("Explorers").WithSummary("Always empty for a sample itinerary (there are no booked excursions). 400 day.");

        var g = api.MapGroup("/bookings/{number}/onboard/explorer").WithTags("Explorers");

        g.MapGet("/{kind}", async (string number, string kind, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.DayAsync(await me.LoadAsync(ct), number, kind, day, ct)))
            .WithSummary("Every venue of one Explorer (dining, entertainment, shopping, spa, exercise or activities) on the guest's ship, each with its hours and events for cruise day `day`, and the events the caller has planned that day. 404 explorer; 400 day.");

        g.MapGet("/{kind}/{venueId}", async (string number, string kind, string venueId, int day, ICurrentUser me, ExplorerService svc, CancellationToken ct) =>
                Results.Ok(await svc.VenueAsync(await me.LoadAsync(ct), number, kind, venueId, day, ct)))
            .WithSummary("One venue with its hours, all its events and its menus for cruise day `day`. 404 explorer or venue; 400 day.");
    }
}
