using Microsoft.AspNetCore.Mvc;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

public static class AuthEndpoints
{
    public const string LoginLimiter = "login";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Auth");

        auth.MapPost("/login", async (LoginRequest body, IAuthService svc, HttpContext http, CancellationToken ct) =>
                Results.Ok(await svc.LoginAsync(body, UserAgent(http), Ip(http), ct)))
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Sign in with email or 10-digit account number plus password.");

        auth.MapPost("/register", async (RegisterRequest body, IAuthService svc, HttpContext http, CancellationToken ct) =>
                Results.Ok(await svc.RegisterAsync(body, UserAgent(http), Ip(http), ct)))
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Create an account (adults only) and sign in. 409 emailTaken when the address has one.");

        auth.MapPost("/forgot", async (CodeRequest body, IAuthService svc, CancellationToken ct) =>
            {
                await svc.RequestCodeAsync(AuthService.Reset, body, ct);
                return Results.NoContent();
            })
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Email a one-time password-reset code. Always 204, whether or not the address has an account.");

        auth.MapPost("/reset", async (ResetRequest body, IAuthService svc, CancellationToken ct) =>
            {
                await svc.ResetPasswordAsync(body, ct);
                return Results.NoContent();
            })
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Set a new password with the emailed code. Ends every session the person had.");

        auth.MapPost("/magic", async (CodeRequest body, IAuthService svc, CancellationToken ct) =>
            {
                await svc.RequestCodeAsync(AuthService.Magic, body, ct);
                return Results.NoContent();
            })
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Email a one-time sign-in code. Always 204, whether or not the address has an account.");

        auth.MapPost("/magic/redeem", async (MagicRedeemRequest body, IAuthService svc, HttpContext http, CancellationToken ct) =>
                Results.Ok(await svc.RedeemMagicAsync(body, UserAgent(http), Ip(http), ct)))
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Sign in with the emailed code.");

        auth.MapPost("/refresh", async (RefreshRequest body, IAuthService svc, HttpContext http, CancellationToken ct) =>
                Results.Ok(await svc.RefreshAsync(body, UserAgent(http), Ip(http), ct)))
            .AllowAnonymous()
            .RequireRateLimiting(LoginLimiter)
            .WithSummary("Swap a refresh token for a new session. The old token is spent; replaying it ends the whole session family.");

        auth.MapPost("/logout", async (LogoutRequest body, ICurrentUser me, IAuthService svc, CancellationToken ct) =>
            {
                await svc.LogoutAsync(await me.LoadAsync(ct), body, ct);
                return Results.NoContent();
            })
            .WithSummary("Revoke the session family of the given refresh token.");

        auth.MapGet("/demo-accounts", async (IUserStore users, IHostEnvironment env, CancellationToken ct) =>
            {
                if (env.IsProduction()) throw ApiException.NotFound();
                var rows = await users.ListDemoAsync(ct);
                return Results.Ok(rows.Where(u => !string.IsNullOrEmpty(u.Email))
                    .Select(u => new DemoAccountDto(u.Email!, u.FirstName ?? "", u.LastName, u.Role)));
            })
            .AllowAnonymous()
            .WithSummary("The seeded demo accounts (email, name, role) so a non-production sign-in page can list them. 404 in production.");

        var meGroup = api.MapGroup("/me").WithTags("Me");

        meGroup.MapGet("", async (ICurrentUser me, CancellationToken ct) =>
                Results.Ok(AuthService.Me(await me.LoadAsync(ct))))
            .WithSummary("The signed-in person (the supervised child, on a view-as token).");

        meGroup.MapGet("/context", async (ContextService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(ct)))
            .WithSummary("Who is signed in, the people on their current trip, the trip and sailing the app is on, and the server's time (moved by the demo clock for a demo account). A device keeps none of this itself.");

        meGroup.MapPost("/view-as/{userId:guid}", async (Guid userId, ICurrentUser me, IAuthService svc, CancellationToken ct) =>
            {
                if (me.ActorPublicId is not null) throw ApiException.Forbidden();
                return Results.Ok(await svc.ViewAsAsync(await me.LoadAsync(ct), userId, ct));
            })
            .WithSummary("Booker only: a short-lived token to act as one of their supervised children.");
    }

    private static string? UserAgent(HttpContext http) => http.Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null;

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
