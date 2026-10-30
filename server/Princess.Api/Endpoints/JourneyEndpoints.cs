using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Phase 6: account, trips, payments, documents, notifications, support, help, privacy, budget, feedback and favourites (data model section 6.1).</summary>
public static class JourneyEndpoints
{
    public const string LinkLimiter = "link";

    public static void MapJourneyEndpoints(this IEndpointRouteBuilder api)
    {
        MapAccount(api);
        MapTrips(api);
        MapPayments(api);
        MapDocuments(api);
        MapInbox(api);
        MapPrivacy(api);
    }

    private static void MapAccount(IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/party", async (string number, ICurrentUser me, AccountService svc, CancellationToken ct) =>
                Results.Ok(await svc.PartyAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Account").WithSummary("Everyone on the booking (any guest on it).");

        api.MapGet("/users/{id:guid}/profile", async (Guid id, ICurrentUser me, AccountService svc, CancellationToken ct) =>
                Results.Ok(await svc.ProfileAsync(await me.LoadAsync(ct), id, ct)))
            .WithTags("Account").WithSummary("A guest's profile: yourself, someone on a shared booking, or a guest who made you their helper.");

        api.MapPut("/users/{id:guid}/profile", async (Guid id, ProfileInput body, ICurrentUser me, AccountService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveProfileAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithTags("Account").WithSummary("Saves a profile. 403 for a supervised account, 400 for bad fields, 409 late or large when a name change needs Guest Services.");

        var helper = api.MapGroup("/me/helper").WithTags("Account");
        helper.MapGet("", async (ICurrentUser me, AccountService svc, CancellationToken ct) =>
                await svc.HelperAsync(await me.LoadAsync(ct), ct) is { } h ? Results.Ok(h) : Results.Text("null", "application/json"))   // a JSON null, not an empty body
            .WithSummary("The person you have asked to help (or null).");
        helper.MapPut("", async (SaveHelperRequest body, ICurrentUser me, AccountService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveHelperAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Names a helper and what they may do; nothing is shared until status is active.");
        helper.MapDelete("", async (ICurrentUser me, AccountService svc, CancellationToken ct) =>
                Results.Ok(await svc.RevokeHelperAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Ends the helper's access at once.");

        api.MapGet("/me/history", async (ICurrentUser me, AccountService svc, CancellationToken ct) =>
                Results.Ok(await svc.HistoryAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Account").WithSummary("Changes made to your record and your supervised children's, newest first.");
    }

    private static void MapTrips(IEndpointRouteBuilder api)
    {
        api.MapGet("/trips", async (ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Trips").WithSummary("Upcoming and past trips, including linked agent bookings.");

        api.MapGet("/trips/{number}", async (string number, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Trips").WithSummary("One upcoming trip you are on or have linked.");

        api.MapPost("/trips/link", async (LinkTripRequest body, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.LinkAsync(await me.LoadAsync(ct), body, ct)))
            .RequireRateLimiting(LinkLimiter)
            .WithTags("Trips").WithSummary("Links a travel-agent booking by number, lead guest's last name and sailing date. Rate limited.");

        api.MapGet("/bookings/{number}", async (string number, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.CoreAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Trips").WithSummary("The booking's core facts: sailing, party, room type, fare.");

        api.MapGet("/sailings", async (TripService svc, CancellationToken ct) => Results.Ok(await svc.SailingsAsync(ct)))
            .AllowAnonymous().WithTags("Trips").WithSummary("Every sailing.");
    }

    private static void MapPayments(IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/payments", async (string number, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.PaymentsAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Payments").WithSummary("The trip, its receipts and your saved cards.");

        api.MapPost("/me/cards", async (AddCardRequest body, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.AddCardAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Payments").WithSummary("Saves a card (brand, last four, expiry only); returns your cards.");

        api.MapDelete("/me/cards/{id:guid}", async (Guid id, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.RemoveCardAsync(await me.LoadAsync(ct), id, ct)))
            .WithTags("Payments").WithSummary("Removes a saved card; receipts keep their snapshot.");

        api.MapPost("/bookings/{number}/payments/balance", async (string number, PayBalanceRequest body, ICurrentUser me, TripService svc, CancellationToken ct) =>
                Results.Ok(await svc.PayBalanceAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithTags("Payments").WithSummary("Pays the rest of the balance with a saved card. 409 paid when nothing is owed.");
    }

    private static void MapDocuments(IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/documents", async (string number, ICurrentUser me, DocumentService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Documents").WithSummary("What each guest holds and what is still needed.");

        api.MapPut("/users/{id:guid}/documents/{doc}", async (Guid id, string doc, SetDocumentRequest body, string? booking, ICurrentUser me, DocumentService svc, CancellationToken ct) =>
                Results.Ok(await svc.SetAsync(await me.LoadAsync(ct), id, doc, body.Expires, booking, ct)))
            .WithTags("Documents").WithSummary("Records that a guest holds a document (with its expiry). Optional ?booking= picks the booking whose view comes back.");

        api.MapDelete("/users/{id:guid}/documents/{doc}", async (Guid id, string doc, string? booking, ICurrentUser me, DocumentService svc, CancellationToken ct) =>
                Results.Ok(await svc.RemoveAsync(await me.LoadAsync(ct), id, doc, booking, ct)))
            .WithTags("Documents").WithSummary("Removes a held document.");
    }

    private static void MapInbox(IEndpointRouteBuilder api)
    {
        api.MapGet("/me/notifications", async (ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.NotificationsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Notifications").WithSummary("What to hear about now (derived from your trip) and your preferences.");

        api.MapPost("/me/notifications/read", async (MarkReadRequest body, ICurrentUser me, InboxService svc, CancellationToken ct) =>
            {
                await svc.MarkReadAsync(await me.LoadAsync(ct), body, ct);
                return Results.NoContent();
            })
            .WithTags("Notifications").WithSummary("Marks notices read by id.");

        api.MapPut("/me/notification-prefs", async (JsonNode? body, ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.SavePrefsAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Notifications").WithSummary("Saves channel and quiet-hours preferences; critical notices stay on.");

        api.MapGet("/me/support-tickets", async (ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.TicketsAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Support").WithSummary("Your callback and email requests, newest first.");

        api.MapPost("/me/support-tickets", async (CreateTicketRequest body, ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.CreateTicketAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Support").WithSummary("Asks for a callback ({kind:'callback', phone}) or sends an email ({kind:'email', message}).");

        api.MapGet("/help/contacts", () => Results.Ok(InboxService.Contacts()))
            .AllowAnonymous().WithTags("Help").WithSummary("Guest Services and emergency numbers.");

        api.MapGet("/me/feedback", async (ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.FeedbackAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Feedback").WithSummary("Feedback you have sent.");

        api.MapPost("/me/feedback", async (SendFeedbackRequest body, ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.SendFeedbackAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Feedback").WithSummary("Sends feedback (5 to 1000 characters); returns the list.");

        api.MapGet("/me/favourites", async (ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.FavouritesAsync(await me.LoadAsync(ct), ct)))
            .WithTags("Favourites").WithSummary("Saved items, in the order saved.");

        api.MapPost("/me/favourites/toggle", async (ToggleFavouriteRequest body, ICurrentUser me, InboxService svc, CancellationToken ct) =>
                Results.Ok(await svc.ToggleFavouriteAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Favourites").WithSummary("Saves an item or removes it if saved; returns the list.");
    }

    private static void MapPrivacy(IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/privacy", async (string number, ICurrentUser me, PrivacyService svc, CancellationToken ct) =>
                Results.Ok(await svc.ViewAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Privacy").WithSummary("Retention dates, consents, deletions so far and the access log. Anything past its retention date is deleted first.");

        api.MapPut("/users/{id:guid}/consents/{consent}", async (Guid id, string consent, SetConsentRequest body, string? booking, ICurrentUser me, PrivacyService svc, CancellationToken ct) =>
                Results.Ok(await svc.SetConsentAsync(await me.LoadAsync(ct), id, consent, body.On, booking, ct)))
            .WithTags("Privacy").WithSummary("Sets one choice for one person. 403 unless you are that adult or the child's booker; 400 for a choice that does not apply to their age.");

        api.MapGet("/bookings/{number}/budget", async (string number, ICurrentUser me, PrivacyService svc, CancellationToken ct) =>
                Results.Ok(await svc.BudgetAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Budget").WithSummary("The booking's spending limits.");

        api.MapPut("/bookings/{number}/budget", async (string number, JsonNode? body, ICurrentUser me, PrivacyService svc, CancellationToken ct) =>
                Results.Ok(await svc.SaveBudgetAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithTags("Budget").WithSummary("Saves the limits. A child's limit is for that child's booker to set.");
    }
}
