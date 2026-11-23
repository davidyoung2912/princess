using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// The port guides (the Port Details page): short and long descriptions, traveller tips, general stats, getting ashore and the attractions with their access tier,
/// logistics, links and map point, for every port in the catalogue. They are written from <c>docs/port-details.md</c>, <c>docs/port-tips.md</c> and
/// <c>docs/port-stats.md</c> by <c>npm run portguides:gen</c> into <c>Content/port-guides.json</c>, which is embedded in the assembly. This is concept content
/// from the supplied documents; a real content source can replace it behind this class with no front-end change.
/// </summary>
public static class PortGuides
{
    private sealed record Loaded(string Version, string ListJson, IReadOnlyDictionary<string, string> ById);

    private static readonly Lazy<Loaded> Data = new(Load);

    /// <summary><c>{ version, ports: [{ id, name, area, countryId, countryName, shortDescription }] }</c>: enough to list and link every port.</summary>
    public static string ListJson => Data.Value.ListJson;

    /// <summary>One port's full guide as JSON, or null for an id with no guide.</summary>
    public static string? Json(string id) => Data.Value.ById.TryGetValue(id, out var json) ? json : null;

    /// <summary>One attraction in a port guide that has a map point: what the walking planner and Stanley's port-day tool choose from.</summary>
    public sealed record GuidePlace(string Name, string Tier, string Why, double Lat, double Lng);

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, IReadOnlyList<GuidePlace>> PlaceCache = new(StringComparer.Ordinal);

    /// <summary>The attractions of a port that have a map point, in the order the guide lists them (easiest to reach first); null for a port with no guide.</summary>
    public static IReadOnlyList<GuidePlace>? Places(string id)
    {
        if (Json(id) is not { } json) return null;
        return PlaceCache.GetOrAdd(id, _ =>
        {
            using var doc = JsonDocument.Parse(json);
            var list = new List<GuidePlace>();
            if (doc.RootElement.TryGetProperty("attractions", out var items))
                foreach (var a in items.EnumerateArray())
                {
                    if (!a.TryGetProperty("map", out var map) || map.ValueKind != JsonValueKind.Object) continue;
                    if (!map.TryGetProperty("lat", out var lat) || !map.TryGetProperty("lng", out var lng) || !lat.TryGetDouble(out var la) || !lng.TryGetDouble(out var ln)) continue;
                    if (Math.Abs(la) > 90 || Math.Abs(ln) > 180) continue;
                    list.Add(new GuidePlace(a.GetProperty("name").GetString() ?? "", a.GetProperty("tier").GetString() ?? "", a.TryGetProperty("why", out var why) ? why.GetString() ?? "" : "", la, ln));
                }
            return list;
        });
    }

    private static Loaded Load()
    {
        using var stream = typeof(PortGuides).Assembly.GetManifestResourceStream("port-guides.json")
            ?? throw new InvalidOperationException("port-guides.json is not embedded.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var text = reader.ReadToEnd();
        var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant()[..16];
        using var doc = JsonDocument.Parse(text);
        var byId = new Dictionary<string, string>(StringComparer.Ordinal);
        var summaries = new List<object>();
        foreach (var port in doc.RootElement.EnumerateArray())
        {
            var id = port.GetProperty("id").GetString()!;
            byId[id] = port.GetRawText();
            summaries.Add(new
            {
                id,
                name = port.GetProperty("name").GetString(),
                area = port.GetProperty("area").GetString(),
                countryId = port.GetProperty("countryId").GetString(),
                countryName = port.GetProperty("countryName").GetString(),
                shortDescription = port.GetProperty("shortDescription").GetString(),
            });
        }
        return new Loaded(version, JsonSerializer.Serialize(new { version, ports = summaries }), byId);
    }
}
