using System.Text.Json;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public interface IStanleyBriefStore
{
    /// <summary>The guest's saved brief as JSON and when it was saved, or null. Anyone else's is never returned.</summary>
    Task<(string Json, DateTime UpdatedAt)?> GetAsync(long userId, CancellationToken ct);
    Task PutAsync(long userId, string json, DateTime at, CancellationToken ct);
    Task DeleteAsync(long userId, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyBriefStore : IStanleyBriefStore
{
    private readonly Dictionary<long, (string, DateTime)> _rows = [];

    public Task<(string Json, DateTime UpdatedAt)?> GetAsync(long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult<(string, DateTime)?>(_rows.TryGetValue(userId, out var r) ? r : null);
    }

    public Task PutAsync(long userId, string json, DateTime at, CancellationToken ct)
    {
        lock (_rows) _rows[userId] = (json, at);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(long userId, CancellationToken ct)
    {
        lock (_rows) _rows.Remove(userId);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Dream and Discover intelligence (docs/stanley-gap-analysis-and-plan.md, phase 8). Reading the words, finding directions and comparing sailings need no sign-in and no guest data; they read the catalogue
/// and are calculated by <see cref="StanleyDiscoverRules"/>. The decision brief is the signed-in guest's own, one per guest, so it is the same on every device. The booking check never stores what it is sent.
/// </summary>
public sealed class StanleyDiscoverService(ICatalogueStore catalogue, IStanleyBriefStore briefs, IClock clock, IAuditLog audit)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public InterviewDto Interview(DiscoverInterviewRequest? body)
    {
        var text = body?.Text;
        if (string.IsNullOrWhiteSpace(text)) throw ApiException.Invalid("text");
        if (text.Length > StanleyDiscoverRules.TextMax) throw ApiException.Invalid("tooLong");
        return StanleyDiscoverRules.Interview(text);
    }

    public async Task<List<DiscoverCandidate>> CandidatesAsync(CancellationToken ct)
    {
        var s = await catalogue.GetAsync(ct);
        var ports = s.Ports.ToDictionary(p => p.Id);
        var days = s.SailingDays.ToLookup(d => d.OwnerId);
        var cheapest = s.Fares.GroupBy(f => f.SailingId).ToDictionary(g => g.Key, g => g.Min(f => f.PerNightCents));
        return [.. s.Sailings.Select(x =>
        {
            var rows = days[x.Id].OrderBy(d => d.Day).ToList();
            List<DiscoverCall>? calls = null; int? sea = null;
            if (rows.Count >= 2)
            {
                var last = rows[^1].Day;
                calls = [.. rows.Where(d => d.PortId != "sea" && d.Day != 1 && d.Day != last).Select(d =>
                {
                    ports.TryGetValue(d.PortId, out var p);
                    double? hours = d.ArriveLocal is { } a && d.DepartLocal is { } b && b > a ? (b - a).TotalHours : null;
                    return new DiscoverCall(p?.Name ?? d.PortId, hours, p?.Tender ?? false);
                })];
                sea = rows.Count(d => d.PortId == "sea");
            }
            long? perNight = cheapest.TryGetValue(x.Id, out var c) ? c : null;
            return new DiscoverCandidate(x.Id, x.Title, x.ShipId, DateOnly.FromDateTime(x.Departure), x.Nights, x.RegionId, perNight, perNight * x.Nights, x.IsHoliday, x.BookingOpen, calls, sea);
        })];
    }

    public async Task<DiscoverDirectionsDto> DirectionsAsync(DiscoverDirectionsRequest? body, CancellationToken ct)
    {
        var filters = StanleyDiscoverRules.Clean(body?.Filters) ?? throw ApiException.Invalid("filters");
        return StanleyDiscoverRules.Directions(filters, await CandidatesAsync(ct), TripRules.Today(clock.UtcNow));
    }

    public async Task<CompareDto> CompareAsync(DiscoverCompareRequest? body, CancellationToken ct)
    {
        var ids = body?.SailingIds?.Distinct().ToArray() ?? [];
        if (ids.Length < 2 || ids.Length > StanleyDiscoverRules.MaxCompare) throw ApiException.Invalid("sailings");
        var weights = StanleyDiscoverRules.CleanWeights(body!.Weights) ?? throw ApiException.Invalid("weights");
        var filters = StanleyDiscoverRules.Clean(body.Filters) ?? throw ApiException.Invalid("filters");
        var all = (await CandidatesAsync(ct)).ToDictionary(c => c.Id);
        if (ids.Any(id => !all.ContainsKey(id))) throw ApiException.Invalid("sailings");
        return StanleyDiscoverRules.Compare([.. ids.Select(id => all[id])], weights, filters);
    }

    public BookingCheckDto CheckBooking(BookingCheckRequest? body) => StanleyDiscoverRules.CheckBooking(body, TripRules.Today(clock.UtcNow));

    private static DiscoverBrief Read(string json) => JsonSerializer.Deserialize<DiscoverBrief>(json, Json) ?? new(null, null, null, null, null);

    public async Task<DiscoverBriefDto> GetBriefAsync(UserRecord user, CancellationToken ct) =>
        await briefs.GetAsync(user.Id, ct) is { } r ? new(Read(r.Json), r.UpdatedAt) : new(new(null, null, null, null, null), null);

    public async Task<DiscoverBriefDto> PutBriefAsync(UserRecord user, DiscoverBrief? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var known = (await catalogue.GetAsync(ct)).Sailings.Select(s => s.Id).ToHashSet();
        if (StanleyDiscoverRules.BriefProblem(body, known) is { } problem) throw ApiException.Invalid(problem);
        var clean = body! with { Text = body.Text?.Trim(), Filters = StanleyDiscoverRules.Clean(body.Filters), Weights = body.Weights is null ? null : StanleyDiscoverRules.CleanWeights(body.Weights) };
        var now = clock.UtcNow;
        await briefs.PutAsync(user.Id, JsonSerializer.Serialize(clean, Json), now, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.brief.save", Outcome = AuditOutcome.Success, Detail = "" }, ct);
        return new(clean, now);
    }

    public async Task DeleteBriefAsync(UserRecord user, CancellationToken ct)
    {
        await briefs.DeleteAsync(user.Id, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.brief.delete", Outcome = AuditOutcome.Success, Detail = "" }, ct);
    }

    /// <summary>The shareable text of the guest's brief. Needs are left out unless asked for.</summary>
    public async Task<string> ShareAsync(UserRecord user, bool includeNeeds, CancellationToken ct)
    {
        var r = await briefs.GetAsync(user.Id, ct) ?? throw ApiException.NotFound();
        var titles = (await catalogue.GetAsync(ct)).Sailings.ToDictionary(s => s.Id, s => $"{s.Title}, {s.Departure:yyyy-MM-dd}");
        return StanleyDiscoverRules.ShareText(Read(r.Json), titles, includeNeeds);
    }
}
