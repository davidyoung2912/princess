using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Bundles and drafts (phase P4). Builds the guest's evening or day as ordered steps from their sailing, booked tours and dinners (<see cref="StanleyBundleRules"/>), and drafts a note for them to send themselves.
/// It books nothing, holds nothing, pays nothing and sends nothing; every step is a screen to open. Read through the same Tools switch as the other read-only helpers.
/// </summary>
public sealed class StanleyBundleService(StanleyCheckupService checkup, IOptions<StanleyOptions> options)
{
    private async Task<BundleDto> BuildAsync(UserRecord user, string? scope, string? pace, int? day, CancellationToken ct)
    {
        scope ??= StanleyBundleRules.Evening;
        pace ??= StanleyBundleRules.Balanced;
        if (!StanleyBundleRules.ScopeOk(scope)) throw ApiException.Invalid("scope");
        if (!StanleyBundleRules.PaceOk(pace)) throw ApiException.Invalid("pace");
        var none = new BundleDto(false, scope, pace, day ?? 0, null, null, [], [], StanleyBundleRules.NotChecked());
        if (!options.Value.Switches.Tools || user.IsSupervised) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none;
        var current = facts.Today.DayNumber - facts.Departure.DayNumber + 1;
        var which = day ?? Math.Clamp(current, 1, facts.Timeline.Days.Count);
        if (which < 1 || which > facts.Timeline.Days.Count) throw ApiException.Invalid("day");
        return StanleyBundleRules.Build(scope, pace, new BundleFacts(facts.Timeline, which, facts.Tours, facts.Meals, facts.Travellers.Any(t => t.Age < 13), "any"));
    }

    public Task<BundleDto> PreviewAsync(UserRecord user, string? scope, string? pace, int? day, CancellationToken ct) => BuildAsync(user, scope, pace, day, ct);

    public async Task<DraftNoteDto?> DraftAsync(UserRecord user, string? kind, string? scope, string? pace, int? day, CancellationToken ct)
    {
        if (!StanleyBundleRules.DraftOk(kind)) throw ApiException.Invalid("kind");
        return StanleyBundleRules.Draft(kind!, await BuildAsync(user, scope, pace, day, ct));
    }
}
