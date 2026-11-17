using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Get to the ship and Embark pack, first part (phase P9c): check-in open (SR-6.1), phone and money (SR-6.6) and muster on sailing day (SR-7.2). Reads the trip dates and check-in state and returns findings
/// each with a screen to open. It fills in, submits and sends nothing. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyEmbarkService(StanleyCheckupService checkup, IOptions<StanleyOptions> options)
{
    public async Task<EmbarkDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new EmbarkDto(false, [], [], null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;
        var f = new EmbarkFacts(facts.Today, facts.Departure, facts.CheckinState, facts.CheckinClosesAt);
        return StanleyEmbarkRules.Build(f, facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
