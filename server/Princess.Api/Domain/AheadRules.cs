using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed record Advisor(string Id, string Name, string Agency, string Region, string[] Languages, string Speciality, string Hours);

public sealed record UpgradeOffer(string Category, long Difference, long MinBid, long BuyNow);

public sealed record Club(string Id, string Name, int MinAge, int MaxAge, string Deck);

public sealed record Pickup(string Name, string Relation, string Phone);

/// <summary>What a parent enters for a child's club. Health notes are kept under the booker only.</summary>
public sealed record ClubForm(Guid ChildId, string Allergies, string Medical, string Medication, bool PhotoConsent, List<Pickup> Pickups, bool SelfSignOut, string EmergencyPhone, bool Confirmed);

public sealed record MedallionEvent(string Id, DateTime At);

public sealed record MedallionStatus(string Stage, List<MedallionEvent> Events, bool CanActivate, DateTime? ActivatedAt, DateTime? LostAt, bool Replacement);

public sealed record CompassionTerms(long Fee, long Refund, long Credit);

/// <summary>
/// Before-the-cruise services, ported from <c>src/domain/ahead.ts</c> and <c>readiness.ts</c>: travel advisors, marketing consent with double opt-in, upgrade bids, kids' clubs,
/// the medallion, luggage tags, compassionate support, the fix-it flows and the health checklist. Names, rules and amounts are authored concept values.
/// </summary>
public static partial class AheadRules
{
    // ---- Travel advisors (DIS-15) ----

    public static readonly IReadOnlyList<Advisor> Advisors =
    [
        new("adv-ocean", "Renata Alvarez", "Blue Door Cruises", "Florida", ["English", "Spanish"], "family", "Mon to Sat, 9:00 to 18:00 Eastern"),
        new("adv-harbor", "Tomasz Nowak", "Harbor & Co. Travel", "New York", ["English", "Polish"], "luxury", "Mon to Fri, 9:00 to 17:00 Eastern"),
        new("adv-pacific", "Keiko Tanaka", "Pacific Passage", "California", ["English", "Japanese"], "first", "Mon to Fri, 8:00 to 16:00 Pacific"),
        new("adv-ease", "Dana Whitfield", "Easy Access Voyages", "Texas", ["English"], "accessible", "Mon to Fri, 9:00 to 17:00 Central"),
        new("adv-gather", "Marcus Bell", "Gather Group Travel", "Illinois", ["English", "French"], "groups", "Tue to Sat, 10:00 to 18:00 Central"),
    ];

    public const int CallbackHours = 24;

    public static Advisor? AdvisorById(string? id) => Advisors.FirstOrDefault(a => a.Id == id);

    private static bool PhoneOk(string? phone) => phone is not null && phone.Count(char.IsAsciiDigit) >= 10 && phone.Length <= 30;

    public static string? AdvisorProblem(string? advisorId, string? way, string? phone, string? question)
    {
        if (AdvisorById(advisorId) is null) return "badAdvisor";
        if (way is not ("callback" or "chat")) return "badWay";
        if (way == "callback" && !PhoneOk(phone)) return "badPhone";
        if (question is null || question.Trim().Length < 5 || question.Length > 500) return "noQuestion";
        return null;
    }

    /// <summary>The scripted first reply to a chat; a call-back gets none, only a promise.</summary>
    public static string AdvisorReply(string advisorName, string question) =>
        $"Hello, it’s {advisorName.Split(' ')[0]}. Thanks for asking{(question.Trim().Length > 60 ? ", and for the detail" : "")}. I’ll look at the sailing dates and room types that fit and send you two or three options. Is there a date you can’t travel?";

    // ---- Marketing consent with double opt-in (DIS-16) ----

    public const int ConsentCodeHours = 24;

    /// <summary>Regions that must confirm a first message before anything is subscribed: Canada, the UK and the EU.</summary>
    public static readonly IReadOnlyDictionary<string, bool> DoubleOptIn = new Dictionary<string, bool> { ["us"] = false, ["ca"] = true, ["uk"] = true, ["eu"] = true, ["au"] = false };

    public static bool IsRegion(string? v) => v is not null && DoubleOptIn.ContainsKey(v);

    public static bool IsChannel(string? v) => v is "email" or "sms";

    public static string? ContactProblem(string channel, string? value)
    {
        if (value is null) return channel == "email" ? "badEmail" : "badPhone";
        if (channel == "email") return EmailPattern().IsMatch(value.Trim()) && value.Length <= 120 ? null : "badEmail";
        return PhoneOk(value) ? null : "badPhone";
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    /// <summary>
    /// The six-digit code a pretend message carries. It comes from a server key, the person and the contact, so the server can check it without storing it and nobody else can work it out.
    /// Only a demo user is shown it (the message is not really sent).
    /// </summary>
    public static string ConsentCode(string key, long userId, string channel, string contact)
    {
        var mac = HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes($"consent|{userId}|{channel}|{contact.Trim().ToLowerInvariant()}"));
        return (100_000 + BitConverter.ToUInt32(mac, 0) % 900_000).ToString();
    }

    public static byte[] CodeHash(string code) => SHA256.HashData(Encoding.UTF8.GetBytes(code));

    /// <summary>pending, confirmed or expired, from when it was asked and whether it was confirmed.</summary>
    public static string ConsentState(DateTime askedAt, DateTime? confirmedAt, DateTime now) =>
        confirmedAt is not null ? "confirmed" : now - askedAt > TimeSpan.FromHours(ConsentCodeHours) ? "expired" : "pending";

    public static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        return at < 0 ? "***" : $"{email[..Math.Min(1, at)]}***{email[at..]}";
    }

    public static string MaskPhone(string phone) => $"***-{new string(phone.Where(char.IsAsciiDigit).ToArray()).PadLeft(4)[^4..].Trim()}";

    // ---- Upgrade offers and bids (MNG-06) ----

    /// <summary>Bids are decided this many days before departure.</summary>
    public const int BidDecidedDays = 3;

    /// <summary>Up to two room types above the current one; the bid floor is 40% of the difference and "buy now" is 90%. Whole dollars.</summary>
    public static List<UpgradeOffer> UpgradeOffers(string current, Func<string, long?> differenceTo)
    {
        var order = Pricing.Categories.Select(c => c.Id).ToList();
        var from = order.IndexOf(current);
        var offers = new List<UpgradeOffer>();
        if (from < 0) return offers;
        foreach (var category in order.Skip(from + 1).Take(2))
        {
            var difference = differenceTo(category);
            if (difference is not > 0) continue;
            static long Round(double x) => Pricing.JsRound(x / 100) * 100;
            offers.Add(new UpgradeOffer(category, difference.Value, Round(difference.Value * 0.4), Round(difference.Value * 0.9)));
        }
        return offers;
    }

    public static string? BidProblem(UpgradeOffer? offer, long cents)
    {
        if (offer is null) return "badCategory";
        if (cents % 100 != 0) return "notWhole";
        if (cents < offer.MinBid) return "tooLow";
        if (cents > offer.BuyNow) return "tooHigh";
        return null;
    }

    /// <summary>A bid at "buy now" always wins. Otherwise the share of the range it covers decides: above the hidden line wins. The same bid always gets the same answer.</summary>
    public static bool BidWins(UpgradeOffer offer, long cents, string key)
    {
        if (cents >= offer.BuyNow) return true;
        var range = Math.Max(1, offer.BuyNow - offer.MinBid);
        var line = offer.MinBid + range * (0.35 + ExcursionRules.Hash($"bid|{key}") % 40 / 100.0);
        return cents >= line;
    }

    // ---- Kids' and teens' clubs (PRE-08) ----

    public static readonly IReadOnlyList<Club> Clubs =
    [
        new("firefly", "Firefly Park", 3, 7, "Deck 6"),
        new("neon", "Neon Grove", 8, 12, "Deck 6"),
        new("underground", "The Underground", 13, 17, "Deck 7"),
    ];

    public const int MaxPickups = 4;
    public const int MaxClubText = 300;

    public static Club? ClubForAge(int age) => Clubs.FirstOrDefault(c => age >= c.MinAge && age <= c.MaxAge);

    public static string? ClubProblem(ClubForm r, int age)
    {
        if (ClubForAge(age) is null) return "noClub";
        if (!PhoneOk(r.EmergencyPhone)) return "noEmergency";
        if (r.Pickups.Count > MaxPickups) return "tooMany";
        if (r.Pickups.Any(p => p.Name.Trim().Length < 2 || p.Name.Length > 80 || p.Relation.Trim().Length < 2 || p.Relation.Length > 40 || p.Phone.Count(char.IsAsciiDigit) < 10)) return "badPickup";
        if (r.SelfSignOut && age < 13) return "selfSignOut";
        if (r.Pickups.Count == 0 && !(r.SelfSignOut && age >= 13)) return "noPickup";
        if (new[] { r.Allergies, r.Medical, r.Medication }.Any(x => x.Length > MaxClubText)) return "tooLong";
        if (!r.Confirmed) return "confirm";
        return null;
    }

    // ---- Medallion (CHK-06) ----

    public const int MedallionShipDays = 14;
    public const int MedallionDeliverDays = 8;

    /// <summary>Made after booking, posted 14 days before sailing and delivered 8 days before. Booked later than that, it is collected at the terminal.</summary>
    public static MedallionStatus Medallion(DateTime departureAt, DateTime bookedAt, DateTime now, DateTime? activatedAt, DateTime? lostAt)
    {
        var shipAt = departureAt.AddDays(-MedallionShipDays);
        var deliverAt = departureAt.AddDays(-MedallionDeliverDays);
        var late = bookedAt > shipAt;
        var events = new List<MedallionEvent> { new("ordered", bookedAt) };
        if (!late) { events.Add(new("shipped", shipAt)); events.Add(new("delivered", deliverAt)); }
        var stage = late ? "collect" : now >= deliverAt ? "delivered" : now >= shipAt ? "shipped" : "preparing";
        return new(stage, [.. events.Where(e => e.At <= now)], stage == "delivered" && activatedAt is null && lostAt is null, activatedAt, lostAt, lostAt is not null);
    }

    // ---- Luggage tags (CHK-09) ----

    public static readonly string[] TagWays = ["print", "etag", "order"];
    public const int TagsPerGuest = 2;
    /// <summary>A mailed set must be asked for this many days before sailing.</summary>
    public const int TagOrderDays = 14;

    /// <summary>Where a bag probably is, worked out from when it was handed over (an estimate; nothing is scanned).</summary>
    public static string BagStage(DateTime? handedOverAt, DateTime now)
    {
        if (handedOverAt is not { } at) return "atHome";
        var since = now - at;
        return since >= TimeSpan.FromHours(5) ? "delivered" : since >= TimeSpan.FromHours(3) ? "inCorridor" : since >= TimeSpan.FromHours(1) ? "onShip" : "handedOver";
    }

    public static string? TagProblem(string? way, int daysToDeparture) =>
        way is null || !TagWays.Contains(way) ? "badWay" : way == "order" && daysToDeparture < TagOrderDays ? "tooLate" : null;

    /// <summary>The name as printed on a tag: "LAST/FIRST" in capitals.</summary>
    public static string PassName(string first, string last) => $"{last}/{first}".ToUpperInvariant();

    // ---- Compassionate and assisted support (SUP-07) ----

    public static readonly string[] AssistKinds = ["assistedBooking", "bereavement", "medical"];
    public const int AssistReviewHours = 4;
    public const int AssistDecideHours = 48;

    public static string AssistStage(DateTime askedAt, DateTime now)
    {
        var since = now - askedAt;
        return since >= TimeSpan.FromHours(AssistDecideHours) ? "decided" : since >= TimeSpan.FromHours(AssistReviewHours) ? "reviewing" : "received";
    }

    public static string? AssistProblem(string? kind, string? phone, string? note, bool hasBooking)
    {
        if (kind is null || !AssistKinds.Contains(kind)) return "badKind";
        if (!PhoneOk(phone)) return "badPhone";
        if (note is null || note.Trim().Length < 5 || note.Length > 600) return "noNote";
        if (kind != "assistedBooking" && !hasBooking) return "noBooking";
        return null;
    }

    /// <summary>What a bereavement or medical cancellation changes: the fee is waived once the papers are seen, and the money comes back as a refund or future cruise credit worth 10% more.</summary>
    public static CompassionTerms Compassion(long paid) => new(0, paid, Pricing.JsRound(paid * 1.1 / 100) * 100);

    // ---- Fix-it flows (MNG-18) and health checklist (MNG-19) ----

    public static readonly string[] FixFlows = ["noBooking", "nameMismatch", "lostDocs"];
    public const int FixContactHours = 24;

    public static string FixStage(DateTime askedAt, DateTime now) => now - askedAt >= TimeSpan.FromHours(FixContactHours) ? "contacted" : "received";

    public static string FixReference(int n) => $"FX-{10_000 + n}";

    public static readonly string[] PrepItems =
        ["motion-mid", "motion-eyes", "motion-food", "motion-bands", "med-supply", "med-list", "med-otc", "med-power", "ins-buy", "ins-card", "ins-fee"];

    /// <summary>A reference for a support case: letters and the asking time, so it is the same for the same case.</summary>
    public static string CaseReference(DateTime askedAt) => $"SC-{10_000 + (int)(new DateTimeOffset(DateTime.SpecifyKind(askedAt, DateTimeKind.Utc)).ToUnixTimeMilliseconds() % 90_000)}";
}
