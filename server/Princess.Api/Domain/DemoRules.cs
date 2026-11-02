using Princess.Api.Data;

namespace Princess.Api.Domain;

/// <summary><paramref name="SavedAt"/> is only set on answers: when the offset was set (milliseconds since 1970), 0 when the person has never saved controls. A new device takes saved controls, and follows a fast clock from that moment.</summary>
public sealed record DemoStateDto(long ClockOffsetSeconds, int ClockSpeed, string[] Scenarios, long SavedAt = 0, string? SailingId = null, string? PhoneZone = null);

/// <summary>The jump target as a moment, in milliseconds since 1970 (the same "now" the screens show).</summary>
public sealed record DemoJumpDto(long At);

/// <summary>Demo controls (data model 6.7). They apply only to users flagged <c>IsDemo</c>; anyone else gets 404.</summary>
public static class DemoRules
{
    /// <summary>The scenario ids of <c>src/domain/scenarios.ts</c>.</summary>
    public static readonly IReadOnlySet<string> ScenarioIds = new HashSet<string> { "bookingLag", "checkinDrop", "dinnerReschedule", "orderStock", "planChange", "belizeTender", "clockChange", "portSkipped", "lateInPort", "phoneDead", "terminalChange", "illness", "packageRise", "photoFail", "childMissing", "chatSlow" };

    /// <summary>A sailing id as the catalogue writes it (<c>sun-2026-11-08</c>). Whether it is bookable is not checked: the demo may sit on any departure.</summary>
    private static readonly System.Text.RegularExpressions.Regex SailingIdPattern = new(@"^sun-\d{4}-\d{2}-\d{2}$", System.Text.RegularExpressions.RegexOptions.Compiled);
    /// <summary>An IANA zone name such as <c>America/New_York</c>.</summary>
    private static readonly System.Text.RegularExpressions.Regex ZonePattern = new(@"^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>The clock offset allowed either way: a year.</summary>
    public const long MaxOffsetSeconds = 366L * 24 * 3600;
    public const int MaxSpeed = 3600;

    /// <summary>Null when the state is acceptable, else the problem title.</summary>
    public static string? Problem(DemoStateDto s)
    {
        if (Math.Abs(s.ClockOffsetSeconds) > MaxOffsetSeconds) return "badOffset";
        if (s.ClockSpeed is < 0 or > MaxSpeed) return "badSpeed";
        if (s.Scenarios is null || s.Scenarios.Any(x => !ScenarioIds.Contains(x))) return "badScenario";
        if (s.SailingId is not null && !SailingIdPattern.IsMatch(s.SailingId)) return "badSailing";
        if (s.PhoneZone is not null && !ZonePattern.IsMatch(s.PhoneZone)) return "badZone";
        return null;
    }

    /// <summary>A save time as milliseconds since 1970, to the whole second (the database keeps seconds, so a save and a later read agree).</summary>
    public static long StampMs(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeSeconds() * 1000;

    /// <summary>The offset from real time that applies at <paramref name="now"/>: the saved offset, plus what a running fast clock has gained since it was saved.</summary>
    public static long OffsetAt(DemoStateRow row, DateTime now)
    {
        if (row.SavedAt is not { } saved || row.ClockSpeed <= 1) return row.ClockOffsetSeconds;
        var gained = (long)Math.Floor((now - saved).TotalSeconds * (row.ClockSpeed - 1));
        return Math.Clamp(row.ClockOffsetSeconds + gained, -MaxOffsetSeconds, MaxOffsetSeconds);
    }

    /// <summary>The offset that makes "now" read <paramref name="atMs"/> (milliseconds since 1970), or null when that is more than a year away.</summary>
    public static long? OffsetForMoment(long atMs, DateTime now)
    {
        var offset = (long)Math.Round((DateTimeOffset.FromUnixTimeMilliseconds(atMs).UtcDateTime - now).TotalSeconds);
        return Math.Abs(offset) > MaxOffsetSeconds ? null : offset;
    }

    /// <summary>The stored form: a stopped clock (speed 0 on the screens) is kept as 1, since the column cannot hold 0; the offset is what the server uses.</summary>
    public static DemoStateDto Clean(DemoStateDto s) => new(s.ClockOffsetSeconds, Math.Max(1, s.ClockSpeed), [.. s.Scenarios.Distinct().Order()], 0, s.SailingId, s.PhoneZone);
}
