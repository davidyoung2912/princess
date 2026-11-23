using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Services.Mcp;

/// <summary>
/// Where the walking planner gets a port's places from (docs/mcp-integration-plan.md, phases 4 and 7). <c>Providers:PortKnowledge</c> is <c>local</c> (the embedded port guides) or
/// <c>mcp</c> (a tool call through the MCP gateway, by default to this app's own public MCP server). Callers cannot tell which answered, which is the point: pointing it at a
/// different MCP provider is a configuration change. A null answer means the port is not known.
/// </summary>
public interface IPortKnowledge
{
    Task<IReadOnlyList<PortDayCandidate>?> PlacesAsync(string port, CancellationToken ct);
}

public sealed class LocalPortKnowledge : IPortKnowledge
{
    public Task<IReadOnlyList<PortDayCandidate>?> PlacesAsync(string port, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<PortDayCandidate>?>(PortGuides.Places(port) is { Count: > 0 } p ? [.. p.Select(x => new PortDayCandidate(x.Name, x.Tier, x.Why, x.Lat, x.Lng))] : null);
}

/// <summary>Reads a port's places from an MCP provider's <c>get_port_guide</c> tool. Whatever comes back is parsed into typed records and cleaned as untrusted text; if the provider is off, fails or sends nothing usable, the local guide answers.</summary>
public sealed class McpPortKnowledge(IMcpGateway gateway, LocalPortKnowledge local, string provider) : IPortKnowledge
{
    public async Task<IReadOnlyList<PortDayCandidate>?> PlacesAsync(string port, CancellationToken ct)
    {
        var got = await gateway.CallAsync(provider, "get_port_guide", new JsonObject { ["port"] = port }, TimeSpan.FromMinutes(30), ct);
        var places = got?.Structured?["thingsToDo"] is JsonArray arr ? Parse(arr) : null;
        return places is { Count: > 0 } ? places : await local.PlacesAsync(port, ct);
    }

    /// <summary>The places that have a name, a reach tier and a valid map point; anything else is dropped.</summary>
    public static List<PortDayCandidate> Parse(JsonArray things)
    {
        var list = new List<PortDayCandidate>();
        foreach (var t in things.OfType<JsonObject>().Take(60))
        {
            var name = McpSanitiser.Text(t["name"]?.GetValue<string>(), 120);
            var tier = McpSanitiser.Text(t["reach"]?.GetValue<string>(), 160);
            if (name is null || tier is null || t["map"] is not JsonObject m || m["lat"] is not JsonValue la || m["lng"] is not JsonValue ln) continue;
            if (!la.TryGetValue<double>(out var lat) || !ln.TryGetValue<double>(out var lng) || !McpSanitiser.Coordinates(lat, lng)) continue;
            list.Add(new PortDayCandidate(name, tier, McpSanitiser.Text(t["why"]?.GetValue<string>(), 500) ?? "", lat, lng));
        }
        return list;
    }
}
