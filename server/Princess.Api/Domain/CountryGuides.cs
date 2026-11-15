using System.Text;
using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// The country and territory profiles (the Country Details page): at a glance, government, economy, timeline, people, culture, links and the catalogue ports in
/// the country. They are written from <c>docs/cruise_country_reference_guide.md</c> by <c>npm run countryguides:gen</c> into <c>Content/country-guides.json</c>,
/// which is embedded in the assembly. This is concept content from the supplied document; a real content source can replace it behind this class with no
/// front-end change. The id is the lower-case ISO code of the country (also the name of its flag).
/// </summary>
public static class CountryGuides
{
    private static readonly Lazy<IReadOnlyDictionary<string, string>> Data = new(Load);

    /// <summary>One profile as JSON, or null for an id with no profile.</summary>
    public static string? Json(string id) => Data.Value.TryGetValue(id, out var json) ? json : null;

    /// <summary>The ids of every profile, in order.</summary>
    public static IReadOnlyCollection<string> Ids => [.. Data.Value.Keys.Order(StringComparer.Ordinal)];

    private static Dictionary<string, string> Load()
    {
        using var stream = typeof(CountryGuides).Assembly.GetManifestResourceStream("country-guides.json")
            ?? throw new InvalidOperationException("country-guides.json is not embedded.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        using var doc = JsonDocument.Parse(reader.ReadToEnd());
        var byId = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var country in doc.RootElement.EnumerateArray()) byId[country.GetProperty("id").GetString()!] = country.GetRawText();
        return byId;
    }
}
