using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Value and bill (phase P6): bill watch (CHK-04), the included-value finder (VAL-01) and "Forgot something?" (CHK-05) for the signed-in guest's current or next trip. It reads the onboard bill, the package
/// balances and the sailing, hands <see cref="StanleyValueRules"/> facts with no names (travellers are "Traveller 2"), and returns findings each with a screen to open. It writes nothing, charges nothing, disputes nothing.
/// </summary>
public sealed class StanleyValueService(StanleyCheckupService checkup, OnboardService onboard, PlanService plan, IOptions<StanleyOptions> options)
{
    public async Task<ValueDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        if (!options.Value.Switches.Money || user.IsSupervised) return new ValueDto(false, [], [], false, null);
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return new ValueDto(false, [], [], false, null);

        var afloat = facts.Today >= facts.Departure && facts.Today <= facts.Departure.AddDays(facts.Nights);
        IReadOnlyList<FolioLine> lines = [];
        var through = 0;
        if (afloat)
        {
            var folio = await onboard.FolioAsync(user, null, ct);
            lines = folio.Lines;
            through = folio.ThroughDay;
        }
        var view = await plan.PackagesAsync(user, null, ct);
        var position = 0;
        var people = view.People.Select(p => new ValuePerson(++position, p.Id, p.Entitlements, p.Balances)).ToList();

        var tender = facts.Timeline.Days.Any(d => Itinerary.PortOf(d.Port)?.Tender == true);
        var value = new ValueFacts(facts.Today, facts.Departure, facts.Nights, through, afloat, lines, people, view.Credit.Remaining, tender);
        return StanleyValueRules.Build(value, facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
