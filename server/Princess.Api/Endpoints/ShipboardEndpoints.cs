using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 10b: orders, the family and children's clubs, health, the stateroom, photos, laundry, Wi-Fi and trip updates (data model section 6.5). Any guest reads, an adult guest writes.</summary>
public static class ShipboardEndpoints
{
    public static void MapShipboardEndpoints(this IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}");

        var o = b.MapGroup("/orders").WithTags("Orders");
        o.MapGet("/menu", async (string number, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.MenuAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Whether ordering is open, who is on the booking with their drink cap, the stateroom, the breakfast mornings on offer and what has run out.");
        o.MapGet("", async (string number, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's orders, newest first, each with its stage worked out from the clock.");
        o.MapPost("", async (string number, PlaceOrderRequest body, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.PlaceAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Places an order and puts it on the account. 400 with the problem (empty, tooMany, unknownItem, wrongMenu, unknownExtra, badQuantity, noGuest, underage, badLocation, badTip, noTime); 403 for a child account; 409 closed or unavailable.");
        o.MapPost("/{id:guid}/resolve", async (string number, Guid id, ResolveOrderRequest body, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.ResolveAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Chooses, for each line that ran out, to swap it or remove it. 400 incomplete or noSubstitute; 409 nothingToChoose.");
        o.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.CancelAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels an order with a refund on the account. 409 tooLate once the kitchen has started.");
        o.MapPut("/{id:guid}/location", async (string number, Guid id, MoveOrderRequest body, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.MoveAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Corrects where an order goes. 400 badLocation; 409 tooLate once delivered.");
        o.MapPost("/{id:guid}/contact", async (string number, Guid id, ICurrentUser me, OrderService svc, CancellationToken ct) => Results.Ok(await svc.ContactAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Records that the guest asked Guest Services about the order.");

        var f = b.MapGroup("/family").WithTags("Family");
        f.MapGet("", async (string number, ICurrentUser me, FamilyService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The children on the booking: club, where they were last seen, allowed places, who may collect them, the meeting point and the log.");
        f.MapPut("/{child:guid}/zones", async (string number, Guid child, SetZonesRequest body, ICurrentUser me, FamilyService svc, CancellationToken ct) => Results.Ok(await svc.SetZonesAsync(await me.LoadAsync(ct), number, child, body, ct)))
            .WithSummary("Sets the places a child may go. 400 badZones; 403 for a child account or someone not a child on the booking.");
        f.MapPut("/{child:guid}/auth", async (string number, Guid child, SetAuthRequest body, ICurrentUser me, FamilyService svc, CancellationToken ct) => Results.Ok(await svc.SetAuthAsync(await me.LoadAsync(ct), number, child, body, ct)))
            .WithSummary("Sets who may collect a child, whether they may sign out alone and whether club staff may take photos. 400 noPickup or tooYoungAlone.");
        f.MapPost("/{child:guid}/check-in", async (string number, Guid child, ICurrentUser me, FamilyService svc, CancellationToken ct) => Results.Ok(await svc.CheckInAsync(await me.LoadAsync(ct), number, child, ct)))
            .WithSummary("Checks a child in to their club. 400 tooYoung, tooOld, alreadyIn or closed.");
        f.MapPost("/{child:guid}/check-out", async (string number, Guid child, ICurrentUser me, FamilyService svc, CancellationToken ct) => Results.Ok(await svc.CheckOutAsync(await me.LoadAsync(ct), number, child, ct)))
            .WithSummary("Checks a child out. 403 notAuthorised unless the caller is a listed adult, or the child where allowed; 409 notIn.");
        f.MapPut("/reunion", async (string number, SetReunionRequest body, ICurrentUser me, FamilyService svc, CancellationToken ct) => Results.Ok(await svc.SetReunionAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Sets where the family meets if parted, and a backup. 400 badMeeting.");

        var h = b.MapGroup("/health").WithTags("Health");
        h.MapGet("", async (string number, ICurrentUser me, HealthService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Medical Center hours now, the caller's own illness reports, requests and whether the booking is isolating.");
        h.MapPost("/reports", async (string number, HealthReportRequest body, ICurrentUser me, HealthService svc, CancellationToken ct) => Results.Ok(await svc.ReportAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Reports illness early. 400 noGuest, noSymptoms, badSymptom or badStart; 403 for someone outside the booking; 409 closed.");
        h.MapPost("/requests", async (string number, HealthRequestRequest body, ICurrentUser me, HealthService svc, CancellationToken ct) => Results.Ok(await svc.RequestAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Asks for seasickness help, medicine or device power. 400 badKind or badNote.");

        var r = b.MapGroup("/room").WithTags("Stateroom");
        r.MapGet("", async (string number, ICurrentUser me, RoomService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The stateroom card: number, deck, steward, amenities, muster station, housekeeping and room controls.");
        r.MapPatch("/housekeeping", async (string number, HousekeepingPatch body, ICurrentUser me, RoomService svc, CancellationToken ct) => Results.Ok(await svc.SetHousekeepingAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Changes housekeeping: service mode (none, dnd, makeUp), cleaning window and turndown. 400 badMode or badWindow.");
        r.MapPatch("/devices", async (string number, DevicesPatch body, ICurrentUser me, RoomService svc, CancellationToken ct) => Results.Ok(await svc.SetDevicesAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Changes the mock smart-room controls. 400 badLights, badTemp or noView.");

        var p = b.MapGroup("/photos").WithTags("Photos");
        p.MapGet("", async (string number, ICurrentUser me, PhotoService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Photos taken so far, the caller's favourites, what the booking owns, receipts and the photographers' schedule.");
        p.MapPut("/{photoId}/favourite", async (string number, string photoId, ICurrentUser me, PhotoService svc, CancellationToken ct) => Results.Ok(await svc.ToggleFavouriteAsync(await me.LoadAsync(ct), number, photoId, ct)))
            .WithSummary("Adds a photo to the caller's favourites, or takes it off, and returns the list. 400 unknownPhoto.");
        p.MapPut("/{photoId}/album", async (string number, string photoId, ICurrentUser me, PhotoService svc, CancellationToken ct) => Results.Ok(await svc.ToggleAlbumAsync(await me.LoadAsync(ct), number, photoId, ct)))
            .WithSummary("Shares a photo with the party's album, or takes the caller's share back, and returns the album. 400 unknownPhoto; 403 for a child account.");
        p.MapPost("/quote", async (string number, PhotoIdsRequest body, ICurrentUser me, PhotoService svc, CancellationToken ct) => Results.Ok(await svc.QuoteAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Prices each way of buying a choice of photos after any the package includes. 400 empty, unknownPhoto or alreadyOwned.");
        p.MapPost("/purchases", async (string number, BuyPhotosRequest body, ICurrentUser me, PhotoService svc, CancellationToken ct) => Results.Ok(await svc.BuyAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Buys photos and puts them on the account. 400 empty, unknownPhoto, alreadyOwned or badOption; 403 for a child account; 409 closed.");
        p.MapPost("/purchases/{id:guid}/download", async (string number, Guid id, ICurrentUser me, PhotoService svc, CancellationToken ct) => Results.Ok(await svc.DownloadAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Saves the next batch of five photos and keeps what earlier attempts saved. 409 expired after the download window.");

        var l = b.MapGroup("/laundry").WithTags("Laundry");
        l.MapGet("", async (string number, ICurrentUser me, LaundryService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The laundry requests, the pick-up windows for each service and whether the free bag is left.");
        l.MapPost("", async (string number, LaundryRequestBody body, ICurrentUser me, LaundryService svc, CancellationToken ct) => Results.Ok(await svc.RequestAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Asks for laundry, pressing or dry cleaning and puts it on the account. 400 badService, badQuantity, badNote or badPickup; 409 closed.");
        l.MapDelete("/{id:guid}", async (string number, Guid id, ICurrentUser me, LaundryService svc, CancellationToken ct) => Results.Ok(await svc.CancelAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Cancels a request and takes it off the account. 409 tooLate once the steward has collected it.");

        var w = b.MapGroup("/wifi").WithTags("Wi-Fi");
        w.MapGet("", async (string number, ICurrentUser me, WifiService svc, CancellationToken ct) => Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The booking's Wi-Fi devices with the usage meter, and how many included devices are left.");
        w.MapPost("/devices", async (string number, AddWifiRequest body, ICurrentUser me, WifiService svc, CancellationToken ct) => Results.Ok(await svc.AddAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithSummary("Adds a device, free while the package or tier has included devices left. 400 badName, duplicate, tooMany, badPlan or badDays; 409 closed.");
        w.MapPut("/devices/{id:guid}", async (string number, Guid id, UpgradeWifiRequest body, ICurrentUser me, WifiService svc, CancellationToken ct) => Results.Ok(await svc.UpgradeAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Upgrades a device's plan for the days it has left. 400 badPlan, expired or notAnUpgrade.");
        w.MapDelete("/devices/{id:guid}", async (string number, Guid id, ICurrentUser me, WifiService svc, CancellationToken ct) => Results.Ok(await svc.RemoveAsync(await me.LoadAsync(ct), number, id, ct)))
            .WithSummary("Removes a device and its charge from the account.");

        var u = b.MapGroup("/updates").WithTags("Trip updates");
        u.MapGet("", async (string number, ICurrentUser me, UpdatesService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Changes to the trip in force for the caller, most serious first, then those that have ended, each with the caller's acknowledgement.");
        u.MapPost("/{id}/ack", async (string number, string id, AcknowledgeRequest body, ICurrentUser me, UpdatesService svc, CancellationToken ct) => Results.Ok(await svc.AcknowledgeAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithSummary("Records that the guest has seen a change and what they chose. 400 option for an unknown change or option; 403 for a child account; 409 ended.");
    }
}
