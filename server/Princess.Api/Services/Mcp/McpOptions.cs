namespace Princess.Api.Services.Mcp;

/// <summary>
/// One external MCP server the gateway may talk to (docs/mcp-integration-plan.md, phase 2). Every provider is off until <see cref="Enabled"/> is set, so a
/// default install, and every test, never touches the network. <see cref="Commercial"/> says whether the provider's terms allow a commercial product to use it:
/// false means demonstration and non-commercial testing only, and is shown on <c>/health/providers</c> and in the runbook.
/// </summary>
public sealed class McpProviderOptions
{
    public bool Enabled { get; set; }
    /// <summary>The Streamable HTTP endpoint, an https address. Empty or not https means the provider is treated as off.</summary>
    public string Endpoint { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 8;
    /// <summary>The credit shown beside anything this provider supplied, for example "GoVisit".</summary>
    public string Attribution { get; set; } = "";
    public bool Commercial { get; set; }
    /// <summary>A bearer token for a provider that needs one. Set in user-secrets or an environment variable, never a file.</summary>
    public string? ApiKey { get; set; }

    public bool IsUsable => Enabled && Uri.TryCreate(Endpoint, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps;
}

/// <summary>The <c>Mcp</c> configuration section: provider settings by name (<c>govisit</c>, <c>openmeteo</c> and so on).</summary>
public sealed class McpOptions
{
    public const string Section = "Mcp";
    public Dictionary<string, McpProviderOptions> Providers { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public McpProviderOptions? Get(string name) => Providers.TryGetValue(name, out var p) && p.IsUsable ? p : null;
}
