using System.Security.Cryptography;
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
    private sealed record Loaded(string ListJson, IReadOnlyDictionary<string, string> ById);

    private static readonly Lazy<Loaded> Data = new(Load);

    /// <summary><c>{ version, countries: [{ id, name, region, status, cruiseCalls }] }</c> by name: enough to list and link every profile.</summary>
    public static string ListJson => Data.Value.ListJson;

    /// <summary>One profile as JSON, or null for an id with no profile.</summary>
    public static string? Json(string id) => Data.Value.ById.TryGetValue(id, out var json) ? json : null;

    /// <summary>The ids of every profile, in order.</summary>
    public static IReadOnlyCollection<string> Ids => [.. Data.Value.ById.Keys.Order(StringComparer.Ordinal)];

    private static Loaded Load()
    {
        using var stream = typeof(CountryGuides).Assembly.GetManifestResourceStream("country-guides.json")
            ?? throw new InvalidOperationException("country-guides.json is not embedded.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var text = reader.ReadToEnd();
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        using var doc = JsonDocument.Parse(text);
        var byId = new Dictionary<string, string>(StringComparer.Ordinal);
        var summaries = new List<(string Name, object Row)>();
        foreach (var country in doc.RootElement.EnumerateArray())
        {
            var id = country.GetProperty("id").GetString()!;
            var name = country.GetProperty("name").GetString()!;
            byId[id] = country.GetRawText();
            summaries.Add((name, new
            {
                id,
                name,
                region = country.GetProperty("region").GetString(),
                status = country.GetProperty("status").GetString(),
                cruiseCalls = country.GetProperty("cruiseCalls").GetString(),
            }));
        }
        var rows = summaries.OrderBy(s => s.Name, StringComparer.Ordinal).Select(s => s.Row).ToList();
        return new Loaded(JsonSerializer.Serialize(new { version, countries = rows }), byId);
    }
}
