using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

public sealed record ServiceRequestItem(string Id, string Group, int EtaMin, int MaxQty);

public sealed record BarDrink(string Id, long Cents, bool Alcohol);

public sealed record DrinkSummaryResult(int Today, int Covered, int? Left, long Paid, int AlcoholRecently, string Alert);

public sealed record TableFriend(string Name, string Cabin);

public sealed record Currency(string Code, string Symbol, double PerUsd);

public sealed record ReadyItem(string Id, bool Tender = false);

/// <summary>
/// One-tap requests, security reports, the drinks tracker, group tables, money, cabin parties, port readiness and the chat safeguards (MSG-03, SAF-04, DIN-06, DIN-09, ACC-03, ACC-05, ACC-07, ROM-06, POR-13, MSG-05).
/// Ports <c>src/domain/services.ts</c>. The mock's PIN scramble is replaced by PBKDF2 in <c>MoneyService</c>.
/// </summary>
public static partial class ServiceRules
{
    private const long Min = 60_000;

    // ---- One-tap service requests ----

    public static readonly IReadOnlyList<ServiceRequestItem> RequestItems =
    [
        new("towels", "housekeeping", 20, 4), new("pillows", "housekeeping", 20, 4), new("bedding", "housekeeping", 30, 2), new("toiletries", "housekeeping", 20, 3),
        new("ice", "housekeeping", 15, 1), new("turndown", "housekeeping", 45, 1), new("light", "maintenance", 60, 1), new("aircon", "maintenance", 45, 1),
        new("plumbing", "maintenance", 40, 1), new("tv", "maintenance", 60, 1),
    ];

    public static ServiceRequestItem? RequestItemById(string? id) => RequestItems.FirstOrDefault(r => r.Id == id);

    public const int MaxOpenRequests = 6;

    /// <summary>Received, on the way after half the usual time, done after all of it. Cancelled stays cancelled.</summary>
    public static string RequestStage(long placedAtMs, int etaMin, long nowMs, bool cancelled)
    {
        if (cancelled) return "cancelled";
        var waited = nowMs - placedAtMs;
        if (waited >= etaMin * Min) return "done";
        return waited >= etaMin * Min / 2.0 ? "onTheWay" : "received";
    }

    // ---- Security and man-overboard reporting ----

    public static readonly string[] ReportKinds = ["overboard", "theft", "harassment", "suspicious", "hazard"];
    public static readonly string[] UrgentReports = ["overboard"];
    public const int MaxReportText = 600;
    /// <summary>The place column holds 80 characters (the mock allowed 120).</summary>
    public const int MaxReportWhere = 80;

    public static string? ReportProblem(string? kind, string? where, string? note)
    {
        if (kind is null || !ReportKinds.Contains(kind)) return "badKind";
        if (where is null || where.Trim().Length < 2 || where.Length > MaxReportWhere) return "noWhere";
        if (note is null || note.Trim().Length < 5) return "noNote";
        if (note.Length > MaxReportText) return "tooLong";
        return null;
    }

    // ---- The drinks tracker ----

    public static readonly IReadOnlyList<BarDrink> BarMenu =
    [
        new("beer", 800, true), new("wine", 1200, true), new("mojito", 1300, true), new("margarita", 1400, true), new("premiumCocktail", 1900, true),
        new("mocktail", 700, false), new("soda", 400, false), new("coffee", 500, false),
    ];

    public static BarDrink? DrinkById(string? id) => BarMenu.FirstOrDefault(d => d.Id == id);

    public const int DailyPackageDrinks = 15;
    public const int AlertAfter = 4;
    public const int AlertWindowMin = 180;
    public const int StopAfter = 6;
    /// <summary>The age to be served alcohol.</summary>
    public const int DrinkingAge = 21;

    /// <summary>What a guest has had today (a cruise day, judged by the caller) and whether to slow down: four alcoholic drinks in three hours is a nudge, six is a stop.</summary>
    public static DrinkSummaryResult DrinkSummary(IReadOnlyList<(string DrinkId, long AtMs)> today, int capUsd, long nowMs)
    {
        var covered = 0;
        long paid = 0;
        foreach (var log in today.OrderBy(l => l.AtMs))
        {
            var d = DrinkById(log.DrinkId);
            if (d is null) continue;
            if (capUsd > 0 && d.Cents <= capUsd * 100L && covered < DailyPackageDrinks) covered++;
            else paid += d.Cents;
        }
        var recently = today.Count(l => DrinkById(l.DrinkId)?.Alcohol == true && nowMs - l.AtMs <= AlertWindowMin * Min && nowMs >= l.AtMs);
        return new DrinkSummaryResult(today.Count, covered, capUsd > 0 ? Math.Max(0, DailyPackageDrinks - covered) : null, paid, recently, recently >= StopAfter ? "stop" : recently >= AlertAfter ? "slow" : "none");
    }

    // ---- Group dining and splitting the bill ----

    public const int MaxTable = 8;

    [GeneratedRegex(@"^\d{4,5}$")]
    private static partial Regex CabinPattern();

    public static string? FriendProblem(string? name, string? cabin, IReadOnlyList<TableFriend> existing, int partySize)
    {
        if (name is null || name.Trim().Length < 2 || name.Length > 40) return "noName";
        if (cabin is null || !CabinPattern().IsMatch(cabin)) return "badCabin";
        if (partySize + existing.Count >= MaxTable) return "full";
        if (existing.Any(x => x.Cabin == cabin && string.Equals(x.Name.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase))) return "duplicate";
        return null;
    }

    // ---- Money: top-up, PIN, gratuities, currency ----

    public const int TopUpMin = 25;
    public const int TopUpMax = 1000;
    public const int TopUpTotalMax = 2000;
    public const int TopUpStep = 25;
    /// <summary>Cash counts after the desk has entered it: this long after the guest asks.</summary>
    public const int CashDeskMin = 120;
    public const int GratuityReasonMin = 15;
    public const int PinFailsAllowed = 5;

    public static string? TopUpProblem(int? dollars, int alreadyDollars)
    {
        if (dollars is not { } d || d < TopUpMin || d > TopUpMax || d % TopUpStep != 0) return "badAmount";
        if (alreadyDollars + d > TopUpTotalMax) return "tooMuch";
        return null;
    }

    public static string? PinProblem(string? pin)
    {
        if (pin is null || pin.Length != 4 || !pin.All(char.IsAsciiDigit)) return "format";
        if (pin.Distinct().Count() == 1 || "0123456789".Contains(pin) || "9876543210".Contains(pin)) return "weak";
        return null;
    }

    /// <summary>Gratuities due for the whole cruise for the guests who pay them (a package includes them for others).</summary>
    public static long GratuityDue(IEnumerable<(bool Suite, bool Included)> guests, int nights = Pricing.Nights) =>
        guests.Sum(g => g.Included ? 0 : (g.Suite ? Pricing.GratuityPerNightSuite : Pricing.GratuityPerNight) * nights);

    public static readonly IReadOnlyList<Currency> Currencies =
    [
        new("USD", "$", 1), new("EUR", "€", 0.92), new("GBP", "£", 0.79), new("CAD", "C$", 1.36), new("MXN", "MX$", 17.1), new("BZD", "BZ$", 2), new("HNL", "L", 24.7),
    ];

    public static Currency? CurrencyByCode(string? code) => Currencies.FirstOrDefault(c => c.Code == code);

    // ---- Cabin parties ----

    public const int MaxPartyCabins = 6;
    public const string QuietFrom = "23:00";
    public const string NoisyBefore = "08:00";

    [GeneratedRegex(@"^([01]\d|2[0-3]):[0-5]\d$")]
    private static partial Regex TimePattern();

    public static string? PartyProblem(string? title, int? day, string? time, IReadOnlyList<string>? cabins)
    {
        if (title is null || title.Trim().Length < 2 || title.Length > 50) return "noTitle";
        if (day is not { } d || d < 1 || d > 7) return "badDay";
        if (time is null || !TimePattern().IsMatch(time)) return "badTime";
        if (string.CompareOrdinal(time, QuietFrom) >= 0 || string.CompareOrdinal(time, NoisyBefore) < 0) return "quiet";
        if (cabins is null || cabins.Count == 0) return "noCabins";
        if (cabins.Count > MaxPartyCabins) return "tooMany";
        if (!cabins.All(c => c is not null && CabinPattern().IsMatch(c)) || cabins.Distinct().Count() != cabins.Count) return "badCabin";
        return null;
    }

    /// <summary>Whether a neighbour has said yes, the same every time.</summary>
    public static string Rsvp(string cabin, string title) => new[] { "yes", "maybe", "no" }[(int)(ExcursionRules.Hash($"{cabin}|{title}") % 3)];

    // ---- Safeguards in chat ----

    public static readonly string[] PhotoTypes = ["image/jpeg", "image/png", "image/webp"];
    public const int MaxPhotoBytes = 1_000_000;
    public const int PhotoMinAge = 18;
    /// <summary>The longest data URL stored for a photo.</summary>
    public const int MaxPhotoDataUrl = 1_400_000;
    public static readonly string[] ReportReasons = ["spam", "rude", "unsafe", "photo"];

    public static string? PhotoProblem(string? type, long bytes, int age)
    {
        if (age < PhotoMinAge) return "age";
        if (type is null || !PhotoTypes.Contains(type)) return "type";
        if (bytes <= 0) return "empty";
        if (bytes > MaxPhotoBytes) return "size";
        return null;
    }

    [GeneratedRegex(@"(\d[\s.-]?){7,}|https?://|www\.", RegexOptions.IgnoreCase)]
    private static partial Regex ContactPattern();

    /// <summary>Under-18s cannot pass on a phone number or a link in chat.</summary>
    public static string? ChildSafeProblem(string text, int age) => age < PhotoMinAge && ContactPattern().IsMatch(text) ? "contactInfo" : null;

    // ---- Port days ----

    public const int LastMinuteLeadMin = 120;

    public static readonly IReadOnlyList<ReadyItem> PortReady =
    [
        new("card"), new("id"), new("allAboard"), new("sun"), new("water"), new("cash"), new("phone"), new("tender", true), new("shoes"),
    ];

    public static bool ReadyKnown(string? id) => PortReady.Any(r => r.Id == id);
}
