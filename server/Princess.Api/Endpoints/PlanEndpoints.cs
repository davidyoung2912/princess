using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 8: the pre-cruise plan (data model section 6.3). Everything hangs off the booking number; any guest on it may read, an adult guest may write.</summary>
public static class PlanEndpoints
{
    public static void MapPlanEndpoints(this IEndpointRouteBuilder api)
    {
        var plan = api.MapGroup("/bookings/{number}");

        plan.MapGet("/plan", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.OverviewAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Plan").WithSummary("Everything booked and not yet booked, day by day.");

        MapExcursions(plan);
        MapDining(plan);
        MapPackages(plan);
        MapLists(plan);
        MapAssistance(plan);
    }

    private static void MapExcursions(RouteGroupBuilder plan)
    {
        var g = plan.MapGroup("/excursions").WithTags("Plan: excursions");
        g.MapGet("", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.ExcursionsAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Every tour with places left, the cart, booked tours and the excursion credit.");
        g.MapPut("/cart/{excursionId}", async (string number, string excursionId, CartRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.AddToCartAsync(await me.LoadAsync(ct), number, excursionId, body, ct)))
            .WithSummary("Puts a tour in the cart for some guests. 409 closed, age, timing, soldOut, duplicate or overlap; 400 for an unknown tour or guest.");
        g.MapDelete("/cart/{excursionId}", async (string number, string excursionId, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.RemoveFromCartAsync(await me.LoadAsync(ct), number, excursionId, ct)))
            .WithSummary("Takes a tour out of the cart.");
        g.MapPost("/checkout", async (string number, CheckoutRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.CheckoutAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Books everything in the cart. The excursion credit is used first; the rest is paid as `parts`. 400 payment or card, 402 challenge or declined.");
        g.MapPut("/bookings/{id:guid}", async (string number, Guid id, ChangeGuestsRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChangeTourGuestsAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Changes who is on a booked tour. At least one adult stays; a refund follows the cancellation terms.");
        g.MapDelete("/bookings/{id:guid}", async (string number, Guid id, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelTourAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a booked tour. Free until two days before the port day, then no refund.");
    }

    private static void MapDining(RouteGroupBuilder plan)
    {
        var g = plan.MapGroup("/dining").WithTags("Plan: dining");
        g.MapGet("", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.DiningAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The dining window, seating plan and reservations.");
        g.MapGet("/slots", async (string number, string? venue, int? day, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.SlotsAsync(await me.LoadAsync(ct), number, venue, day ?? 0, ct)))
            .WithSummary("The table grid for a restaurant on a night, counting tables taken by every booking on the sailing.");
        g.MapPost("/reservations", async (string number, ReserveRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.ReserveAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Reserves a table. 409 notOpen, fixedSeating, closed, full, clash or age; 400 for a bad venue, night, time or party.");
        g.MapDelete("/reservations/{id:guid}", async (string number, Guid id, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelTableAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a reservation.");
        g.MapPost("/reservations/{id:guid}/move", async (string number, Guid id, MoveRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.MoveTableAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Moves a reservation to another night or time. Any failure leaves the original table as it was. 409 unchanged, closed, full or clash.");
        g.MapPost("/reservations/{id:guid}/late", async (string number, Guid id, LateRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.RunningLateAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Tells the restaurant the party will be late (5 to 30 minutes).");
    }

    private static void MapPackages(RouteGroupBuilder plan)
    {
        var g = plan.MapGroup("/packages").WithTags("Plan: packages");
        g.MapGet("", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.PackagesAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Add-ons, upgrades, purchases with price protection, and what each guest gets.");
        g.MapPost("/purchases", async (string number, BuyRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.BuyAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Buys an add-on or a package upgrade. 400 for an ineligible guest or a payment problem, 409 held or closed, 402 challenge or declined.");
        g.MapPost("/purchases/{id:guid}/claim-drop", async (string number, Guid id, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.ClaimDropAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Takes the credit owed after a price drop. 409 nothing when none is owed.");
        g.MapDelete("/purchases/{id:guid}", async (string number, Guid id, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelPurchaseAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a purchase for a full refund until three days before sailing. 409 locked after that.");
    }

    private static void MapLists(RouteGroupBuilder plan)
    {
        plan.MapGet("/checklist", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChecklistAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Plan: lists").WithSummary("The checklist on a 90/60/30/14/7/1-day timeline. The app ticks what it can see for itself.");
        plan.MapPut("/checklist/{id}", async (string number, string id, TickRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.TickChecklistAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithTags("Plan: lists").WithSummary("Ticks or unticks an item the guest does themself. 400 for an item the app ticks.");
        plan.MapGet("/packing", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.PackingAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Plan: lists").WithSummary("The packing list built from the season, the tours booked, ages and needs.");
        plan.MapPut("/packing/{id}", async (string number, string id, TickRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.TickPackingAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithTags("Plan: lists").WithSummary("Ticks or unticks a packing item.");
        plan.MapGet("/travel", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.TravelAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Plan: lists").WithSummary("The arrival plan with the windows open to this booking.");
        plan.MapPut("/travel", async (string number, SaveTravelRequest body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveTravelAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithTags("Plan: lists").WithSummary("Saves the arrival window, way of travel and hotel. 400 for a choice that is not offered.");
    }

    private static void MapAssistance(RouteGroupBuilder plan)
    {
        var g = plan.MapGroup("/assistance").WithTags("Plan: assistance");
        g.MapGet("", async (string number, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.AssistanceAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Notice deadlines for each kind of help and the requests made.");
        g.MapPost("", async (string number, AssistRequestInput body, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.RequestAssistanceAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Asks for help for a guest and records the matching need on their profile. 409 duplicate, 400 for a missing note.");
        g.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, PlanService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelAssistanceAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Withdraws a request.");
    }
}
