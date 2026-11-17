using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Remember pack, first part (phase P9f): recap (SR-11.1), feedback (SR-11.2) and loyalty explained (SR-11.5) on the day the ship gets in. Reads the trip dates and returns findings each with a screen to open.
/// It builds, drafts and sends nothing. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyRememberService(StanleyCheckupService checkup, IOptions<StanleyOptions> options)
{
    public async Task<RememberDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new RememberDto(false, [], [], null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;
        return StanleyRememberRules.Build(new RememberFacts(facts.Today, facts.Departure, facts.Nights), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
