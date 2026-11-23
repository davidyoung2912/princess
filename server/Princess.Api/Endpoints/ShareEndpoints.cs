using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Hand-over by QR code (chat bundles plan, phase Q1): direct codes for public items and short-lived handoff codes for anything personal.</summary>
public static class ShareEndpoints
{
    public const string Limiter = "share";

    public static void MapShareEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/me/shares").WithTags("Shares").RequireRateLimiting(Limiter);

        g.MapGet("/direct", async (string? t, string? r, ICurrentUser me, BundleShareService svc, CancellationToken ct) => Results.Ok(await svc.DirectAsync(await me.LoadAsync(ct), t, r, ct)))
            .WithSummary("What a direct code (`t` type, `r` ref) shows the caller, rebuilt for their own sailing. 400 shareRef when their sailing does not have it.");

        g.MapGet("", async (ICurrentUser me, BundleShareService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The caller's handoff codes that still open, with scan counts. A code is never listed again after it is made.");

        g.MapPost("", async (ShareCodeBody body, ICurrentUser me, BundleShareService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Makes a handoff code for a ref, good for 15 minutes (default), 1 hour or 24 hours (`minutes`). The code comes back once. 400 shareRef|minutes, 409 tooMany.");

        g.MapGet("/{code}", async (string code, ICurrentUser me, BundleShareService svc, CancellationToken ct) => Results.Ok(await svc.OpenAsync(await me.LoadAsync(ct), code, ct)))
            .WithSummary("What a handoff code shows the caller, and counts the scan. 404 for a wrong, stopped or expired code (never says which); 400 shareRef when their sailing does not have it.");

        g.MapPost("/{code}/accept", async (string code, ICurrentUser me, BundleShareService svc, CancellationToken ct) => Results.Ok(await svc.AcceptAsync(await me.LoadAsync(ct), code, ct)))
            .WithSummary("Join (a group invite code) or send a connection request (a connect code): the ordinary invitation or request, with every existing rule. 404 for a wrong, stopped or expired code; 409 full|answered|alreadyAsked|cooldown|connected.");

        g.MapDelete("/{id:guid}", async (Guid id, ICurrentUser me, BundleShareService svc, CancellationToken ct) => { await svc.StopAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Stops one of the caller's codes at once. 404 for a code that is not theirs.");
    }
}
