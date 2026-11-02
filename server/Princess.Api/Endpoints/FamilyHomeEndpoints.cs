using Princess.Api.Auth;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Family-at-home links and the page behind them (multi-device plan 2, Phase 6).</summary>
public static class FamilyHomeEndpoints
{
    public static void MapFamilyHomeEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/me/family-links", async (NewFamilyLinkRequest? body, ICurrentUser me, FamilyHomeService svc, CancellationToken ct) =>
                Results.Ok(await svc.IssueAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Family at home")
            .WithSummary("Makes a signed link to the family-at-home page that lasts 3, 7 (default) or 14 days. The token is shown once. 403 childCannotShare for a supervised child, 409 tooManyLinks past 20 live links.");

        api.MapDelete("/me/family-links/{id}", async (string id, ICurrentUser me, FamilyHomeService svc, CancellationToken ct) =>
            {
                await svc.RevokeAsync(await me.LoadAsync(ct), id, ct);
                return Results.NoContent();
            })
            .WithTags("Family at home")
            .WithSummary("Stops one link at once. 404 for a link that is not the guest's.");

        api.MapDelete("/me/family-links", async (ICurrentUser me, FamilyHomeService svc, CancellationToken ct) =>
            {
                await svc.RevokeAllAsync(await me.LoadAsync(ct), ct);
                return Results.NoContent();
            })
            .WithTags("Family at home")
            .WithSummary("Stops every link the guest has shared.");

        api.MapPost("/me/family-postcards", async (FamilyPostcardRequest body, ICurrentUser me, FamilyHomeService svc, CancellationToken ct) =>
            {
                await svc.PostcardAsync(await me.LoadAsync(ct), body, ct);
                return Results.NoContent();
            })
            .WithTags("Family at home")
            .WithSummary("Sends a postcard (kind ok, sea, port, late or love, with a note of at most 140 characters) to the page every live link opens. The newest 30 are kept. 400 badPostcard.");

        api.MapGet("/public/family/{token}", async (string token, FamilyHomeService svc, CancellationToken ct) => Results.Ok(await svc.PublicAsync(token, ct)))
            .AllowAnonymous().RequireRateLimiting(CheckinEndpoints.LookupLimiter).WithTags("Family at home")
            .WithSummary("What a family-at-home link shows, with no sign-in: the guest's first name, when the link ends, the postcards and the ship-level notices. Ok is false with a reason (signature, unknown, revoked or expired) for a link that does not work. Rate-limited. Never where the guest is.");
    }
}
