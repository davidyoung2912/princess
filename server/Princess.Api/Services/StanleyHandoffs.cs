using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public interface IStanleyHandoffStore
{
    Task AddAsync(StanleyHandoffRow row, CancellationToken ct);
    /// <summary>The guest's handoffs, newest first. Anyone else's are never returned.</summary>
    Task<List<StanleyHandoffRow>> ListAsync(long userId, int max, CancellationToken ct);
    /// <summary>Every guest's handoffs opened since a time, for the administrators' counts. Only <c>Topic</c> and <c>OpenedAt</c> are filled; no guest and no words.</summary>
    Task<List<StanleyHandoffRow>> SinceAsync(DateTime since, int max, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyHandoffStore : IStanleyHandoffStore
{
    private readonly List<StanleyHandoffRow> _rows = [];
    private long _next;

    public Task AddAsync(StanleyHandoffRow row, CancellationToken ct)
    {
        lock (_rows) { row.Id = ++_next; _rows.Add(row); }
        return Task.CompletedTask;
    }

    public Task<List<StanleyHandoffRow>> ListAsync(long userId, int max, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId).OrderByDescending(r => r.OpenedAt).ThenByDescending(r => r.Id).Take(max).ToList());
    }

    public Task<List<StanleyHandoffRow>> SinceAsync(DateTime since, int max, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.OpenedAt >= since).OrderByDescending(r => r.OpenedAt).Take(max).Select(r => new StanleyHandoffRow { Topic = r.Topic, OpenedAt = r.OpenedAt }).ToList());
    }
}

/// <summary>
/// Human handoff (docs/stanley-gap-analysis-and-plan.md, phase 6). A case exists only once <see cref="CreateAsync"/> has stored it and given it a reference, and the device says "handed to Guest Services"
/// only from that answer. The guest must have agreed to the exact text (<c>consent</c>), a child account cannot send one, and an emergency is not a topic. What goes in the audit trail is the topic and
/// the reference, never the guest's words. The case's progress is worked out from the clock (<see cref="StanleyHandoffRules.StatusOf"/>) because the staff side is simulated.
/// </summary>
public sealed class StanleyHandoffService(IStanleyHandoffStore store, IClock clock, IAuditLog audit, IOptions<StanleyOptions> options, IOperatorAlerts? alerts = null)
{
    private static string Clean(string? s) => (s ?? "").Trim();

    public async Task<StanleyHandoffDto> CreateAsync(UserRecord user, StanleyHandoffRequest? body, CancellationToken ct)
    {
        if (!options.Value.Switches.Handoff) throw ApiException.Conflict("off");
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (StanleyHandoffRules.Problem(body) is { } problem) throw ApiException.Invalid(problem);
        var now = clock.UtcNow;
        var existing = await store.ListAsync(user.Id, 100, ct);
        // At most ten in a day, so a stuck device cannot flood the desk.
        if (existing.Count(r => now < r.OpenedAt.AddHours(24)) >= StanleyHandoffRules.MaxOpen) throw ApiException.Conflict("tooManyCases");
        var row = new StanleyHandoffRow
        {
            PublicId = Guid.NewGuid(), UserId = user.Id, Topic = body!.Topic!, Reference = StanleyHandoffRules.Reference(user.PublicId.ToString(), existing.Count),
            Issue = Clean(body.Issue), Outcome = Clean(body.Outcome), BookingRef = Clean(body.Reference), Tried = Clean(body.Tried), Attachment = Clean(body.Attachment), Role = Clean(body.Role),
            OpenedAt = now, Source = "sim",
        };
        await store.AddAsync(row, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.handoff", Outcome = AuditOutcome.Success, Target = row.Reference, Detail = row.Topic }, ct);
        // An urgent case tells whoever is on duty at once. The alert holds the topic, the desk and the reference only, and a failure to send it never fails the guest's request.
        if (alerts is not null && StanleyHandoffRules.IsUrgent(row.Topic))
        {
            var a = StanleyHandoffRules.AlertFor(row.Topic, row.Reference);
            try { await alerts.NotifyAsync(new OperatorAlert("urgent", "handoff", a.Summary, a.Reference), ct); }
            catch (Exception e) when (e is not OperationCanceledException) { /* the sender logs its own failure; the case is already stored */ }
        }
        return StanleyHandoffRules.View(row, now);
    }

    public async Task<List<StanleyHandoffDto>> ListAsync(UserRecord user, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return (await store.ListAsync(user.Id, 50, ct)).Select(r => StanleyHandoffRules.View(r, now)).ToList();
    }

    public async Task<StanleyHandoffDto> GetAsync(UserRecord user, Guid id, CancellationToken ct)
    {
        var row = (await store.ListAsync(user.Id, 100, ct)).FirstOrDefault(r => r.PublicId == id) ?? throw ApiException.NotFound();
        return StanleyHandoffRules.View(row, clock.UtcNow);
    }
}
