using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>One row of the due queue (<c>StanleyRuleDue</c>). Ids and keys only, never the guest's words.</summary>
public sealed class StanleyDueRow
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string IdemKey { get; set; } = "";
    public DateTime DueAt { get; set; }
    public string TriggerKind { get; set; } = StanleyTrigger.Time;
    public string ClassId { get; set; } = "";
    public int RankNo { get; set; } = StanleyRank.Convenience;
    public bool Critical { get; set; }
    public string Subject { get; set; } = "";
    public string FactKey { get; set; } = "";
    public string State { get; set; } = StanleyDueState.Pending;
    public string? LeaseOwner { get; set; }
    public DateTime? LeaseUntil { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public StanleyDue ToDue() => new(IdemKey, UserId, DueAt, TriggerKind, ClassId, RankNo, Critical, Subject, FactKey);
}

/// <summary>
/// The due queue shared by reminders (R3) and standing rules (P2c). Every item has a unique idempotency key, so queuing the same thing twice does nothing. A worker claims due items
/// under a lease; if it dies the lease runs out and another worker takes them over, so nothing is lost and nothing is sent twice by two workers at once.
/// </summary>
public interface IStanleyDueStore
{
    /// <summary>Queues the item; false when the key is already there (queued, done or held).</summary>
    Task<bool> EnqueueAsync(StanleyDueRow row, CancellationToken ct);
    /// <summary>Claims up to <paramref name="max"/> pending items due by <paramref name="now"/>, and items whose lease has run out, soonest first.</summary>
    Task<List<StanleyDueRow>> ClaimDueAsync(DateTime now, string owner, TimeSpan lease, int max, CancellationToken ct);
    /// <summary>Closes the item (done, held or dropped) with a reason. Only the lease owner can.</summary>
    Task<bool> CompleteAsync(long id, string owner, string state, string? reason, CancellationToken ct);
    /// <summary>Puts a claimed item back as pending for a later time (a paused class, a failed delivery).</summary>
    Task<bool> RescheduleAsync(long id, string owner, DateTime dueAt, string? reason, CancellationToken ct);
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct);
}

public sealed class MemoryStanleyDueStore : IStanleyDueStore
{
    private readonly List<StanleyDueRow> _rows = [];
    private long _next;

    private static StanleyDueRow Copy(StanleyDueRow r) => new()
    {
        Id = r.Id, UserId = r.UserId, IdemKey = r.IdemKey, DueAt = r.DueAt, TriggerKind = r.TriggerKind, ClassId = r.ClassId, RankNo = r.RankNo, Critical = r.Critical, Subject = r.Subject,
        FactKey = r.FactKey, State = r.State, LeaseOwner = r.LeaseOwner, LeaseUntil = r.LeaseUntil, Reason = r.Reason, CreatedAt = r.CreatedAt,
    };

    /// <summary>A copy of every row in queue order, for the test harness to read what became of each item.</summary>
    public List<StanleyDueRow> Snapshot()
    {
        lock (_rows) return _rows.OrderBy(r => r.Id).Select(Copy).ToList();
    }

    public Task<bool> EnqueueAsync(StanleyDueRow row, CancellationToken ct)
    {
        lock (_rows)
        {
            if (_rows.Any(r => r.IdemKey == row.IdemKey)) return Task.FromResult(false);
            row.Id = ++_next;
            _rows.Add(Copy(row));
            return Task.FromResult(true);
        }
    }

    public Task<List<StanleyDueRow>> ClaimDueAsync(DateTime now, string owner, TimeSpan lease, int max, CancellationToken ct)
    {
        lock (_rows)
        {
            var claimable = _rows
                .Where(r => r.DueAt <= now && (r.State == StanleyDueState.Pending || (r.State == StanleyDueState.Claimed && r.LeaseUntil < now)))
                .OrderBy(r => r.DueAt).ThenBy(r => r.Id).Take(max).ToList();
            foreach (var r in claimable) { r.State = StanleyDueState.Claimed; r.LeaseOwner = owner; r.LeaseUntil = now + lease; }
            return Task.FromResult(claimable.Select(Copy).ToList());
        }
    }

    public Task<bool> CompleteAsync(long id, string owner, string state, string? reason, CancellationToken ct)
    {
        lock (_rows)
        {
            var r = _rows.FirstOrDefault(x => x.Id == id && x.State == StanleyDueState.Claimed && x.LeaseOwner == owner);
            if (r is null) return Task.FromResult(false);
            r.State = state; r.Reason = reason; r.LeaseOwner = null; r.LeaseUntil = null;
            return Task.FromResult(true);
        }
    }

    public Task<bool> RescheduleAsync(long id, string owner, DateTime dueAt, string? reason, CancellationToken ct)
    {
        lock (_rows)
        {
            var r = _rows.FirstOrDefault(x => x.Id == id && x.State == StanleyDueState.Claimed && x.LeaseOwner == owner);
            if (r is null) return Task.FromResult(false);
            r.State = StanleyDueState.Pending; r.DueAt = dueAt; r.Reason = reason; r.LeaseOwner = null; r.LeaseUntil = null;
            return Task.FromResult(true);
        }
    }

    public Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.DueAt < cutoff && r.State != StanleyDueState.Pending && r.State != StanleyDueState.Claimed));
    }
}

public sealed class DapperStanleyDueStore(IDbConnectionFactory db) : IStanleyDueStore
{
    private const string Columns = "Id, UserId, IdemKey, DueAt, TriggerKind, ClassId, RankNo, Critical, Subject, FactKey, [State], LeaseOwner, LeaseUntil, Reason, CreatedAt";

    public async Task<bool> EnqueueAsync(StanleyDueRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "IF NOT EXISTS (SELECT 1 FROM dbo.StanleyRuleDue WHERE IdemKey = @IdemKey) INSERT INTO dbo.StanleyRuleDue (UserId, IdemKey, DueAt, TriggerKind, ClassId, RankNo, Critical, Subject, FactKey, [State], CreatedAt) VALUES (@UserId, @IdemKey, @DueAt, @TriggerKind, @ClassId, @RankNo, @Critical, @Subject, @FactKey, @State, @CreatedAt)",
            row, null, ct)) > 0;
    }

    public async Task<List<StanleyDueRow>> ClaimDueAsync(DateTime now, string owner, TimeSpan lease, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // READPAST and UPDLOCK let two workers claim different rows at the same time without waiting on each other.
        return (await c.QueryAsync<StanleyDueRow>(Sql.Cmd(
            "WITH due AS (SELECT TOP (@max) * FROM dbo.StanleyRuleDue WITH (UPDLOCK, READPAST, ROWLOCK) WHERE DueAt <= @now AND ([State] = 'pending' OR ([State] = 'claimed' AND LeaseUntil < @now)) ORDER BY DueAt, Id) " +
            "UPDATE due SET [State] = 'claimed', LeaseOwner = @owner, LeaseUntil = @until OUTPUT " + string.Join(", ", Columns.Split(", ").Select(x => "inserted." + x)),
            new { max, now, owner, until = now + lease }, null, ct))).ToList();
    }

    public async Task<bool> CompleteAsync(long id, string owner, string state, string? reason, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.StanleyRuleDue SET [State] = @state, Reason = @reason, LeaseOwner = NULL, LeaseUntil = NULL WHERE Id = @id AND [State] = 'claimed' AND LeaseOwner = @owner", new { id, owner, state, reason }, null, ct)) > 0;
    }

    public async Task<bool> RescheduleAsync(long id, string owner, DateTime dueAt, string? reason, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.StanleyRuleDue SET [State] = 'pending', DueAt = @dueAt, Reason = @reason, LeaseOwner = NULL, LeaseUntil = NULL WHERE Id = @id AND [State] = 'claimed' AND LeaseOwner = @owner", new { id, owner, dueAt, reason }, null, ct)) > 0;
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyRuleDue WHERE DueAt < @cutoff AND [State] NOT IN ('pending', 'claimed')", new { cutoff }, null, ct));
    }
}

/// <summary>What each class has done lately, so a runaway class pauses itself.</summary>
public interface IStanleyBreakerStore
{
    Task<BreakerState> GetAsync(string classId, CancellationToken ct);
    Task SaveAsync(string classId, BreakerState state, CancellationToken ct);
}

public sealed class MemoryStanleyBreakerStore : IStanleyBreakerStore
{
    private readonly Dictionary<string, BreakerState> _states = [];

    public Task<BreakerState> GetAsync(string classId, CancellationToken ct)
    {
        lock (_states) return Task.FromResult(_states.TryGetValue(classId, out var s) ? s : StanleyBreakerRules.Fresh);
    }

    public Task SaveAsync(string classId, BreakerState state, CancellationToken ct)
    {
        lock (_states) _states[classId] = state;
        return Task.CompletedTask;
    }
}

public sealed class DapperStanleyBreakerStore(IDbConnectionFactory db) : IStanleyBreakerStore
{
    private sealed class Row { public DateTime WindowStart { get; set; } public int Count { get; set; } public DateTime? PausedUntil { get; set; } }

    public async Task<BreakerState> GetAsync(string classId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var r = await c.QueryFirstOrDefaultAsync<Row>(Sql.Cmd("SELECT WindowStart, [Count], PausedUntil FROM dbo.StanleyBreaker WHERE ClassId = @classId", new { classId }, null, ct));
        return r is null ? StanleyBreakerRules.Fresh : new(r.WindowStart, r.Count, r.PausedUntil);
    }

    public async Task SaveAsync(string classId, BreakerState state, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.StanleyBreaker SET WindowStart = @WindowStart, [Count] = @Count, PausedUntil = @PausedUntil WHERE ClassId = @classId; " +
            "IF @@ROWCOUNT = 0 INSERT INTO dbo.StanleyBreaker (ClassId, WindowStart, [Count], PausedUntil) VALUES (@classId, @WindowStart, @Count, @PausedUntil)",
            new { classId, state.WindowStart, state.Count, state.PausedUntil }, null, ct));
    }
}
