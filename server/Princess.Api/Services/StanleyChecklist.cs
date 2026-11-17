using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The trip checklist concierge and smart defaults (phase P5). Reads the check-in progress of each traveller, the booked tours and dinners and the guest's own remembered dinner preference, and returns what is
/// outstanding with a screen for each. It changes nothing and applies no default; travellers are only "Traveller 2". Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyChecklistService(StanleyCheckupService checkup, CheckinService checkin, IStanleyMemoryStore memory, IOptions<StanleyOptions> options)
{
    public async Task<ChecklistDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new ChecklistDto(false, [], 0, 0, false, [], null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;

        CheckinViewDto view;
        try { view = await checkin.ViewAsync(user, null, ct); }
        catch (ApiException) { return none; }

        var position = 0;
        var people = view.Guests.Select(g => new ChecklistPerson(++position, g.Child, g.Progress.Left)).ToList();
        var preference = StanleyChecklistRules.DiningPreference(await memory.ListAsync(user.Id, ct), await memory.GetEnabledAsync(user.Id, ct), sailing);
        var f = new ChecklistFacts(view.Status.State, people, view.Progress.BookingLeft, CheckinRules.GuestSteps.Length, CheckinRules.BookingSteps.Length, facts.Nights, facts.Tours.Count, facts.Meals.Count, preference);
        return StanleyChecklistRules.Build(f, facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
