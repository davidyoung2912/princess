using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>
/// Account state kept on the server so a guest finds the same data on every device (docs/multi-device-plan.md).
/// Each key is one small JSON document the client already normalises; the server only checks the key, that it is an object and its size.
/// </summary>
public static class StateRules
{
    /// <summary>Keys a person may keep, with the most characters of JSON each may hold.</summary>
    public static readonly IReadOnlyDictionary<string, int> UserKeys = new Dictionary<string, int>
    {
        ["settings"] = 4_000,
        ["offers"] = 8_000,
        ["shop"] = 8_000,
        ["phone"] = 4_000,
        ["memory"] = 256_000,
        ["pilot"] = 64_000,
        ["trip"] = 32_000,
        ["hub"] = 64_000,
        ["health"] = 32_000,
        ["concierge"] = 128_000,
        ["calm"] = 16_000,
        ["family"] = 32_000,
        ["sharing"] = 500,
        ["travellers"] = 16_000,
        ["reminder"] = 500,
        ["postcards"] = 2_000,
    };

    /// <summary>
    /// Keys held encrypted at rest: the medical card, access profile and allergy flag (<c>health</c>), the sensory / calm profile (<c>calm</c>) and the
    /// family-at-home contacts, links and secret (<c>family</c>) and the saved travellers with their dates of birth (<c>travellers</c>). They are saved only while the person's own <c>settings</c>
    /// document says <c>syncPrivate</c> is on, so withdrawing consent also stops new writes.
    /// </summary>
    public static readonly IReadOnlySet<string> EncryptedKeys = new HashSet<string> { "health", "calm", "family", "travellers" };

    /// <summary>Keys a booking may keep (shared by everyone on it).</summary>
    public static readonly IReadOnlyDictionary<string, int> BookingKeys = new Dictionary<string, int>
    {
        ["port"] = 64_000,
        ["party"] = 32_000,
    };

    /// <summary>The problem title for a document that cannot be saved, or null when it can.</summary>
    public static string? Problem(IReadOnlyDictionary<string, int> keys, string? key, JsonNode? data)
    {
        if (key is null || !keys.TryGetValue(key, out var max)) return "badKey";
        if (data is not JsonObject) return "badData";
        return data.ToJsonString().Length > max ? "tooLarge" : null;
    }
}
