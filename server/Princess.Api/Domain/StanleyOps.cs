using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>A switch an operator set. <c>Scope</c> is class or global; <c>Reason</c> is the operator's own words, never a guest's.</summary>
public sealed record OpsSwitchRow(string Scope, string Name, bool Off, string Reason, Guid By, DateTime At);

/// <summary>A global pause one operator has asked for and a second must approve.</summary>
public sealed record OpsProposal(bool Off, string Reason, Guid By, DateTime At);

/// <summary>What a request to change the global switch did: asked for a second person, applied, released, or refused.</summary>
public sealed record OpsGlobalDecision(string Outcome, OpsProposal? Proposal);

/// <summary>
/// The rules of the operations console (docs/stanley-actions-and-proactive-plan.md, section 20.2): who may change a switch, what a change must record, and the two-person rule for the global
/// switch. Pure, so it is tested without a server. Pausing everything needs two different people inside an hour; releasing a pause, which can only make Stanley quieter to stop, needs one.
/// </summary>
public static class StanleyOpsRules
{
    public const string ScopeClass = "class", ScopeGlobal = "global", GlobalName = "all";
    public const string Proposed = "proposed", Applied = "applied", Released = "released", NeedsSecondPerson = "needsSecondPerson";
    public const int MinReason = 5, MaxReason = 200;
    public static readonly TimeSpan ProposalLife = TimeSpan.FromMinutes(60);
    private static readonly Regex ClassPattern = new("^[A-Za-z0-9._-]{1,40}$", RegexOptions.Compiled);

    public static bool ValidClass(string? id) => id is not null && ClassPattern.IsMatch(id);

    /// <summary>A change must say why: five to two hundred characters once trimmed.</summary>
    public static bool ValidReason(string? reason, out string clean)
    {
        clean = (reason ?? "").Trim();
        return clean.Length is >= MinReason and <= MaxReason;
    }

    /// <summary>The proposal if it is still alive at <paramref name="now"/>.</summary>
    public static OpsProposal? Live(OpsProposal? p, DateTime now) => p is not null && now - p.At < ProposalLife ? p : null;

    /// <summary>
    /// One operator asks to turn the global pause on or off. Off to on (pause): the first person only proposes, a different person asking for the same within the hour applies it, the same person again is told a second is needed.
    /// Releasing is applied at once. The caller stores what the decision says.
    /// </summary>
    public static OpsGlobalDecision Global(bool currentlyPaused, OpsProposal? pending, bool pause, string reason, Guid actor, DateTime now)
    {
        if (!pause) return new(currentlyPaused ? Released : Applied, null);
        if (currentlyPaused) return new(Applied, null);
        var live = Live(pending, now);
        if (live is { Off: true } p)
        {
            if (p.By == actor) return new(NeedsSecondPerson, p);
            return new(Applied, null);
        }
        return new(Proposed, new OpsProposal(true, reason, actor, now));
    }

    /// <summary>The class ids an operator has switched off, for the worker to add to the configured ones.</summary>
    public static IEnumerable<string> OffClasses(IEnumerable<OpsSwitchRow> rows) => rows.Where(r => r.Scope == ScopeClass && r.Off).Select(r => r.Name);

    public static bool GlobalPaused(IEnumerable<OpsSwitchRow> rows) => rows.Any(r => r.Scope == ScopeGlobal && r.Name == GlobalName && r.Off);
}
