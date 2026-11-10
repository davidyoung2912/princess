using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Phase 0b of the permanent Stanley chat (docs/chat-features-research.md, section 15.4): every notice the server builds for a guest is also a message in their Stanley thread, once per
/// <see cref="PushNotice.Key"/>, so the thread is the one inbox and a phone push is its doorbell. It never decides whether a phone is told: <see cref="PushService"/> does that on its own,
/// so a failure here cannot silence a safety notice (fail open). The voice is the one the thread last spoke in; it is brought up to date when the guest opens the thread, which is also
/// why this works with no signed-in person, as the scheduled pass has none.
/// </summary>
public sealed class StanleyNoticeRelay(IChatStore store, ILogger<StanleyNoticeRelay> log)
{
    /// <summary>
    /// Writes each notice that is not yet in the thread. Supervised accounts are left out (their notice-only variant is phase 0d). Returns how many messages were added; any failure is logged
    /// without the notice's text and swallowed, because the caller sends the push regardless.
    /// </summary>
    /// <summary>Kind, lane, key and time only. Best effort: a counting failure never reaches the notice.</summary>
    private async Task LogAsync(long userId, StanleyNotice n, string evt, DateTime now, CancellationToken ct)
    {
        try { await store.LogNoticeDeliveryAsync(userId, n.Key, n.Kind, n.Lane, evt, now, ct); }
        catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "A Stanley notice delivery could not be logged"); }
    }

    public async Task<int> RelayAsync(UserRecord actor, IReadOnlyList<PushNotice> notices, DateTime now, CancellationToken ct)
    {
        if (notices.Count == 0 || actor.IsSupervised) return 0;
        try
        {
            await store.EnsureStanleyAsync(actor.Id, StanleyPersonaRules.Welcome(actor.FirstName), now, ct);
            var (voice, subtitle) = await store.LastStanleyPersonaAsync(actor.Id, ct) ?? (StanleyPersonaRules.Company, StanleyPersonaRules.CompanyName);
            var added = 0;
            // The most important first, so a critical message is never behind a slow write of a minor one.
            foreach (var n in notices.OrderByDescending(n => n.Bypass).ThenByDescending(n => n.Priority))
            {
                var built = StanleyNoticeRules.Build(n, now);
                if (!await store.AddStanleyNoticeAsync(actor.Id, built, voice, subtitle, now, ct)) continue;
                added++;
                await LogAsync(actor.Id, built, StanleyNoticeRules.EventPosted, now, ct);
            }
            return added;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "A Stanley notice could not be written to the thread for user {UserId}; the push goes out regardless", actor.Id);
            // Counted as the fail-open path (15.12: under 1% of critical notices should go this way); if the store is the thing failing, this may fail too and is dropped.
            foreach (var n in notices) await LogAsync(actor.Id, StanleyNoticeRules.Build(n, now), StanleyNoticeRules.EventFailOpen, now, ct);
            return 0;
        }
    }
}
