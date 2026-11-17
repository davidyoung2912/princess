using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The rung 3 standing rules, the availability watch and practice mode (phase P9a, v1). A guest's rules live in their account's state store, so every device sees the same ones. Rules are read when the guest asks
/// (there is no background run yet), reading the same change list, check-up facts and inventory the other screens use. Nothing here books, pays, cancels, holds a place or messages anyone: a rule only notices or
/// lines something up for the guest to open. A rule works only while its permission row is on, and the rows for rung 3 need level 3, which stays off behind the operator switch.
/// </summary>
public sealed class StanleyStandingService(IStateStore state, StanleyCheckupService checkup, StanleyChangeService changes, StanleyPermissionService permissions, IUserClock clock, IOptions<StanleyOptions> options)
{
    private async Task<(StandingDoc Doc, int Version)> LoadAsync(long userId, CancellationToken ct) =>
        await state.GetAsync(false, userId, StanleyStandingRules.StateKey, ct) is { } row ? (StanleyStandingRules.Parse(row.Json), row.Version) : (new StandingDoc(), 0);

    private async Task SaveAsync(UserRecord user, StandingDoc doc, int version, CancellationToken ct)
    {
        if (await state.SaveAsync(false, user.Id, StanleyStandingRules.StateKey, StanleyStandingRules.ToJson(doc), version, await clock.NowAsync(user, ct), ct) is null) throw ApiException.Conflict("changed");
    }

    public async Task<string> PaceAsync(long userId, CancellationToken ct) => (await LoadAsync(userId, ct)).Doc.Pace;

    private bool Off(UserRecord user) => !options.Value.Switches.Tools || user.IsSupervised;

    private async Task<HashSet<string>> RowsOnAsync(UserRecord user, CancellationToken ct) =>
        [.. (await permissions.GetAsync(user, ct)).Rows.Where(r => r.State == "on").Select(r => r.Id)];

    public async Task<StandingDto> GetAsync(UserRecord user, CancellationToken ct)
    {
        var templates = StanleyStandingRules.Templates;
        if (Off(user)) return new(false, false, templates, [], [], [], 0, StanleyStandingRules.MaxRules, [], null, [], []);
        var (doc, version) = await LoadAsync(user.Id, ct);
        var rowsOn = await RowsOnAsync(user, ct);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        var asOf = (facts?.Now ?? await clock.NowAsync(user, ct)).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
        if (facts is null || sailing is null)
            return new(true, false, templates, StanleyStandingRules.View(doc, rowsOn), [], [], 0, StanleyStandingRules.MaxRules, StanleyStandingRules.NotChecked(doc), asOf, [], []);

        var list = await changes.ListAsync(user, sailing, null, ct);
        var seen = list.Cards.Select(c => new StandingChange(c.Id, c.Kind, c.Day, c.Title, c.Consequence, c.Critical, c.Affects)).ToList();
        var f = new StandingFacts(
            facts.Today.DayNumber - facts.Departure.DayNumber + 1, facts.Today, facts.Now, facts.Timeline, facts.Tours, facts.Meals, facts.CheckinState, facts.CheckinOpensAt, seen, id => ExcursionRules.ById(id) is { } x ? ExcursionRules.SpotsLeft(x, sailing) : 0,
            (venue, day, time) => DiningRules.SlotsFor(venue, sailing, day).Where(s => time.Length == 0 || s.Time == time).Sum(s => s.Tables), rowsOn);
        var (items, rules, notChecked) = StanleyStandingRules.Evaluate(doc, f);
        // Remember what the watches saw, so an opening is told from a place that was always free.
        var next = doc with { Rules = [.. rules] };
        if (!next.RuleList.SequenceEqual(doc.RuleList)) await SaveAsync(user, next, version, ct);
        var (shown, practice, rolled) = StanleyStandingRules.Limit(items);
        return new(true, true, templates, StanleyStandingRules.View(next, rowsOn), shown, practice, rolled, StanleyStandingRules.MaxRules, notChecked, asOf, Tables(), Tours(facts), facts.Nights, DiningRules.DinnerTimes);
    }

    private static List<StandingChoice> Tables() => [.. DiningRules.Venues.Where(v => v.Kind != "main").Select(v => new StandingChoice(v.Id, v.Name))];

    private static List<StandingChoice> Tours(CheckupFacts facts)
    {
        var ports = facts.Timeline.Days.Select(d => d.Port).ToHashSet();
        return [.. ExcursionRules.Catalogue.Where(x => ports.Contains(x.Port)).Select(x => new StandingChoice(x.Id, x.Name))];
    }

    public async Task<StandingDto> AddAsync(UserRecord user, StandingRequest? body, CancellationToken ct)
    {
        if (Off(user)) throw ApiException.Forbidden();
        var (doc, version) = await LoadAsync(user.Id, ct);
        var (facts, _) = await checkup.FactsAsync(user, ct);
        var rule = StanleyStandingRules.Make(doc, body, facts?.Nights ?? 7, Guid.NewGuid().ToString("N")[..12], out var problem) ?? throw ApiException.Invalid(problem ?? "body");
        await SaveAsync(user, doc with { Rules = [.. doc.RuleList, rule] }, version, ct);
        return await GetAsync(user, ct);
    }

    public async Task<StandingDto> RemoveAsync(UserRecord user, string id, CancellationToken ct)
    {
        var (doc, version) = await LoadAsync(user.Id, ct);
        if (!doc.RuleList.Any(r => r.Id == id)) throw ApiException.NotFound();
        await SaveAsync(user, doc with { Rules = [.. doc.RuleList.Where(r => r.Id != id)] }, version, ct);
        return await GetAsync(user, ct);
    }

    /// <summary>Puts a rule in practice or takes it out (graduates it). Graduating is the guest's one tap; nothing graduates by itself.</summary>
    public async Task<StandingDto> SetPracticeAsync(UserRecord user, string id, bool practice, CancellationToken ct)
    {
        var (doc, version) = await LoadAsync(user.Id, ct);
        if (!doc.RuleList.Any(r => r.Id == id)) throw ApiException.NotFound();
        await SaveAsync(user, doc with { Rules = [.. doc.RuleList.Select(r => r.Id == id ? r with { Practice = practice } : r)] }, version, ct);
        return await GetAsync(user, ct);
    }

    /// <summary>Saves the guest's answer to "More, the same, or less?" (<c>more</c>, <c>same</c> or <c>less</c>). It only moves when a suggestion is made; it never changes a level.</summary>
    public async Task SetPaceAsync(UserRecord user, string? answer, CancellationToken ct)
    {
        if (Off(user)) throw ApiException.Forbidden();
        if (!StanleyStandingRules.PaceOk(answer)) throw ApiException.Invalid("answer");
        var (doc, version) = await LoadAsync(user.Id, ct);
        await SaveAsync(user, doc with { Pace = answer!, PaceAt = (await clock.NowAsync(user, ct)).ToString("yyyy-MM-dd") }, version, ct);
    }
}

/// <summary>Plain-words control (19.4): a sentence is read as one control from a fixed set, shown back, and applied only on the guest's confirm. The sentence is never stored.</summary>
public sealed class StanleyControlService(StanleyPermissionService permissions, StanleyActivityService activity)
{
    public async Task<ControlProposal> ProposeAsync(UserRecord user, ControlRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var level = (await permissions.GetAsync(user, ct)).Level;
        return StanleyControlRules.Propose(body?.Text, level);
    }

    public async Task<ControlResult> ConfirmAsync(UserRecord user, ControlConfirmRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        switch (body?.Id)
        {
            case StanleyControlRules.StopDinners:
                await permissions.SetRowAsync(user, "CL-10", new StanleyRowRequest(false, "settings", null), ct);
                return new(true, "Done. I will not book dinners for you.", "/me/stanley-can");
            case StanleyControlRules.MoreCareful:
                var level = (await permissions.GetAsync(user, ct)).Level;
                if (level <= 1) return new(true, "You are already at the lowest level.", "/me/stanley-can");
                await permissions.SetLevelAsync(user, new StanleyLevelRequest(level - 1, "settings", null), ct);
                return new(true, $"Done. I am at level {level - 1} now and will ask first more often.", "/me/stanley-can");
            case StanleyControlRules.PauseToday:
                await permissions.PauseAsync(user, new StanleyPauseRequest("today"), ct);
                return new(true, "Paused until the end of today.", "/me/stanley-can");
            case StanleyControlRules.UndoToday:
                var r = await activity.UndoAllAsync(user, ct);
                return new(true, r.Undone == 0 && r.Kept == 0 ? "There was nothing to undo." : $"Undone: {r.Undone}. Kept because it can no longer be undone: {r.Kept}.", "/me/stanley-activity");
            case StanleyControlRules.DoMore or StanleyControlRules.WhyLast:
                return new(true, "Nothing was changed.", body.Id == StanleyControlRules.DoMore ? "/me/stanley-can" : "/me/stanley-activity");
            default:
                throw ApiException.Invalid("id");
        }
    }
}
