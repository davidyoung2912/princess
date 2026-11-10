namespace Princess.Api.Domain;

/// <summary>
/// "Keep this chat" (docs/chat-features-research.md, 8.5 and phase 5). Chat messages are deleted 30 days after the cruise. A chat is kept past that, for 12 months after the cruise, only when
/// <b>every</b> person in it has agreed; a supervised child cannot agree for themself, their guardian does. The deletion date is always shown. Pure: dates and people go in.
/// </summary>
public static class ChatKeepRules
{
    /// <summary>The standard period (docs/chat-plan.md): messages go this many days after the cruise ends.</summary>
    public const int StandardDays = 30;
    /// <summary>A kept chat is held this many months after the cruise ends.</summary>
    public const int KeptMonths = 12;

    public const string Permanent = "permanent", Closed = "closed", NoTrip = "noTrip", TooLate = "tooLate";

    public static DateOnly StandardDeleteOn(DateOnly cruiseEnds) => cruiseEnds.AddDays(StandardDays);

    public static DateOnly KeptDeleteOn(DateOnly cruiseEnds) => cruiseEnds.AddMonths(KeptMonths);

    /// <summary>Why a chat cannot be kept (a stable code), or null when it can. The Stanley chat is permanent already; an ended chat has nothing to keep; the standard date must not have passed (the messages are gone).</summary>
    public static string? Unavailable(bool permanent, bool closed, DateOnly? cruiseEnds, DateOnly today)
    {
        if (permanent) return Permanent;
        if (closed) return Closed;
        if (cruiseEnds is not { } ends) return NoTrip;
        return today >= StandardDeleteOn(ends) ? TooLate : null;
    }

    /// <summary>
    /// A chat is kept when it has at least one active member and each of them has agreed. A person who joins later has not agreed, so the chat is not kept again until they do;
    /// a person who leaves stops being counted.
    /// </summary>
    public static bool IsKept(IReadOnlyCollection<long> activeMembers, IReadOnlySet<long> keepers) =>
        activeMembers.Count > 0 && activeMembers.All(keepers.Contains);

    /// <summary>The active members who have not agreed yet.</summary>
    public static List<long> Missing(IReadOnlyCollection<long> activeMembers, IReadOnlySet<long> keepers) =>
        [.. activeMembers.Where(m => !keepers.Contains(m))];

    /// <summary>A supervised child never agrees for themself: their guardian decides for them.</summary>
    public static bool MayAgreeOwn(bool supervised) => !supervised;

    /// <summary>
    /// The cruise end a chat counts from, for a guest: the trip they are on or have next, else the one that ended most recently. Null with no confirmed booking.
    /// </summary>
    public static DateOnly? CruiseEnds(IEnumerable<(DateOnly Departure, int Nights)> confirmed, DateOnly today)
    {
        var ends = confirmed.Select(b => (b.Departure, End: b.Departure.AddDays(b.Nights))).ToList();
        var ahead = ends.Where(e => e.End >= today).OrderBy(e => e.Departure).Select(e => (DateOnly?)e.End).FirstOrDefault();
        return ahead ?? ends.OrderByDescending(e => e.End).Select(e => (DateOnly?)e.End).FirstOrDefault();
    }
}
