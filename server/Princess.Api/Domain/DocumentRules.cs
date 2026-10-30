namespace Princess.Api.Domain;

/// <summary>Ported from <c>src/domain/documents.ts</c>: what a guest must hold for a closed-loop Caribbean cruise.</summary>
public static class DocumentRules
{
    public const int AdultAge = 16;
    public const int PassportValidMonths = 6;

    public static readonly string[] DocIds = ["passport", "birthCertificate", "photoId", "insurance"];

    public static bool HasExpiry(string doc) => doc != "birthCertificate";

    public sealed record Requirement(string Id, string Level, string[] SatisfiedBy);

    public sealed record ReqResult(Requirement Requirement, string Status, string? UsedDoc, string? Problem);

    public sealed record GuestDocs(List<ReqResult> Results, int Blocking, bool Ready);

    /// <summary>What the guest holds: document id to expiry (null where the document has none or none was given).</summary>
    public sealed class Held : Dictionary<string, string?>;

    public static List<Requirement> RequirementsFor(string citizenship, int age)
    {
        var insurance = new Requirement("insurance", "optional", ["insurance"]);
        if (citizenship == "other") return [new("passport", "required", ["passport"]), insurance];
        var list = new List<Requirement> { new("proofOfCitizenship", "required", ["passport", "birthCertificate"]) };
        if (age >= AdultAge) list.Add(new("photoId", "required", ["passport", "photoId"]));
        list.Add(new("passport", "recommended", ["passport"]));
        list.Add(insurance);
        return list;
    }

    public static DateOnly PassportValidUntil(DateOnly returnDate) => returnDate.AddMonths(PassportValidMonths);

    /// <summary>A passport must be valid six months past the return date; other dated documents only until the return.</summary>
    public static string DocStatus(string doc, Held held, DateOnly returnDate)
    {
        if (!held.TryGetValue(doc, out var expires)) return "missing";
        if (!HasExpiry(doc)) return "ok";
        if (expires is null) return "noExpiry";
        var e = DateOnly.ParseExact(expires, "yyyy-MM-dd");
        if (e < returnDate) return "expired";
        if (doc == "passport" && e < PassportValidUntil(returnDate)) return "tooSoon";
        return "ok";
    }

    /// <summary>Ready when any accepted document is held and in date; a held document with a date problem is a problem, not missing.</summary>
    public static ReqResult CheckRequirement(Requirement r, Held held, DateOnly returnDate)
    {
        var results = r.SatisfiedBy.Select(doc => (doc, status: DocStatus(doc, held, returnDate))).ToList();
        var good = results.FirstOrDefault(x => x.status == "ok");
        if (good.doc is not null) return new ReqResult(r, "ready", good.doc, null);
        var bad = results.FirstOrDefault(x => x.status is not ("missing" or "noExpiry"));
        if (bad.doc is not null) return new ReqResult(r, "problem", bad.doc, bad.status);
        var undated = results.FirstOrDefault(x => x.status == "noExpiry");
        if (undated.doc is not null) return new ReqResult(r, "problem", undated.doc, "noExpiry");
        return new ReqResult(r, "missing", null, null);
    }

    public static GuestDocs ForGuest(string citizenship, int age, Held held, DateOnly returnDate)
    {
        var results = RequirementsFor(citizenship, age).Select(r => CheckRequirement(r, held, returnDate)).ToList();
        var blocking = results.Count(x => x.Requirement.Level == "required" && x.Status != "ready");
        return new GuestDocs(results, blocking, blocking == 0);
    }

    public static bool PassportProblem(GuestDocs d) => d.Results.Any(r => r.Requirement.Id == "passport" && r.Status == "problem");
}
