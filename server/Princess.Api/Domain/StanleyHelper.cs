using Princess.Api.Auth;
using Princess.Api.Data;

namespace Princess.Api.Domain;

/// <summary>A guest a helper may prepare Stanley previews for.</summary>
public sealed record StanleyHelpedDto(Guid GuestId, string Name, string Relationship, DateTime Until);

/// <summary>
/// The helper path for Stanley (docs/stanley-gap-analysis-and-plan.md, the helper-session design). The guest turns it on by adding the <c>stanley</c> permission to the helper link they already control; it lasts
/// <see cref="GrantDays"/> days from when the guest last saved the link, and ending the link ends it at once. A helper can only <b>prepare</b> a preview for the guest from a short list of kinds; the preview belongs to
/// the guest, names the helper, and only the guest can confirm it. A helper never reads the guest's memory, plan, receipts or bookings through this path. Pure.
/// </summary>
public static class StanleyHelperRules
{
    public const int GrantDays = 30;
    /// <summary>A helper's preview waits a day for the guest, not ten minutes. The price and availability check at confirm still voids it if they moved.</summary>
    public const int PreviewMinutes = 24 * 60;

    /// <summary>What a helper may prepare: things the guest then looks at and confirms. Not a case (it would share the guest's words), an order, or a plan change.</summary>
    public static readonly string[] Preparable = [StanleyActionKinds.AddExcursion, StanleyActionKinds.ReserveDinner, StanleyActionKinds.MoveDinner, StanleyActionKinds.ChangeSeating, StanleyActionKinds.CreatePoll];

    public static bool KindOk(string kind) => Preparable.Contains(kind);

    public static DateTime Until(DateTime changedAt) => changedAt.AddDays(GrantDays);

    /// <summary>Whether the guest's grant lets this helper prepare now: active, with view and stanley, and not older than the limit.</summary>
    public static bool Live(HelperGrant? grant, DateTime now) =>
        AccessRules.HelperAllows(grant, HelperPermission.Stanley) && now <= Until(grant!.ChangedAt);
}
