using System.Text.Json;
using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>The day plan as the device last listed it for one guest and sailing, and when the server was told.</summary>
public sealed record StanleyPlanSnapshot(List<StanleyPlanEntry> Plan, DateTime UpdatedAt);

/// <summary>
/// Where the server keeps the guest's day plan (docs/stanley-gap-analysis-and-plan.md, the carry-over list: a plan change was checked only against the snapshot the device sent with the request). The plan itself
/// still lives on the device, but the server now holds the last snapshot it was given, so a request that arrives without one (another tab, a retry, an old build) is checked against the same plan the guest
/// saw, and a preview and its confirm are both checked against one snapshot rather than whatever each request carries. Titles and times only, no guest data; one row per guest and sailing.
/// </summary>
public interface IStanleyPlanSnapshotStore
{
    Task<StanleyPlanSnapshot?> GetAsync(long userId, string sailingId, CancellationToken ct);
    Task PutAsync(long userId, string sailingId, IReadOnlyList<StanleyPlanEntry> plan, DateTime now, CancellationToken ct);
    /// <summary>Deletes snapshots not refreshed since <paramref name="cutoff"/> and returns how many went.</summary>
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct);
}

public sealed class MemoryStanleyPlanSnapshotStore : IStanleyPlanSnapshotStore
{
    private readonly Dictionary<(long, string), StanleyPlanSnapshot> _rows = [];

    public Task<StanleyPlanSnapshot?> GetAsync(long userId, string sailingId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.TryGetValue((userId, sailingId), out var s) ? new StanleyPlanSnapshot([.. s.Plan], s.UpdatedAt) : null);
    }

    public Task PutAsync(long userId, string sailingId, IReadOnlyList<StanleyPlanEntry> plan, DateTime now, CancellationToken ct)
    {
        lock (_rows) _rows[(userId, sailingId)] = new StanleyPlanSnapshot([.. plan], now);
        return Task.CompletedTask;
    }

    public Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        lock (_rows)
        {
            var old = _rows.Where(kv => kv.Value.UpdatedAt < cutoff).Select(kv => kv.Key).ToList();
            foreach (var k in old) _rows.Remove(k);
            return Task.FromResult(old.Count);
        }
    }
}

public sealed class DapperStanleyPlanSnapshotStore(IDbConnectionFactory db) : IStanleyPlanSnapshotStore
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<StanleyPlanSnapshot?> GetAsync(long userId, string sailingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QueryFirstOrDefaultAsync<(string Json, DateTime UpdatedAt)?>(Sql.Cmd("SELECT Json, UpdatedAt FROM dbo.StanleyPlanSnapshots WHERE UserId = @userId AND SailingId = @sailingId", new { userId, sailingId }, null, ct));
        return row is { } r ? new StanleyPlanSnapshot(JsonSerializer.Deserialize<List<StanleyPlanEntry>>(r.Json, Json) ?? [], r.UpdatedAt) : null;
    }

    public async Task PutAsync(long userId, string sailingId, IReadOnlyList<StanleyPlanEntry> plan, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var json = JsonSerializer.Serialize(plan, Json);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.StanleyPlanSnapshots AS t USING (SELECT @userId AS UserId, @sailingId AS SailingId) AS s ON t.UserId = s.UserId AND t.SailingId = s.SailingId
            WHEN MATCHED THEN UPDATE SET Json = @json, UpdatedAt = @now
            WHEN NOT MATCHED THEN INSERT (UserId, SailingId, Json, UpdatedAt) VALUES (@userId, @sailingId, @json, @now);
            """, new { userId, sailingId, json, now }, null, ct));
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyPlanSnapshots WHERE UpdatedAt < @cutoff", new { cutoff }, null, ct));
    }
}

/// <summary>How a request's day plan and the server's snapshot are reconciled.</summary>
public static class StanleyPlanSnapshots
{
    /// <summary>A snapshot older than this is not used for a request that sends no plan: a day-old plan may no longer be today's.</summary>
    public static readonly TimeSpan MaxAge = TimeSpan.FromDays(1);

    /// <summary>
    /// The context to use for a request. A plan the device sent (already cleaned) is kept as the new snapshot and used. With none, the guest's saved snapshot is used when it is recent; with
    /// none of that, the context stays without a plan and a plan change asks the guest to open the plan first, as before.
    /// </summary>
    public static async Task<StanleyActionContext> MergeAsync(IStanleyPlanSnapshotStore? store, long userId, StanleyActionContext ctx, DateTime now, CancellationToken ct)
    {
        if (store is null) return ctx;
        var key = ctx.SailingId ?? "";
        if (ctx.Plan is { Count: > 0 } plan)
        {
            await store.PutAsync(userId, key, plan, now, ct);
            return ctx;
        }
        var saved = await store.GetAsync(userId, key, ct);
        return saved is { Plan.Count: > 0 } s && now - s.UpdatedAt < MaxAge ? ctx with { Plan = s.Plan } : ctx;
    }
}
