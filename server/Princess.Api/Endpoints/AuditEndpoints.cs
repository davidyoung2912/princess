using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Domain;

namespace Princess.Api.Endpoints;

/// <summary>One line of the activity report, as the screens see it (no addresses or internal ids of other people).</summary>
public sealed record AuditEventDto(long Id, long At, string Category, string Action, string Outcome, string? Target, int? Status, string? Error, string? Detail, string? RequestId, bool ByYou, bool ForYou);

/// <summary>The audit trail: a guest reads their own activity; an administrator searches everyone's.</summary>
public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/me/audit", async (ICurrentUser me, IAuditStore store, int? max, long? before, string? outcome, string? category, DateTime? from, DateTime? to, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                var rows = await store.QueryAsync(new AuditQuery
                {
                    Person = user.PublicId, Max = Math.Clamp(max ?? 100, 1, 200), BeforeId = before,
                    Outcome = Known(outcome, "success", "failure", "denied", "error"), Category = Known(category, "auth", "request", "domain", "error", "system"),
                    From = from, To = to,
                }, ct);
                return Results.Ok(rows.Select(r => ToDto(r, user.PublicId)).ToList());
            })
            .WithTags("Audit").WithSummary("The signed-in person's own activity, newest first: what they did, what was done for them, and what failed. Page back with before=<last id>.");

        api.MapGet("/audit", async (ICurrentUser me, IAuditStore store, Guid? actor, Guid? subject, string? action, string? outcome, string? category, DateTime? from, DateTime? to, int? max, long? before, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                if (user.Role != "admin") throw ApiException.Forbidden();
                var rows = await store.QueryAsync(new AuditQuery
                {
                    Actor = actor, Subject = subject, ActionPrefix = action, Outcome = Known(outcome, "success", "failure", "denied", "error"),
                    Category = Known(category, "auth", "request", "domain", "error", "system"), From = from, To = to, Max = Math.Clamp(max ?? 200, 1, 500), BeforeId = before,
                }, ct);
                return Results.Ok(rows);
            })
            .WithTags("Audit").WithSummary("Administrators only (403 otherwise): search the whole trail by actor, subject, action prefix, outcome, category and time.");
    }

    private static string? Known(string? value, params string[] allowed) => value is not null && allowed.Contains(value) ? value : null;

    private static AuditEventDto ToDto(AuditEntry r, Guid me) => new(
        r.Id, new DateTimeOffset(DateTime.SpecifyKind(r.At, DateTimeKind.Utc)).ToUnixTimeMilliseconds(), r.Category, r.Action, r.Outcome, r.Target, r.StatusCode,
        r.Category == AuditCategory.Error ? "server" : r.ErrorMessage ?? r.ErrorCode, r.Detail, r.CorrelationId, r.ActorPublicId == me, r.SubjectPublicId == me);
}
