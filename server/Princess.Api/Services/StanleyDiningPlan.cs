using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Where a booking's dining plan is kept.</summary>
public interface IDiningPlanStore
{
    Task SetAsync(long bookingId, string plan, CancellationToken ct);
}

public sealed class DapperDiningPlanStore(IDbConnectionFactory db) : IDiningPlanStore
{
    public async Task SetAsync(long bookingId, string plan, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.Bookings SET Dining = @plan WHERE Id = @bookingId", new { bookingId, plan }, null, ct));
    }
}

/// <summary>What a seating change would do, worked out from live data. <c>Facts</c> changes if anything the preview depends on does.</summary>
public sealed record DiningPlanPreview(string From, string To, string Facts);

/// <summary>
/// Changes a booking's dining plan. Only the person who booked may change it (it moves the whole party), and the rules in <see cref="DiningPlanRules"/> decide whether it can be done now. The same
/// service backs Stanley's <c>change_seating</c> action and could back a dining screen; a change is one row update, so there is nothing half done to settle.
/// </summary>
public sealed class StanleyDiningPlanService(ScopeLoader scopes, IPlanStore plan, IDiningPlanStore store)
{
    private async Task<(Scope Scope, int MainTables)> LoadAsync(UserRecord user, string? number, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: true, ct);
        if (scope.Booking.BookerUserId != user.Id) throw ApiException.Forbidden();
        var tables = await plan.ListTablesAsync(scope.Booking.BookingId, ct);
        var main = tables.Count(t => DiningRules.VenueById(t.VenueId)?.Kind == "main");
        return (scope, main);
    }

    public async Task<DiningPlanPreview> PreviewAsync(UserRecord user, string? number, string? to, CancellationToken ct)
    {
        var (scope, main) = await LoadAsync(user, number, ct);
        var b = scope.Booking;
        var want = DiningPlanRules.FromWords(to);
        if (DiningPlanRules.Problem(want, b.Dining, scope.Today, scope.Departure, b.SailingId, main) is { } problem)
            throw problem == "unchanged" ? ApiException.Conflict(problem) : problem is "plan" ? ApiException.Invalid(problem) : ApiException.Conflict(problem);
        return new DiningPlanPreview(b.Dining, want!, $"seating|{b.BookingId}|{b.Dining}|{want}|{DiningPlanRules.Left(want!, b.SailingId) > 0}");
    }

    /// <summary>Makes the change and answers with the plan it replaced, so it can be put back.</summary>
    public async Task<string> ChangeAsync(UserRecord user, string? number, string? to, CancellationToken ct)
    {
        var preview = await PreviewAsync(user, number, to, ct);
        var scope = await scopes.LoadAsync(user, number, write: true, ct);
        await store.SetAsync(scope.Booking.BookingId, preview.To, ct);
        return preview.From;
    }

    /// <summary>Puts the earlier plan back, if it still can be and the plan is still the one that was set.</summary>
    public async Task RestoreAsync(UserRecord user, string? number, string from, string was, CancellationToken ct)
    {
        var (scope, _) = await LoadAsync(user, number, ct);
        if (!DiningPlanRules.Plans.Contains(from) || scope.Booking.Dining != was) throw ApiException.Conflict("changed");
        if (scope.Today > scope.Departure.AddDays(-DiningPlanRules.FreezeDays)) throw ApiException.Conflict("started");
        await store.SetAsync(scope.Booking.BookingId, from, ct);
    }

    /// <summary>Whether the booking's plan is already <paramref name="to"/>, to settle an outcome that was not known.</summary>
    public async Task<bool> IsAsync(UserRecord user, string? number, string? to, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: false, ct);
        return scope.Booking.Dining == DiningPlanRules.FromWords(to);
    }
}
