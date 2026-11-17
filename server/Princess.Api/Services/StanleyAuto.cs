using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// AUT-02, deadline reminders (phase P10a). Runs only when the guest is asked (no background run yet) and only if <see cref="StanleyPermissionService.MayAsync"/> says the CL-08 row is on, which it is not for a child, a pause,
/// a level below 4 or a guest who has not switched it on. Each reminder is a plain clock reminder on the guest's own list with a ledger line (so Did shows it and it can be removed there), is tagged with its key so it is set once, and
/// never touches money, another person or a booking.
/// </summary>
public sealed class StanleyAutoService(StanleyCheckupService checkup, StanleyPermissionService permissions, IStanleyReminderStore reminders, IStanleyActionStore ledger, IClock clock, PlanService plan, IStateStore state, StanleyDiscoverService discover, ICatalogueStore catalogue, IProgramChanges programChanges, StanleyBundleService bundles)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AutoRunDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var none = new AutoRunDto(false, StanleyAutoRules.ClassId, [], [], StanleyAutoRules.NotChecked.ToList(), null);
        if (!await permissions.MayAsync(user, StanleyAutoRules.Row, ct)) return none;
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none with { On = true };

        var now = clock.UtcNow;
        var existing = await reminders.ListAsync(user.Id, now.AddDays(-1), ct);
        var have = existing.Where(r => r.State != StanleyReminderRules.StateCancelled && r.AnchorId is not null && r.AnchorId.StartsWith(StanleyAutoRules.Marker, StringComparison.Ordinal))
            .Select(r => r.AnchorId!).ToHashSet(StringComparer.Ordinal);
        var live = existing.Count(r => r.State != StanleyReminderRules.StateCancelled);
        var (add, waiting) = StanleyAutoRules.Plan(StanleyAutoRules.Candidates(facts), have, have.Count, now);

        var made = new List<AutoMade>();
        foreach (var c in add)
        {
            if (live + made.Count >= StanleyReminderRules.MaxPending) { waiting.Add("Your reminders list is full: " + c.Text); continue; }
            var row = new StanleyReminderRow
            {
                PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = c.DueAt, Text = StanleyReminderRules.Clean(c.Text), CreatedAt = now, Kind = StanleyReminderRules.KindClock,
                ZoneId = Itinerary.ShipHomeZone, AnchorType = "auto", AnchorId = c.Key, State = StanleyReminderRules.StateScheduled,
            };
            await reminders.AddAsync(row, ct);
            var receipt = new StanleyActionRow
            {
                PublicId = Guid.NewGuid(), UserId = user.Id, Kind = StanleyActionKinds.RemindMe, Status = StanleyActionStatus.Done, CreatedAt = now, ExpiresAt = now, UpdatedAt = now, DoneAt = now,
                UndoUntil = now.AddMinutes(StanleyAutoRules.UndoMinutes), Ref = row.PublicId.ToString(), IdemKey = c.Key,
                Data = JsonSerializer.Serialize(new StanleyActionData(sailing, "Reminder set: " + row.Text, [], ["You"], null, null, new Dictionary<string, string> { ["class"] = StanleyAutoRules.ClassId }, "Stanley, because you switched on setting your reminders"), Json),
            };
            await ledger.AddAsync(receipt, ct);
            made.Add(new(c.Key, row.Text, c.DueAt, StanleyActionService.Receipt(receipt)));
        }
        return new(true, StanleyAutoRules.ClassId, made, waiting, StanleyAutoRules.NotChecked.ToList(), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }

    /// <summary>
    /// AUT-05, lists kept current (first part: the packing list). The list is rebuilt from the season, tours and forecast whenever it is read, so it is already current; this says what its suggestions added or dropped since the last run
    /// and records where it stands now. Same switch (CL-08) as AUT-02. It changes no list, tick, hidden item or item the guest added. The trip checklist is read the same way (what it now shows as done or no longer done), and so is the sailing shortlist (what is newly on it, and what is gone or closed to booking), and the comparison of the shortlist with the guest's saved weights (a score that moved).
    /// </summary>
    public async Task<AutoListsDto> ListsAsync(UserRecord user, CancellationToken ct)
    {
        var none = new AutoListsDto(false, false, [], StanleyAutoRules.ListsNotChecked.ToList(), null);
        if (!await permissions.MayAsync(user, StanleyAutoRules.Row, ct)) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none with { On = true };

        var changes = new List<AutoListChange>();
        var view = await plan.PackingAsync(user, null, ct);
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.ListsKey, ct);
        var before = StanleyAutoRules.Parse(row?.Json);
        var change = StanleyAutoRules.Diff(view.Items, before);
        if (change is not null) changes.Add(change);
        if (before is null || change is not null)
            await state.SaveAsync(false, user.Id, StanleyAutoRules.ListsKey, StanleyAutoRules.ToJson(view.Items), row?.Version ?? 0, clock.UtcNow, ct);

        var check = await plan.ChecklistAsync(user, null, ct);
        var crow = await state.GetAsync(false, user.Id, StanleyAutoRules.ChecklistKey, ct);
        var cbefore = StanleyAutoRules.Parse(crow?.Json);
        var cchange = StanleyAutoRules.ChecklistDiff(check.Entries, cbefore);
        if (cchange is not null) changes.Add(cchange);
        if (cbefore is null || cchange is not null)
            await state.SaveAsync(false, user.Id, StanleyAutoRules.ChecklistKey, StanleyAutoRules.ChecklistToJson(check.Entries), crow?.Version ?? 0, clock.UtcNow, ct);

        var sbrief = (await discover.GetBriefAsync(user, ct)).Brief.Shortlist ?? [];
        var open = (await catalogue.GetAsync(ct)).Sailings.Where(x => x.BookingOpen).ToDictionary(x => x.Id, x => $"{x.Title}, {x.Departure:yyyy-MM-dd}");
        var srow = await state.GetAsync(false, user.Id, StanleyAutoRules.ShortlistKey, ct);
        var sbefore = StanleyAutoRules.Parse(srow?.Json);
        var schange = StanleyAutoRules.ShortlistDiff(sbrief, open, sbefore);
        if (schange is not null) changes.Add(schange);
        if (sbefore is null || schange is not null)
            await state.SaveAsync(false, user.Id, StanleyAutoRules.ShortlistKey, StanleyAutoRules.ShortlistToJson(sbrief), srow?.Version ?? 0, clock.UtcNow, ct);

        var rows = new List<(string, string, int?)>();
        var picks = sbrief.Where(open.ContainsKey).ToArray();
        if (picks.Length is >= 2 and <= StanleyDiscoverRules.MaxCompare)
        {
            var saved = (await discover.GetBriefAsync(user, ct)).Brief;
            var cmp = await discover.CompareAsync(new(picks, saved.Weights, saved.Filters), ct);
            rows = [.. cmp.Rows.Select(r => (r.SailingId, r.Title, r.Score))];
        }
        var mrow = await state.GetAsync(false, user.Id, StanleyAutoRules.ComparisonKey, ct);
        var mbefore = StanleyAutoRules.Parse(mrow?.Json);
        var mchange = StanleyAutoRules.ComparisonDiff(rows, mbefore);
        if (mchange is not null) changes.Add(mchange);
        if (mbefore is null || mchange is not null)
            await state.SaveAsync(false, user.Id, StanleyAutoRules.ComparisonKey, StanleyAutoRules.ComparisonToJson(rows), mrow?.Version ?? 0, clock.UtcNow, ct);
        return new(true, before is null && cbefore is null && sbefore is null && mbefore is null, changes, StanleyAutoRules.ListsNotChecked.ToList(), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }

    /// <summary>
    /// AUT-03, my plan topped up (phase P10b). Needs permission row CL-09 (level 4). Adds free events to the guest's own plan as "Stanley's pick" and drops his own picks that no longer fit; what the guest added is never touched,
    /// and a pick the guest removed is not added again. Nothing is held or booked. The picks are kept in the guest's own state store.
    /// </summary>
    public async Task<StanleyAutoRules.AutoPlanDto> PlanAsync(UserRecord user, CancellationToken ct)
    {
        var none = new StanleyAutoRules.AutoPlanDto(false, [], [], [], StanleyAutoRules.PlanNotChecked.ToList(), null);
        if (!await permissions.MayAsync(user, StanleyAutoRules.PlanRow, ct)) return none;
        var (facts, _) = await checkup.FactsAsync(user, ct);
        if (facts is null) return none with { On = true };
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.PicksKey, ct);
        var before = StanleyAutoRules.ParsePicks(row?.Json);
        var (doc, added, removed) = StanleyAutoRules.Top(facts, programChanges.Current(), null, before);
        if (before is null || added.Count > 0 || removed.Count > 0)
            await state.SaveAsync(false, user.Id, StanleyAutoRules.PicksKey, StanleyAutoRules.PicksToJson(doc), row?.Version ?? 0, clock.UtcNow, ct);
        return new(true, doc.Picks, added, removed, StanleyAutoRules.PlanNotChecked.ToList(), facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }

    /// <summary>The picks as they stand, whether or not the switch is on now (the guest can always see and remove what Stanley added).</summary>
    public async Task<StanleyAutoRules.AutoPlanDto> PicksAsync(UserRecord user, CancellationToken ct)
    {
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.PicksKey, ct);
        return new(await permissions.MayAsync(user, StanleyAutoRules.PlanRow, ct), StanleyAutoRules.ParsePicks(row?.Json)?.Picks ?? [], [], [], StanleyAutoRules.PlanNotChecked.ToList(), null);
    }

    /// <summary>The guest removes one of Stanley's picks. It is not added again. 404 when it is not one of his picks.</summary>
    public async Task<StanleyAutoRules.AutoPlanDto> RemovePickAsync(UserRecord user, int day, string id, CancellationToken ct)
    {
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.PicksKey, ct);
        var doc = StanleyAutoRules.ParsePicks(row?.Json) ?? throw ApiException.NotFound();
        var next = StanleyAutoRules.Dismiss(doc, StanleyAutoRules.PickKey(day, id));
        if (ReferenceEquals(next, doc)) throw ApiException.NotFound();
        if (await state.SaveAsync(false, user.Id, StanleyAutoRules.PicksKey, StanleyAutoRules.PicksToJson(next), row!.Version, clock.UtcNow, ct) is null) throw ApiException.Conflict("changed");
        return await PicksAsync(user, ct);
    }

    /// <summary>
    /// AUT-06, drafts saved (phase P10b). Needs permission row CL-06 and level 4 (a draft the guest asks for in the app is a separate, always-available helper). Saves tonight's plan note and a "may be late" note, one of each, for the
    /// guest to read, change and send themselves. Nothing is sent or submitted.
    /// </summary>
    public async Task<StanleyAutoRules.AutoDraftsDto> DraftsAsync(UserRecord user, CancellationToken ct)
    {
        var none = new StanleyAutoRules.AutoDraftsDto(false, [], [], StanleyAutoRules.DraftNotChecked.ToList(), null);
        if (!await permissions.MayAsync(user, StanleyAutoRules.DraftRow, ct) || (await permissions.GetAsync(user, ct)).EffectiveLevel < 4) return none;
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.DraftsKey, ct);
        var have = StanleyAutoRules.ParseDrafts(row?.Json);
        var tonight = await bundles.PreviewAsync(user, StanleyBundleRules.Evening, StanleyBundleRules.Balanced, null, ct);
        var now = clock.UtcNow;
        var (all, saved) = StanleyAutoRules.Merge(have, StanleyAutoRules.Fresh(tonight, now));
        if (saved.Count > 0)
            await state.SaveAsync(false, user.Id, StanleyAutoRules.DraftsKey, StanleyAutoRules.DraftsToJson(all), row?.Version ?? 0, now, ct);
        return new(true, all, saved, StanleyAutoRules.DraftNotChecked.ToList(), now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }

    /// <summary>The saved drafts, for the guest to read.</summary>
    public async Task<StanleyAutoRules.AutoDraftsDto> SavedDraftsAsync(UserRecord user, CancellationToken ct)
    {
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.DraftsKey, ct);
        return new(true, StanleyAutoRules.ParseDrafts(row?.Json), [], StanleyAutoRules.DraftNotChecked.ToList(), null);
    }
}
