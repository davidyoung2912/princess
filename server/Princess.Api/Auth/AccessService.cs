using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

public enum HelperPermission { Documents, Payments, Profile }

/// <summary>The pure rules of section 7 of <c>docs/backend-data-model.md</c>, separate from the lookups so they test without a database.</summary>
public static class AccessRules
{
    /// <summary>As <c>normalizeBookingNumber</c> in the frontend: spaces and dashes out, upper case. Null if the result cannot be a booking number.</summary>
    public static string? NormalizeBookingNumber(string? text)
    {
        if (text is null) return null;
        var n = new string(text.Where(c => !char.IsWhiteSpace(c) && c != '-').ToArray()).ToUpperInvariant();
        return n.Length == 8 && n.All(char.IsAsciiLetterOrDigit) ? n : null;
    }

    /// <summary>A live helper grant allows the permission only if the guest also granted <c>view</c>, and never reaches chat, orders or health.</summary>
    public static bool HelperAllows(HelperGrant? grant, HelperPermission needed)
    {
        if (grant is null || grant.Status != "active") return false;
        var held = grant.Permissions.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return held.Contains("view") && held.Contains(needed.ToString().ToLowerInvariant());
    }
}

/// <summary>Booking membership, adult-write, booker-only, parent-for-child and helper checks. Each throws the ApiException the screens expect.</summary>
public sealed class AccessService(IAccessStore store)
{
    /// <summary>A guest on the booking. Anyone else, and any number that does not exist, gets the same notFound (no enumeration).</summary>
    public async Task<BookingMembership> RequireMemberAsync(UserRecord user, string? bookingNumber, CancellationToken ct)
    {
        var number = AccessRules.NormalizeBookingNumber(bookingNumber) ?? throw ApiException.NotFound();
        return await store.FindMembershipAsync(user.Id, number, ct) ?? throw ApiException.NotFound();
    }

    /// <summary>A member who is not a supervised child.</summary>
    public async Task<BookingMembership> RequireAdultMemberAsync(UserRecord user, string? bookingNumber, CancellationToken ct)
    {
        var membership = await RequireMemberAsync(user, bookingNumber, ct);
        if (user.IsSupervised) throw ApiException.Forbidden("supervised");
        return membership;
    }

    /// <summary>Change, cancel and link removal: the member who made the booking.</summary>
    public async Task<BookingMembership> RequireBookerAsync(UserRecord user, string? bookingNumber, CancellationToken ct)
    {
        var membership = await RequireAdultMemberAsync(user, bookingNumber, ct);
        if (membership.BookerUserId != user.Id) throw ApiException.Forbidden();
        return membership;
    }

    /// <summary>Privacy consents, budget limits, club registration and family controls for a child: only that child's booker.</summary>
    public static void RequireParentOf(UserRecord parent, UserRecord child)
    {
        if (!child.IsSupervised || child.BookerUserId != parent.Id || parent.IsSupervised) throw ApiException.Forbidden();
    }

    /// <summary>Acting on <paramref name="guest"/>'s documents, payments or profile: the guest themself, or a helper they have consented to.</summary>
    public async Task RequireSelfOrHelperAsync(UserRecord actor, UserRecord guest, HelperPermission needed, CancellationToken ct)
    {
        if (actor.Id == guest.Id) return;
        var grant = await store.FindLiveHelperGrantAsync(actor.Id, guest.Id, ct);
        if (!AccessRules.HelperAllows(grant, needed)) throw ApiException.Forbidden();
    }
}
