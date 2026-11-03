using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Records what a guest does that moves the stage (docs/stage-experience-plan.md section 3.2). Events carry the guest's own "now", so a demo account's
/// clock and its stage agree. Anything that does not name a known sailing is ignored rather than refused, so a slow or stale screen never breaks.
/// </summary>
public sealed class JourneyEventService(IInboxStore inbox, ITripStore trips, IUserClock clock)
{
    /// <summary>Records an event from the guest. 400 for a kind or sailing this does not accept; 403 for a child account.</summary>
    public async Task RecordAsync(UserRecord actor, string? kind, string? sailingId, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        if (kind is null || !StageRules.ClientKinds.Contains(kind)) throw ApiException.Invalid("kind");
        if (string.IsNullOrWhiteSpace(sailingId)) throw ApiException.Invalid("sailingId");
        if (!(await trips.ListSailingsAsync(ct)).Any(s => s.Id == sailingId)) throw ApiException.Invalid("sailingId");
        await inbox.AddJourneyEventAsync(actor.Id, kind, sailingId, await clock.NowAsync(actor, ct), ct);
    }

    /// <summary>Notes that the guest priced a sailing (a quote is a deliberate step). Never fails the request that triggered it.</summary>
    public async Task NotePriceViewAsync(UserRecord actor, string? sailingId, CancellationToken ct)
    {
        if (actor.IsSupervised || string.IsNullOrWhiteSpace(sailingId)) return;
        await inbox.AddJourneyEventAsync(actor.Id, StageRules.PriceView, sailingId, await clock.NowAsync(actor, ct), ct);
    }
}
