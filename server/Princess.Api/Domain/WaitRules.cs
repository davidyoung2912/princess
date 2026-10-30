namespace Princess.Api.Domain;

/// <summary>A walk-in place a guest can join a virtual queue for. Hours are ship time, for a sea day and a port day.</summary>
public sealed record QueueVenue(string Id, string[][] Sea, string[][] Port);

public sealed record QueueState(string Stage, int Position, int WaitMinutes, long ReadyAt, long ExpiresAt);

public sealed record WaitlistState(string Stage, int Position, long OfferAt, long ExpiresAt);

/// <summary>Virtual queues for walk-in places and waitlists for full tables, ported from <c>src/domain/queue.ts</c> and <c>menus.ts</c>. Positions move with the clock, so they are the same every time for the same moment.</summary>
public static class WaitRules
{
    public const int QueueStepMin = 6;
    public const int HoldMin = 10;
    public const int WaitlistOfferAfterMin = 180;
    public const int WaitlistOfferHoldMin = 120;
    public const int WaitlistMinLeadMin = 45;

    private const long Min = 60_000;
    private static readonly string[][] All = [["00:00", "24:00"]];

    /// <summary>Places with no table to reserve: everything in the directory that dinner reservations do not cover, less the fixed-seating room.</summary>
    public static readonly IReadOnlyList<QueueVenue> Venues =
    [
        new("eatery", [["06:30", "22:00"]], [["06:30", "10:30"], ["11:30", "15:00"], ["17:30", "21:30"]]),
        new("americana", [["07:00", "22:00"]], [["07:00", "10:30"], ["17:00", "21:30"]]),
        new("lido", [["11:00", "18:00"]], [["11:00", "16:00"]]),
        new("intl-cafe", All, All),
        new("omalleys", [["11:30", "23:00"]], [["16:00", "23:00"]]),
        new("alfredo", [["11:30", "22:00"]], [["16:00", "22:00"]]),
    ];

    public static QueueVenue? VenueById(string? id) => Venues.FirstOrDefault(v => v.Id == id);

    private static int Mins(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    /// <summary>Whether the place is open at a ship-time "HH:mm".</summary>
    public static bool OpenAt(QueueVenue v, bool seaDay, string time)
    {
        var at = Mins(time);
        return (seaDay ? v.Sea : v.Port).Any(h => at >= Mins(h[0]) && at < Mins(h[1]));
    }

    /// <summary>Where a new arrival starts in the queue: 3 to 10 parties ahead.</summary>
    public static int StartingPosition(string venueId, long joinedAtMs) => 3 + (int)(ExcursionRules.Hash($"{venueId}|{Math.Floor(joinedAtMs / (30.0 * Min)):0}") % 8);

    /// <summary>Where a waitlisted party starts: 1 to 4.</summary>
    public static int WaitlistStart(long joinedAtMs) => 1 + (int)(joinedAtMs % 4);

    public static QueueState QueueAt(long joinedAt, int start, long now)
    {
        var readyAt = joinedAt + start * QueueStepMin * Min;
        var expiresAt = readyAt + HoldMin * Min;
        if (now >= expiresAt) return new("expired", 0, 0, readyAt, expiresAt);
        if (now >= readyAt) return new("ready", 0, 0, readyAt, expiresAt);
        var behind = (int)Math.Floor((now - joinedAt) / (double)(QueueStepMin * Min));
        return new("waiting", Math.Max(1, start - behind), Math.Max(1, (int)Math.Ceiling((readyAt - now) / (double)Min)), readyAt, expiresAt);
    }

    /// <summary>A table is offered after three hours, or sooner when the slot is near (halfway to it), and the offer lasts two hours or until 15 minutes before the slot.</summary>
    public static WaitlistState WaitlistAt(long joinedAt, long slotAt, long now, int start)
    {
        var offerAt = joinedAt + Math.Min(WaitlistOfferAfterMin * Min, (long)Math.Floor((slotAt - joinedAt) / 2.0));
        var expiresAt = Math.Min(offerAt + WaitlistOfferHoldMin * Min, slotAt - 15 * Min);
        if (now >= expiresAt) return new("expired", 0, offerAt, expiresAt);
        if (now >= offerAt) return new("offered", 0, offerAt, expiresAt);
        return new("waiting", start, offerAt, expiresAt);
    }

    /// <summary>Whether a guest may still join a waitlist for a slot.</summary>
    public static bool CanJoinWaitlist(long slotAt, long now) => slotAt - now >= WaitlistMinLeadMin * Min;
}
