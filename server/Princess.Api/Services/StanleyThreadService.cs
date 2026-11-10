using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The permanent Stanley chat (docs/chat-features-research.md, section 15, phase 0a). Makes sure the caller has one (registration makes it, and this is the repeatable backfill for accounts that
/// existed before), and keeps who Stanley speaks for in step with the guest's stage: the company before and after the trip, the ship while aboard. A change of voice is a system line in the thread,
/// and earlier messages keep the subtitle they were sent under. The persona is decided here, from the stage engine and the sailing; the screen only shows what it is given.
/// </summary>
public sealed class StanleyThreadService(IChatStore store, ContextService context, ITripStore trips, ICurrentUser me, IUserClock clock)
{
    /// <summary>Makes the thread if it is missing, then brings the persona up to date. Safe to call on every read: it writes only when something is missing or changed.</summary>
    public async Task EnsureAsync(UserRecord actor, CancellationToken ct)
    {
        await store.EnsureStanleyAsync(actor.Id, StanleyPersonaRules.Welcome(actor.FirstName), await clock.NowAsync(actor, ct), ct);
        // The stage is the signed-in person's own. A guardian reading a child's thread must not move the child's voice by the guardian's trip.
        if ((await me.LoadAsync(ct)).Id != actor.Id) return;
        var next = await PersonaAsync(actor, ct);
        var before = await store.LastStanleyPersonaAsync(actor.Id, ct);
        var line = StanleyPersonaRules.ChangeLine(before is { } b ? new StanleyPersona(b.Voice, b.Subtitle) : null, next);
        if (line is not null) await store.AddStanleyLineAsync(actor.Id, line, next.Voice, next.Subtitle, await clock.NowAsync(actor, ct), ct);
    }

    /// <summary>Who Stanley speaks for now. The ship is the one of the sailing the stage is about (so two bookings give the ship the guest is on, not the other).</summary>
    public async Task<StanleyPersona> PersonaAsync(UserRecord actor, CancellationToken ct)
    {
        var ctx = await context.GetAsync(ct);
        if (!StanleyPersonaRules.IsOnBoard(ctx.Stage)) return StanleyPersonaRules.For(ctx.Stage, null);
        var sailing = ctx.FocusSailingId ?? ctx.SailingId;
        var ship = (await trips.ListForUserAsync(actor.Id, ct)).FirstOrDefault(b => b.SailingId == sailing && !string.IsNullOrEmpty(b.ShipName))?.ShipName
            ?? StanleyPersonaRules.ShipNameFromId(sailing is null ? null : AboardPlans.ShipOfSailing(sailing));
        return StanleyPersonaRules.For(ctx.Stage, ship);
    }
}
