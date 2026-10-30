namespace Princess.Api.Domain;

public sealed record CancelTerms(string Tier, long Fee, long Refund);

public sealed record AcceptanceDto(string Id, string Version, long At);

/// <summary>Ported from <c>src/domain/policy.ts</c>: cancellation, date change and the legal documents a guest accepts (all concept content).</summary>
public static class PolicyRules
{
    public const int FreeCancelHours = 24;
    public const int FreeCancelMinDays = 7;

    private sealed record Row(string Tier, int Min, int? Max, double? Share);

    // A null share is "the deposit only".
    private static readonly Row[] CancelRows =
    [
        new("early", 91, null, null),
        new("mid", 46, 90, 0.5),
        new("late", 15, 45, 0.75),
        new("final", 0, 14, 1),
    ];

    public static CancelTerms CancelTermsFor(long total, long paid, long deposit, int daysToDeparture, double hoursSinceBooking)
    {
        if (hoursSinceBooking < FreeCancelHours && daysToDeparture >= FreeCancelMinDays) return new("free24h", 0, paid);
        var row = CancelRows.FirstOrDefault(r => daysToDeparture >= r.Min && (r.Max is null || daysToDeparture <= r.Max)) ?? CancelRows[^1];
        var fee = Math.Min(total, row.Share is null ? deposit : Pricing.JsRound(total * row.Share.Value / 100) * 100);
        return new(row.Tier, fee, Math.Max(0, paid - fee));
    }

    /// <summary>A date change is free until the final payment date; the new date must also be outside it. Anything else goes through Guest Services.</summary>
    public static string ChangeCheck(int daysToDeparture, int newDaysToDeparture, bool sameSailing, int finalDays = Pricing.DefaultFinalPaymentDays)
    {
        if (sameSailing) return "same";
        if (daysToDeparture <= finalDays) return "tooLate";
        return newDaysToDeparture > finalDays ? "ok" : "newTooSoon";
    }

    public static readonly string[] LegalIds = ["terms", "health", "age", "pregnancy"];

    /// <summary>The version recorded with each acceptance (<c>ref.LegalDocs.Version</c>); the screens show it as "2026-10".</summary>
    public const int LegalVersion = 202610;

    public static string VersionLabel(int version) => $"{version / 100}-{version % 100:00}";

    /// <summary>The ids accepted, in document order, for the log written when someone books.</summary>
    public static string[] Accepted(IReadOnlyDictionary<string, bool>? accepted) => [.. LegalIds.Where(id => accepted?.GetValueOrDefault(id) == true)];
}
