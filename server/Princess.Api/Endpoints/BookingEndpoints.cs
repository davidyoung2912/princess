using System.Text.RegularExpressions;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 7: discover and booking (data model section 6.2).</summary>
public static partial class BookingEndpoints
{
    public const string IdempotencyHeader = "Idempotency-Key";
    private static readonly System.Text.Json.JsonSerializerOptions Web = new(System.Text.Json.JsonSerializerDefaults.Web);

    [GeneratedRegex(@"^[A-Za-z0-9_.:\-]{8,80}$")]
    private static partial Regex KeyRx();

    /// <summary>The optional <c>Idempotency-Key</c>: a client-made id for one attempt, so a double submit or a retry after a lost reply cannot charge twice.</summary>
    private static string? KeyOf(HttpContext http)
    {
        var key = http.Request.Headers[IdempotencyHeader].ToString();
        if (key.Length == 0) return null;
        return KeyRx().IsMatch(key) ? key : throw ApiException.Invalid("idempotencyKey");
    }

    public static void MapBookingEndpoints(this IEndpointRouteBuilder api)
    {
        MapDiscover(api);
        MapFunnel(api);
        MapBooked(api);
    }

    private static void MapDiscover(IEndpointRouteBuilder api)
    {
        api.MapGet("/sailings/offers", async (DiscoverService svc, CancellationToken ct) => Results.Ok(await svc.OffersAsync(ct)))
            .AllowAnonymous().WithTags("Discover").WithSummary("Every priced sailing with its \"from\" price.");

        api.MapGet("/sailings/bookable", async (DiscoverService svc, CancellationToken ct) => Results.Ok(await svc.DatesAsync(ct)))
            .AllowAnonymous().WithTags("Discover").WithSummary("Every sailing with days to departure and whether it can still be booked.");

        api.MapGet("/sailings/{id}/quote", async (string id, string? category, int? guests, DiscoverService svc, CancellationToken ct) =>
                Results.Ok(await svc.QuoteAsync(id, category, guests ?? 0, ct)))
            .AllowAnonymous().WithTags("Discover").WithSummary("An all-in estimate for a room type and party size. 400 for an unknown sailing, room type or party size.");

        api.MapGet("/sailings/{id}/rooms", async (string id, DiscoverService svc, CancellationToken ct) => Results.Ok(await svc.RoomsAsync(id, ct)))
            .AllowAnonymous().WithTags("Discover").WithSummary("The room types of a sailing with fare per person, capacity and any included package.");

        api.MapGet("/sailings/{id}/cabins", async (string id, string? category, DiscoverService svc, CancellationToken ct) => Results.Ok(await svc.CabinsAsync(id, category, ct)))
            .AllowAnonymous().WithTags("Discover").WithSummary("Sample staterooms of a room type and which are free. Staterooms already booked are not offered.");
    }

    private static void MapFunnel(IEndpointRouteBuilder api)
    {
        api.MapPost("/booking/fares", async (Draft draft, BookingService svc, CancellationToken ct) => Results.Ok(await svc.FaresAsync(draft, ct)))
            .WithTags("Booking").WithSummary("The fares a room type can be booked with, priced for the draft's party.");

        api.MapPost("/booking/quote", async (Draft draft, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.QuoteAsync(await me.LoadAsync(ct), draft, ct)))
            .WithTags("Booking").WithSummary("The price held for 24 hours, the payment plan and the Captain's Circle discount and credit. Send `total` back as `expectedTotal` when booking.");

        api.MapGet("/me/booking-prefill", async (ICurrentUser me, BookingService svc, CancellationToken ct) => Results.Ok(await svc.PrefillAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Booking").WithSummary("Guests and contact filled from the account and the current booking's party.");

        var draft = api.MapGroup("/me/draft").WithTags("Booking");
        draft.MapGet("", async (ICurrentUser me, BookingService svc, CancellationToken ct) =>
            {
                // A bare 200 with no body is not JSON; the screens expect the value null.
                var current = await svc.GetDraftAsync(await me.LoadAsync(ct), ct);
                return current is null ? Results.Text("null", "application/json") : Results.Json(current, Web);
            })
            .WithSummary("The saved draft, or the JSON value null when there is none.");
        draft.MapPut("", async (Draft body, ICurrentUser me, BookingService svc, CancellationToken ct) => Results.Ok(await svc.SaveDraftAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Saves the one live draft. The id in the response is chosen by the server; use it from then on.");
        draft.MapDelete("", async (ICurrentUser me, BookingService svc, CancellationToken ct) =>
            {
                await svc.DiscardDraftAsync(await me.LoadAsync(ct), ct);
                return Results.NoContent();
            })
            .WithSummary("Discards the draft.");
        draft.MapPost("/resume-link", async (SendResumeLinkRequest body, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.SendResumeLinkAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Sends a link back to the draft by email or text. 400 for an unusable address, 404 when nothing is saved.");

        api.MapPost("/bookings", async (BookRequest body, HttpContext http, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.BookAsync(await me.LoadAsync(ct), body, KeyOf(http), ct)))
            .WithTags("Booking").WithSummary("Books and charges. Same draft or same Idempotency-Key twice returns the first booking. 400 incomplete or bad payment, 409 priceChanged, cabinTaken or closed, 402 challenge or declined.");
    }

    private static void MapBooked(IEndpointRouteBuilder api)
    {
        var b = api.MapGroup("/bookings/{number}").WithTags("Booking");

        b.MapGet("/detail", async (string number, ICurrentUser me, BookingService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("The full booking: guests, receipts, balance, cancel terms.");

        b.MapPost("/pay-balance", async (string number, PayBalancePartsRequest body, HttpContext http, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.PayBalanceAsync(await me.LoadAsync(ct), number, body, KeyOf(http), ct)))
            .WithSummary("Pays the rest of the balance with one or two methods. 409 nothingDue; 402 challenge or declined. Supports Idempotency-Key.");

        b.MapGet("/change", async (string number, string? sailingId, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChangePreviewAsync(await me.LoadAsync(ct), number, sailingId, ct)))
            .WithSummary("What moving to another sailing would cost. Booker only.");

        b.MapPost("/change", async (string number, string? sailingId, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChangeAsync(await me.LoadAsync(ct), number, sailingId, ct)))
            .WithSummary("Moves to another sailing. 409 with the reason (tooLate, newTooSoon, same). Booker only.");

        b.MapPost("/cancel", async (string number, ICurrentUser me, BookingService svc, CancellationToken ct) =>
                Results.Ok(await svc.CancelAsync(await me.LoadAsync(ct), number, ct)))
            .WithSummary("Cancels and refunds per the cancel terms. 409 closed once the ship has sailed or leaves today. Booker only.");
    }
}
