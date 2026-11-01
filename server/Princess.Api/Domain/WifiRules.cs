namespace Princess.Api.Domain;

public sealed record WifiPlanDef(string Id, long PerDay, int? CapMb, int Rank);

/// <summary>Ship Wi-Fi (NET-02), ported from <c>src/domain/wifi.ts</c>: plans, devices, a usage meter and sign-in help. Plans and prices are authored concept values.</summary>
public static class WifiRules
{
    public static readonly IReadOnlyList<WifiPlanDef> Plans =
    [
        new("messaging", 999, 500, 1),
        new("surf", 1999, 3000, 2),
        new("stream", 2999, null, 3),
    ];

    public static WifiPlanDef? PlanById(string? id) => Plans.FirstOrDefault(p => p.Id == id);

    public const int MaxDevices = 6, MaxDays = 8;

    /// <summary>The plan a package or tier gives for free.</summary>
    public const string IncludedPlan = "surf";

    private const long Day = 86_400_000;

    public static long ExpiresAt(long addedAt, int days) => addedAt + days * Day;

    /// <summary>Megabytes used today: a steady rate for the device, from the start of its current ship day.</summary>
    public static long UsedTodayMb(string id, long addedAt, long now)
    {
        var rate = 0.4 + ExcursionRules.Hash(id) % 25 / 10.0;
        var since = Math.Min(now - addedAt, now % Day);
        return Math.Max(0, (long)Math.Round(since / 60_000.0 * rate, MidpointRounding.AwayFromZero));
    }

    public static string? AddProblem(string? name, string? plan, int? days, IReadOnlyCollection<string> existingNames)
    {
        if (name is null || name.Trim().Length is < 2 or > 30) return "badName";
        if (existingNames.Any(n => string.Equals(n, name.Trim(), StringComparison.OrdinalIgnoreCase))) return "duplicate";
        if (existingNames.Count >= MaxDevices) return "tooMany";
        if (PlanById(plan) is null) return "badPlan";
        if (days is null or < 1 or > MaxDays) return "badDays";
        return null;
    }

    /// <summary>Days left on a plan, rounded up, at least one.</summary>
    public static long DaysLeft(long expiresAt, long now) => Math.Max(1, (long)Math.Ceiling((expiresAt - now) / (double)Day));

    public static long UpgradeCost(string fromPlan, long expiresAt, WifiPlanDef to, long now) =>
        Math.Max(0, to.PerDay - (PlanById(fromPlan)?.PerDay ?? 0)) * DaysLeft(expiresAt, now);
}
