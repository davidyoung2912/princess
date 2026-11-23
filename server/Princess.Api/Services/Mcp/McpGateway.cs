using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;

namespace Princess.Api.Services.Mcp;

/// <summary>
/// The one door to every external MCP server (docs/mcp-integration-plan.md, phase 2). A call is checked against <see cref="McpEgressPolicy"/> first, then goes
/// out through a per-provider <see cref="ProviderGuard"/> (timeout, circuit breaker, health report) and an optional short cache. It answers null when the provider
/// is off, the circuit is open, the call fails or the server calls it an error; the caller then uses its own local data. Logs the provider, tool, outcome and time,
/// never the arguments.
/// </summary>
public interface IMcpGateway
{
    bool IsEnabled(string provider);
    /// <summary>The credit to show beside what the provider supplied, or null when it is off.</summary>
    string? Attribution(string provider);
    Task<McpToolResult?> CallAsync(string provider, string tool, JsonObject args, TimeSpan? cacheFor, CancellationToken ct);
}

public sealed class McpGateway(IOptions<McpOptions> options, IHttpClientFactory factory, McpEgressPolicy policy, IClock clock, IMemoryCache cache, ILogger<McpGateway> log, ProviderHealth? health = null) : IMcpGateway
{
    private readonly ConcurrentDictionary<string, (McpClient Client, ProviderGuard Guard)> clients = new(StringComparer.OrdinalIgnoreCase);

    public bool IsEnabled(string provider) => options.Value.Get(provider) is not null;

    public string? Attribution(string provider) => options.Value.Get(provider) is { Attribution.Length: > 0 } p ? p.Attribution : options.Value.Get(provider) is null ? null : provider;

    public async Task<McpToolResult?> CallAsync(string provider, string tool, JsonObject args, TimeSpan? cacheFor, CancellationToken ct)
    {
        policy.Check(provider, tool, args);   // before anything else: a refused call never reaches the network, even when the provider is off
        var settings = options.Value.Get(provider);
        if (settings is null) return null;
        var key = $"mcp|{provider}|{tool}|{args.ToJsonString()}";
        if (cacheFor is not null && cache.TryGetValue(key, out McpToolResult? hit) && hit is not null) return hit;
        var (client, guard) = clients.GetOrAdd(provider, _ =>
        {
            var g = new ProviderGuard($"Mcp:{provider}", clock, log);
            health?.Register(g);
            return (new McpClient(factory, settings), g);
        });
        var clock0 = Stopwatch.StartNew();
        var result = await guard.RunAsync(async () =>
        {
            var r = settings.InProcess ? PrincessMcpServer.CallTool(tool, args) : await client.CallToolAsync(tool, args, ct);
            return r.IsError ? null : r;
        }, () => (McpToolResult)null!);
        log.LogInformation("MCP {Provider} {Tool} {Outcome} in {Ms} ms", provider, tool, result is null ? "no answer" : "ok", clock0.ElapsedMilliseconds);
        if (result is not null && cacheFor is not null) cache.Set(key, result, cacheFor.Value);
        return result;
    }
}
