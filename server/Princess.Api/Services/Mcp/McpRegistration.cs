using Princess.Api.Domain;

namespace Princess.Api.Services.Mcp;

public static class McpRegistration
{
    /// <summary>Registers the MCP gateway. Every provider is off until its <c>Mcp:Providers:&lt;name&gt;:Enabled</c> is true, so nothing calls out by default.</summary>
    public static IServiceCollection AddMcp(this IServiceCollection services, IConfiguration config)
    {
        services.AddOptions<McpOptions>().BindConfiguration(McpOptions.Section);
        services.AddHttpClient("mcp", c =>
        {
            // Say who is calling, honestly: some providers block anonymous automation, and we do not disguise ourselves to get past that.
            c.DefaultRequestHeaders.UserAgent.ParseAdd($"{McpClient.ClientName}/1.0");
            c.Timeout = TimeSpan.FromSeconds(65);
        });
        services.AddSingleton(McpEgressPolicy.Default());
        services.AddSingleton<IMcpGateway, McpGateway>();
        // Providers:CruiseDiscovery and Providers:FlightSearch are local only for now: a verified provider would be another case here.
        foreach (var name in new[] { "CruiseDiscovery", "FlightSearch" })
            if ((config[$"Providers:{name}"] ?? "local").Trim().ToLowerInvariant() != "local")
                throw new InvalidOperationException($"Providers:{name} is '{config[$"Providers:{name}"]}', which is not registered. Choose one of: local.");
        services.AddScoped<ICruiseDiscovery, LocalCruiseDiscovery>();
        services.AddSingleton<IFlightSearch, LocalFlightSearch>();
        // Providers:PortKnowledge is local (the embedded guides) or mcp (a tool call through the gateway, by default to this app's own public MCP server, Mcp:PortKnowledgeProvider).
        services.AddSingleton<LocalPortKnowledge>();
        var knowledge = (config["Providers:PortKnowledge"] ?? "local").Trim().ToLowerInvariant();
        switch (knowledge)
        {
            case "local":
                services.AddSingleton<IPortKnowledge>(sp => sp.GetRequiredService<LocalPortKnowledge>());
                break;
            case "mcp":
                var from = config["Mcp:PortKnowledgeProvider"] is { Length: > 0 } named ? named : PrincessMcpServer.Provider;
                services.AddSingleton<IPortKnowledge>(sp => new McpPortKnowledge(sp.GetRequiredService<IMcpGateway>(), sp.GetRequiredService<LocalPortKnowledge>(), from));
                break;
            default:
                throw new InvalidOperationException($"Providers:PortKnowledge is '{knowledge}', which is not registered. Choose one of: local, mcp.");
        }
        return services;
    }
}
