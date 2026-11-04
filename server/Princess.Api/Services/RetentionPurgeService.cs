using Dapper;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Data;

namespace Princess.Api.Services;

public sealed class RetentionOptions
{
    public const string Section = "Retention";
    /// <summary>Minutes between runs. 0 switches the job off.</summary>
    public int IntervalMinutes { get; set; } = 360;
    /// <summary>Days an audit row or sign-in session keeps the address and device it came from, and an audit row its stack trace. After that they are blanked (the row stays). 0 keeps them for ever.</summary>
    public int NetworkDataDays { get; set; } = 60;
}

/// <summary>Blanks the address and device of old audit rows and refresh-token rows, in batches so no run holds a long lock.</summary>
public static class NetworkDataRetention
{
    private const int Batch = 5000;

    public static async Task<(int Audit, int Sessions)> BlankOlderThanAsync(IDbConnectionFactory db, DateTime cutoff, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        int audit = 0, sessions = 0, n;
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("""
                UPDATE TOP (@batch) dbo.AuditEvents SET Ip = NULL, UserAgent = NULL, ErrorDetail = NULL
                WHERE [At] < @cutoff AND (Ip IS NOT NULL OR UserAgent IS NOT NULL OR ErrorDetail IS NOT NULL)
                """, new { cutoff, batch = Batch }, null, ct));
            audit += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("""
                UPDATE TOP (@batch) dbo.RefreshTokens SET Ip = NULL, UserAgent = NULL
                WHERE CreatedAt < @cutoff AND (Ip IS NOT NULL OR UserAgent IS NOT NULL)
                """, new { cutoff, batch = Batch }, null, ct));
            sessions += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        return (audit, sessions);
    }
}

/// <summary>
/// Deletes data past its retention date even if nobody opens the privacy centre (SEC-03).
/// Uses real time; the privacy centre still purges a demo person's booking at their own clock.
/// </summary>
public sealed class RetentionPurgeService(IServiceScopeFactory scopes, IOptions<RetentionOptions> options, ILogger<RetentionPurgeService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = options.Value.IntervalMinutes;
        if (minutes <= 0) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(minutes));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var n = await scope.ServiceProvider.GetRequiredService<PrivacyService>().PurgeAllDueAsync(stoppingToken);
                if (options.Value.NetworkDataDays > 0)
                {
                    var (a, r) = await NetworkDataRetention.BlankOlderThanAsync(scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>(), DateTime.UtcNow.AddDays(-options.Value.NetworkDataDays), stoppingToken);
                    if (a + r > 0)
                    {
                        log.LogInformation("Blanked the address and device of {Audit} audit row(s) and {Sessions} session(s)", a, r);
                        await scope.ServiceProvider.GetRequiredService<IAuditLog>().RecordAsync(new AuditEntry { Category = AuditCategory.System, Action = "retention.network", Outcome = AuditOutcome.Success, ActorRole = "system", Detail = AuditContext.Json(new { audit = a, sessions = r }) }, stoppingToken);
                    }
                }
                if (n > 0)
                {
                    log.LogInformation("Retention purge ran for {Count} booking(s)", n);
                    await scope.ServiceProvider.GetRequiredService<IAuditLog>().RecordAsync(new AuditEntry { Category = AuditCategory.System, Action = "retention.purge", Outcome = AuditOutcome.Success, ActorRole = "system", Detail = AuditContext.Json(new { bookings = n }) }, stoppingToken);
                }
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Retention purge failed; it will try again at the next interval");
                await RecordFailureAsync(e);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RecordFailureAsync(Exception e)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<IAuditLog>().RecordAsync(new AuditEntry
            {
                Category = AuditCategory.Error, Action = "retention.purge", Outcome = AuditOutcome.Error, ActorRole = "system",
                ErrorCode = "server", ErrorType = e.GetType().FullName, ErrorMessage = AuditLog.Cut(e.Message, 400), ErrorDetail = AuditLog.Cut(e.StackTrace, 2000),
            });
        }
        catch (Exception inner)
        {
            log.LogError(inner, "Could not audit the retention purge failure");
        }
    }
}
