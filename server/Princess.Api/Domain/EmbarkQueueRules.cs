namespace Princess.Api.Domain;

public sealed record EmbarkStepDto(string Id, int Walk, int Queue, bool AccessibleLane, bool QuietLane);

/// <summary>One arrival window with the wait the guest's needs make of it and the step-by-step forecast.</summary>
public sealed record EmbarkWindowDto(string Start, string End, string Crowd, int WaitMinutes, IReadOnlyList<EmbarkStepDto> Steps, int Total);

/// <summary>The windows a guest can make, the quietest of them, and the forecast for each (S5-01, S5-02).</summary>
public sealed record EmbarkQueueDto(IReadOnlyList<EmbarkWindowDto> Windows, string? Recommended, string Source);

/// <summary>
/// Embarkation queue times (multi-device plan 3, Phase 4): how long each arrival window takes to get through the terminal, adjusted for the guest's
/// needs, and the walk and queue at each of four steps. Moved from <c>embark.ts</c>; a real terminal feed replaces <see cref="Queue"/> and keeps the shape.
/// </summary>
public static class EmbarkQueueRules
{
    public const int MobilityExtra = 10;

    private static readonly string[] StepIds = ["terminal", "security", "photo", "gangway"];
    private static readonly Dictionary<string, double> Share = new() { ["terminal"] = 0.3, ["security"] = 0.4, ["photo"] = 0.1, ["gangway"] = 0.2 };
    private static readonly Dictionary<string, int> Walk = new() { ["terminal"] = 5, ["security"] = 3, ["photo"] = 2, ["gangway"] = 6 };

    private static int CrowdOrder(string crowd) => crowd switch { "quiet" => 0, "busy" => 1, _ => 2 };

    public static bool ValidEarliest(string? hhmm) =>
        string.IsNullOrEmpty(hhmm) || (hhmm.Length == 5 && TimeOnly.TryParseExact(hhmm, "HH:mm", out _));

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..]);

    public static EmbarkQueueDto Queue(bool priority, bool mobility, bool quiet, string? earliest)
    {
        var from = string.IsNullOrEmpty(earliest) ? 0 : Minutes(earliest);
        var windows = PlanRules.ArrivalWindows(priority).Where(w => Minutes(w.Start) >= from).Select(w => ForWindow(w, priority, mobility)).ToList();
        var best = windows.OrderBy(w => CrowdOrder(w.Crowd)).ThenBy(w => Minutes(w.Start)).FirstOrDefault();
        return new(windows, best?.Start, FeedRules.Sim);
    }

    private static EmbarkWindowDto ForWindow(ArrivalWindow w, bool priority, bool mobility)
    {
        var wait = BoardingRules.WaitMinutes(w.Crowd) + (mobility ? MobilityExtra : 0);
        var cut = priority ? 0.5 : 1.0;
        var steps = StepIds.Select(id => new EmbarkStepDto(id, Walk[id] + (mobility ? 3 : 0), (int)Pricing.JsRound(wait * Share[id] * cut), true, id is "security" or "terminal")).ToList();
        return new(w.Start, w.End, w.Crowd, wait, steps, steps.Sum(s => s.Walk + s.Queue));
    }
}
