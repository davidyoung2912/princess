using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Manage and Prebook pack, first part (phase P9b): "what to expect" (SR-4.5) and "dinner for everyone" (SR-5.4). Reads the trip facts, the booked tours and dinners and the party's open polls, and returns
/// findings each with a screen to open. It starts no poll, books nothing and sends nothing. Off for a supervised account and when the tools switch is off.
/// </summary>
public sealed class StanleyPrebookService(StanleyCheckupService checkup, StanleyPollService polls, IOptions<StanleyOptions> options)
{
    public async Task<PrebookDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new PrebookDto(false, [], [], null);
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;

        var open = (await polls.ListAsync(user, null, ct)).Where(x => !x.Closed).Select(x => new PollGap(x.Question, x.Status.Silent, x.Status.Answered)).ToList();
        var f = new PrebookFacts(facts.Today, facts.Departure, facts.Nights, facts.Travellers.Count(t => t.Age >= 18), facts.Tours.Count, facts.Meals.Count,
            facts.FinalDue, DateOnly.FromDateTime(facts.CheckinOpensAt), open);
        return StanleyPrebookRules.Build(f, facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
