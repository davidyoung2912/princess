namespace Princess.Api.Services;

/// <summary>Where guards report themselves, so <c>/health/providers</c> can say which real providers are working or have fallen back to the simulation (N8.4).</summary>
public sealed class ProviderHealth
{
    private readonly List<ProviderGuard> guards = [];
    public void Register(ProviderGuard guard) { lock (guards) guards.Add(guard); }

    public IReadOnlyList<ProviderStatus> Snapshot()
    {
        lock (guards) return [.. guards.Select(g => new ProviderStatus(g.Name, g.IsOpen ? "fallback" : g.Failures > 0 ? "degraded" : "ok", g.Failures))];
    }
}

public sealed record ProviderStatus(string Provider, string State, int Failures);
