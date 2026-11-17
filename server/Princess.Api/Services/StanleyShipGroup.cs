using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The missed-ship guard and group gaps (phase P8). Reads the guest's own away status for today's port, the head-back buffer they chose and the open polls of their party, and returns findings each with a
/// screen to open. It sends nothing, contacts nobody and answers no poll. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyShipGroupService(StanleyCheckupService checkup, PortRowService portRows, StanleyPollService polls, IOptions<StanleyOptions> options)
{
    public async Task<ShipGroupDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new ShipGroupDto(false, [], [], false, null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;

        var now = facts.Now;
        var day = AboardRules.PortDayAt(facts.Timeline, now) is { } p ? AboardRules.WithState(p, now) : null;
        var inPort = day is not null && TripRules.ToMs(now) >= day.ArriveAt;
        var away = false;
        int? buffer = null;
        if (day is not null)
        {
            var rows = (await portRows.ListAsync(user, null, ct)).Rows.Where(r => !r.Deleted).ToList();
            away = AwayRules.IsAway(AwayRules.StatusOf(rows.FirstOrDefault(r => r.Kind == "presence" && r.Key == AwayRules.PresenceKey(day.Date, user.PublicId))?.Data?.ToJsonString()));
            buffer = rows.FirstOrDefault(r => r.Kind == "plan" && r.Key == day.Date)?.Data?["buffer"] is System.Text.Json.Nodes.JsonValue v && v.TryGetValue<int>(out var b) ? b : null;
        }

        var gaps = (await polls.ListAsync(user, null, ct)).Where(x => !x.Closed).Select(x => new PollGap(x.Question, x.Status.Silent, x.Status.Answered)).ToList();
        var f = new ShipGroupFacts(inPort, day?.Port ?? "", away, day?.Tender ?? false, day?.AllAboardShip ?? "", day?.AllAboardAt ?? 0, TripRules.ToMs(now), buffer, day is not null, gaps);
        return StanleyShipGroupRules.Build(f, now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
