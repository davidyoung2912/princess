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
    /// <summary>Days Stanley's finished actions and receipts, its tier log rows and a decision brief nobody has changed are kept before they are deleted. Prepared actions that never ran go after a day. 0 keeps them for ever.</summary>
    public int StanleyDays { get; set; } = 180;
}

/// <summary>Deletes old Stanley rows in batches: receipts, handoffs, tier log rows and decision briefs past their retention, and previews nobody confirmed.</summary>
public static class StanleyRetention
{
    private const int Batch = 5000;

    /// <summary>
    /// Deletes handoff photos: every one saved before the retention cutoff (its case goes at the same time) and any older than a day that no case names. Returns how many.
    /// </summary>
    public static async Task<int> DeletePhotosAsync(IDbConnectionFactory db, IHandoffPhotoStore photos, DateTime now, int days, CancellationToken ct)
    {
        var deleted = 0;
        foreach (var (user, id) in await photos.ListOlderThanAsync(now.AddHours(-StanleyHandoffPhotoRules.UnattachedHours), ct))
        {
            var old = (await photos.ListOlderThanAsync(now.AddDays(-days), ct)).Contains((user, id));
            if (!old)
            {
                using var c = await db.OpenAsync(ct);
                var used = await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(1) FROM dbo.StanleyHandoffs WHERE UserId = @user AND Attachment = @name", new { user, name = StanleyHandoffPhotoRules.IdOf(id) }, null, ct));
                if (used > 0) continue;
            }
            if (await photos.DeleteAsync(user, id, ct)) deleted++;
        }
        return deleted;
    }

    public static async Task<(int Actions, int TierLog, int Handoffs, int Briefs, int Polls, int Plans, int Reminders)> DeleteOlderThanAsync(IDbConnectionFactory db, DateTime now, int days, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var cutoff = now.AddDays(-days);
        var unconfirmed = now.AddDays(-1);
        int actions = 0, tiers = 0, handoffs = 0, briefs = 0, polls = 0, plans = 0, reminders = 0, n;
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("""
                DELETE TOP (@batch) FROM dbo.StanleyActions
                WHERE CreatedAt < @cutoff OR (Status IN (N'prepared', N'expired', N'changed') AND CreatedAt < @unconfirmed)
                """, new { cutoff, unconfirmed, batch = Batch }, null, ct));
            actions += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("DELETE TOP (@batch) FROM dbo.StanleyTierLog WHERE [At] < @cutoff", new { cutoff, batch = Batch }, null, ct));
            tiers += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("DELETE TOP (@batch) FROM dbo.StanleyHandoffs WHERE OpenedAt < @cutoff", new { cutoff, batch = Batch }, null, ct));
            handoffs += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        // A brief holds the wish text as typed; one the guest has not touched for the whole retention period goes, as the guest can also delete it at any time.
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("DELETE TOP (@batch) FROM dbo.StanleyBriefs WHERE UpdatedAt < @cutoff", new { cutoff, batch = Batch }, null, ct));
            briefs += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        // A poll is a plan for a trip that is long over by now, and a plan snapshot is only useful for the day it was sent; neither is kept past its use.
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("DELETE TOP (@batch) FROM dbo.StanleyPolls WHERE CreatedAt < @cutoff", new { cutoff, batch = Batch }, null, ct));
            polls += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        var planCutoff = now.AddDays(-30);
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("DELETE TOP (@batch) FROM dbo.StanleyPlanSnapshots WHERE UpdatedAt < @planCutoff", new { planCutoff, batch = Batch }, null, ct));
            plans += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        var reminderCutoff = now.AddDays(-7);
        do
        {
            n = await c.ExecuteAsync(Sql.Cmd("DELETE TOP (@batch) FROM dbo.StanleyReminders WHERE DueAt < @reminderCutoff", new { reminderCutoff, batch = Batch }, null, ct));
            reminders += n;
        } while (n >= Batch && !ct.IsCancellationRequested);
        return (actions, tiers, handoffs, briefs, polls, plans, reminders);
    }
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
                if (options.Value.StanleyDays > 0)
                {
                    var (acts, tiers, hands, briefs, polls, plans, rems) = await StanleyRetention.DeleteOlderThanAsync(scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>(), DateTime.UtcNow, options.Value.StanleyDays, stoppingToken);
                    var gone = await StanleyRetention.DeletePhotosAsync(scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>(), scope.ServiceProvider.GetRequiredService<IHandoffPhotoStore>(), DateTime.UtcNow, options.Value.StanleyDays, stoppingToken);
                    if (gone > 0) log.LogInformation("Deleted {Photos} handoff photo(s)", gone);
                    if (acts + tiers + hands + briefs + polls + plans + rems > 0)
                    {
                        log.LogInformation("Deleted {Actions} Stanley action row(s), {Tiers} tier log row(s), {Handoffs} handoff row(s), {Briefs} brief(s), {Polls} poll(s), {Plans} plan snapshot(s) and {Reminders} reminder(s)", acts, tiers, hands, briefs, polls, plans, rems);
                        await scope.ServiceProvider.GetRequiredService<IAuditLog>().RecordAsync(new AuditEntry { Category = AuditCategory.System, Action = "retention.stanley", Outcome = AuditOutcome.Success, ActorRole = "system", Detail = AuditContext.Json(new { actions = acts, tierLog = tiers, handoffs = hands, briefs, polls, plans, reminders = rems }) }, stoppingToken);
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
