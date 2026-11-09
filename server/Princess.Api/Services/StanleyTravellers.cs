using System.Text.Json;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public interface IStanleyTravellerStore
{
    /// <summary>The guest's saved travellers as JSON, or null. Anyone else's are never returned.</summary>
    Task<string?> GetAsync(long userId, CancellationToken ct);
    Task PutAsync(long userId, string json, DateTime at, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyTravellerStore : IStanleyTravellerStore
{
    private readonly Dictionary<long, string> _rows = [];

    public Task<string?> GetAsync(long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.TryGetValue(userId, out var r) ? r : null);
    }

    public Task PutAsync(long userId, string json, DateTime at, CancellationToken ct)
    {
        lock (_rows) _rows[userId] = json;
        return Task.CompletedTask;
    }
}

/// <summary>
/// The travellers a guest plans for, with their access and pace as sourced, dated records (phase 9). Held on the server so any device has them; owned by one guest and never shown to anyone else on the booking.
/// </summary>
public sealed class StanleyTravellerService(IStanleyTravellerStore store, IUserClock clock, IClock serverClock, IAuditLog audit)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<List<TravellerRecord>> ReadAsync(long userId, CancellationToken ct) =>
        await store.GetAsync(userId, ct) is { } json ? JsonSerializer.Deserialize<List<TravellerRecord>>(json, Json) ?? [] : [];

    public async Task<TravellerListDto> ListAsync(UserRecord user, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        return new([.. (await ReadAsync(user.Id, ct)).Select(r => StanleyTravellerRules.View(r, today))], StanleyTravellerRules.StaleDays, StanleyTravellerRules.Max);
    }

    public async Task<TravellerListDto> SaveAsync(UserRecord user, string? id, TravellerRecord? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        if (body is null || body.Id != id) throw ApiException.Invalid("id");
        if (StanleyTravellerRules.Problem(body, today) is { } problem) throw ApiException.Invalid(problem);
        var all = await ReadAsync(user.Id, ct);
        var before = all.FirstOrDefault(r => r.Id == id);
        if (before is null && all.Count >= StanleyTravellerRules.Max) throw ApiException.Conflict("tooMany");
        var clean = StanleyTravellerRules.Clean(body, before, today);
        var next = before is null ? [.. all, clean] : all.Select(r => r.Id == id ? clean : r).ToList();
        await store.PutAsync(user.Id, JsonSerializer.Serialize(next, Json), serverClock.UtcNow, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.traveller.save", Outcome = AuditOutcome.Success, Detail = "" }, ct);
        return new([.. next.Select(r => StanleyTravellerRules.View(r, today))], StanleyTravellerRules.StaleDays, StanleyTravellerRules.Max);
    }

    public async Task<TravellerListDto> DeleteAsync(UserRecord user, string? id, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        var all = await ReadAsync(user.Id, ct);
        if (all.All(r => r.Id != id)) throw ApiException.NotFound();
        var next = all.Where(r => r.Id != id).ToList();
        await store.PutAsync(user.Id, JsonSerializer.Serialize(next, Json), serverClock.UtcNow, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.traveller.delete", Outcome = AuditOutcome.Success, Detail = "" }, ct);
        return new([.. next.Select(r => StanleyTravellerRules.View(r, today))], StanleyTravellerRules.StaleDays, StanleyTravellerRules.Max);
    }
}
