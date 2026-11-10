using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public enum GangwayDirection { Off, On }

/// <summary>What a demo gangway scan is told: <c>on</c> (coming aboard) or <c>off</c> (leaving the ship).</summary>
public sealed record GangwayScanDto(string? Direction);

/// <summary>What the scan did: the guest's presence for the port day and when it was recorded (ms, the guest's own clock).</summary>
public sealed record GangwayScanResultDto(string Status, long At, string Port, string Date);

/// <summary>
/// A guest's Medallion read at the gangway: coming aboard marks them back, going ashore marks them away. <see cref="RecordAsync"/> is the one place that turns a scan into the
/// guest's presence row (the same row the app writes by hand), so a real gangway feed replaces the demo route with no other change. Until then the demo route
/// stands in for the reader. Scans count only while the ship is in port.
/// </summary>
public sealed class GangwayService(ICurrentUser me, TripService trips, IPortRowStore rows, IUserClock userClock, IClock clock, ChatAwayService away)
{
    public static GangwayDirection? ParseDirection(string? direction) => direction switch { "on" => GangwayDirection.On, "off" => GangwayDirection.Off, _ => null };

    /// <summary>Records the scan as the guest's presence for today's port day. 400 noPortDay when the ship is not in port for them.</summary>
    public async Task<GangwayScanResultDto> RecordAsync(UserRecord guest, GangwayDirection direction, CancellationToken ct)
    {
        var now = await userClock.NowAsync(guest, ct);
        var booking = await trips.CurrentAsync(guest, now, ct) ?? throw ApiException.Invalid("noPortDay");
        var day = AboardRules.PortDayAt(TimelineBook.For(booking.SailingId, DateOnly.FromDateTime(booking.Departure)), now) ?? throw ApiException.Invalid("noPortDay");
        var nowMs = TripRules.ToMs(now);
        if (nowMs < day.ArriveAt || nowMs >= day.DepartAt) throw ApiException.Invalid("noPortDay");
        var status = direction == GangwayDirection.On ? "back" : "ashore";
        await rows.ApplyAsync(booking.BookingId, [new PortRowRow("presence", AwayRules.PresenceKey(day.Date, guest.PublicId), AwayRules.PresenceJson(status, nowMs), nowMs, false)], clock.UtcNow, ct);
        await away.OnPresenceAsync(guest, status, nowMs, ct);
        return new(status, nowMs, day.Port, day.Date);
    }

    /// <summary>The demo stand-in for the gangway reader. 404 unless the account is a demo account; 400 badDirection for anything but on or off.</summary>
    public async Task<GangwayScanResultDto> DemoScanAsync(GangwayScanDto? body, CancellationToken ct)
    {
        var user = await me.LoadAsync(ct);
        if (!user.IsDemo) throw ApiException.NotFound();
        var direction = ParseDirection(body?.Direction) ?? throw ApiException.Invalid("badDirection");
        return await RecordAsync(user, direction, ct);
    }
}
