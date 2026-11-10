using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public interface IStanleyMemoryStore
{
    /// <summary>The guest's items, oldest first. Anyone else's are never returned.</summary>
    Task<List<StanleyMemoryRow>> ListAsync(long userId, CancellationToken ct);
    Task AddAsync(StanleyMemoryRow row, CancellationToken ct);
    Task UpdateAsync(StanleyMemoryRow row, CancellationToken ct);
    /// <summary>True when an item of that guest was removed.</summary>
    Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct);
    Task DeleteAllAsync(long userId, CancellationToken ct);
    /// <summary>Memory is on unless the guest switched it off.</summary>
    Task<bool> GetEnabledAsync(long userId, CancellationToken ct);
    Task SetEnabledAsync(long userId, bool enabled, CancellationToken ct);
    /// <summary>How much Stanley speaks up (chatty, helpful, asked or off), or null when the guest has not chosen one.</summary>
    Task<string?> GetLevelAsync(long userId, CancellationToken ct);
    Task SetLevelAsync(long userId, string level, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyMemoryStore : IStanleyMemoryStore
{
    private readonly List<StanleyMemoryRow> _rows = [];
    private readonly Dictionary<long, bool> _enabled = [];
    private readonly Dictionary<long, string> _levels = [];
    private long _next;

    public Task<List<StanleyMemoryRow>> ListAsync(long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId).OrderBy(r => r.Id).ToList());
    }

    public Task AddAsync(StanleyMemoryRow row, CancellationToken ct)
    {
        lock (_rows) { row.Id = ++_next; _rows.Add(row); }
        return Task.CompletedTask;
    }

    public Task UpdateAsync(StanleyMemoryRow row, CancellationToken ct)
    {
        lock (_rows)
        {
            var i = _rows.FindIndex(r => r.Id == row.Id && r.UserId == row.UserId);
            if (i >= 0) _rows[i] = row;
        }
        return Task.CompletedTask;
    }

    public Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.UserId == userId && r.PublicId == publicId) > 0);
    }

    public Task DeleteAllAsync(long userId, CancellationToken ct)
    {
        lock (_rows) _rows.RemoveAll(r => r.UserId == userId);
        return Task.CompletedTask;
    }

    public Task<bool> GetEnabledAsync(long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(!_enabled.TryGetValue(userId, out var on) || on);
    }

    public Task SetEnabledAsync(long userId, bool enabled, CancellationToken ct)
    {
        lock (_rows) _enabled[userId] = enabled;
        return Task.CompletedTask;
    }

    public Task<string?> GetLevelAsync(long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_levels.TryGetValue(userId, out var l) ? l : null);
    }

    public Task SetLevelAsync(long userId, string level, CancellationToken ct)
    {
        lock (_rows) _levels[userId] = level;
        return Task.CompletedTask;
    }
}

/// <summary>
/// What Stanley remembers (docs/stanley-gap-analysis-and-plan.md, phase 7). Every call is for the signed-in guest's own items only; an id that is not theirs is not found. A child account cannot keep memory.
/// Forgetting deletes the row, so the next packet cannot hold it on any device. The audit trail records the kind and the action, never the value.
/// </summary>
public sealed class StanleyMemoryService(IStanleyMemoryStore store, IClock clock, IAuditLog audit)
{
    private static string Key(StanleyMemoryRow r) => r.Kind + "|" + r.Scope + "|" + r.SailingId;

    private async Task Record(string action, string detail, CancellationToken ct) =>
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.memory." + action, Outcome = AuditOutcome.Success, Detail = detail }, ct);

    public async Task<StanleyMemoryDto> GetAsync(UserRecord user, CancellationToken ct) =>
        new(await store.GetEnabledAsync(user.Id, ct), [.. (await store.ListAsync(user.Id, ct)).Select(StanleyMemoryRules.View)], StanleyMemoryRules.Catalogue(), await store.GetLevelAsync(user.Id, ct));

    public async Task<StanleyMemoryItemDto> RememberAsync(UserRecord user, StanleyMemoryItemRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (StanleyMemoryRules.Problem(body) is { } problem) throw ApiException.Invalid(problem);
        var all = await store.ListAsync(user.Id, ct);
        var row = new StanleyMemoryRow
        {
            PublicId = Guid.NewGuid(), UserId = user.Id, Kind = body!.Kind!, Value = body.Value!, Scope = body.Scope!, SailingId = body.Scope == "trip" ? body.SailingId!.Trim() : "",
            Source = string.IsNullOrEmpty(body.Source) ? "told" : body.Source, Share = body.Share ?? !StanleyMemoryRules.IsSensitive(body.Kind!), UpdatedAt = clock.UtcNow,
        };
        // The same thing said twice is one item. A single-valued kind (pace) is replaced, a multi-valued one (interest) gains one value.
        var same = all.FirstOrDefault(r => r.Kind == row.Kind && r.Scope == row.Scope && r.SailingId == row.SailingId && (StanleyMemoryRules.IsMultiple(r.Kind) ? r.Value == row.Value : true));
        if (same is not null)
        {
            row.Id = same.Id; row.PublicId = same.PublicId;
            await store.UpdateAsync(row, ct);
        }
        else
        {
            if (all.Count >= StanleyMemoryRules.MaxItems) throw ApiException.Conflict("tooMany");
            await store.AddAsync(row, ct);
        }
        await Record("remember", row.Kind, ct);
        return StanleyMemoryRules.View(row);
    }

    public async Task<StanleyMemoryItemDto> UpdateAsync(UserRecord user, Guid id, StanleyMemoryUpdateRequest? body, CancellationToken ct)
    {
        if (body is null || (body.Scope is null && body.Share is null)) throw ApiException.Invalid("scope");
        if (body.Scope is not null && !StanleyMemoryRules.Scopes.Contains(body.Scope)) throw ApiException.Invalid("scope");
        var all = await store.ListAsync(user.Id, ct);
        var row = all.FirstOrDefault(r => r.PublicId == id) ?? throw ApiException.NotFound();
        if (body.Scope is not null && body.Scope != row.Scope)
        {
            if (body.Scope == "trip") throw ApiException.Invalid("sailing");   // A trip item is made by saying it again for a trip; only "carry forward" moves one.
            row.Scope = "future"; row.SailingId = "";
            // A future item of the same kind already kept (single-valued) or the same value (multi-valued) is replaced by this one.
            foreach (var other in all.Where(o => o.Id != row.Id && o.Kind == row.Kind && o.Scope == "future" && (!StanleyMemoryRules.IsMultiple(o.Kind) || o.Value == row.Value)))
                await store.DeleteAsync(user.Id, other.PublicId, ct);
        }
        if (body.Share is { } share && StanleyMemoryRules.IsSensitive(row.Kind)) row.Share = share;
        row.UpdatedAt = clock.UtcNow;
        await store.UpdateAsync(row, ct);
        await Record("update", row.Kind, ct);
        return StanleyMemoryRules.View(row);
    }

    public async Task ForgetAsync(UserRecord user, Guid id, CancellationToken ct)
    {
        var all = await store.ListAsync(user.Id, ct);
        var row = all.FirstOrDefault(r => r.PublicId == id) ?? throw ApiException.NotFound();
        await store.DeleteAsync(user.Id, id, ct);
        await Record("forget", row.Kind, ct);
    }

    public async Task ForgetAllAsync(UserRecord user, CancellationToken ct)
    {
        await store.DeleteAllAsync(user.Id, ct);
        await Record("forgetAll", "", ct);
    }

    public async Task SetEnabledAsync(UserRecord user, bool enabled, CancellationToken ct)
    {
        await store.SetEnabledAsync(user.Id, enabled, ct);
        await Record(enabled ? "on" : "off", "", ct);
    }

    /// <summary>Keeps how much Stanley speaks up for the signed-in guest, so a new device starts with the same choice. A child account keeps none. The audit trail records the level word only.</summary>
    public async Task SetLevelAsync(UserRecord user, string? level, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (level is null || !StanleyMemoryRules.Levels.Contains(level)) throw ApiException.Invalid("level");
        await store.SetLevelAsync(user.Id, level, ct);
        await Record("level", level, ct);
    }

    /// <summary>The settings call: memory on or off, the level, or both. At least one must be given.</summary>
    public async Task SetSettingsAsync(UserRecord user, StanleyMemorySettingsRequest? body, CancellationToken ct)
    {
        if (body is null || (body.Enabled is null && body.Level is null)) throw ApiException.Invalid("settings");
        if (body.Level is not null) await SetLevelAsync(user, body.Level, ct);
        if (body.Enabled is { } on) await SetEnabledAsync(user, on, ct);
    }

    /// <summary>What the packet may carry for this guest and voyage. Read from the store on every request, so a forgotten item is gone at once.</summary>
    public async Task<List<string>> ForAnswersAsync(UserRecord user, string? sailingId, CancellationToken ct) =>
        user.IsSupervised ? [] : StanleyMemoryRules.ForAnswers(await store.ListAsync(user.Id, ct), await store.GetEnabledAsync(user.Id, ct), sailingId);
}
