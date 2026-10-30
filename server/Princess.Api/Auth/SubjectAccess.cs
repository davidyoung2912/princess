using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

/// <summary>The person an endpoint acts on, the booking they share with the caller (if any), and whether the caller got in as a consented helper.</summary>
public sealed record Subject(UserRecord Target, SharedBooking? Booking, bool ViaHelper);

/// <summary>
/// Who may read or change another guest's profile or documents (data model section 7). A reader is the person, anyone on a shared booking, or a helper
/// they consented to. A writer is the person, their booker (for a supervised child), the booker of a shared booking, or a helper with the permission.
/// Outsiders always get notFound so a stranger cannot tell who exists.
/// </summary>
public sealed class SubjectAccess(IUserStore users, IAccountStore accounts, IAccessStore access)
{
    public async Task<Subject> ResolveAsync(UserRecord actor, Guid targetPublicId, HelperPermission helperNeeds, bool write, CancellationToken ct)
    {
        var target = actor.PublicId == targetPublicId ? actor : await users.FindByPublicIdAsync(targetPublicId, ct) ?? throw ApiException.NotFound();

        if (actor.Id == target.Id)
        {
            if (write && actor.IsSupervised) throw ApiException.Forbidden("supervised");
            return new Subject(target, await accounts.FindSharedBookingAsync(target.Id, target.Id, ct), false);
        }

        var shared = await accounts.FindSharedBookingAsync(actor.Id, target.Id, ct);
        if (shared is not null)
        {
            if (!write) return new Subject(target, shared, false);
            if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
            if (target.BookerUserId == actor.Id || shared.BookerUserId == actor.Id) return new Subject(target, shared, false);
            if (await HelperAllowsAsync(actor, target, helperNeeds, ct)) return new Subject(target, shared, true);
            throw ApiException.Forbidden();
        }

        if (!await HelperAllowsAsync(actor, target, helperNeeds, ct)) throw ApiException.NotFound();
        if (write && actor.IsSupervised) throw ApiException.Forbidden("supervised");
        return new Subject(target, await accounts.FindSharedBookingAsync(target.Id, target.Id, ct), true);
    }

    private async Task<bool> HelperAllowsAsync(UserRecord actor, UserRecord target, HelperPermission needed, CancellationToken ct) =>
        AccessRules.HelperAllows(await access.FindLiveHelperGrantAsync(actor.Id, target.Id, ct), needed);
}
