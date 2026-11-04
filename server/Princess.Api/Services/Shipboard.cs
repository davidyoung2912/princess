using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What the Phase 10b services share: the on-board check, ship time and the lines they put on the account.</summary>
internal static class Shipboard
{
    public static long Ms(DateTime utc) => TripRules.ToMs(utc);

    public static DateTime FromMs(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;

    public static bool IsAboard(Scope c) => c.Timeline.Aboard(c.Now);

    /// <summary>Before sailing day's 11:00 boarding opens, or aboard: when things can be booked or bought ahead of time or on the ship.</summary>
    public static bool BeforeOrAboard(Scope c) =>
        c.Confirmed && (IsAboard(c) || c.Now < Itinerary.LocalToUtc(c.Departure, new TimeOnly(11, 0), c.Timeline.HomeZone));

    public static void RequireOpen(Scope c)
    {
        if (!BeforeOrAboard(c)) throw ApiException.Conflict("closed");
    }

    /// <summary>The caller's age on the sailing date.</summary>
    public static int AgeOf(Scope c, UserRecord actor) => c.PersonByUser(actor.Id)?.Age ?? 18;

    /// <summary>Actions on board need the ship to be under way (or boarded) and the booking not cancelled.</summary>
    public static void RequireAboard(Scope c)
    {
        if (!IsAboard(c) || !c.Confirmed) throw ApiException.Conflict("closed");
    }

    /// <summary>The cruise day, 1 to the last day of the sailing, that a moment falls on.</summary>
    public static int DayAt(Scope c, DateTime at) => Math.Clamp(FolioRules.CruiseDay(c.Timeline, at), 1, c.Timeline.Days.Count);

    /// <summary>Ship time as "HH:mm".</summary>
    public static string ShipTime(Scope c) => Itinerary.LocalAt(c.Now, c.Timeline.ShipZoneAt(c.Now)).Time.ToString("HH:mm");

    public static async Task<bool> NeedsStepFreeAsync(IAccountStore accounts, Scope c, CancellationToken ct) =>
        (await accounts.GetProfileAsync(c.Booking.BookerUserId, ct))?.Needs.Contains("mobility") == true;

    public static StateroomAssignment Stateroom(Scope c, bool needsStepFree) =>
        BoardingRules.AssignmentFor(c.Booking.Number, c.Booking.SailingId, c.Booking.CategoryId, c.Booking.CabinNumber, needsStepFree);

    /// <summary>Account lines for the store: the guest on each is the person's user, and an unknown guest falls back to the booker.</summary>
    public static List<FolioWrite> Writes(Scope c, IEnumerable<FolioLine> lines) =>
        [.. lines.Select(l => new FolioWrite(c.PersonById(l.Guest)?.UserId ?? c.Booking.BookerUserId, l.Day, l.Category, l.Description, l.Cents, l.CoveredBy, FromMs(l.At)))];

    public static string FirstName(Scope c, long userId) => c.PersonByUser(userId)?.First ?? "";
}
