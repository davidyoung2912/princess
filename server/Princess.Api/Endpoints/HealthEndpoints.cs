using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
            .AllowAnonymous().WithTags("Health").WithSummary("Liveness: the process is up.");

        app.MapGet("/health/providers", (ProviderHealth health) => Results.Ok(new { providers = health.Snapshot() }))
            .AllowAnonymous().WithTags("Health").WithSummary("Real providers that are switched on and whether each is working, degraded or has fallen back to the simulation. Empty when everything is simulated.");

        app.MapGet("/health/db", async (IDbConnectionFactory db, ILogger<Program> log, HttpContext http, CancellationToken ct) =>
            {
                try
                {
                    await using var c = await db.OpenAsync(ct);
                    await c.ExecuteScalarAsync<int>(new CommandDefinition("SELECT 1", cancellationToken: ct));
                    return Results.Ok(new { status = "ok" });
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogWarning(e, "Database health check failed");
                    await Problems.Write(http, ApiErrorCode.Server, "databaseUnavailable", StatusCodes.Status503ServiceUnavailable);
                    return Results.Empty;
                }
            })
            .AllowAnonymous().WithTags("Health").WithSummary("Readiness: the database answers.");
    }
}
