using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Disembark pack, first part (phase P9d): bag night (SR-10.1), customs ready (SR-10.3) and leave nothing behind (SR-10.6). Reads the trip dates and returns findings each with a screen to open.
/// It fills in, submits and sends nothing. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyDisembarkService(StanleyCheckupService checkup, IOptions<StanleyOptions> options)
{
    public async Task<DisembarkDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new DisembarkDto(false, [], [], null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;
        return StanleyDisembarkRules.Build(new DisembarkFacts(facts.Today, facts.Departure, facts.Nights), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
