namespace Princess.Api.Domain;

/// <summary>One open poll the guest's party has not all answered. Counts only: no names, and silence is never read as a yes.</summary>
public sealed record PollGap(string Question, int Silent, int Answered);

/// <summary>What the missed-ship guard and the group gaps look at. <see cref="InPort"/> is a port day with the ship arrived; <see cref="Away"/> is the guest's own "ashore" or "leaving".</summary>
public sealed record ShipGroupFacts(bool InPort, string Port, bool Away, bool Tender, string AllAboardShip, long AllAboardAt, long NowMs, int? Buffer, bool Presence, IReadOnlyList<PollGap> Polls);

public sealed record ShipGroupFinding(string Id, string Severity, string Title, string Detail, string Route);

public sealed record ShipGroupDto(bool HasTrip, IReadOnlyList<ShipGroupFinding> Findings, IReadOnlyList<string> NotChecked, bool Clear, string? AsOf);

/// <summary>
/// The missed-ship guard (CHK-03) and group gaps (CHK-07), docs/stanley-actions-and-proactive-plan.md section 4. Pure and deterministic. The guard uses the same landing time as the head-back notices
/// (<see cref="AwayRules.LandingByMs"/>) and says how long is left, that it is time, or that all aboard has passed, with the missed-ship screen to open. The group check counts who has not answered an open poll.
/// It never contacts anyone and never answers for anyone.
/// </summary>
public static class StanleyShipGroupRules
{
    private const string Away = "/plan/away", WhatIf = "/plan/what-if", Polls = "/plan/group-poll";

    public static IReadOnlyList<string> NotChecked(ShipGroupFacts f) =>
    [
        .. f.InPort && !f.Away ? new[] { "Whether you are ashore (tell me on the Away screen and I will watch your way back)" } : [],
        "Who in your party has no dinner booked (dinners are held for the booking, not for each person)",
        "Where you are right now (I only know what you tell me)",
    ];

    public static IReadOnlyList<ShipGroupFinding> Findings(ShipGroupFacts f)
    {
        var list = new List<ShipGroupFinding>();
        if (f.InPort && f.Away)
        {
            var place = f.Tender ? "tender landing" : "pier gate";
            var landing = AwayRules.LandingByMs(f.AllAboardAt, f.Tender, f.Buffer);
            if (f.NowMs >= f.AllAboardAt)
                list.Add(new("ship:gone", "critical", "All aboard has passed", $"All aboard in {f.Port} was {f.AllAboardShip} ship time. Open the missed-ship steps now and call the ship's port agent.", WhatIf));
            else if (f.NowMs >= landing)
                list.Add(new("ship:now", "critical", "Time to head back", $"All aboard is at {f.AllAboardShip} ship time, in about {Mins(f.AllAboardAt - f.NowMs)} minutes. Head for the {place} now.", Away));
            else
            {
                var left = Mins(landing - f.NowMs);
                var near = f.NowMs >= landing - AwayRules.HeadsUpMinutes * 60_000L;
                list.Add(new("ship:buffer", near ? "soon" : "ok", near ? "Start thinking about the way back" : "You have time",
                    $"Be at the {place} in about {left} minutes. All aboard is at {f.AllAboardShip} ship time.", Away));
            }
        }
        foreach (var p in f.Polls.Where(p => p.Silent > 0))
            list.Add(new($"poll:{p.Question}", "soon", p.Silent == 1 ? "1 person has not answered a poll" : $"{p.Silent} people have not answered a poll",
                $"“{p.Question}” has {p.Answered} answer{(p.Answered == 1 ? "" : "s")} so far. Silence is not counted as a yes.", Polls));
        return list;
    }

    private static int Mins(long ms) => Math.Max(0, (int)Math.Ceiling(ms / 60_000.0));

    public static ShipGroupDto Build(ShipGroupFacts f, string asOf)
    {
        var findings = Findings(f);
        return new(true, findings, NotChecked(f), findings.Count == 0 || findings.All(x => x.Severity == "ok"), asOf);
    }
}
