using Microsoft.AspNetCore.Mvc;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Domain;

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

        var meGroup = api.MapGroup("/me").WithTags("Me");

        meGroup.MapGet("", async (ICurrentUser me, CancellationToken ct) =>
                Results.Ok(AuthService.Me(await me.LoadAsync(ct))))
            .WithSummary("The signed-in person (the supervised child, on a view-as token).");

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
