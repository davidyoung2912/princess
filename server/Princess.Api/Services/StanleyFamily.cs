using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Family pack, first part (phase P9e): kids club ready (SR-F.1) and everyone's muster (SR-F.4). Reads the sailing date and the traveller ages and returns findings each with a screen to open.
/// It registers, messages and marks nothing. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyFamilyService(StanleyCheckupService checkup, IOptions<StanleyOptions> options)
{
    public async Task<FamilyDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new FamilyDto(false, [], [], null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;
        return StanleyFamilyRules.Build(new FamilyFacts(facts.Today, facts.Departure, facts.Travellers.Select(t => t.Age).ToList(), facts.Nights), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
