using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Endpoints;

/// <summary>One account waiting for a person to check it, and the accounts it may duplicate. No email address of anyone, and no merge: a person decides, and the decision is recorded.</summary>
public sealed record ReviewMatchDto(Guid Id, string AccountNumber, long CreatedAt);
public sealed record ReviewDto(Guid Id, string AccountNumber, string FirstName, string LastName, string Dob, long CreatedAt, IReadOnlyList<ReviewMatchDto> Matches);

/// <summary>"different" (two people who share a name and birthday) or "same" (one guest with two accounts; joining them is done by Guest Services outside this screen).</summary>
public sealed record ResolveReviewRequest(string? Decision);

/// <summary>The Guest Services queue for possible duplicate profiles (IDN-03). Administrators only.</summary>
public static class ReviewEndpoints
{
    public static void MapReviewEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/admin/reviews").WithTags("Account reviews");

        g.MapGet("", async (ICurrentUser me, ISignInStore store, CancellationToken ct) =>
            {
                await RequireAdminAsync(me, ct);
                var items = await store.ListReviewsAsync(ct);
                return Results.Ok(items.Select(i => new ReviewDto(i.Id, i.AccountNumber, i.FirstName, i.LastName, i.Dob.ToString("yyyy-MM-dd"), Ms(i.CreatedAt),
                    i.Matches.Select(m => new ReviewMatchDto(m.Id, m.AccountNumber, Ms(m.CreatedAt))).ToList())).ToList());
            })
            .WithSummary("Administrators only (403 otherwise): accounts flagged as a possible duplicate, oldest first, each with the accounts it may duplicate (account number and date joined; never an email address).");

        g.MapPost("/{id:guid}/resolve", async (Guid id, ResolveReviewRequest body, ICurrentUser me, ISignInStore store, IAuditLog audit, IClock clock, CancellationToken ct) =>
            {
                var admin = await RequireAdminAsync(me, ct);
                var decision = body.Decision;
                if (decision is not ("different" or "same")) throw ApiException.Invalid();
                if (!await store.ClearReviewAsync(id, clock.UtcNow, ct)) throw ApiException.NotFound();
                await audit.RecordAsync(new AuditEntry
                {
                    Category = AuditCategory.Domain, Action = "account.review.resolve", Outcome = AuditOutcome.Success,
                    ActorPublicId = admin.PublicId, ActorRole = admin.Role, SubjectPublicId = id, Detail = AuditContext.Json(new { decision }),
                }, ct);
                return Results.NoContent();
            })
            .WithSummary("Administrators only: settle a flagged account as `different` people or the `same` guest. Clears the flag and records who decided; accounts are never merged here. 404 when the account is not flagged, 400 for any other decision.");
    }

    private static async Task<UserRecord> RequireAdminAsync(ICurrentUser me, CancellationToken ct)
    {
        // A booker viewing as a child is acting as the child, never as staff.
        if (me.ActorPublicId is not null) throw ApiException.Forbidden();
        var user = await me.LoadAsync(ct);
        if (user.Role != "admin") throw ApiException.Forbidden();
        return user;
    }

    private static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
}
