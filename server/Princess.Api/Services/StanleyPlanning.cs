using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Dream, Discover and Book pack, first part (phase P9f): pointers to the planning and booking screens for a guest with no confirmed trip still to sail.
/// Reads only whether such a trip exists. It holds, books and sends nothing. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyPlanningService(StanleyCheckupService checkup, IUserClock clock, IOptions<StanleyOptions> options)
{
    public async Task<PlanningDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        if (!options.Value.Switches.Tools || user.IsSupervised) return new PlanningDto(false, [], [], null);
        var (facts, _) = await checkup.FactsAsync(user, ct);
        var now = await clock.NowAsync(user, ct);
        return StanleyPlanningRules.Build(new PlanningFacts(facts is not null), now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
