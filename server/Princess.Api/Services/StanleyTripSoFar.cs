using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley's trip so far (phase P9a, v1): counts and level suggestions for the signed-in guest, read from the ledger, which is the action store. Read-only: it never changes a level, a switch or an act. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyTripSoFarService(IStanleyActionStore store, IClock clock, IOptions<StanleyOptions> options)
{
    public async Task<TripSoFarDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        if (!options.Value.Switches.Tools || user.IsSupervised) return new(false, 0, 0, 0, [], [], null);
        var rows = (await store.ListAsync(user.Id, StanleyActivityRules.MaxReceipts, ct))
            .Where(r => r.Status is StanleyActionStatus.Done or StanleyActionStatus.Undone)
            .Select(r => new LedgerTally(r.Kind, r.Status == StanleyActionStatus.Undone)).ToList();
        return StanleyTripSoFarRules.Build(rows, clock.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
