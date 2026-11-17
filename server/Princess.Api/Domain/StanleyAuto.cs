namespace Princess.Api.Domain;

/// <summary>A reminder Stanley may set because a date on the trip matters. <c>Key</c> is stable (the class, the kind of date and the date), so the same date is never set twice. Ids, dates and words the server wrote; nothing the guest typed.</summary>
public sealed record AutoCandidate(string Key, string Text, DateTime DueAt);

/// <summary>A reminder Stanley set and the receipt that says so.</summary>
public sealed record AutoMade(string Key, string Text, DateTime DueAt, string Receipt);

/// <summary>What a run did: <c>On</c> says whether the guest has let Stanley do this, <c>Made</c> what was set, <c>Waiting</c> what was left for a later run and why, <c>NotChecked</c> what was not read.</summary>
public sealed record AutoRunDto(bool On, string Class, List<AutoMade> Made, List<string> Waiting, List<string> NotChecked, string? AsOf);

/// <summary>
/// Rung 4, the safe classes (docs/stanley-actions-and-proactive-plan.md, phase P10a). v1 is AUT-02, deadline reminders: with the guest's own switch on (CL-08, level 4) Stanley sets a reminder for a date on the trip that can cost
/// something (check-in opens, final payment), never recurring and never tied to anything but a date on the trip, at most <see cref="MaxPerTrip"/> in all. A reminder is not an item the classifier prices, so the gate here is
/// the switch, the pause, the child rule, the cap and the reminders' own horizon. AUT-01 (reminders that follow) already happens because anchored reminders move with their anchor; AUT-05 and AUT-07 act on the device and are still to do. Pure.
/// </summary>
public static class StanleyAutoRules
{
    public const string ClassId = "AUT-02", Row = "CL-08", Marker = "aut02:";
    public const int MaxPerTrip = 30, PaymentLeadFar = 7, PaymentLeadNear = 2, UndoMinutes = 120;
    private static readonly TimeOnly Morning = new(9, 0);

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
        "Lists kept current (AUT-05) and saved for me (AUT-07) are not built yet.",
        "Bag night, documents, dining and exit time reminders are not set yet.",
    ];
}
