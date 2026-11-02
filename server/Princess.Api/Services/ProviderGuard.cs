using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The wrapper every real provider runs behind (N8.1). A call that throws or returns null counts as a failure; after <see cref="Threshold"/> failures in a row the circuit
/// opens for <see cref="OpenFor"/> and every call goes straight to the fall-back (the simulation) without touching the network. The first call after that is a trial:
/// if it succeeds the circuit closes. The timeout itself belongs to the provider's HttpClient. One guard per provider, so a failing weather feed never slows flights.
/// </summary>
public sealed class ProviderGuard(string name, IClock clock, ILogger log, int threshold = 3, TimeSpan? openFor = null)
{
    public int Threshold { get; } = threshold;
    public TimeSpan OpenFor { get; } = openFor ?? TimeSpan.FromMinutes(2);
    private readonly object gate = new();
    private int failures;
    private DateTime openUntil = DateTime.MinValue;

    public string Name { get; } = name;
    public bool IsOpen { get { lock (gate) return clock.UtcNow < openUntil; } }
    public int Failures { get { lock (gate) return failures; } }

    /// <summary>The real answer, or <paramref name="fallback"/>'s when the circuit is open, the call fails or it has no answer.</summary>
    public T Run<T>(Func<T?> real, Func<T> fallback) where T : class
    {
        if (IsOpen) return fallback();
        try
        {
            var got = real();
            if (got is not null) { lock (gate) failures = 0; return got; }
            Fail("no answer");
        }
        catch (Exception e)
        {
            Fail(e.Message);
        }
        return fallback();
    }

    private void Fail(string why)
    {
        lock (gate)
        {
            failures++;
            if (failures >= Threshold)
            {
                openUntil = clock.UtcNow + OpenFor;
                log.LogWarning("{Provider} circuit open for {Minutes} min after {Count} failures ({Why})", Name, OpenFor.TotalMinutes, failures, why);
            }
            else log.LogWarning("{Provider} failed ({Why}); using the simulation for this call", Name, why);
        }
    }
}
