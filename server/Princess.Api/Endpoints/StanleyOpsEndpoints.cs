using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

public sealed record StanleyOpsBreakerDto(string State, int Count, long? PausedUntil);
public sealed record StanleyOpsClassDto(string ClassId, int Pending, int Claimed, int Done, int Held, int Dropped, StanleyOpsBreakerDto Breaker, bool SwitchedOff, string? SwitchReason);
public sealed record StanleyOpsProposalDto(string Reason, long At, long ExpiresAt);
public sealed record StanleyOpsGlobalDto(bool Paused, string? Reason, long? Since, StanleyOpsProposalDto? Proposal);
public sealed record StanleyOpsHealthDto(long At, StanleyOpsGlobalDto Global, IReadOnlyList<StanleyOpsClassDto> Classes);
public sealed record StanleyOpsSwitchBody(bool Off, string? Reason);
public sealed record StanleyOpsReasonBody(string? Reason);
public sealed record StanleyOpsGlobalResultDto(string Outcome, StanleyOpsGlobalDto Global);

/// <summary>
/// The Stanley operations console, aggregates and switches only (docs/stanley-actions-and-proactive-plan.md, 20.2). Administrators only. It shows counts per class, never a guest, and every change needs a reason that is recorded with who made it.
/// </summary>
public static class StanleyOpsEndpoints
{
    public static void MapStanleyOpsEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/admin/stanley/health", async (ICurrentUser me, IStanleyDueStore due, IStanleyBreakerStore breakers, IStanleyOpsStore ops, IClock clock, CancellationToken ct) =>
            {
                await RequireAdminAsync(me, ct);
                return Results.Ok(await HealthAsync(due, breakers, ops, clock.UtcNow, ct));
            })
            .WithTags("Stanley").WithSummary("Administrators only (403 otherwise): per class, how many scheduled items are pending, claimed, done, held and dropped, the circuit breaker state, and whether an operator switched the class off; plus the global pause and any proposal waiting for a second person. Aggregate counts only.");

        api.MapPut("/admin/stanley/switches/class/{classId}", async (string classId, StanleyOpsSwitchBody body, ICurrentUser me, IStanleyOpsStore ops, IAuditLog audit, IClock clock, CancellationToken ct) =>
            {
                var admin = await RequireAdminAsync(me, ct);
                if (!StanleyOpsRules.ValidClass(classId) || !StanleyOpsRules.ValidReason(body.Reason, out var reason)) throw ApiException.Invalid();
                await ops.SetAsync(new(StanleyOpsRules.ScopeClass, classId, body.Off, reason, admin.PublicId, clock.UtcNow), ct);
                await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = body.Off ? "stanley.ops.classOff" : "stanley.ops.classOn", Outcome = AuditOutcome.Success, Target = classId, Detail = reason }, ct);
                return Results.NoContent();
            })
            .WithTags("Stanley").WithSummary("Administrators only: switch one class of proactive output off or on, with a reason (5 to 200 characters). A class that is off is dropped, never delivered. Recorded in the audit trail with who and why.");

        api.MapPost("/admin/stanley/switches/global", async (StanleyOpsSwitchBody body, ICurrentUser me, IStanleyOpsStore ops, IStanleyDueStore due, IStanleyBreakerStore breakers, IAuditLog audit, IClock clock, CancellationToken ct) =>
            {
                var admin = await RequireAdminAsync(me, ct);
                if (!StanleyOpsRules.ValidReason(body.Reason, out var reason)) throw ApiException.Invalid();
                var now = clock.UtcNow;
                var rows = await ops.ListAsync(ct);
                var decision = StanleyOpsRules.Global(StanleyOpsRules.GlobalPaused(rows), await ops.GetProposalAsync(ct), body.Off, reason, admin.PublicId, now);
                string action;
                switch (decision.Outcome)
                {
                    case StanleyOpsRules.Proposed:
                        await ops.SaveProposalAsync(decision.Proposal, ct);
                        action = "stanley.ops.globalProposed";
                        break;
                    case StanleyOpsRules.NeedsSecondPerson:
                        action = "stanley.ops.globalNeedsSecond";
                        break;
                    default:
                        await ops.SetAsync(new(StanleyOpsRules.ScopeGlobal, StanleyOpsRules.GlobalName, body.Off, reason, admin.PublicId, now), ct);
                        await ops.SaveProposalAsync(null, ct);
                        action = body.Off ? "stanley.ops.globalOn" : "stanley.ops.globalOff";
                        break;
                }
                await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = action, Outcome = decision.Outcome == StanleyOpsRules.NeedsSecondPerson ? AuditOutcome.Denied : AuditOutcome.Success, Target = StanleyOpsRules.GlobalName, Detail = reason }, ct);
                return Results.Ok(new StanleyOpsGlobalResultDto(decision.Outcome, (await HealthAsync(due, breakers, ops, now, ct)).Global));
            })
            .WithTags("Stanley").WithSummary("Administrators only: pause all proactive Stanley output (critical items still go) or release it. Pausing needs two different administrators within an hour: the first call returns `proposed`, the second from someone else returns `applied`, the same person again returns `needsSecondPerson`. Releasing is applied at once.");

        api.MapPost("/admin/stanley/breakers/{classId}/reset", async (string classId, StanleyOpsReasonBody body, ICurrentUser me, IStanleyBreakerStore breakers, IAuditLog audit, CancellationToken ct) =>
            {
                await RequireAdminAsync(me, ct);
                if (!StanleyOpsRules.ValidClass(classId) || !StanleyOpsRules.ValidReason(body.Reason, out var reason)) throw ApiException.Invalid();
                await breakers.SaveAsync(classId, StanleyBreakerRules.Fresh, ct);
                await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.ops.breakerReset", Outcome = AuditOutcome.Success, Target = classId, Detail = reason }, ct);
                return Results.NoContent();
            })
            .WithTags("Stanley").WithSummary("Administrators only: close a class's tripped circuit breaker after review, with a reason. Its held items are tried again at their next pass.");
    }

    private static async Task<UserRecord> RequireAdminAsync(ICurrentUser me, CancellationToken ct)
    {
        if (me.ActorPublicId is not null) throw ApiException.Forbidden();
        var user = await me.LoadAsync(ct);
        if (user.Role != "admin") throw ApiException.Forbidden();
        return user;
    }

    internal static async Task<StanleyOpsHealthDto> HealthAsync(IStanleyDueStore due, IStanleyBreakerStore breakers, IStanleyOpsStore ops, DateTime now, CancellationToken ct)
    {
        var counts = await due.CountsAsync(ct);
        var states = await breakers.ListAsync(ct);
        var rows = await ops.ListAsync(ct);
        var proposal = StanleyOpsRules.Live(await ops.GetProposalAsync(ct), now);
        var global = rows.FirstOrDefault(r => r.Scope == StanleyOpsRules.ScopeGlobal && r.Name == StanleyOpsRules.GlobalName && r.Off);
        var classes = counts.Select(c => c.ClassId).Concat(states.Keys).Concat(rows.Where(r => r.Scope == StanleyOpsRules.ScopeClass).Select(r => r.Name)).Distinct().OrderBy(x => x, StringComparer.Ordinal)
            .Select(id =>
            {
                int N(string s) => counts.Where(c => c.ClassId == id && c.State == s).Sum(c => c.Count);
                var b = states.TryGetValue(id, out var bs) ? bs : StanleyBreakerRules.Fresh;
                var paused = StanleyBreakerRules.IsPaused(b, now);
                var sw = rows.FirstOrDefault(r => r.Scope == StanleyOpsRules.ScopeClass && r.Name == id);
                return new StanleyOpsClassDto(id, N(StanleyDueState.Pending), N(StanleyDueState.Claimed), N(StanleyDueState.Done), N(StanleyDueState.Held), N(StanleyDueState.Dropped),
                    new(paused ? "tripped" : "closed", b.Count, paused ? TripRules.ToMs(b.PausedUntil!.Value) : null), sw is { Off: true }, sw is { Off: true } ? sw.Reason : null);
            }).ToList();
        return new(TripRules.ToMs(now),
            new(global is not null, global?.Reason, global is null ? null : TripRules.ToMs(global.At), proposal is null ? null : new(proposal.Reason, TripRules.ToMs(proposal.At), TripRules.ToMs(proposal.At + StanleyOpsRules.ProposalLife))),
            classes);
    }
}
