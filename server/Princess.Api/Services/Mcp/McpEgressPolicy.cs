using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Princess.Api.Services.Mcp;

public sealed class McpPolicyException(string message) : Exception(message);

/// <summary>How one argument may look. Arguments with no rule are refused, so a new field cannot leave by accident.</summary>
public abstract record ArgRule
{
    public abstract bool Allows(JsonNode? value);

    public sealed record Text(int Max, string? Pattern = null) : ArgRule
    {
        public override bool Allows(JsonNode? v) => v is JsonValue j && j.TryGetValue<string>(out var s) && s.Length > 0 && s.Length <= Max && (Pattern is null || Regex.IsMatch(s, Pattern));
    }

    public sealed record Whole(int Min, int Max) : ArgRule
    {
        public override bool Allows(JsonNode? v) => v is JsonValue j && j.TryGetValue<int>(out var n) && n >= Min && n <= Max;
    }

    public sealed record OneOf(params string[] Values) : ArgRule
    {
        public override bool Allows(JsonNode? v) => v is JsonValue j && j.TryGetValue<string>(out var s) && Values.Contains(s);
    }

    /// <summary>An object <c>{ latitude, longitude }</c> and nothing else: a place, never a person.</summary>
    public sealed record Coordinates : ArgRule
    {
        public override bool Allows(JsonNode? v) =>
            v is JsonObject o && o.Count == 2 && o["latitude"] is JsonValue a && o["longitude"] is JsonValue b
            && a.TryGetValue<double>(out var lat) && b.TryGetValue<double>(out var lng) && McpSanitiser.Coordinates(lat, lng);
    }
}

/// <summary>One tool a provider may be asked to run, with the arguments it may be given and which are required.</summary>
public sealed record McpToolRule(string Tool, IReadOnlyDictionary<string, ArgRule> Args, params string[] Required);

/// <summary>
/// What may leave the server (docs/mcp-integration-plan.md, principles 4 and 5): only allowlisted tools, only allowlisted arguments, each checked against its
/// rule, before any network call. The rules take places, dates, interests and counts. There is no rule that accepts a name, booking number, cabin, email, phone
/// number or free text of any length, so a guest's details cannot be sent by mistake. Every rule here is read-only: no booking, payment or change tool is listed.
/// </summary>
public sealed class McpEgressPolicy(IReadOnlyDictionary<string, IReadOnlyList<McpToolRule>> rules)
{
    public bool Allows(string provider, string tool) => rules.TryGetValue(provider, out var r) && r.Any(x => x.Tool == tool);

    /// <summary>Throws <see cref="McpPolicyException"/> unless the call is allowed.</summary>
    public void Check(string provider, string tool, JsonObject args)
    {
        if (!rules.TryGetValue(provider, out var list)) throw new McpPolicyException($"No tools are allowed for {provider}.");
        var rule = list.FirstOrDefault(x => x.Tool == tool) ?? throw new McpPolicyException($"{provider} may not be asked to run {tool}.");
        foreach (var (name, value) in args)
        {
            if (!rule.Args.TryGetValue(name, out var arg)) throw new McpPolicyException($"{tool} may not be given '{name}'.");
            if (!arg.Allows(value)) throw new McpPolicyException($"{tool} '{name}' is not an allowed value.");
        }
        foreach (var need in rule.Required)
            if (!args.ContainsKey(need)) throw new McpPolicyException($"{tool} needs '{need}'.");
    }

    private const string PlaceName = @"^[\p{L}\p{M}0-9 .,'’()\-]{2,120}$";
    private const string GoVisitPath = @"^/(en|cs)/(destinations|places)/[A-Za-z0-9_\-/]{1,200}$";

    private static McpToolRule Rule(string tool, string[] required, params (string Name, ArgRule Rule)[] args) =>
        new(tool, args.ToDictionary(a => a.Name, a => a.Rule), required);

    /// <summary>The rules for the providers the app knows. A provider with no entry cannot be called.</summary>
    public static McpEgressPolicy Default() => new(new Dictionary<string, IReadOnlyList<McpToolRule>>(StringComparer.OrdinalIgnoreCase)
    {
        ["govisit"] =
        [
            Rule("search_destinations", ["query"], ("query", new ArgRule.Text(120, PlaceName)), ("mode", new ArgRule.OneOf("auto", "name", "intent")), ("limit", new ArgRule.Whole(1, 20)), ("country", new ArgRule.Text(2, "^[A-Za-z]{2}$")), ("language", new ArgRule.OneOf("en", "cs"))),
            Rule("search_places", ["query"], ("query", new ArgRule.Text(120, PlaceName)), ("mode", new ArgRule.OneOf("auto", "name", "intent")), ("limit", new ArgRule.Whole(1, 20)), ("country", new ArgRule.Text(2, "^[A-Za-z]{2}$")), ("language", new ArgRule.OneOf("en", "cs")), ("near", new ArgRule.Coordinates())),
            Rule("list_destination_highlights", ["pagePath"], ("pagePath", new ArgRule.Text(300, GoVisitPath)), ("limit", new ArgRule.Whole(1, 20))),
            Rule("list_destination_places", ["pagePath"], ("pagePath", new ArgRule.Text(300, GoVisitPath)), ("limit", new ArgRule.Whole(1, 20))),
            Rule("list_destination_activities", ["pagePath"], ("pagePath", new ArgRule.Text(300, GoVisitPath))),
            Rule("get_place_visit_facts", ["pagePath"], ("pagePath", new ArgRule.Text(300, GoVisitPath))),
        ],
    });
}
