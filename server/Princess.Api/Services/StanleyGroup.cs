using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Reminders R8, guardian copies (phase P11 v1). When the booker asks, each child on their account with a port day all-aboard time gets a reminder on the booker's own list, an hour before, labelled with the child's first name.
/// A supervised child receives nothing and is never messaged. No switch is needed because the guardian is the one asking and the result is only their own reminders, which they can remove; it adds no ledger line.
/// </summary>
public sealed class StanleyGroupService(StanleyCheckupService checkup, IChatSafetyStore safety, IStanleyReminderStore reminders, IClock clock)
{
    public async Task<GuardianCopiesDto> GuardianAsync(UserRecord user, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var notChecked = StanleyGroupRules.NotChecked.ToList();
        var children = (await safety.ListChildrenAsync(user.Id, ct)).Select(k => (k.PublicId, First: k.FirstName)).ToList();
        if (children.Count == 0) return new(false, [], [], [], notChecked, null);
        var (facts, _) = await checkup.FactsAsync(user, ct);
        var names = children.Select(c => c.First).ToList();
        if (facts is null) return new(true, names, [], [], notChecked, null);

        var now = clock.UtcNow;
        var existing = await reminders.ListAsync(user.Id, now.AddDays(-1), ct);
        var have = existing.Where(r => r.State != StanleyReminderRules.StateCancelled && r.AnchorId is not null && r.AnchorId.StartsWith(StanleyGroupRules.Marker, StringComparison.Ordinal))
            .Select(r => r.AnchorId!).ToHashSet(StringComparer.Ordinal);
        var live = existing.Count(r => r.State != StanleyReminderRules.StateCancelled);
        var (add, waiting) = StanleyAutoRules.Plan(StanleyGroupRules.GuardianCandidates(facts, children), have, have.Count, now);

        var made = new List<GuardianCopyDto>();
        foreach (var c in add)
        {
            if (live + made.Count >= StanleyReminderRules.MaxPending) { waiting.Add("Your reminders list is full: " + c.Text); continue; }
            await reminders.AddAsync(new StanleyReminderRow
            {
                PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = c.DueAt, Text = StanleyReminderRules.Clean(c.Text), CreatedAt = now, Kind = StanleyReminderRules.KindClock,
                ZoneId = Itinerary.ShipHomeZone, AnchorType = "guardian", AnchorId = c.Key, State = StanleyReminderRules.StateScheduled,
            }, ct);
            made.Add(new(c.Key, c.Text[..c.Text.IndexOf(':')], StanleyReminderRules.Clean(c.Text), c.DueAt));
        }
        return new(true, names, made, waiting, notChecked, facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
