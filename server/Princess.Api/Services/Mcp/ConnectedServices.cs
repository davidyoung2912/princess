using Microsoft.Extensions.Options;

namespace Princess.Api.Services.Mcp;

/// <summary>One outside source that is switched on, in words a guest can read: who supplies it, what it is used for and exactly what is sent to it.</summary>
public sealed record ConnectedServiceDto(string Id, string Name, string Purpose, string[] Sent);

public sealed record ConnectedServicesDto(IReadOnlyList<ConnectedServiceDto> Services, string[] NeverSent);

/// <summary>
/// What the "Connected services" card shows (docs/mcp-integration-plan.md, phase 6). Only outside sources that are on are listed, with their credit; nothing is said about
/// simulated sources, so a guest cannot tell a demonstration feed from a live one. The principle list is the same whatever is on. No secrets, no endpoints.
/// </summary>
public static class ConnectedServices
{
    private static readonly string[] Never =
    [
        "Your name, email, phone number or booking number",
        "Your passport, payment or health details",
        "Your messages to Stanley or to other guests",
        "Who you are travelling with",
    ];

    private static readonly Dictionary<string, (string Purpose, string[] Sent)> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        ["govisit"] = ("Ideas for things to do near a port", ["The port or place name", "The kind of thing you are interested in"]),
        ["openmeteo"] = ("Weather and sea conditions for a port", ["The port's position", "The date"]),
    };

    public static ConnectedServicesDto Build(McpOptions mcp, IConfiguration config)
    {
        var list = new List<ConnectedServiceDto>();
        foreach (var (id, _) in mcp.Providers.OrderBy(p => p.Key, StringComparer.Ordinal))
        {
            if (id.Equals(PrincessMcpServer.Provider, StringComparison.OrdinalIgnoreCase) || mcp.Get(id) is not { } p) continue;
            var (purpose, sent) = Known.TryGetValue(id, out var k) ? k : ("Extra information for your trip", ["Only the place and date you are asking about"]);
            list.Add(new ConnectedServiceDto(id, p.Attribution is { Length: > 0 } a ? a : id, purpose, sent));
        }
        if (string.Equals(config["Providers:Weather"], "openmeteo", StringComparison.OrdinalIgnoreCase) && !list.Any(s => s.Id == "openmeteo"))
            list.Add(new ConnectedServiceDto("openmeteo", "Open-Meteo.com", Known["openmeteo"].Purpose, Known["openmeteo"].Sent));
        return new ConnectedServicesDto(list, Never);
    }
}
