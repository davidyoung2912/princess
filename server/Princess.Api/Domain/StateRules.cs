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
        ["stageWelcome"] = 8_000,
        ["stageProgress"] = 12_000,
    };

    /// <summary>The most stage welcomes <c>stageWelcome</c> remembers, and the longest sailing id in an entry's key.</summary>
    public const int StageWelcomeMaxEntries = 100, StageWelcomeMaxSailingId = 64;

    /// <summary>The key under which <c>stageWelcome</c> remembers that the guest has seen Stanley's one-time introduction; it is not a stage.</summary>
    public const string StanleyIntroKey = "stanley";

    /// <summary>
    /// The problem for a <c>stageWelcome</c> document: <c>{ seen: { "&lt;stage&gt;" or "&lt;stage&gt;:&lt;sailingId&gt;": seenAtMs } }</c>.
    /// The stage must be one of the eleven; the sailing id is plain letters, digits, dot, dash or underscore. The value is the time the welcome was dismissed.
    /// </summary>
    private static string? StageWelcomeProblem(JsonObject data)
    {
        if (data["seen"] is not JsonObject seen || seen.Count > StageWelcomeMaxEntries) return "badData";
        foreach (var (key, node) in seen)
        {
            if (key != StanleyIntroKey && !StageKeyOk(key)) return "badData";
            if (node is not JsonValue at || !at.TryGetValue<double>(out _)) return "badData";
        }
        return null;
    }

    /// <summary>A stage, or a stage and sailing id joined by a colon: the stage is one of the eleven; the sailing id is plain letters, digits, dot, dash or underscore.</summary>
    private static bool StageKeyOk(string key)
    {
        var colon = key.IndexOf(':');
        var stage = colon < 0 ? key : key[..colon];
        if (!StageRules.All.Contains(stage)) return false;
        if (colon < 0) return true;
        var sailing = key[(colon + 1)..];
        return sailing.Length is > 0 and <= StageWelcomeMaxSailingId && sailing.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_');
    }

    /// <summary>The most steps <c>stageProgress</c> remembers, and the most steps one stage has.</summary>
    public const int StageProgressMaxEntries = 300, StageProgressMaxStep = 9;

    /// <summary>
    /// The problem for a <c>stageProgress</c> document: <c>{ visited: { "&lt;stage key&gt;#&lt;step&gt;": visitedAtMs } }</c>, the steps of a stage's welcome page the guest has opened.
    /// The stage key is as in <c>stageWelcome</c>; the step is a single digit from 1.
    /// </summary>
    private static string? StageProgressProblem(JsonObject data)
    {
        if (data["visited"] is not JsonObject visited || visited.Count > StageProgressMaxEntries) return "badData";
        foreach (var (key, node) in visited)
        {
            var hash = key.LastIndexOf('#');
            if (hash < 0 || !StageKeyOk(key[..hash])) return "badData";
            var step = key[(hash + 1)..];
            if (step.Length != 1 || step[0] < '1' || step[0] > '0' + StageProgressMaxStep) return "badData";
            if (node is not JsonValue at || !at.TryGetValue<double>(out _)) return "badData";
        }
        return null;
    }

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
        return key switch
        {
            "recent" => RecentProblem(obj),
            "stageWelcome" => StageWelcomeProblem(obj),
            "stageProgress" => StageProgressProblem(obj),
            _ => null,
        };
    }
}
