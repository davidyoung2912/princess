using System.Text.Json;
using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

public sealed record CaseTimes(string Kind, string Number, DateTime OpenedAt, long Cents, DateTime? WithdrawnAt);

public sealed record CaseRefund(long Cents, bool Sent, long ExpectedBy);

public sealed record CaseStatus(string Stage, DateTime DueAt, string? Outcome, CaseRefund? Refund);

public sealed record Feedback(int Overall, Dictionary<string, int> Areas, string Comment, List<string> Crew, bool AllowContact, bool ShareName);

public sealed record CrewMember(string Id, string Name, string Role);

public sealed record LoyaltyStatus(string Before, string After, int DaysBefore, int DaysAfter, string? Next, int? DaysToNext, bool Promoted);

/// <summary>
/// After the cruise (POS-01 to POS-14): cases for lost items, bills, claims and complaints, feedback with service recovery, Captain's Circle progress, rebooking and the Future Cruise desk.
/// Ported from <c>src/domain/postcruise.ts</c>. Offers, amounts and figures are authored concept values.
/// </summary>
public static class PostCruiseRules
{
    private static readonly TimeSpan Hour = TimeSpan.FromHours(1);

    // ---- Cases (DEB-06, POS-07, POS-11) ----

    public static readonly string[] OpenKinds = ["lostItem", "billing", "claim", "complaint"];

    /// <summary>Hours the team has to reply with an answer.</summary>
    public static int SlaHours(string kind) => kind switch { "lostItem" => 72, "billing" => 120, "claim" => 240, "complaint" => 72, _ => 48 };

    private static string Code(string kind) => kind switch { "lostItem" => "LF", "billing" => "BD", "claim" => "CL", "complaint" => "CP", _ => "SR" };

    public const int CaseTextMax = 600;
    public const int CasePlaceMax = 80;
    public const long ClaimMax = 500_000;
    public const long RecoveryCredit = 5000;
    /// <summary>Days after the answer that a refund takes to reach the card.</summary>
    public const int RefundDays = 3;
    public const int MaxOpenCases = 10;

    public static string? CaseProblem(string? kind, string? summary, string? place, string? lineId, long cents)
    {
        if (kind is null || !OpenKinds.Contains(kind)) return "badKind";
        if ((summary ?? "").Trim().Length < 5 || summary!.Length > CaseTextMax) return "badSummary";
        if ((place ?? "").Length > CasePlaceMax) return "badPlace";
        if (kind == "lostItem" && (place ?? "").Trim().Length == 0) return "noPlace";
        if (kind == "billing" && ((lineId ?? "").Length == 0 || lineId!.Length > 40)) return "noLine";
        if (kind is "billing" or "claim" && (cents < 1 || cents > ClaimMax)) return "badAmount";
        return null;
    }

    /// <summary>A case number that is the same every time for the same booking, kind and count, such as <c>PC-LF-48213</c>.</summary>
    public static string CaseNumber(string kind, string booking, int seq) => $"PC-{Code(kind)}-{10_000 + DisembarkRules.Hash($"{booking}|{kind}|{seq}") % 90_000}";

    /// <summary>Where a case stands at a moment: received for the first day, in review until it is due, then answered. The answer is steady for a case number.</summary>
    public static CaseStatus StatusOf(CaseTimes c, DateTime now)
    {
        var dueAt = c.OpenedAt.AddHours(SlaHours(c.Kind));
        if (c.WithdrawnAt is not null) return new CaseStatus("withdrawn", dueAt, null, null);
        if (now < dueAt) return new CaseStatus(now - c.OpenedAt < TimeSpan.FromHours(24) ? "received" : "inReview", dueAt, null, null);
        var h = DisembarkRules.Hash(c.Number);
        var expectedBy = dueAt.AddDays(RefundDays);
        CaseRefund Refund(long cents) => new(cents, now >= expectedBy, TripRules.ToMs(expectedBy));
        return c.Kind switch
        {
            "lostItem" => new CaseStatus("resolved", dueAt, h % 3 == 0 ? "notFound" : "found", null),
            "billing" => h % 4 == 0 ? new CaseStatus("resolved", dueAt, "explained", null) : new CaseStatus("resolved", dueAt, "refunded", Refund(c.Cents)),
            "claim" => new CaseStatus("resolved", dueAt, "goodwill", Refund(Pricing.JsRound(c.Cents / 2.0))),
            "complaint" => new CaseStatus("resolved", dueAt, "replied", null),
            _ => new CaseStatus("resolved", dueAt, "credit", new CaseRefund(RecoveryCredit, true, TripRules.ToMs(dueAt))),
        };
    }

    /// <summary>A case can be withdrawn until it is answered.</summary>
    public static bool Withdrawable(CaseStatus s) => s.Stage is "received" or "inReview";

    // ---- Feedback (POS-02, POS-11, POS-14) ----

    public static readonly string[] Areas = ["ship", "dining", "entertainment", "crew", "excursions"];

    public const int CommentMax = 1000;
    public const int CrewMax = 3;
    public const int CrewNameMax = 60;
    /// <summary>Feedback can be changed this many days after the cruise.</summary>
    public const int FeedbackEditDays = 14;

    private static bool Rating(int n) => n is >= 1 and <= 5;

    public static string? FeedbackProblem(int overall, IReadOnlyDictionary<string, int>? areas, string? comment, IReadOnlyList<string>? crew)
    {
        if (!Rating(overall)) return "noOverall";
        foreach (var (k, v) in areas ?? new Dictionary<string, int>()) if (!Areas.Contains(k) || !Rating(v)) return "badRating";
        if ((comment ?? "").Length > CommentMax) return "badComment";
        if ((crew ?? []).Count > CrewMax || (crew ?? []).Any(n => string.IsNullOrWhiteSpace(n) || n.Length > CrewNameMax)) return "badCrew";
        return null;
    }

    /// <summary>Poor feedback (2 or below overall or in any area) starts service recovery.</summary>
    public static bool NeedsRecovery(Feedback f) => f.Overall <= 2 || f.Areas.Values.Any(r => r <= 2);

    /// <summary>Crew the guest can pick to thank by name.</summary>
    public static readonly IReadOnlyList<CrewMember> Crew =
    [
        new("marisol", "Marisol", "steward"), new("dennis", "Dennis", "steward"), new("aiko", "Aiko", "steward"), new("rafael", "Rafael", "dining"),
        new("joy", "Joy", "dining"), new("tomas", "Tomas", "entertainment"), new("imani", "Imani", "guest"),
    ];

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static string FeedbackJson(Feedback f) => JsonSerializer.Serialize(new { f.Overall, f.Areas, f.Comment, f.Crew, f.AllowContact, f.ShareName }, Web);

    /// <summary>Reads the stored JSON; a hand-written row (the persona seeds put the area scores at the top level) is read as far as it fits.</summary>
    public static Feedback ParseFeedback(string? json)
    {
        JsonNode? n;
        try { n = JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json); }
        catch (JsonException) { n = null; }
        var o = n as JsonObject ?? [];
        int Int(JsonNode? x) => x is JsonValue v && v.TryGetValue<int>(out var i) ? i : 0;
        var areas = new Dictionary<string, int>();
        if (o["areas"] is JsonObject stored) foreach (var (k, v) in stored) { if (Areas.Contains(k) && Rating(Int(v))) areas[k] = Int(v); }
        else foreach (var a in Areas) if (Rating(Int(o[a]))) areas[a] = Int(o[a]);
        var crew = o["crew"] is JsonArray c ? c.Select(x => x?.GetValue<string>() ?? "").Where(s => s.Length > 0).ToList() : [];
        bool Flag(string key) => o[key] is JsonValue v && v.TryGetValue<bool>(out var b) && b;
        return new Feedback(Int(o["overall"]), areas, o["comment"] is JsonValue cv && cv.TryGetValue<string>(out var s) ? s : "", crew, Flag("allowContact"), Flag("shareName"));
    }

    // ---- Captain's Circle (POS-05) ----

    public static readonly string[] TierOrder = ["none", "gold", "ruby", "platinum", "elite"];

    /// <summary>Cruise days that reach each level.</summary>
    public static int TierDays(string tier) => tier switch { "gold" => 5, "ruby" => 30, "platinum" => 90, "elite" => 150, _ => 0 };

    public static string TierForDays(int days) => TierOrder.Reverse().FirstOrDefault(t => days >= TierDays(t)) ?? "none";

    /// <summary>Level and days before and after this cruise. A level already held is never lost.</summary>
    public static LoyaltyStatus Loyalty(string held, int daysBefore, int nights, bool counted)
    {
        var heldIndex = Math.Max(0, Array.IndexOf(TierOrder, held));
        var daysAfter = daysBefore + (counted ? nights : 0);
        var after = TierOrder[Math.Max(Array.IndexOf(TierOrder, TierForDays(daysAfter)), heldIndex)];
        var nextIndex = Array.IndexOf(TierOrder, after) + 1;
        var next = nextIndex < TierOrder.Length ? TierOrder[nextIndex] : null;
        return new LoyaltyStatus(TierOrder[heldIndex], after, daysBefore, daysAfter, next, next is null ? null : Math.Max(0, TierDays(next) - daysAfter), counted && Array.IndexOf(TierOrder, after) > heldIndex);
    }

    // ---- Referral (POS-08) ----

    public const long ReferralCredit = 5000;

    public static string ReferralCode(string firstName) => $"{firstName.ToUpperInvariant()}{100 + DisembarkRules.Hash($"ref|{firstName}") % 900}";

    // ---- Rebooking (POS-06) ----

    /// <summary>Hold a price and an offer for this many days (a week).</summary>
    public const int HoldDays = 7;
    /// <summary>Deposit per guest when booking on board, instead of a fifth of the fare.</summary>
    public const long OnboardDeposit = 10_000;
    /// <summary>Onboard credit for booking on board, and the extra for each level.</summary>
    public const long BookingCredit = 10_000;
    public static long LevelCredit(string tier) => tier switch { "gold" => 2500, "ruby" => 5000, "platinum" => 7500, "elite" => 10_000, _ => 0 };
    /// <summary>Booking at least this many days after the cruise ends.</summary>
    public const int RebookGapDays = 14;
    public const int MaxHolds = 3;

    /// <summary>The deposit for a held cruise: a fifth of the fare in whole dollars, or the lower onboard deposit when held on board.</summary>
    public static long HoldDeposit(long total, int guests, bool onboard)
    {
        var standard = Math.Min(total, Pricing.JsRound(total * 0.2 / 100) * 100);
        return onboard ? Math.Min(standard, OnboardDeposit * guests) : standard;
    }

    public static DateTime HoldExpiry(DateTime placedAt) => placedAt.AddDays(HoldDays);

    /// <summary>The first morning a cruise can be held after a cruise ends.</summary>
    public static DateOnly EarliestRebook(DateOnly lastDay) => lastDay.AddDays(RebookGapDays);

    // ---- The Future Cruise desk (POS-06) ----

    /// <summary>The days the desk is open: the sea days (the first sea day when a sailing has none to speak of is not special-cased).</summary>
    public static List<int> DeskDays(Timeline timeline) => DayKinds.DaysOf(timeline, "sea");
    public const int DeskStepMinutes = 30;

    public static List<TimeOnly> DeskTimes()
    {
        var times = new List<TimeOnly>();
        for (var m = 10 * 60; m <= 16 * 60 + 30; m += DeskStepMinutes) times.Add(new TimeOnly(m / 60, m % 60));
        return times;
    }
}
