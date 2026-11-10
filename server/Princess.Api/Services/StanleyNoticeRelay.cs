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
                if (await store.AddStanleyNoticeAsync(actor.Id, StanleyNoticeRules.Build(n, now), voice, subtitle, now, ct)) added++;
            return added;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "A Stanley notice could not be written to the thread for user {UserId}; the push goes out regardless", actor.Id);
            return 0;
        }
    }
}
