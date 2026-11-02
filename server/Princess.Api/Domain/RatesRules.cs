namespace Princess.Api.Domain;

public sealed record RateTableDto(string AsOf, Dictionary<string, double> PerUsd);

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

    public static RateTableDto TableFor(DateOnly day)
    {
        var asOf = day.ToString("yyyy-MM-dd");
        var perUsd = new Dictionary<string, double>();
        foreach (var (code, sample) in Sample)
        {
            var unit = code == "USD" ? 0 : ((Hash($"{code}|{asOf}") % 2001) / 1000.0 - 1) * Drift;
            perUsd[code] = Math.Round(sample * (1 + unit) * 10_000, MidpointRounding.AwayFromZero) / 10_000;
        }
        return new RateTableDto(asOf, perUsd);
    }
}
