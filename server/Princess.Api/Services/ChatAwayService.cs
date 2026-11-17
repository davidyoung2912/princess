using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Tells the connected people in a chat when a guest leaves or returns to the ship (docs/chat-ashore-plan.md). Called from the one place each presence write goes through
/// (the gangway scan and the guest's own port row), after the write. For each conversation where the guest turned it on, the other active members who are connected to them
/// (and have not blocked them, nor been blocked) get a system line in the chat and a normal notice. Nothing but the ship-level change is shared. A failure is logged and never fails the write.
/// </summary>
public sealed class ChatAwayService(IChatStore store, IAccountStore accounts, ChatNotifier notifier, ILogger<ChatAwayService> log)
{
    public async Task OnPresenceAsync(UserRecord user, string? status, long atMs, CancellationToken ct)
    {
        if (!ChatAwayRules.IsStatus(status) || user.IsSupervised) return;
        try
        {
            // Recorded on every conversation, so a later "back" knows the guest had gone ashore even if the switch was turned on in between.
            var claims = await store.ClaimAwayAsync(user.Id, status!, ct);
            await GreetAsync(user, status!, claims.Select(c => c.Previous).FirstOrDefault(), atMs, ct);
            var wanted = claims.Where(c => c.NotifyAway).Select(c => (c.GroupId, Change: ChatAwayRules.Transition(c.Previous, status))).Where(c => c.Change != ChatAwayRules.Change.None).ToList();
            if (wanted.Count == 0) return;
            var profile = await accounts.GetProfileAsync(user.Id, ct);
            var who = ChatConnectionRules.ShortName(profile?.FirstName, profile?.LastName);
            var at = DateTimeOffset.FromUnixTimeMilliseconds(atMs).UtcDateTime;
            var recipients = (await store.ListAwayRecipientsAsync(user.Id, [.. wanted.Select(w => w.GroupId)], ct)).ToLookup(r => r.GroupId);
            foreach (var (groupId, change) in wanted)
            {
                var to = recipients[groupId].ToList();
                if (to.Count == 0) continue;
                // A line in the chat is read by every member, so it is written only when every other active member may be told; otherwise the allowed people get the notice alone.
                var others = (await store.ListMembersAsync(groupId, ct)).Count(p => p.UserId != user.Id && p.Status == ChatConversationRules.Active);
                if (to.Count >= others) await store.AddSystemLineAsync(groupId, user.Id, ChatAwayRules.Line(who, change), at, ct);
                await Task.WhenAll(to.Select(r => notifier.AwayAsync(r.UserId, r.GroupPublicId, who, change, atMs, r.Muted, ct)));
            }
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Chat away notices could not all be sent");
        }
    }

    /// <summary>Stanley's own "have a great time" and "welcome back" in the guest's Stanley thread. Best effort: a failure never reaches the presence write or the notices to other people.</summary>
    private async Task GreetAsync(UserRecord user, string status, string? previous, long atMs, CancellationToken ct)
    {
        try
        {
            var change = ChatAwayRules.Transition(previous, status);
            var now = DateTimeOffset.FromUnixTimeMilliseconds(atMs).UtcDateTime;
            if (StanleyAwayRules.Text(change, user.FirstName) is null) return;
            await store.EnsureStanleyAsync(user.Id, StanleyPersonaRules.Welcome(user.FirstName), now, ct);
            var (voice, subtitle) = await store.LastStanleyPersonaAsync(user.Id, ct) ?? (StanleyPersonaRules.Company, StanleyPersonaRules.CompanyName);
            await store.AddStanleyNoticeAsync(user.Id, StanleyAwayRules.Notice(change, user.FirstName, status, atMs, now), voice, subtitle, now, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Stanley could not greet the guest on leaving or returning");
        }
    }
}
