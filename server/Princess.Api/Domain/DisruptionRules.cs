namespace Princess.Api.Domain;

public sealed record DisruptionDef(string Id, string Severity, string[] Options);

/// <summary>
/// Changes to the trip the ship or the line makes (SUP-06, SAF-06, MNG-15), ported from <c>src/domain/disruption.ts</c>: which are in force and the choices on offer. The texts stay in the app's language files.
/// </summary>
public static class DisruptionRules
{
    public static readonly IReadOnlyList<DisruptionDef> All =
    [
        new("portSkipped", "critical", ["credit", "talk"]),
        new("belizeTender", "important", ["keep", "stay"]),
        new("planChange", "info", ["ok"]),
        new("clockChange", "important", ["ok"]),
        new("terminalChange", "important", ["ok"]),
        new("illness", "important", ["ok"]),
    ];

    public static DisruptionDef? ById(string? id) => All.FirstOrDefault(d => d.Id == id);

    private static int Rank(string severity) => severity switch { "critical" => 0, "important" => 1, _ => 2 };

    /// <summary>The disruptions in force for the active scenarios, most serious first.</summary>
    public static List<DisruptionDef> Active(IReadOnlySet<string> scenarios) =>
        [.. All.Where(d => scenarios.Contains(d.Id)).OrderBy(d => Rank(d.Severity))];

    public static bool ValidOption(DisruptionDef def, string? option) => option is not null && def.Options.Contains(option);
}
