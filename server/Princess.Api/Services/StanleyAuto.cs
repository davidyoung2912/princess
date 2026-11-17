using System.Text.Json;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// AUT-02, deadline reminders (phase P10a). Runs only when the guest is asked (no background run yet) and only if <see cref="StanleyPermissionService.MayAsync"/> says the CL-08 row is on, which it is not for a child, a pause,
/// a level below 4 or a guest who has not switched it on. Each reminder is a plain clock reminder on the guest's own list with a ledger line (so Did shows it and it can be removed there), is tagged with its key so it is set once, and
/// never touches money, another person or a booking.
/// </summary>
public sealed class StanleyAutoService(StanleyCheckupService checkup, StanleyPermissionService permissions, IStanleyReminderStore reminders, IStanleyActionStore ledger, IClock clock, PlanService plan, IStateStore state, StanleyDiscoverService discover, ICatalogueStore catalogue, IProgramChanges programChanges, StanleyBundleService bundles, IStanleyEffects effects, ITripStore trips, ServiceRequestService requests, StanleyChangeService changeFeed)
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

    // ---- AUT-04, AUT-08 and AUT-09 (phase P10c): the classes that touch a booking or the crew ----

    private static string Plain(string reason) => reason switch
    {
        "full" => "that table is full",
        "clash" => "you are already at a table at that time",
        "closed" => "that time has passed",
        "fixedSeating" => "your dining plan is a fixed seating",
        "age" => "a table needs an adult",
        "unchanged" => "it is already at that time",
        "whichDinner" => "I could not tell which dinner you meant",
        "noDinner" => "you have no dinner booked to move",
        "duplicate" => "you already have that request open",
        "tooMany" => "you already have several requests open",
        "classOff" or "paused" or "practice" => "this is switched off",
        "overCap" => "I have reached my limit for today",
        "paid" => "it would cost something",
        "shared" => "it would touch someone else's booking",
        "feeSoon" or "notReversible" => "it could not be undone for two hours",
        "overlap" => "it would sit on something you booked",
        "quiet" => "it is quiet hours, when I make no reservations",
        "declined" => "you undid two of these, so I ask first now",
        "child" => "this account is supervised",
        _ => "it could not be done just now",
    };

    private static string Describe(StanleyIntent i) => i.Kind switch
    {
        StanleyActionKinds.ReserveDinner => $"A table on night {i.Arg("day")}",
        StanleyActionKinds.MoveDinner => $"Moving your dinner on day {i.Arg("day")}",
        _ => StanleyActionRules.ItemLabel(i.Arg("item")),
    };

    private static bool Classed(StanleyActionRow r, string classId)
    {
        try { return JsonSerializer.Deserialize<StanleyActionData>(r.Data, Json)?.Args.GetValueOrDefault("class") == classId; }
        catch (JsonException) { return false; }
    }

    /// <summary>What the ledger already holds for one class: acts today (done or undone), acts undone, and every key used, so something done or undone for a night or a day is never done again.</summary>
    private async Task<(int Today, int Undone, HashSet<string> Keys)> LedgerAsync(UserRecord user, string classId, DateTime guestNow, CancellationToken ct)
    {
        var offset = guestNow - clock.UtcNow;
        int today = 0, undone = 0;
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var r in await ledger.ListAsync(user.Id, 200, ct))
        {
            if (!Classed(r, classId)) continue;
            if (r.IdemKey is not null) keys.Add(r.IdemKey);
            if (r.Status == StanleyActionStatus.Undone) undone++;
            if (r.Status is StanleyActionStatus.Done or StanleyActionStatus.Undone && (r.CreatedAt + offset).Date == guestNow.Date) today++;
        }
        return (today, undone, keys);
    }

    private async Task<BookingRow?> BookingOfAsync(UserRecord user, CheckupFacts facts, CancellationToken ct) =>
        (await trips.ListForUserAsync(user.Id, ct)).Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= facts.Today).OrderBy(b => b.Departure).FirstOrDefault();

    /// <summary>
    /// One act of rung 4 on a booking or the crew. It is previewed as the guest (the service's own checks apply), put through the act-or-ask gate, done, and written to the ledger with a receipt that can be undone for two hours.
    /// Anything the preview or the gate refuses is returned as a plain sentence and nothing is done.
    /// </summary>
    private async Task<(StanleyAutoRules.AutoActDto? Made, string? Waiting)> ActAsync(
        UserRecord user, CheckupFacts facts, string sailing, string classId, string because, int cap, int undoMinutes, int today, int undone, StanleyIntent intent, string key,
        Func<IReadOnlyDictionary<string, string>, StanleyItemFlags> flagsOf, Func<IReadOnlyDictionary<string, string>, bool> overlaps, bool mustBeAlone, CancellationToken ct)
    {
        var ctx = new StanleyActionContext(null, null, sailing);
        StanleyPreviewFacts preview;
        try { preview = await effects.PreviewAsync(user, intent, ctx, ct); }
        catch (ApiException e) { return (null, $"{Describe(intent)}: left alone, {Plain(e.Title)}."); }
        var args = new Dictionary<string, string>(intent.Args);
        foreach (var (k, v) in preview.Resolved ?? new Dictionary<string, string>()) args[k] = v;
        args["class"] = classId;
        if (mustBeAlone && args.GetValueOrDefault("alone") != "1") return (null, $"{preview.Title}: left alone, {Plain("shared")}.");
        var now = clock.UtcNow;
        var nowMs = new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        var gate = StanleyActGate.Decide(new StanleyGateInput(flagsOf(args), new StanleyClassState(true, false, false, today, cap, undoMinutes, undone, true), nowMs,
            facts.Now.Hour * 60 + facts.Now.Minute, 0, 15, true, overlaps(args), false, false, user.IsSupervised));
        if (!gate.Act) return (null, $"{preview.Title}: left alone, {Plain(gate.Reasons[0])}.");
        StanleyEffectResult done;
        try { done = await effects.ExecuteAsync(user, new StanleyIntent(intent.Kind, args), ctx, ct); }
        catch (ApiException e) { return (null, $"{preview.Title}: not done, {Plain(e.Title)}."); }
        var receipt = new StanleyActionRow
        {
            PublicId = Guid.NewGuid(), UserId = user.Id, Kind = intent.Kind, Status = StanleyActionStatus.Done, CreatedAt = now, ExpiresAt = now, UpdatedAt = now, DoneAt = now,
            UndoUntil = now.AddMinutes(undoMinutes), Ref = done.Ref, IdemKey = key,
            Data = JsonSerializer.Serialize(new StanleyActionData(sailing, preview.Title, preview.Lines, preview.Who, null, preview.Terms, args, because), Json),
        };
        await ledger.AddAsync(receipt, ct);
        return (new StanleyAutoRules.AutoActDto(key, preview.Title, StanleyActionService.Receipt(receipt)), null);
    }

    private static StanleyAutoRules.AutoActsDto Empty(string classId, bool on = false) => new(on, classId, [], [], StanleyAutoRules.BookingNotChecked.ToList(), null);

    /// <summary>
    /// AUT-04, free reservations I always want (phase P10c). Needs row CL-10 (level 4). Reserves a main-dining table (included in the fare) at the guest's usual time on each of the next three nights that has no dinner booked, at most
    /// two a day. The booker books for the booking; anyone else books only for themselves. A night the guest undid is never booked again, and two undone tables stop it.
    /// </summary>
    public async Task<StanleyAutoRules.AutoActsDto> DinnersAsync(UserRecord user, CancellationToken ct)
    {
        if (!await permissions.MayAsync(user, StanleyAutoRules.DinnerRow, ct)) return Empty(StanleyAutoRules.DinnerClassId);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null || sailing is null) return Empty(StanleyAutoRules.DinnerClassId, true);
        var asOf = facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
        var usual = StanleyAutoRules.ParseStanding((await state.GetAsync(false, user.Id, StanleyAutoRules.StandingKey, ct))?.Json).UsualDinner;
        var made = new List<StanleyAutoRules.AutoActDto>();
        var waiting = new List<string>();
        var booking = await BookingOfAsync(user, facts, ct);
        var venue = ShipDining.VenuesOf(AboardPlans.ShipOfSailing(sailing)).FirstOrDefault(v => v.Kind == "main" && !v.WalkIn);
        if (usual.Length == 0) waiting.Add("Choose your usual dinner time first. I book nothing without it.");
        else if (booking is null || venue is null) waiting.Add("There is no main dining room to book on this trip.");
        else
        {
            var (today, undone, keys) = await LedgerAsync(user, StanleyAutoRules.DinnerClassId, facts.Now, ct);
            foreach (var day in StanleyAutoRules.DinnerNights(facts))
            {
                var key = $"aut04:{sailing}:{day}";
                if (keys.Contains(key)) continue;
                var intent = new StanleyIntent(StanleyActionKinds.ReserveDinner, new() { ["day"] = day.ToString(), ["time"] = usual, ["who"] = booking.BookerUserId == user.Id ? "all" : "me" });
                var start = StanleyAutoRules.DinnerStartMs(facts, day, usual);
                var (did, why) = await ActAsync(user, facts, sailing, StanleyAutoRules.DinnerClassId, "Stanley, because you let me book your usual dinner", StanleyAutoRules.DinnerCap, StanleyAutoRules.UndoMinutes, today + made.Count, undone, intent, key,
                    _ => StanleyClassifier.Dining(venue, start, 0), _ => false, false, ct);
                if (did is not null) made.Add(did);
                if (why is not null) waiting.Add(why);
            }
        }
        return new(true, StanleyAutoRules.DinnerClassId, made, [.. waiting.Distinct()], StanleyAutoRules.BookingNotChecked.ToList(), asOf);
    }

    /// <summary>
    /// AUT-08, keep my timings (phase P10c). Needs row CL-11 (level 4) and a Keep my dinner rule the guest made. On a day the programme changed, a main-dining dinner that is the guest's alone and is not at the rule's time is moved to
    /// that time when the table is free and does not sit on a tour. Anything else is only said, for the guest to fix.
    /// </summary>
    public async Task<StanleyAutoRules.AutoActsDto> TimingsAsync(UserRecord user, CancellationToken ct)
    {
        if (!await permissions.MayAsync(user, StanleyAutoRules.TimingRow, ct)) return Empty(StanleyAutoRules.TimingClassId);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null || sailing is null) return Empty(StanleyAutoRules.TimingClassId, true);
        var asOf = facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
        var rule = StanleyStandingRules.Parse((await state.GetAsync(false, user.Id, StanleyStandingRules.StateKey, ct))?.Json).RuleList
            .FirstOrDefault(r => r.Template == "RUL-02" && !r.Practice && DiningRules.DinnerTimes.Contains(r.Time));
        var made = new List<StanleyAutoRules.AutoActDto>();
        var waiting = new List<string>();
        if (rule is null) waiting.Add("Make a Keep my dinner rule first (in your standing rules, not in practice). I move a dinner only to the time you chose.");
        else
        {
            var list = await changeFeed.ListAsync(user, sailing, null, ct);
            var seen = list.Cards.Select(c => new StandingChange(c.Id, c.Kind, c.Day, c.Title, c.Consequence, c.Critical, c.Affects)).ToList();
            var first = Math.Max(1, facts.Today.DayNumber - facts.Departure.DayNumber + 1);
            var (today, undone, keys) = await LedgerAsync(user, StanleyAutoRules.TimingClassId, facts.Now, ct);
            foreach (var day in StanleyAutoRules.ChangedDays(seen, first, facts.Timeline.Days.Count))
            {
                var meals = facts.Meals.Where(m => m.Day == day).ToList();
                if (meals.Count == 0 || meals.Any(m => m.Time == rule.Time)) continue;
                var key = $"aut08:{sailing}:{day}:{rule.Time}";
                if (keys.Contains(key)) continue;
                var intent = new StanleyIntent(StanleyActionKinds.MoveDinner, new() { ["day"] = day.ToString(), ["time"] = rule.Time });
                var start = StanleyAutoRules.DinnerStartMs(facts, day, rule.Time);
                var (did, why) = await ActAsync(user, facts, sailing, StanleyAutoRules.TimingClassId, "Stanley, because you let me keep your dinner time", StanleyAutoRules.TimingCap, StanleyAutoRules.UndoMinutes, today + made.Count, undone, intent, key,
                    a => StanleyClassifier.Dining(DiningRules.VenueById(a.GetValueOrDefault("venueId")) ?? new Venue("", "", "specialty", 1, false, "", "", "", ""), start, 0), _ => StanleyAutoRules.OnATour(facts, day, rule.Time), true, ct);
                if (did is not null) made.Add(did);
                if (why is not null) waiting.Add(why);
            }
        }
        return new(true, StanleyAutoRules.TimingClassId, made, [.. waiting.Distinct()], StanleyAutoRules.BookingNotChecked.ToList(), asOf);
    }

    private async Task<List<string>> RepeatedAsync(UserRecord user, CheckupFacts facts, CancellationToken ct)
    {
        var booking = await BookingOfAsync(user, facts, ct);
        if (booking is null) return [];
        return StanleyAutoRules.Repeated((await requests.ListAsync(user, booking.Number, ct)).Select(r => (r.Item, r.Stage == "cancelled")));
    }

    /// <summary>
    /// AUT-09, my standing order (phase P10c). Needs row CL-12 (level 4). Sends one free stateroom request (ice, towels or pillows) the guest has asked for three times, once a day at the time they chose. It never sends anything
    /// else, never a repair and never more than one. The guest can cancel it until the crew is on the way, or undo it from the ledger.
    /// </summary>
    public async Task<StanleyAutoRules.AutoActsDto> OrdersAsync(UserRecord user, CancellationToken ct)
    {
        if (!await permissions.MayAsync(user, StanleyAutoRules.OrderRow, ct)) return Empty(StanleyAutoRules.OrderClassId);
        var (facts, sailing) = await checkup.FactsAsync(user, ct);
        if (facts is null || sailing is null) return Empty(StanleyAutoRules.OrderClassId, true);
        var asOf = facts.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
        var choice = StanleyAutoRules.ParseStanding((await state.GetAsync(false, user.Id, StanleyAutoRules.StandingKey, ct))?.Json);
        var made = new List<StanleyAutoRules.AutoActDto>();
        var waiting = new List<string>();
        var item = ServiceRules.RequestItemById(choice.OrderItem);
        if (item is null) waiting.Add("Choose a request and the time to send it first. I send nothing without it.");
        else if (!(await RepeatedAsync(user, facts, ct)).Contains(item.Id)) waiting.Add($"You have not asked for {StanleyActionRules.ItemLabel(item.Id).ToLowerInvariant()} three times yet, so I do not repeat it.");
        else if (!StanleyAutoRules.OrderDue(choice.OrderTime, facts.Now)) waiting.Add($"It is not {choice.OrderTime} yet.");
        else
        {
            var (today, undone, keys) = await LedgerAsync(user, StanleyAutoRules.OrderClassId, facts.Now, ct);
            var key = $"aut09:{sailing}:{facts.Today:yyyy-MM-dd}:{item.Id}";
            if (!keys.Contains(key))
            {
                var intent = new StanleyIntent(StanleyActionKinds.OrderItem, new() { ["item"] = item.Id, ["qty"] = "1" });
                var nowMs = new DateTimeOffset(DateTime.SpecifyKind(clock.UtcNow, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
                var (did, why) = await ActAsync(user, facts, sailing, StanleyAutoRules.OrderClassId, "Stanley, because you let me repeat your usual request", StanleyAutoRules.OrderCap, StanleyAutoRules.OrderUndoMinutes(item), today, undone, intent, key,
                    _ => StanleyClassifier.Service(item, nowMs), _ => false, false, ct);
                if (did is not null) made.Add(did);
                if (why is not null) waiting.Add(why);
            }
        }
        return new(true, StanleyAutoRules.OrderClassId, made, waiting, StanleyAutoRules.BookingNotChecked.ToList(), asOf);
    }

    /// <summary>The guest's usual dinner time and standing order, and what they may choose from.</summary>
    public async Task<StanleyAutoRules.AutoStandingDto> StandingAsync(UserRecord user, CancellationToken ct)
    {
        var s = StanleyAutoRules.ParseStanding((await state.GetAsync(false, user.Id, StanleyAutoRules.StandingKey, ct))?.Json);
        var (facts, _) = await checkup.FactsAsync(user, ct);
        var repeated = facts is null ? [] : await RepeatedAsync(user, facts, ct);
        return new(s.UsualDinner, s.OrderItem, s.OrderTime, [.. DiningRules.DinnerTimes], repeated, StanleyAutoRules.BookingNotChecked.ToList());
    }

    /// <summary>Saves the guest's choices (all three at once; an empty value clears one). 400 with the closed reason usual, item, notRepeated or time.</summary>
    public async Task<StanleyAutoRules.AutoStandingDto> SetStandingAsync(UserRecord user, StanleyAutoRules.AutoStandingRequest? body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        var usual = body?.UsualDinner ?? "";
        var item = body?.OrderItem ?? "";
        var time = body?.OrderTime ?? "";
        var (facts, _) = await checkup.FactsAsync(user, ct);
        var repeated = facts is null ? [] : await RepeatedAsync(user, facts, ct);
        if (StanleyAutoRules.StandingProblem(usual, item, time, repeated) is { } problem) throw ApiException.Invalid(problem);
        var row = await state.GetAsync(false, user.Id, StanleyAutoRules.StandingKey, ct);
        var next = item.Length == 0 ? new StanleyAutoRules.AutoStanding(usual, "", "") : new(usual, item, time);
        if (await state.SaveAsync(false, user.Id, StanleyAutoRules.StandingKey, StanleyAutoRules.StandingToJson(next), row?.Version ?? 0, clock.UtcNow, ct) is null) throw ApiException.Conflict("changed");
        return await StandingAsync(user, ct);
    }
}
