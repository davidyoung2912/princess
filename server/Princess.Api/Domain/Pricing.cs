using System.Text.Json.Serialization;

namespace Princess.Api.Domain;

public sealed record QuoteLine(string Key, int Guests, long Cents);

/// <summary>An all-in estimate (<c>Quote</c>) and, once a fare is chosen, a booking quote (<c>BookingQuote</c>); <see cref="Fare"/> is only present on the latter.</summary>
public sealed record QuoteResult(string SailingId, string Category, int Guests, List<QuoteLine> Lines, long Total, long PerPerson, long Gratuities)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Fare { get; init; }
}

public sealed record FromPrice(long Fare, long Taxes, long Gratuities, long AllIn);

public sealed record Promotion(string Id, long CreditCents);

public sealed record PayPlan(string[] Options, long Total, long Deposit, string FinalDue);

public sealed record RoomCategory(string Id, string Name, double Ratio, bool Suite, int Capacity);

public sealed record FareInfo(string Id, string Name, long PerNight);

/// <summary>
/// Ported from <c>src/domain/pricing.ts</c>, <c>fares.ts</c> and the booking part of <c>ahead.ts</c> (D15: the server is the authority for money).
/// Interior fare by sailing and the room type ratios are authored concept data with no table in the schema, so they live here; sailings, dates and open/closed come from the database.
/// </summary>
public static class Pricing
{
    public const int Nights = 7;
    public const int MaxGuests = 4;
    public const long TaxesAndFees = 23_600;
    public const long GratuityPerNight = 1_650;
    public const long GratuityPerNightSuite = 1_850;
    public const double ExtraGuestShare = 0.75;
    public const int SoloMultiple = 2;
    public const int DefaultFinalPaymentDays = 90;
    public const double DepositShare = 0.2;
    public const int EarlyCreditDays = 120;
    public const int PriceLockHours = 24;
    public const long MinPaid = 10_000;
    public const long ScaLimit = 300_000;
    public const string ScaDemoCode = "123456";
    public const string DeclinedLast4 = "0002";
    public const int MaxParts = 2;

    /// <summary>Interior fare per person for two sharing, by sailing. The lowest is the advertised "from" price.</summary>
    private static readonly Dictionary<string, long> InteriorFare = new()
    {
        ["sun-2026-11-08"] = 153_900,
        ["sun-2026-11-22"] = 157_900,
        ["sun-2026-12-06"] = 155_900,
        ["sun-2026-12-27"] = 239_900,
        ["sun-2027-01-17"] = 174_900,
        ["sun-2027-02-07"] = 199_900,
        ["sun-2027-02-28"] = 214_900,
        ["sun-2027-03-21"] = 189_900,
    };

    public static readonly IReadOnlyList<RoomCategory> Categories =
    [
        new("interior", "Interior", 1, false, 4),
        new("oceanview", "Premium Oceanview", 1.22, false, 4),
        new("balcony", "Deluxe Balcony", 1.45, false, 4),
        new("miniSuite", "Mini-Suite", 1.9, true, 4),
        new("sanctuaryMiniSuite", "Sanctuary Mini-Suite", 2.45, true, 4),
        new("signatureSuite", "Signature Suite", 3.4, true, 3),
    ];

    public static readonly IReadOnlyList<FareInfo> Fares =
    [
        new("standard", "Standard", 0),
        new("plus", "Princess Plus", 6_000),
        new("premier", "Princess Premier", 9_000),
    ];

    public static RoomCategory? Category(string? id) => Categories.FirstOrDefault(c => c.Id == id);

    public static FareInfo? Fare(string? id) => Fares.FirstOrDefault(f => f.Id == id);

    public static bool HasPrice(string sailingId) => InteriorFare.ContainsKey(sailingId);

    /// <summary>JavaScript's <c>Math.round</c> (halves go up), so the ported sums match the screens to the cent.</summary>
    public static long JsRound(double n) => (long)Math.Floor(n + 0.5);

    private static long RoundToDollar(double cents) => JsRound(cents / 100) * 100;

    public static long? FareFor(string sailingId, string category)
    {
        var cat = Category(category);
        return !InteriorFare.TryGetValue(sailingId, out var baseFare) || cat is null ? null : RoundToDollar(baseFare * cat.Ratio);
    }

    /// <summary>The Sanctuary Mini-Suite and Signature Suite include the Premier package in their fare.</summary>
    public static string? FareIncluded(string category) => category is "sanctuaryMiniSuite" or "signatureSuite" ? "premier" : null;

    public static string[] FareOptions(string category) => FareIncluded(category) is not null ? ["premier"] : [.. Fares.Select(f => f.Id)];

    public static int CapacityOf(string category) => Category(category)?.Capacity ?? (category == "signatureSuite" ? 3 : 4);

    public static QuoteResult? Quote(string sailingId, string category, int guests)
    {
        var fare = FareFor(sailingId, category);
        var cat = Category(category);
        if (fare is null || cat is null || guests < 1 || guests > MaxGuests) return null;
        var lines = new List<QuoteLine>();
        var paying = Math.Min(guests, 2);
        if (guests == 1)
        {
            lines.Add(new("fare", 1, fare.Value));
            lines.Add(new("soloSupplement", 1, fare.Value * (SoloMultiple - 1)));
        }
        else
        {
            lines.Add(new("fare", paying, fare.Value * paying));
            if (guests > 2) lines.Add(new("extraFare", guests - 2, JsRound(fare.Value * ExtraGuestShare) * (guests - 2)));
        }
        var gratuities = (cat.Suite ? GratuityPerNightSuite : GratuityPerNight) * Nights * guests;
        lines.Add(new("taxes", guests, TaxesAndFees * guests));
        lines.Add(new("gratuities", guests, gratuities));
        var total = lines.Sum(l => l.Cents);
        return new QuoteResult(sailingId, category, guests, lines, total, JsRound((double)total / guests), gratuities);
    }

    /// <summary>The Discover estimate with the package added and the gratuities line replaced when the package covers them. Null for anything not bookable.</summary>
    public static QuoteResult? BookingQuote(string sailingId, string category, int guests, string fare)
    {
        var baseQuote = Quote(sailingId, category, guests);
        if (baseQuote is null || guests > CapacityOf(category) || !FareOptions(category).Contains(fare)) return null;
        if (fare == "standard") return baseQuote with { Fare = fare };
        var included = FareIncluded(category) is not null;
        var lines = baseQuote.Lines.Where(l => l.Key != "gratuities").ToList();
        lines.Add(new("package", guests, included ? 0 : Fare(fare)!.PerNight * Nights * guests));
        var total = lines.Sum(l => l.Cents);
        return baseQuote with { Fare = fare, Lines = lines, Total = total, PerPerson = JsRound((double)total / guests), Gratuities = 0 };
    }

    public static FromPrice? FromPriceOf(string sailingId)
    {
        var q = Quote(sailingId, "interior", 2);
        var fare = FareFor(sailingId, "interior");
        return q is null || fare is null ? null : new FromPrice(fare.Value, TaxesAndFees, GratuityPerNight * Nights, q.PerPerson);
    }

    public static List<Promotion> PromotionsFor(string category, int daysToDeparture) =>
        daysToDeparture < EarlyCreditDays ? [] : [new Promotion("earlyCredit", Category(category)?.Suite == true ? 30_000 : 15_000)];

    /// <summary>A sailing can be booked until the day before it leaves.</summary>
    public static bool Bookable(int daysToDeparture) => daysToDeparture >= 1;

    public static PayPlan PayPlanFor(long total, DateOnly departure, int daysToDeparture, int finalDays = DefaultFinalPaymentDays)
    {
        var deposit = Math.Min(total, RoundToDollar(total * DepositShare));
        return new PayPlan(daysToDeparture > finalDays ? ["deposit", "full"] : ["full"], total, deposit, departure.AddDays(-finalDays).ToString("yyyy-MM-dd"));
    }

    public static long DueNow(PayPlan plan, string option) => option == "full" ? plan.Total : plan.Deposit;

    // ---- Captain's Circle at booking, and credit ----

    public static readonly IReadOnlyDictionary<string, int> MemberPercent = new Dictionary<string, int> { ["none"] = 0, ["gold"] = 2, ["ruby"] = 3, ["platinum"] = 5, ["elite"] = 7 };

    /// <summary>"CC" and seven digits; the last digit is a check on the first six, so a typo is caught.</summary>
    public static bool LoyaltyNumberOk(string? n)
    {
        if (n is null || n.Length != 9 || n[0] != 'C' || n[1] != 'C' || !n.Skip(2).All(char.IsAsciiDigit)) return false;
        var d = n[2..].Select(c => c - '0').ToArray();
        return d.Take(6).Select((x, i) => x * (i + 1)).Sum() % 10 == d[6];
    }

    /// <summary>A person's own number gives their own level; any other valid number joins at Gold.</summary>
    public static string TierForNumber(string number, string? ownNumber, string ownTier) => number == ownNumber ? ownTier : "gold";

    public sealed record PerkSums(long Discount, long Credit, long Total);

    public static PerkSums ApplyPerks(long total, string number, string tier, bool useCredit, long creditLeft)
    {
        var discount = LoyaltyNumberOk(number) ? JsRound((double)total * MemberPercent.GetValueOrDefault(tier) / 10_000) * 100 : 0;
        var afterDiscount = total - discount;
        var credit = useCredit ? Math.Max(0, Math.Min(creditLeft, afterDiscount - MinPaid)) : 0;
        return new PerkSums(discount, credit, afterDiscount - credit);
    }
}

/// <summary>One way a payment is made. A device wallet needs no card on file.</summary>
public sealed record PaymentPart(string Method, Guid? CardId, long Cents);

/// <summary>Ported from <c>checkParts</c> and the strong-customer-authentication rule in <c>fares.ts</c>.</summary>
public static class PaymentRules
{
    /// <summary>Whether the parts make up exactly what is due: one or two methods, each a positive amount, no card twice. Null when fine.</summary>
    public static string? CheckParts(IReadOnlyList<PaymentPart>? parts, long due)
    {
        if (parts is null || parts.Count == 0) return "empty";
        if (parts.Count > Pricing.MaxParts) return "tooMany";
        if (parts.Any(p => p.Cents <= 0 || (p.Method != "card" && p.Method != "wallet") || (p.Method == "card" && p.CardId is null))) return "amount";
        var keys = parts.Select(p => p.Method == "card" ? p.CardId.ToString()! : "wallet").ToList();
        if (keys.Distinct().Count() != keys.Count) return "duplicate";
        return parts.Sum(p => p.Cents) == due ? null : "sum";
    }

    /// <summary>3-D Secure is asked for a card that is not the one on file by default, or for any card payment of $3,000 or more.</summary>
    public static bool ScaRequired(string method, bool isDefaultCard, long cents) => method == "card" && (!isDefaultCard || cents >= Pricing.ScaLimit);
}
