namespace Princess.Api.Domain;

/// <summary>
/// The booking's dining plan (anytime, early or late seating) and the rules for changing it (docs/stanley-gap-analysis-and-plan.md, the carry-over list: "change my dining time to late seating" was only an explainer).
/// A fixed seating gives the whole party one table in the main dining room for the cruise, so the plan can change only before the cruise is close and only while that seating has places. Pure.
/// </summary>
public static class DiningPlanRules
{
    public static readonly string[] Plans = ["anytime", "early", "late"];
    /// <summary>Seatings are handed out this many days before sailing; after that the plan is fixed.</summary>
    public const int FreezeDays = 3;
    /// <summary>Tables a fixed seating has for one sailing.</summary>
    public const int SeatingCapacity = 60;

    public static string Label(string plan) => plan switch
    {
        "early" => $"Early seating ({DiningRules.Seating("early")})",
        "late" => $"Late seating ({DiningRules.Seating("late")})",
        _ => "Anytime dining",
    };

    /// <summary>The plan in a guest's words: "late", "early seating", "anytime" or "flexible". Null when it is none of them.</summary>
    public static string? FromWords(string? text)
    {
        var t = (text ?? "").Trim().ToLowerInvariant();
        if (Plans.Contains(t)) return t;
        if (t is "flexible" or "any time" or "open") return "anytime";
        return null;
    }

    /// <summary>Tables left in a fixed seating on a sailing: the same every time for the same sailing, and sometimes none. Anytime dining has no limit.</summary>
    public static int Left(string plan, string sailingId)
    {
        if (plan == "anytime") return int.MaxValue;
        var h = ExcursionRules.Hash($"seating|{plan}|{sailingId}");
        return h % 7 == 0 ? 0 : 1 + (int)(h % (uint)(SeatingCapacity - 1));
    }

    /// <summary>The first reason the plan cannot change, as a closed code, or null: <c>plan</c> (not one of the three), <c>unchanged</c>, <c>started</c> (past the freeze date), <c>full</c> or <c>hasTables</c>
    /// (main dining tables are already booked on the anytime plan, which a fixed seating would clash with).</summary>
    public static string? Problem(string? to, string current, DateOnly today, DateOnly departure, string sailingId, int mainTables)
    {
        if (to is null || !Plans.Contains(to)) return "plan";
        if (to == current) return "unchanged";
        if (today > departure.AddDays(-FreezeDays)) return "started";
        if (Left(to, sailingId) <= 0) return "full";
        if (current == "anytime" && mainTables > 0) return "hasTables";
        return null;
    }
}
