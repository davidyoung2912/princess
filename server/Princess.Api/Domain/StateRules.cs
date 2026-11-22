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
        ["guideChoices"] = 8_000,
        ["guideFit"] = 500,
        ["hints"] = 16_000,
    };

    /// <summary>The most stage welcomes <c>stageWelcome</c> remembers, and the longest sailing id in an entry's key.</summary>
    public const int StageWelcomeMaxEntries = 100, StageWelcomeMaxSailingId = 64;

    /// <summary>The key under which <c>stageWelcome</c> remembers that the guest has seen Stanley's one-time introduction; it is not a stage.</summary>
    public const string StanleyIntroKey = "stanley";

    /// <summary>The key under which <c>stageWelcome</c> remembers that the guest has seen the app's own first welcome, which comes before Stanley's introduction; it is not a stage.</summary>
    public const string AppWelcomeKey = "app";

    /// <summary>
    /// The problem for a <c>stageWelcome</c> document: <c>{ seen: { "&lt;stage&gt;" or "&lt;stage&gt;:&lt;sailingId&gt;": seenAtMs } }</c>.
    /// The stage must be one of the eleven; the sailing id is plain letters, digits, dot, dash or underscore. The value is the time the welcome was dismissed.
    /// </summary>
    private static string? StageWelcomeProblem(JsonObject data)
    {
        if (data["seen"] is not JsonObject seen || seen.Count > StageWelcomeMaxEntries) return "badData";
        foreach (var (key, node) in seen)
        {
            if (key != StanleyIntroKey && key != AppWelcomeKey && !StageKeyOk(key)) return "badData";
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

    /// <summary>The most pages and tour steps <c>hints</c> remembers, and the longest id.</summary>
    public const int HintsMaxPages = 400, HintsMaxSteps = 120, HintsMaxId = 40;

    /// <summary>
    /// The problem for a <c>hints</c> document: <c>{ tips: { "&lt;page id&gt;": count }, tour: [ "&lt;step id&gt;" ], tourOn: true }</c> (the tour is off unless <c>tourOn</c> is true), the page tips and first-visit tour steps the guest has dismissed.
    /// Ids are letters, digits, dot, dash or underscore; a count is a whole number from 1; both parts are optional.
    /// </summary>
    private static string? HintsProblem(JsonObject data)
    {
        static bool IdOk(string id) => id.Length is > 0 and <= HintsMaxId && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_');
        foreach (var (part, node) in data)
        {
            if (part == "tips")
            {
                if (node is not JsonObject tips || tips.Count > HintsMaxPages) return "badData";
                foreach (var (id, value) in tips)
                    if (!IdOk(id) || value is not JsonValue n || !n.TryGetValue<double>(out var count) || count < 1 || count > 1000 || count != Math.Floor(count)) return "badData";
            }
            else if (part == "tour")
            {
                if (node is not JsonArray steps || steps.Count > HintsMaxSteps) return "badData";
                foreach (var step in steps)
                    if (step is not JsonValue s || !s.TryGetValue<string>(out var id) || !IdOk(id)) return "badData";
            }
            else if (part == "tourOn")
            {
                if (node is not JsonValue on || !on.TryGetValue<bool>(out _)) return "badData";
            }
            else return "badData";
        }
        return null;
    }

    /// <summary>The most tasks <c>guideChoices</c> keeps in each of its two lists, and the longest task id.</summary>
    public const int GuideChoicesMaxEntries = 60, GuideChoicesMaxId = 40;

    /// <summary>
    /// The problem for a <c>guideChoices</c> document: <c>{ skipped: { "&lt;task id&gt;": atMs }, later: { "&lt;task id&gt;": "yyyy-MM-dd" } }</c>, the tasks the guest said are not for them or will do later.
    /// A task id is letters, digits and dots, like <c>prebook.tours</c>; both lists are optional.
    /// </summary>
    private static string? GuideChoicesProblem(JsonObject data)
    {
        foreach (var (list, node) in data)
        {
            if (list is not ("skipped" or "later") || node is not JsonObject entries || entries.Count > GuideChoicesMaxEntries) return "badData";
            foreach (var (id, value) in entries)
            {
                if (id.Length is 0 or > GuideChoicesMaxId || !id.All(c => char.IsAsciiLetterOrDigit(c) || c == '.')) return "badData";
                if (list == "skipped" ? value is not JsonValue at || !at.TryGetValue<double>(out _)
                    : value is not JsonValue day || !day.TryGetValue<string>(out var text) || !DateOnly.TryParseExact(text, "yyyy-MM-dd", out _)) return "badData";
            }
        }
        return null;
    }

    /// <summary>
    /// The problem for a <c>guideFit</c> document: <c>{ firstCruise, solo, quiet: bool, at: ms }</c>, the three answers of the "make this plan fit me" prompt and when it was answered.
    /// It holds nothing sensitive (access and health needs are never kept here); every field is optional.
    /// </summary>
    private static string? GuideFitProblem(JsonObject data)
    {
        foreach (var (key, node) in data)
        {
            if (node is not JsonValue v) return "badData";
            if (key is "firstCruise" or "solo" or "quiet") { if (!v.TryGetValue<bool>(out _)) return "badData"; }
            else if (key == "at") { if (!v.TryGetValue<double>(out _)) return "badData"; }
            else return "badData";
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
            "guideChoices" => GuideChoicesProblem(obj),
            "guideFit" => GuideFitProblem(obj),
            "hints" => HintsProblem(obj),
            _ => null,
        };
    }
}
