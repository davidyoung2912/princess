using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Next-level plan N4: what a party shares, the organiser dashboard, the change log, and read-only caregiver and advisor links.</summary>
public static class PartyEndpoints
{
    public static void MapPartyEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/bookings/{number}/organiser", async (string number, ICurrentUser me, PartyService svc, CancellationToken ct) =>
                Results.Ok(await svc.OrganiserAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Party").WithSummary("The roster with check-in and document status for the people who share it, and the money for the booker only.");

        api.MapGet("/bookings/{number}/party-log", async (string number, ICurrentUser me, PartyService svc, CancellationToken ct) =>
                Results.Ok(await svc.LogAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Party").WithSummary("The newest changes to the party's shared plan: polls, ideas, meeting places and the ledger.");

        api.MapGet("/bookings/{number}/share-links", async (string number, ICurrentUser me, ShareLinkService svc, CancellationToken ct) =>
                Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), number, ct)))
            .WithTags("Party").WithSummary("The caregiver and advisor links the guest has made on this booking.");

        api.MapPost("/bookings/{number}/share-links", async (string number, ShareLinkRequest body, ICurrentUser me, ShareLinkService svc, CancellationToken ct) =>
                Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), number, body, ct)))
            .WithTags("Party").WithSummary("Makes a read-only link ('caregiver' or, for the booker, 'advisor'). The address is returned once. 400 badShareLink, 403 bookerOnly, 409 tooManyLinks.");

        api.MapDelete("/bookings/{number}/share-links/{id:guid}", async (string number, Guid id, ICurrentUser me, ShareLinkService svc, CancellationToken ct) =>
            {
                await svc.RevokeAsync(await me.LoadAsync(ct), number, id, ct);
                return Results.NoContent();
            })
            .WithTags("Party").WithSummary("Ends a link at once.");

        api.MapPost("/bookings/{number}/share-links/{id:guid}/checkin", async (string number, Guid id, ShareCheckInRequest body, ICurrentUser me, ShareLinkService svc, CancellationToken ct) =>
                Results.Ok(await svc.CheckInAsync(await me.LoadAsync(ct), number, id, body, ct)))
            .WithTags("Party").WithSummary("Tells the caregiver the guest is fine, with a short note.");

        api.MapGet("/public/share/{token}", async (string token, ShareLinkService svc, CancellationToken ct) =>
                await svc.ViewAsync(token, ct) is { } view ? Results.Ok(view) : Results.NotFound())
            .AllowAnonymous().RequireRateLimiting(CheckinEndpoints.LookupLimiter).WithTags("Party").WithSummary("The read-only view behind a share link. The address is the secret; no sign-in, never a position.");
    }
}
