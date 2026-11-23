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
        return services;
    }
}
