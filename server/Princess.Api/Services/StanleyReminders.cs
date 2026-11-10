using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed class StanleyReminderRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long UserId { get; set; }
    public DateTime DueAt { get; set; }
    public string Text { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public interface IStanleyReminderStore
{
    Task AddAsync(StanleyReminderRow row, CancellationToken ct);
    /// <summary>The guest's own reminders that are not yet long past, soonest first.</summary>
    Task<List<StanleyReminderRow>> ListAsync(long userId, DateTime since, CancellationToken ct);
    /// <summary>True when the guest's own reminder was removed.</summary>
    Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct);
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct);
}

public sealed class MemoryStanleyReminderStore : IStanleyReminderStore
{
    private readonly List<StanleyReminderRow> _rows = [];
    private long _next;

    private static StanleyReminderRow Copy(StanleyReminderRow r) => new() { Id = r.Id, PublicId = r.PublicId, UserId = r.UserId, DueAt = r.DueAt, Text = r.Text, CreatedAt = r.CreatedAt };

    public Task AddAsync(StanleyReminderRow row, CancellationToken ct)
    {
        lock (_rows) { row.Id = ++_next; _rows.Add(Copy(row)); }
        return Task.CompletedTask;
    }

    public Task<List<StanleyReminderRow>> ListAsync(long userId, DateTime since, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId && r.DueAt >= since).OrderBy(r => r.DueAt).Select(Copy).ToList());
    }

    public Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.UserId == userId && r.PublicId == publicId) > 0);
    }

    public Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.DueAt < cutoff));
    }
}

public sealed class DapperStanleyReminderStore(IDbConnectionFactory db) : IStanleyReminderStore
{
    public async Task AddAsync(StanleyReminderRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.StanleyReminders (PublicId, UserId, DueAt, Text, CreatedAt) VALUES (@PublicId, @UserId, @DueAt, @Text, @CreatedAt)", row, null, ct));
    }

    public async Task<List<StanleyReminderRow>> ListAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StanleyReminderRow>(Sql.Cmd("SELECT Id, PublicId, UserId, DueAt, Text, CreatedAt FROM dbo.StanleyReminders WHERE UserId = @userId AND DueAt >= @since ORDER BY DueAt", new { userId, since }, null, ct))).ToList();
    }

    public async Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyReminders WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct)) > 0;
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyReminders WHERE DueAt < @cutoff", new { cutoff }, null, ct));
    }
}

/// <summary>
/// Reminders as push (docs/stanley-gap-analysis-and-plan.md, the carry-over list). A reminder is the guest's own: made by a confirmed Stanley action, listed and removed by them alone, and sent to their own phones
/// by the existing push dispatch (so a phone that has not allowed alerts gets nothing, and the on-device reminder still shows when the app is open). The text is what the guest chose; no other data goes in it.
/// </summary>
public sealed class StanleyReminderService(IStanleyReminderStore store, IClock clock)
{
    /// <summary>Sets a reminder for the next time the clock in <paramref name="zoneId"/> shows <paramref name="hhmm"/>. 400 time, 409 tooMany after ten waiting reminders. Returns the reminder's id.</summary>
    public async Task<Guid> SetAsync(UserRecord user, string? hhmm, string? text, string zoneId, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (!StanleyReminderRules.TimeOk(hhmm)) throw ApiException.Invalid("time");
        var now = clock.UtcNow;
        var waiting = await store.ListAsync(user.Id, now, ct);
        if (waiting.Count >= StanleyReminderRules.MaxPending) throw ApiException.Conflict("tooMany");
        var row = new StanleyReminderRow { PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = StanleyReminderRules.NextDue(now, hhmm!, zoneId), Text = StanleyReminderRules.Clean(text), CreatedAt = now };
        await store.AddAsync(row, ct);
        return row.PublicId;
    }

    /// <summary>The guest's reminders that are due to be sent now, for the push dispatch.</summary>
    public async Task<List<StanleyReminderDue>> DueAsync(long userId, DateTime now, CancellationToken ct)
    {
        var since = now.AddHours(-StanleyReminderRules.LateHours);
        var nowMs = TripRules.ToMs(now);
        return StanleyReminderRules.Sendable((await store.ListAsync(userId, since, ct)).Select(r => new StanleyReminderDue(r.PublicId, r.Text, TripRules.ToMs(r.DueAt))), nowMs);
    }

    public async Task<bool> CancelAsync(UserRecord user, Guid id, CancellationToken ct) => await store.DeleteAsync(user.Id, id, ct);

    /// <summary>Whether the guest already has a reminder with these words waiting, to settle an outcome that was not known.</summary>
    public async Task<bool> ExistsAsync(UserRecord user, string text, CancellationToken ct) =>
        (await store.ListAsync(user.Id, clock.UtcNow, ct)).Any(r => r.Text == StanleyReminderRules.Clean(text));
}
