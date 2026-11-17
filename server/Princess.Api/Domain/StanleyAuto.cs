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
        if (f.Nights >= 1)
        {
            var last = f.Departure.AddDays(f.Nights);
            list.Add(new($"{Marker}bags:{last:yyyy-MM-dd}", "Bags go out tonight. The bags screen has the tags.", TripRules.ZonedToUtc(last.AddDays(-1), BagNight)));
            if (f.Timeline is not null)
                for (var day = 1; day <= f.Timeline.Days.Count; day++)
                    if (f.Timeline.AllAboardAt(day) is { } aboard)
                    {
                        var d = f.Timeline.Days[day - 1];
                        var place = Itinerary.PortOf(d.Port)?.Name ?? d.Port;
                        list.Add(new($"{Marker}aboard:{d.Date:yyyy-MM-dd}", $"All aboard in {place} is in an hour. Time to head back to the ship.", aboard.AddMinutes(-AboardLeadMinutes)));
                        list.Add(new($"{Marker}portpack:{d.Date:yyyy-MM-dd}", $"Tomorrow is {place}. While you are on ship Wi-Fi, open the port page so it is saved on this phone for ashore.", TripRules.ZonedToUtc(d.Date.AddDays(-1), PortPackTime)));
                    }
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
        "Saved for me (AUT-07) so far only reminds you the evening before a port to open its page on ship Wi-Fi; nothing is saved to your phone for you, and the boarding pass, receipts, recap and album are not built. Lists kept current (AUT-05) is a separate run that only covers the packing list.",
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
}
