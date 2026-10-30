using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>Ported from <c>src/domain/privacy.ts</c> (retention and consents) and <c>budget.ts</c> (limits).</summary>
public static class PrivacyRules
{
    public const int CoppaAge = 13;
    public const int MaxAccess = 50;

    public sealed record Rule(string Id, int? Days, string[] Kinds);

    /// <summary>Authored concept values; the periods are days after the cruise ends. Null days: kept until the guest deletes it.</summary>
    public static readonly Rule[] Retention =
    [
        new("idDocuments", 30, ["ci-guest", "documents"]),
        new("photo", 30, ["ci-guest"]),
        new("health", 90, ["illness", "clubReg"]),
        new("payment", null, []),
        new("messages", null, []),
        new("history", null, []),
    ];

    public static DateOnly? DeleteOn(Rule rule, DateOnly cruiseEnds) => rule.Days is { } d ? cruiseEnds.AddDays(d) : null;

    public static bool IsDue(Rule rule, DateOnly cruiseEnds, DateOnly today) => DeleteOn(rule, cruiseEnds) is { } day && today >= day;

    /// <summary>The records to delete today: every kind that a due rule names and that no rule still in force also needs.</summary>
    public static List<string> KindsToDelete(DateOnly cruiseEnds, DateOnly today)
    {
        var due = Retention.Where(r => IsDue(r, cruiseEnds, today)).SelectMany(r => r.Kinds).Distinct();
        var keep = Retention.Where(r => !IsDue(r, cruiseEnds, today)).SelectMany(r => r.Kinds).ToHashSet();
        return due.Where(k => !keep.Contains(k)).ToList();
    }

    public sealed record Consent(string Id, bool AdultsOnly, bool ChildOnly);

    public static readonly Consent[] Consents =
    [
        new("marketingEmail", true, false),
        new("marketingSms", true, false),
        new("improve", true, false),
        new("shipPhotos", false, false),
        new("parent", false, true),
    ];

    public static readonly string[] ConsentIds = Consents.Select(c => c.Id).ToArray();

    /// <summary>The consents that apply to a person: under-13s have only the ones a parent decides, and nothing else is asked of the child.</summary>
    public static Consent[] ConsentsFor(int age) =>
        Consents.Where(c => age < CoppaAge ? c.Id is "parent" or "shipPhotos" : !c.ChildOnly).ToArray();

    /// <summary>An adult decides for themself; a parent (the booker) for a supervised child. A supervised account decides nothing.</summary>
    public static bool MayDecide(long actorId, bool actorSupervised, long targetId, bool targetSupervised, long? targetBookerId) =>
        !actorSupervised && (actorId == targetId || (targetSupervised && targetBookerId == actorId));

    // ---- Budget ----
    public const long MaxBudget = 1_000_000;
    public static readonly int[] AlertLevels = [50, 80, 100];
    public const int DefaultAlert = 80;

    private static long? Cents(JsonNode? n) =>
        n is JsonValue v && v.TryGetValue<long>(out var c) && c > 0 && c <= MaxBudget ? c : null;

    /// <summary>A budget from stored data: anything out of range or unknown falls back to "no limit".</summary>
    public static JsonObject NormalizeBudget(JsonNode? raw)
    {
        var o = raw as JsonObject;
        var kids = new JsonObject();
        if (o?["kids"] is JsonObject k) foreach (var (id, v) in k) if (Cents(v) is { } c) kids[id] = c;
        var level = o?["alertAt"] is JsonValue a && a.TryGetValue<int>(out var l) && AlertLevels.Contains(l) ? l : DefaultAlert;
        return new JsonObject { ["total"] = Cents(o?["total"]), ["alertAt"] = level, ["kids"] = kids };
    }

    /// <summary>Strict check of a submitted budget (the screens only send valid ones); throws nothing, returns the problem or null.</summary>
    public static string? ValidateBudget(JsonNode? raw, ISet<string> kidIds)
    {
        if (raw is not JsonObject o) return "invalid";
        if (o["total"] is { } t && !(t is JsonValue tv && tv.TryGetValue<long>(out var total) && total > 0 && total <= MaxBudget)) return "total";
        if (!(o["alertAt"] is JsonValue a && a.TryGetValue<int>(out var l) && AlertLevels.Contains(l))) return "alertAt";
        if (o["kids"] is JsonObject kids)
            foreach (var (id, v) in kids)
                if (!kidIds.Contains(id) || !(v is JsonValue kv && kv.TryGetValue<long>(out var c) && c > 0 && c <= MaxBudget)) return "kid";
        return null;
    }
}
