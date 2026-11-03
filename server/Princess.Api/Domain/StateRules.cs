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
        ["recent"] = 2_000,
    };

    /// <summary>The most screens <c>recent</c> keeps, and the longest address it accepts.</summary>
    public const int RecentMaxItems = 3, RecentMaxPath = 200;

    /// <summary>
    /// Whether an address is one of the app's own: one leading slash, no scheme, no second slash at the start, no backslash or control character.
    /// A stored address is later used as a link, so it must never lead outside the app.
    /// </summary>
    public static bool IsAppPath(string? path)
    {
        if (string.IsNullOrEmpty(path) || path.Length > RecentMaxPath || path[0] != '/' || path.Length > 1 && path[1] == '/') return false;
        if (path.Any(c => c == '\\' || char.IsControl(c))) return false;
        var end = path.IndexOfAny(['?', '#']);
        return !(end < 0 ? path : path[..end]).Contains(':');
    }

    /// <summary>The problem for a <c>recent</c> document: <c>{ items: [ { path, at } ] }</c> with at most three app addresses.</summary>
    private static string? RecentProblem(JsonObject data)
    {
        if (data["items"] is not JsonArray items || items.Count > RecentMaxItems) return "badData";
        foreach (var node in items)
        {
            if (node is not JsonObject item) return "badData";
            if (item["path"] is not JsonValue p || !p.TryGetValue<string>(out var path) || !IsAppPath(path)) return "badData";
            if (item["at"] is not JsonValue at || !at.TryGetValue<double>(out _)) return "badData";
        }
        return null;
    }

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
        if (data is not JsonObject obj) return "badData";
        if (data.ToJsonString().Length > max) return "tooLarge";
        return key == "recent" ? RecentProblem(obj) : null;
    }
}
