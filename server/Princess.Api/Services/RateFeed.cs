using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What a rate source must supply (ACC-07). Null means it had no answer; the service then keeps what it last had.</summary>
public interface IRateFeed
{
    /// <summary>Rates per US dollar for a day, or null when the source cannot answer. Must not throw for a network failure.</summary>
    Task<RateTableDto?> FetchAsync(DateOnly today, CancellationToken ct);
}

/// <summary>The stub: the authored sample rates moved a little each day. This is the default.</summary>
public sealed class SimRateFeed : IRateFeed
{
    public Task<RateTableDto?> FetchAsync(DateOnly today, CancellationToken ct) => Task.FromResult<RateTableDto?>(RatesRules.TableFor(today));
}

/// <summary>Settings for <see cref="HttpRateFeed"/>. The default points at a free, key-less feed of European Central Bank reference rates.</summary>
public sealed class RateOptions
{
    public const string Section = "Rates";
    /// <summary>Base address of a Frankfurter-compatible service: <c>GET {BaseUrl}/latest?base=USD&amp;symbols=EUR,GBP</c> answering <c>{ "date": "YYYY-MM-DD", "rates": { "EUR": 0.92 } }</c>.</summary>
    public string BaseUrl { get; set; } = "https://api.frankfurter.dev/v1";
    public int TimeoutSeconds { get; set; } = 5;
}

/// <summary>
/// A real feed (<c>Providers:Rates</c> = <c>http</c>). It asks for the codes the app lists. Codes the feed does not carry (the Belize dollar is pegged and the
/// Honduran lempira is not an ECB currency) keep their sample rate, so the table is always complete; the date is the feed's own.
/// </summary>
public sealed class HttpRateFeed(HttpClient http, IOptions<RateOptions> options, ILogger<HttpRateFeed> log) : IRateFeed
{
    public async Task<RateTableDto?> FetchAsync(DateOnly today, CancellationToken ct)
    {
        var o = options.Value;
        var symbols = string.Join(',', RatesRules.Sample.Where(s => s.Code != "USD").Select(s => s.Code));
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(o.TimeoutSeconds, 1, 30)));
            using var res = await http.GetAsync($"{o.BaseUrl.TrimEnd('/')}/latest?base=USD&symbols={symbols}", timeout.Token);
            if (!res.IsSuccessStatusCode) { log.LogWarning("Rate feed answered {Status}", (int)res.StatusCode); return null; }
            return Parse(await res.Content.ReadAsStringAsync(timeout.Token));
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or OperationCanceledException or JsonException)
        {
            if (ct.IsCancellationRequested) throw;
            log.LogWarning("Rate feed could not be read: {Reason}", e.Message);
            return null;
        }
    }

    /// <summary>The table in a feed's answer, or null when it is not in the expected shape.</summary>
    public static RateTableDto? Parse(string json)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(json); }
        catch (JsonException) { return null; }
        if (root is not JsonObject o || o["rates"] is not JsonObject rates) return null;
        if (o["date"] is not JsonValue d || !d.TryGetValue<string>(out var text) || !DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var asOf)) return null;
        var live = new Dictionary<string, double>();
        foreach (var (code, node) in rates)
            if (node is JsonValue v && v.TryGetValue<double>(out var rate)) live[code.ToUpperInvariant()] = rate;
        return live.Count == 0 ? null : RatesRules.FromFeed(asOf, live);
    }
}

/// <summary>
/// The table every device sees. It asks the feed at most once every <see cref="RatesRules.FreshHours"/> hours, however many devices ask. When the feed does not answer it keeps the last
/// table it had, with that table's own (older) date, so the app shows its age; if it never had one, it serves the sample table, dated long ago and so called out of date.
/// </summary>
public sealed class RateService(IRateFeed feed, IMemoryCache cache, IClock clock)
{
    private const string Fresh = "rates:fresh";
    private const string LastGood = "rates:last";
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<RateTableDto> CurrentAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(Fresh, out RateTableDto? fresh) && fresh is not null) return fresh;
        await Gate.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue(Fresh, out fresh) && fresh is not null) return fresh;
            var got = await feed.FetchAsync(DateOnly.FromDateTime(clock.UtcNow), ct);
            if (got is not null)
            {
                cache.Set(LastGood, got);
                return cache.Set(Fresh, got, TimeSpan.FromHours(RatesRules.FreshHours));
            }
            // No answer: keep what we had, and try again soon rather than after six hours.
            var kept = cache.TryGetValue(LastGood, out RateTableDto? last) && last is not null ? last : RatesRules.SampleTable();
            return cache.Set(Fresh, kept, TimeSpan.FromMinutes(5));
        }
        finally { Gate.Release(); }
    }
}
