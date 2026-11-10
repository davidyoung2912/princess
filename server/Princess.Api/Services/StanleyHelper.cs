using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// A helper preparing Stanley previews for a guest who allowed it. The preview is made as the guest (their rules, their party, their bookings) but stored with the helper's name, and the helper gets only the
/// preview back. Confirming, undoing and reading receipts are the guest's own endpoints and refuse anyone else, so nothing happens until the guest confirms.
/// </summary>
public sealed class StanleyHelperService(IAccessStore access, IUserStore users, StanleyActionService actions, IClock clock)
{
    /// <summary>The guests this helper may prepare for now.</summary>
    public async Task<List<StanleyHelpedDto>> ListAsync(UserRecord helper, CancellationToken ct)
    {
        var list = new List<StanleyHelpedDto>();
        if (helper.IsSupervised) return list;
        foreach (var g in await access.ListHelpedGuestsAsync(helper.Id, ct))
        {
            var grant = new HelperGrant { Permissions = g.Permissions, Status = "active", ChangedAt = g.ChangedAt };
            if (!StanleyHelperRules.Live(grant, clock.UtcNow)) continue;
            if (await users.FindByIdAsync(g.GuestUserId, ct) is { } guest) list.Add(new(guest.PublicId, $"{guest.FirstName} {guest.LastName}".Trim(), g.Relationship, StanleyHelperRules.Until(g.ChangedAt)));
        }
        return list;
    }

    /// <summary>Prepares a preview for the guest. 404 for a guest who has not allowed this helper (the same as one who does not exist), 400 badAction for a kind a helper may not prepare.</summary>
    public async Task<StanleyActionDto> PrepareAsync(UserRecord helper, Guid guestId, StanleyIntent intent, CancellationToken ct)
    {
        if (helper.IsSupervised) throw ApiException.Forbidden();
        var guest = await users.FindByPublicIdAsync(guestId, ct) ?? throw ApiException.NotFound();
        if (!StanleyHelperRules.Live(await access.FindLiveHelperGrantAsync(helper.Id, guest.Id, ct), clock.UtcNow)) throw ApiException.NotFound();
        if (!StanleyHelperRules.KindOk(intent.Kind)) throw ApiException.Invalid("badAction");
        // No device context: the helper's phone says nothing about the guest's plan, and the guest's saved plan is left as it was.
        return await actions.PrepareAsync(guest, intent, null, ct, helper);
    }
}
