using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What a group has planned and how many said Going (phase 7c shared cards). Read by the moment service to decide an offer and by the share service to repeat the check when the admin taps.</summary>
public static class GroupDayPlans
{
    public static async Task<List<ChatGroupMomentRules.DayPlan>> ListAsync(IChatStore store, long groupId, CancellationToken ct)
    {
        var rows = await store.ListPlansAsync(groupId, ct);
        if (rows.Count == 0) return [];
        var answers = await store.ListResponsesAsync([.. rows.Select(r => r.Id)], ct);
        var list = new List<ChatGroupMomentRules.DayPlan>();
        foreach (var r in rows)
            if (ChatCardRules.Parse(r.Payload) is { } card)
                list.Add(new(card, answers.Count(a => a.MessageId == r.Id && a.Choice == ChatPlanningRules.Going)));
        return list;
    }

    public static IEnumerable<(string Id, string Name)> ShipPlaces() => ShipReference.Get().Places.Select(p => (p.Id, p.Name));
}
