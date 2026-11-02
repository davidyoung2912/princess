namespace Princess.Api.Domain;

public sealed record DemoStateDto(long ClockOffsetSeconds, int ClockSpeed, string[] Scenarios);

/// <summary>Demo controls (data model 6.7). They apply only to users flagged <c>IsDemo</c>; anyone else gets 404.</summary>
public static class DemoRules
{
    /// <summary>The scenario ids of <c>src/domain/scenarios.ts</c>.</summary>
    public static readonly IReadOnlySet<string> ScenarioIds = new HashSet<string> { "bookingLag", "checkinDrop", "dinnerReschedule", "orderStock", "planChange", "belizeTender", "clockChange", "portSkipped", "lateInPort", "phoneDead", "terminalChange", "illness", "packageRise", "photoFail", "childMissing", "chatSlow" };

    /// <summary>The clock offset allowed either way: a year.</summary>
    public const long MaxOffsetSeconds = 366L * 24 * 3600;
    public const int MaxSpeed = 3600;

    /// <summary>Null when the state is acceptable, else the problem title.</summary>
    public static string? Problem(DemoStateDto s)
    {
        if (Math.Abs(s.ClockOffsetSeconds) > MaxOffsetSeconds) return "badOffset";
        if (s.ClockSpeed is < 0 or > MaxSpeed) return "badSpeed";
        if (s.Scenarios is null || s.Scenarios.Any(x => !ScenarioIds.Contains(x))) return "badScenario";
        return null;
    }

    /// <summary>The stored form: a stopped clock (speed 0 on the screens) is kept as 1, since the column cannot hold 0; the offset is what the server uses.</summary>
    public static DemoStateDto Clean(DemoStateDto s) => new(s.ClockOffsetSeconds, Math.Max(1, s.ClockSpeed), [.. s.Scenarios.Distinct().Order()]);
}
