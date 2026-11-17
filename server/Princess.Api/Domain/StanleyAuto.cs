namespace Princess.Api.Domain;

/// <summary>A reminder Stanley may set because a date on the trip matters. <c>Key</c> is stable (the class, the kind of date and the date), so the same date is never set twice. Ids, dates and words the server wrote; nothing the guest typed.</summary>
public sealed record AutoCandidate(string Key, string Text, DateTime DueAt);

/// <summary>A reminder Stanley set and the receipt that says so.</summary>
public sealed record AutoMade(string Key, string Text, DateTime DueAt, string Receipt);

/// <summary>What a run did: <c>On</c> says whether the guest has let Stanley do this, <c>Made</c> what was set, <c>Waiting</c> what was left for a later run and why, <c>NotChecked</c> what was not read.</summary>
public sealed record AutoRunDto(bool On, string Class, List<AutoMade> Made, List<string> Waiting, List<string> NotChecked, string? AsOf);

/// <summary>What changed on one list since the guest's last look: what Stanley's suggestions now add and what they no longer include. Item words only; nothing the guest typed.</summary>
public sealed record AutoListChange(string List, List<string> Added, List<string> Removed);

/// <summary>A list run: <c>FirstLook</c> says this was the first time the list was read, so it only recorded where things stand.</summary>
public sealed record AutoListsDto(bool On, bool FirstLook, List<AutoListChange> Changes, List<string> NotChecked, string? AsOf);

/// <summary>
/// Rung 4, the safe classes (docs/stanley-actions-and-proactive-plan.md, phase P10a). v1 is AUT-02, deadline reminders: with the guest's own switch on (CL-08, level 4) Stanley sets a reminder for a date on the trip that can cost
/// something (check-in opens, final payment), never recurring and never tied to anything but a date on the trip, at most <see cref="MaxPerTrip"/> in all. A reminder is not an item the classifier prices, so the gate here is
/// the switch, the pause, the child rule, the cap and the reminders' own horizon. AUT-01 (reminders that follow) already happens because anchored reminders move with their anchor; AUT-05 and AUT-07 act on the device and are still to do. Pure.
/// </summary>
public static class StanleyAutoRules
{
    public const string ClassId = "AUT-02", Row = "CL-08", Marker = "aut02:";
    public const int MaxPerTrip = 30, PaymentLeadFar = 7, PaymentLeadNear = 2, UndoMinutes = 120, ExitLeadMinutes = 60, DocsLead = 14, DiningFreezeLead = 5, AboardLeadMinutes = 60;
    private static readonly TimeOnly Morning = new(9, 0), BagNight = new(15, 0), PortPackTime = new(18, 0);

    /// <summary>The dates on the trip that can cost something and are still ahead. A paid balance and a check-in that has opened give none.</summary>
    public static List<AutoCandidate> Candidates(CheckupFacts f)
    {
        var list = new List<AutoCandidate>();
        if (f.CheckinState == "notOpen")
            list.Add(new($"{Marker}checkin:{DateOnly.FromDateTime(f.CheckinOpensAt):yyyy-MM-dd}", "Online check-in opens today.", f.CheckinOpensAt.AddHours(9)));
        if (f.PaymentState is "upcoming" or "dueSoon" && f.FinalDue is { } due)
        {
            list.Add(new($"{Marker}pay7:{due:yyyy-MM-dd}", "Your final payment is due in 7 days.", TripRules.ZonedToUtc(due.AddDays(-PaymentLeadFar), Morning)));
            list.Add(new($"{Marker}pay2:{due:yyyy-MM-dd}", "Your final payment is due in 2 days.", TripRules.ZonedToUtc(due.AddDays(-PaymentLeadNear), Morning)));
        }
        if (!f.AgentBooking && f.Travellers.Any(t => t.Docs.Results.Any(r => r.Status != "ready")))
            list.Add(new($"{Marker}docs:{f.Departure:yyyy-MM-dd}", "Two weeks to sailing and a document is not ready. The documents screen shows which.", TripRules.ZonedToUtc(f.Departure.AddDays(-DocsLead), Morning)));
        if (!f.AgentBooking && f.Today <= f.Departure.AddDays(-DiningPlanRules.FreezeDays))
            list.Add(new($"{Marker}dining:{f.Departure:yyyy-MM-dd}", "Your dining plan freezes in 3 days. The dining screen is where to change it.", TripRules.ZonedToUtc(f.Departure.AddDays(-DiningFreezeLead), Morning)));
        list.Add(new($"{Marker}pass:{f.Departure:yyyy-MM-dd}", "Tomorrow you sail. While you have signal, open your boarding pass so it is saved on this phone.", TripRules.ZonedToUtc(f.Departure.AddDays(-1), PortPackTime)));
        if (f.Nights >= 1)
        {
            var last = f.Departure.AddDays(f.Nights);
            list.Add(new($"{Marker}bags:{last:yyyy-MM-dd}", "Bags go out tonight. The bags screen has the tags.", TripRules.ZonedToUtc(last.AddDays(-1), BagNight)));
            list.Add(new($"{Marker}recap:{last:yyyy-MM-dd}", "Your trip is over. The Remember the trip screen has the recap, your feedback and your chats to keep.", TripRules.ZonedToUtc(last.AddDays(1), Morning)));
            if (f.Timeline is not null)
                for (var day = 1; day <= f.Timeline.Days.Count; day++)
                    if (f.Timeline.AllAboardAt(day) is { } aboard)
                    {
                        var d = f.Timeline.Days[day - 1];
                        var place = Itinerary.PortOf(d.Port)?.Name ?? d.Port;
                        list.Add(new($"{Marker}aboard:{d.Date:yyyy-MM-dd}", $"All aboard in {place} is in an hour. Time to head back to the ship.", aboard.AddMinutes(-AboardLeadMinutes)));
                        list.Add(new($"{Marker}portpack:{d.Date:yyyy-MM-dd}", $"Tomorrow is {place}. While you are on ship Wi-Fi, open the port page so it is saved on this phone for ashore.", TripRules.ZonedToUtc(d.Date.AddDays(-1), PortPackTime)));
                    }
            if (f.Timeline is not null && f.Timeline.Days.Count >= 2)
            {
                var vacate = DisembarkRules.Times(f.Timeline).VacateAt;
                list.Add(new($"{Marker}exit:{DateOnly.FromDateTime(vacate):yyyy-MM-dd}", "Your cabin needs to be empty in an hour. The getting off screen has the last look list.", vacate.AddMinutes(-ExitLeadMinutes)));
            }
        }
        return list;
    }

    /// <summary>What to set now. Skips what is already set (<paramref name="have"/> holds keys), what is already past, what is beyond the reminders' horizon (it waits for a later run) and anything over the cap.</summary>
    public static (List<AutoCandidate> Add, List<string> Waiting) Plan(IEnumerable<AutoCandidate> candidates, IReadOnlySet<string> have, int madeSoFar, DateTime now)
    {
        var add = new List<AutoCandidate>();
        var waiting = new List<string>();
        foreach (var c in candidates.OrderBy(c => c.DueAt))
        {
            if (have.Contains(c.Key) || c.DueAt <= now) continue;
            if (c.DueAt > now.AddDays(StanleyReminderRules.MaxDays)) { waiting.Add("Not yet in range: " + c.Text); continue; }
            if (madeSoFar + add.Count >= MaxPerTrip) { waiting.Add("Over the limit of 30 reminders for this trip: " + c.Text); continue; }
            add.Add(c);
        }
        return (add, waiting);
    }

    public static readonly string[] NotChecked =
    [
        "Reminders that follow (AUT-01) are done by the reminders themselves when a time moves.",
        "Saved for me (AUT-07) only reminds you: the evening before sailing to open your boarding pass, the evening before a port to open its page on ship Wi-Fi, and the day after the ship gets in to open the recap screen. Nothing is saved to your phone or built for you, and receipts and an album are not built. Lists kept current (AUT-05) is a separate run that only covers the packing list.",
    ];

    public const string ListsKey = "stanley.auto.lists.packing";

    /// <summary>What the suggested packing items now add and drop against the ids recorded last time. The guest's own items are never in either list, and a first look (no record) reports nothing.</summary>
    public static AutoListChange? Diff(IReadOnlyList<PackItem> now, IReadOnlyCollection<string>? before)
    {
        if (before is null) return null;
        var suggested = now.Where(i => i.Group != "mine").ToList();
        var was = before.ToHashSet(StringComparer.Ordinal);
        var added = suggested.Where(i => !was.Contains(i.Id)).Select(i => i.Label).ToList();
        var ids = suggested.Select(i => i.Id).ToHashSet(StringComparer.Ordinal);
        var removed = was.Where(id => !ids.Contains(id)).Select(PrettyId).Order(StringComparer.Ordinal).ToList();
        return added.Count == 0 && removed.Count == 0 ? null : new("packing", added, removed);
    }

    public const string ChecklistKey = "stanley.auto.lists.checklist";

    /// <summary>What the trip checklist now shows as done against the ids recorded last time: <c>Added</c> is newly done, <c>Removed</c> is no longer done. A first look (no record) reports nothing.</summary>
    public static AutoListChange? ChecklistDiff(IReadOnlyList<ChecklistEntry> now, IReadOnlyCollection<string>? before)
    {
        if (before is null) return null;
        var done = now.Where(e => e.State == "done").Select(e => e.Id).ToHashSet(StringComparer.Ordinal);
        var was = before.ToHashSet(StringComparer.Ordinal);
        var added = done.Where(id => !was.Contains(id)).Order(StringComparer.Ordinal).Select(PrettyId).ToList();
        var removed = was.Where(id => !done.Contains(id)).Order(StringComparer.Ordinal).Select(PrettyId).ToList();
        return added.Count == 0 && removed.Count == 0 ? null : new("checklist", added, removed);
    }

    public static string ChecklistToJson(IEnumerable<ChecklistEntry> entries) => System.Text.Json.JsonSerializer.Serialize(entries.Where(e => e.State == "done").Select(e => e.Id).Distinct().Order(StringComparer.Ordinal).ToList());

    public const string ShortlistKey = "stanley.auto.lists.shortlist";

    /// <summary>
    /// The guest's shortlisted sailings against the ids recorded last time: <c>Added</c> is a sailing newly on the shortlist (the guest's own choice, said back), <c>Removed</c> is one on it last time that is no longer in the catalogue
    /// or no longer open to book. <paramref name="titles"/> maps the sailing ids that are still open to book to a title. A first look (no record) reports nothing.
    /// </summary>
    public static AutoListChange? ShortlistDiff(IReadOnlyCollection<string> shortlist, IReadOnlyDictionary<string, string> titles, IReadOnlyCollection<string>? before)
    {
        if (before is null) return null;
        var was = before.ToHashSet(StringComparer.Ordinal);
        var added = shortlist.Where(id => !was.Contains(id) && titles.ContainsKey(id)).Select(id => titles[id]).ToList();
        var gone = was.Where(id => !titles.ContainsKey(id)).Order(StringComparer.Ordinal).Select(PrettyId).ToList();
        return added.Count == 0 && gone.Count == 0 ? null : new("shortlist", added, gone);
    }

    public static string ShortlistToJson(IEnumerable<string> ids) => System.Text.Json.JsonSerializer.Serialize(ids.Distinct().Order(StringComparer.Ordinal).ToList());

    public const string ComparisonKey = "stanley.auto.lists.comparison";

    /// <summary>
    /// The comparison of the guest's open shortlisted sailings (their own saved weights and filters) against the scores recorded last time, in rank order as "id=score". It says a score that moved and a new sailing at the top;
    /// a sailing that joined or left the shortlist is the shortlist's own line, not repeated here. A first look (no record) reports nothing.
    /// </summary>
    public static AutoListChange? ComparisonDiff(IReadOnlyList<(string Id, string Title, int? Score)> now, IReadOnlyCollection<string>? before)
    {
        if (before is null) return null;
        var was = before.Select(b => b.Split('=', 2)).Where(p => p.Length == 2).ToDictionary(p => p[0], p => p[1], StringComparer.Ordinal);
        var lines = new List<string>();
        foreach (var r in now.Where(r => was.ContainsKey(r.Id)))
        {
            var score = r.Score?.ToString() ?? "-";
            if (was[r.Id] != score) lines.Add($"{r.Title}: {(was[r.Id] == "-" ? "no score" : was[r.Id])} to {(score == "-" ? "no score" : score)} out of 100");
        }
        var oldTop = before.Select(b => b.Split('=', 2)[0]).FirstOrDefault(id => now.Any(r => r.Id == id));
        if (now.Count > 0 && oldTop is not null && now[0].Id != oldTop && now[0].Score is not null && was.ContainsKey(now[0].Id)) lines.Add($"{now[0].Title} now scores highest");
        return lines.Count == 0 ? null : new("comparison", lines, []);
    }

    public static string ComparisonToJson(IEnumerable<(string Id, string Title, int? Score)> rows) => System.Text.Json.JsonSerializer.Serialize(rows.Select(r => $"{r.Id}={r.Score?.ToString() ?? "-"}").ToList());

    private static string PrettyId(string id) => id.Replace('-', ' ').Replace('_', ' ');

    public static string ToJson(IEnumerable<PackItem> items) => System.Text.Json.JsonSerializer.Serialize(items.Where(i => i.Group != "mine").Select(i => i.Id).Distinct().Order(StringComparer.Ordinal).ToList());

    public static List<string>? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json)?.Where(x => !string.IsNullOrWhiteSpace(x)).Take(400).ToList(); }
        catch (System.Text.Json.JsonException) { return null; }
    }

    public static readonly string[] ListsNotChecked =
    [
        "The packing list (which holds the documents to bring), the trip checklist and the sailing shortlist are kept current so far. The comparison of your shortlist (with your saved weights) is kept current so far: only a score that moved is said, and nothing is re-ranked for you. A sailing that is gone or closed to booking is only said, never removed from your shortlist.",
        "Your own items, ticks and hidden items are never changed.",
    ];

    // ---- AUT-03, my plan topped up (phase P10b) ----

    public const string PlanClassId = "AUT-03", PlanRow = "CL-09", PicksKey = "stanley.auto.picks", DraftClassId = "AUT-06", DraftRow = "CL-06", DraftsKey = "stanley.auto.drafts";
    public const int MaxPicksPerDay = 4, LookAheadDays = 3, MaxDismissed = 200;
    private const int EveningFromMinutes = 17 * 60;

    /// <summary>One thing Stanley added to the guest's own plan. Words and ids the server wrote; nothing the guest typed.</summary>
    public sealed record Pick(string Id, int Day, string Title, string Start, int Minutes, string Place);

    /// <summary>Stanley's picks and the ones the guest removed (never added again).</summary>
    public sealed record PicksDoc(List<Pick> Picks, List<string> Dismissed);

    public sealed record AutoPlanDto(bool On, List<Pick> Picks, List<string> Added, List<string> Removed, List<string> NotChecked, string? AsOf);

    public static readonly string[] PlanNotChecked =
    [
        "Only things that are included in your fare are added, on sea days or in the evening of a port day, and never on top of something you booked, a dinner or another pick. At most 4 a day, for the next 3 days.",
        "Nothing is held or booked. A pick is a note in your own plan with the screen to open; walking times and whether a place has space are not checked.",
        "What you added yourself is never changed. A pick you remove is not added again.",
    ];

    private static int Mins(string hhmm) => int.Parse(hhmm[..2], System.Globalization.CultureInfo.InvariantCulture) * 60 + int.Parse(hhmm[3..5], System.Globalization.CultureInfo.InvariantCulture);
    private static bool Overlap(string a, int am, string b, int bm) { var x = Mins(a); var y = Mins(b); return x < y + bm && y < x + am; }

    /// <summary>Everything the guest has on a day that a pick must not sit on: booked tours, booked or usual dinner, and other picks.</summary>
    private static List<(string Start, int Minutes)> Busy(CheckupFacts f, int day)
    {
        var busy = new List<(string, int)>();
        foreach (var t in f.Tours.Where(t => t.Day == day)) busy.Add((t.Start, (int)Math.Round(t.Hours * 60)));
        foreach (var m in f.Meals.Where(m => m.Day == day && m.Time is not null)) busy.Add((m.Time!, DayPlanRules.DinnerMinutes));
        busy.Add((DayPlanRules.DinnerStart, DayPlanRules.DinnerMinutes));
        return busy;
    }

    /// <summary>
    /// The picks for the next few days. A pick already held stays only while its event is still on at the same time and clear of the guest's own things; one that no longer fits is dropped and said. New picks are free, adult-or-all-ages
    /// events on a sea day or after 5 pm on a port day, clear of everything booked, a dinner and each other, at most <see cref="MaxPicksPerDay"/> a day. A removed pick is never added again.
    /// </summary>
    public static (PicksDoc Doc, List<string> Added, List<string> Removed) Top(CheckupFacts f, IReadOnlyList<PlanChange> feed, string? shipId, PicksDoc? before)
    {
        var doc = before ?? new([], []);
        var dismissed = doc.Dismissed.ToHashSet(StringComparer.Ordinal);
        var firstDay = Math.Max(1, f.Today.DayNumber - f.Departure.DayNumber + 1);
        var lastDay = Math.Min(f.Timeline.Days.Count, firstDay + LookAheadDays - 1);
        var keep = new List<Pick>();
        var added = new List<string>();
        var removed = new List<string>();
        for (var day = firstDay; day <= lastDay; day++)
        {
            var events = ProgramRules.On(f.Timeline, day, true, feed, shipId);
            var busy = Busy(f, day);
            var d = f.Timeline.Days[day - 1];
            var mine = new List<Pick>();
            foreach (var p in doc.Picks.Where(p => p.Day == day).OrderBy(p => Mins(p.Start)).ThenBy(p => p.Id, StringComparer.Ordinal))
            {
                var e = events.FirstOrDefault(x => x.Id == p.Id);
                if (e is null || e.Status != "on" || e.Start != p.Start || e.Extra != 0 || busy.Any(b => Overlap(b.Start, b.Minutes, p.Start, p.Minutes)) || mine.Any(m => Overlap(m.Start, m.Minutes, p.Start, p.Minutes)))
                { removed.Add($"{p.Title} on day {day}"); continue; }
                mine.Add(p);
            }
            foreach (var e in events.Where(e => e.Status == "on" && e.Extra == 0 && e.Age is "all" or "adults" && !dismissed.Contains(PickKey(day, e.Id))).OrderBy(e => e.StartAt).ThenBy(e => e.Id, StringComparer.Ordinal))
            {
                if (mine.Count >= MaxPicksPerDay) break;
                if (mine.Any(m => m.Id == e.Id)) continue;
                if (d.Port != "sea" && Mins(e.Start) < EveningFromMinutes) continue;
                if (busy.Any(b => Overlap(b.Start, b.Minutes, e.Start, e.Minutes)) || mine.Any(m => Overlap(m.Start, m.Minutes, e.Start, e.Minutes))) continue;
                mine.Add(new(e.Id, day, e.Title, e.Start, e.Minutes, e.PlaceId));
                added.Add($"{e.Title} on day {day} at {e.Start}");
            }
            keep.AddRange(mine.OrderBy(m => Mins(m.Start)).ThenBy(m => m.Id, StringComparer.Ordinal));
        }
        // Picks on days outside the window are neither judged nor dropped, unless the day has passed.
        keep.AddRange(doc.Picks.Where(p => p.Day > lastDay));
        return (new(keep, doc.Dismissed), added, removed);
    }

    public static string PickKey(int day, string eventId) => $"{day}:{eventId}";

    public static PicksDoc Dismiss(PicksDoc doc, string pickKey)
    {
        var picks = doc.Picks.Where(p => PickKey(p.Day, p.Id) != pickKey).ToList();
        if (picks.Count == doc.Picks.Count) return doc;
        var dismissed = doc.Dismissed.Append(pickKey).Distinct(StringComparer.Ordinal).TakeLast(MaxDismissed).ToList();
        return new(picks, dismissed);
    }

    public static string PicksToJson(PicksDoc d) => System.Text.Json.JsonSerializer.Serialize(d, DocJson);
    private static readonly System.Text.Json.JsonSerializerOptions DocJson = new(System.Text.Json.JsonSerializerDefaults.Web);

    public static PicksDoc? ParsePicks(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var d = System.Text.Json.JsonSerializer.Deserialize<PicksDoc>(json, DocJson);
            return d is null ? null : new([.. (d.Picks ?? []).Where(p => !string.IsNullOrWhiteSpace(p.Id) && p.Start is { Length: 5 }).Take(80)], [.. (d.Dismissed ?? []).Take(MaxDismissed)]);
        }
        catch (System.Text.Json.JsonException) { return null; }
    }

    // ---- AUT-06, drafts saved (phase P10b) ----

    /// <summary>A saved draft: one per form, replaced when the facts change. For the guest to read, change and send themselves.</summary>
    public sealed record SavedDraft(string Kind, string Text, string SavedAt);

    public sealed record AutoDraftsDto(bool On, List<SavedDraft> Drafts, List<string> Saved, List<string> NotChecked, string? AsOf);

    public static readonly string[] DraftNotChecked =
    [
        "Only two drafts so far: a plan note for tonight and a note for if you may be late back to the ship. Check-in, customs and feedback drafts are not saved.",
        "A draft is a note kept for you to read, change and send yourself. Nothing is sent or submitted, and a draft names times and places only.",
    ];

    /// <summary>The drafts worth keeping now: one per kind, built from tonight's bundle. A kind whose text has not changed is not saved again.</summary>
    public static List<SavedDraft> Fresh(BundleDto tonight, DateTime now)
    {
        var list = new List<SavedDraft>();
        foreach (var kind in StanleyBundleRules.Drafts)
            if (StanleyBundleRules.Draft(kind, tonight) is { } d) list.Add(new(kind, d.Text, now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")));
        return list;
    }

    /// <summary>What changed against the drafts already saved: the kinds that are new or have new words. Saved drafts that are no longer built stay until the guest sees a new one.</summary>
    public static (List<SavedDraft> All, List<string> Saved) Merge(IReadOnlyList<SavedDraft> have, IReadOnlyList<SavedDraft> fresh)
    {
        var all = have.ToDictionary(d => d.Kind, StringComparer.Ordinal);
        var saved = new List<string>();
        foreach (var d in fresh)
            if (!all.TryGetValue(d.Kind, out var old) || old.Text != d.Text) { all[d.Kind] = d; saved.Add(d.Kind == "late-note" ? "Note for if you are late back" : "Plan note for tonight"); }
        return ([.. all.Values.OrderBy(d => d.Kind, StringComparer.Ordinal)], saved);
    }

    public static string DraftsToJson(IEnumerable<SavedDraft> d) => System.Text.Json.JsonSerializer.Serialize(d, DocJson);

    public static List<SavedDraft> ParseDrafts(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return [.. (System.Text.Json.JsonSerializer.Deserialize<List<SavedDraft>>(json, DocJson) ?? []).Where(d => StanleyBundleRules.DraftOk(d.Kind) && !string.IsNullOrEmpty(d.Text)).Take(4)]; }
        catch (System.Text.Json.JsonException) { return []; }
    }

    // ---- AUT-04 free reservations, AUT-08 keep my timings, AUT-09 my standing order (phase P10c) ----

    public const string DinnerClassId = "AUT-04", DinnerRow = "CL-10", TimingClassId = "AUT-08", TimingRow = "CL-11", OrderClassId = "AUT-09", OrderRow = "CL-12", StandingKey = "stanley.auto.standing";
    public const int DinnerCap = 2, TimingCap = 2, OrderCap = 1, BookAhead = 3, RepeatTimes = 3;
    /// <summary>The free stateroom requests a standing order may repeat. A repair, a charge or anything else is never repeated.</summary>
    public static readonly string[] OrderItems = ["ice", "towels", "pillows"];

    /// <summary>What the guest chose to be repeated: their usual main-dining time, and one stateroom request with the time of day to send it. Ids and times only, never the guest's words.</summary>
    public sealed record AutoStanding(string UsualDinner, string OrderItem, string OrderTime);

    public sealed record AutoActDto(string Key, string Text, string Receipt);

    /// <summary>What a run of AUT-04, AUT-08 or AUT-09 did: what it did (each with a receipt that can be undone for two hours), what it left alone and why, and what it does not check.</summary>
    public sealed record AutoActsDto(bool On, string Class, List<AutoActDto> Made, List<string> Waiting, List<string> NotChecked, string? AsOf);

    public sealed record AutoStandingRequest(string? UsualDinner, string? OrderItem, string? OrderTime);

    public sealed record AutoStandingDto(string UsualDinner, string OrderItem, string OrderTime, List<string> DinnerTimes, List<string> OrderItems, List<string> NotChecked);

    public static readonly string[] BookingNotChecked =
    [
        "Free reservations (AUT-04) are only main dining, on a night with no dinner booked yet, at your usual time, for the next 3 nights, at most 2 a day. A booker books for the whole booking; anyone else only for themselves. Specialty dining, paid shows and anyone else's own account are never booked.",
        "Whether you turned up at a table I booked is not checked. If you undo two tables I booked I stop booking and ask first, and a night you undid is never booked again.",
        "Keep my timings (AUT-08) moves only a main-dining dinner that is yours alone, to the time of a Keep my dinner rule you made, on a day the programme changed, when the table is free. Nothing else is moved, and a booking that cannot move is only said.",
        "My standing order (AUT-09) sends only ice, towels or pillows (never a repair), only one you have asked for three times, once a day at the time you chose. Whether the crew can bring it is theirs to say; you can cancel it until it is on its way.",
    ];

    public static string? StandingProblem(string? usual, string? item, string? time, IReadOnlyCollection<string> repeated)
    {
        if (usual is { Length: > 0 } && !DiningRules.DinnerTimes.Contains(usual)) return "usual";
        if (item is { Length: > 0 })
        {
            if (!OrderItems.Contains(item)) return "item";
            if (!repeated.Contains(item)) return "notRepeated";
            if (time is null || !ClockTime(time)) return "time";
        }
        return null;
    }

    public static bool ClockTime(string t) => t.Length == 5 && t[2] == ':' && int.TryParse(t[..2], out var h) && int.TryParse(t[3..], out var m) && h is >= 0 and <= 23 && m is >= 0 and <= 59;

    public static string StandingToJson(AutoStanding s) => System.Text.Json.JsonSerializer.Serialize(s, DocJson);

    public static AutoStanding ParseStanding(string? json)
    {
        var none = new AutoStanding("", "", "");
        if (string.IsNullOrWhiteSpace(json)) return none;
        try
        {
            var d = System.Text.Json.JsonSerializer.Deserialize<AutoStanding>(json, DocJson);
            if (d is null) return none;
            var usual = DiningRules.DinnerTimes.Contains(d.UsualDinner ?? "") ? d.UsualDinner! : "";
            var ok = OrderItems.Contains(d.OrderItem ?? "") && ClockTime(d.OrderTime ?? "");
            return new(usual, ok ? d.OrderItem! : "", ok ? d.OrderTime! : "");
        }
        catch (System.Text.Json.JsonException) { return none; }
    }

    /// <summary>Items asked for at least <see cref="RepeatTimes"/> times (a cancelled request does not count) among those a standing order may repeat.</summary>
    public static List<string> Repeated(IEnumerable<(string Item, bool Cancelled)> asked) =>
        [.. asked.Where(a => !a.Cancelled && OrderItems.Contains(a.Item)).GroupBy(a => a.Item).Where(g => g.Count() >= RepeatTimes).Select(g => g.Key).OrderBy(i => i, StringComparer.Ordinal)];

    /// <summary>The dinner nights worth booking: from today for <see cref="BookAhead"/> days, a night the ship has a dinner, with no dinner of any kind booked on it.</summary>
    public static List<int> DinnerNights(CheckupFacts f)
    {
        var first = Math.Max(1, f.Today.DayNumber - f.Departure.DayNumber + 1);
        var last = Math.Min(f.Timeline.Days.Count, first + BookAhead - 1);
        var nights = new List<int>();
        for (var day = first; day <= last; day++)
            if (DiningRules.IsDinnerDay(f.Timeline, day) && !f.Meals.Any(m => m.Day == day)) nights.Add(day);
        return nights;
    }

    /// <summary>The start of a dinner as epoch milliseconds, on the ship's clock for that night.</summary>
    public static long DinnerStartMs(CheckupFacts f, int day, string time)
    {
        var date = f.Timeline.Departure.AddDays(day - 1);
        var utc = Itinerary.LocalToUtc(date, TimeOnly.ParseExact(time, "HH:mm"), f.Timeline.ShipZoneOnDate(date));
        return new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
    }

    /// <summary>Days with a programme change on record that a Keep my dinner rule may react to.</summary>
    public static List<int> ChangedDays(IEnumerable<StandingChange> changes, int firstDay, int lastDay) =>
        [.. changes.Where(c => c.Kind == ChangeKinds.Itinerary && c.Day is { } d && d >= firstDay && d <= lastDay && c.Consequence != ChangeConsequence.Optional).Select(c => c.Day!.Value).Distinct().OrderBy(d => d)];

    /// <summary>Whether a dinner at this time on this day would sit on a tour the guest booked.</summary>
    public static bool OnATour(CheckupFacts f, int day, string time) =>
        f.Tours.Any(t => t.Day == day && Overlap(t.Start, (int)Math.Round(t.Hours * 60), time, DayPlanRules.DinnerMinutes));

    /// <summary>A request can be withdrawn only until the crew is on the way (half its usual time), so its undo window is that long, not two hours.</summary>
    public static int OrderUndoMinutes(ServiceRequestItem item) => Math.Max(1, item.EtaMin / 2);

    /// <summary>Whether it is time to send today's standing order: the chosen time has come on the guest's clock.</summary>
    public static bool OrderDue(string time, DateTime guestNow) => ClockTime(time) && guestNow.Hour * 60 + guestNow.Minute >= Mins(time);
}
