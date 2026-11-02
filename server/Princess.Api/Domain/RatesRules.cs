namespace Princess.Api.Domain;

/// <summary><c>Version</c> changes when the day or any rate does.</summary>
public sealed record RateTableDto(string Version, string AsOf, Dictionary<string, double> PerUsd);

/// <summary>
/// Exchange rates for reading only (ACC-07; multi-device plan Phase 5). The source is a stub: the authored sample rates move a little
/// each day, the same for every device, as <c>stubRates</c> in <c>src/domain/rates.ts</c> does. A real feed would replace <see cref="TableFor"/>.
/// The account is always charged in US dollars.
/// </summary>
public static class RatesRules
{
    /// <summary>The most a rate moves from its sample value, as a fraction.</summary>
    public const double Drift = 0.03;

    public static readonly (string Code, double PerUsd)[] Sample =
    [
        ("USD", 1), ("EUR", 0.92), ("GBP", 0.79), ("CAD", 1.36), ("MXN", 17.1), ("BZD", 2), ("HNL", 24.7),
    ];

    /// <summary>The client's string hash (djb2 over UTF-16 code units), so the stub gives the same table on either side.</summary>
    internal static uint Hash(string text)
    {
        var h = 5381u;
        foreach (var c in text) h = unchecked(h * 33 + c);
        return h;
    }

    /// <summary>The date on the authored sample rates; the client's <c>SAMPLE_TABLE</c> carries the same date. Used when no feed has ever answered, so the table reads as out of date and never as today's.</summary>
    public const string SampleDate = "2026-10-01";

    /// <summary>The longest a feed's answer is believed to be fresh, in hours. After that the next request asks the feed again.</summary>
    public const int FreshHours = 6;

    public static RateTableDto TableFor(DateOnly day) => Build(day.ToString("yyyy-MM-dd"), StubRates(day));

    private static Dictionary<string, double> StubRates(DateOnly day)
    {
        var asOf = day.ToString("yyyy-MM-dd");
        var perUsd = new Dictionary<string, double>();
        foreach (var (code, sample) in Sample)
        {
            var unit = code == "USD" ? 0 : ((Hash($"{code}|{asOf}") % 2001) / 1000.0 - 1) * Drift;
            perUsd[code] = Math.Round(sample * (1 + unit) * 10_000, MidpointRounding.AwayFromZero) / 10_000;
        }
        return perUsd;
    }

    /// <summary>The sample rates with their own old date. The fallback of last resort.</summary>
    public static RateTableDto SampleTable() => Build(SampleDate, Sample.ToDictionary(s => s.Code, s => s.PerUsd));

    /// <summary>
    /// A table from what a feed answered. Only codes the app lists are kept; a rate that is missing, not a number or not above zero keeps its sample value,
    /// and US dollars are always 1. The date is the feed's own, so the age the guest sees is the feed's age.
    /// </summary>
    public static RateTableDto FromFeed(DateOnly asOf, IReadOnlyDictionary<string, double> live)
    {
        var perUsd = new Dictionary<string, double>();
        foreach (var (code, sample) in Sample)
            perUsd[code] = code == "USD" ? 1 : live.TryGetValue(code, out var r) && double.IsFinite(r) && r > 0 ? Math.Round(r, 4) : sample;
        return Build(asOf.ToString("yyyy-MM-dd"), perUsd);
    }

    private static RateTableDto Build(string asOf, Dictionary<string, double> perUsd)
    {
        var text = string.Join('|', perUsd.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => $"{kv.Key}={kv.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}"));
        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{asOf}|{text}"))).ToLowerInvariant()[..16];
        return new RateTableDto(version, asOf, perUsd);
    }
}
