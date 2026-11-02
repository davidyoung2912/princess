using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

public sealed record PricingFareDto(string Id, string Name, long PerNight, string Tagline);

/// <summary>A next-season departure that can be held but not yet booked (POS-06), with its interior fare.</summary>
public sealed record PricingDepartureDto(string Id, string Departure, long Fare);

/// <summary>The fare tables for the screens' estimates (multi-device plan 3). <c>Interior</c> is the interior fare per person for two sharing, by sailing id; <c>Version</c> changes when any figure does.</summary>
public sealed record PricingReferenceDto(string Version, IReadOnlyDictionary<string, long> Interior, IReadOnlyList<PricingDepartureDto> NextSeason, long TaxesAndFees, long GratuityPerNight, long GratuityPerNightSuite, IReadOnlyList<PricingFareDto> Fares);

public static class PricingReference
{
    public static PricingReferenceDto Get()
    {
        var interior = Pricing.InteriorFare.OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => kv.Value);
        // Ids are "sun-YYYY-MM-DD", so the departure date is the id's tail.
        var next = Pricing.NextSeasonFare.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => new PricingDepartureDto(kv.Key, kv.Key[^10..], kv.Value)).ToList();
        var fares = Pricing.Fares.Select(f => new PricingFareDto(f.Id, f.Name, f.PerNight, f.Tagline)).ToList();
        var text = string.Join('|',
            interior.Select(kv => $"{kv.Key}={kv.Value}")
                .Concat(next.Select(n => $"{n.Id}={n.Fare}"))
                .Concat([$"tax={Pricing.TaxesAndFees}", $"g={Pricing.GratuityPerNight}", $"gs={Pricing.GratuityPerNightSuite}"])
                .Concat(fares.Select(f => $"{f.Id}={f.Name}/{f.PerNight}/{f.Tagline}")));
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        return new(version, interior, next, Pricing.TaxesAndFees, Pricing.GratuityPerNight, Pricing.GratuityPerNightSuite, fares);
    }
}
