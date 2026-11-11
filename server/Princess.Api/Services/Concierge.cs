using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Concierge settings. <c>ApiKey</c> is a secret: user-secrets or an environment variable, never a tracked file. Without one the scripted concierge answers.</summary>
/// <summary>The model service's key and address. Which model answers, and how much it may spend, is <see cref="StanleyOptions"/>.</summary>
public sealed class ConciergeOptions
{
    public const string Section = "Concierge";
    public string ApiKey { get; set; } = "";
    public string Endpoint { get; set; } = "https://api.anthropic.com/v1/messages";
}

/// <summary>Why a model could not answer: auth, rate, network or bad. The service turns it into the scripted concierge plus a <c>fallback</c> code.</summary>
public sealed class ConciergeModelException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>Which model a call uses (decision 6 in docs/stanley-gap-analysis-and-plan.md): small for prescans, default for answers with tools, large only for planning.</summary>
public enum ModelTier { Small, Default, Large }

/// <summary>What a model must supply: one request with the tools, answered in the Messages API's shape (<c>content</c> blocks, <c>stop_reason</c> and <c>usage</c>).</summary>
public interface IConciergeModel
{
    /// <summary>False when no model is set up (no key); the service then answers from the script without counting against the hourly limit.</summary>
    bool Available { get; }

    /// <param name="messages">Messages API turns (<c>[{role, content}]</c>), ending with the guest's message or a tool result.</param>
    Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct);
}

public sealed class UnavailableConciergeModel : IConciergeModel
{
    public bool Available => false;
    public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct) =>
        throw new ConciergeModelException("bad", "No concierge model is configured.");
}

/// <summary>The Anthropic Messages API. The key lives only here, on the server.</summary>
public sealed class AnthropicConciergeModel(HttpClient http, IOptions<ConciergeOptions> options, IOptions<StanleyOptions> stanley) : IConciergeModel
{
    public bool Available => true;

    /// <summary>The API's own error text (<c>error.message</c>), cut short, for the log. It describes the request's shape or the account, not the guest's words.</summary>
    private static async Task<string> ErrorOf(HttpResponseMessage res, CancellationToken ct)
    {
        try
        {
            var message = JsonNode.Parse(await res.Content.ReadAsStringAsync(ct))?["error"]?["message"]?.GetValue<string>() ?? "";
            return message.Length > 300 ? message[..300] : message;
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { return ""; }
    }

    public async Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, ModelTier tier, CancellationToken ct)
    {
        var o = options.Value;
        var (name, maxTokens) = stanley.Value.For(tier);
        var body = new JsonObject { ["model"] = name, ["max_tokens"] = maxTokens, ["system"] = system, ["messages"] = messages.DeepClone() };   // a copy: the caller's tool loop sends the same array on every turn, and a node can have only one parent
        if (JsonNode.Parse(toolsJson) is JsonArray { Count: > 0 } tools) body["tools"] = tools;   // Stanley asks with no tools: the API refuses an empty list
        using var req = new HttpRequestMessage(HttpMethod.Post, o.Endpoint) { Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json") };
        req.Headers.Add("x-api-key", o.ApiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");
        HttpResponseMessage res;
        try { res = await http.SendAsync(req, ct); }
        catch (HttpRequestException) { throw new ConciergeModelException("network", "Could not reach the service."); }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { throw new ConciergeModelException("network", "The service timed out."); }
        using (res)
        {
            if (!res.IsSuccessStatusCode)
                throw res.StatusCode switch
                {
                    HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => new ConciergeModelException("auth", "The key was refused."),
                    HttpStatusCode.TooManyRequests => new ConciergeModelException("rate", "Too many requests."),
                    _ => new ConciergeModelException("bad", $"The service answered {(int)res.StatusCode}: {await ErrorOf(res, ct)}"),
                };
            try { return JsonNode.Parse(await res.Content.ReadAsStringAsync(ct))?.AsObject() ?? throw new ConciergeModelException("bad", "An empty answer."); }
            catch (JsonException) { throw new ConciergeModelException("bad", "An unreadable answer."); }
        }
    }
}

/// <summary>A per-person count of model calls in a sliding window (the gateway's daily ceiling). Counted in the database by default so the limit holds across restarts and instances.</summary>
public interface IConciergeLimiter
{
    /// <summary>Counts one call and returns true when the person is still within <paramref name="limit"/> in the last hour; false (and counts nothing) when not.</summary>
    Task<bool> TryTakeAsync(long userId, DateTime now, int limit, CancellationToken ct);

    /// <summary>The same over any <paramref name="window"/>.</summary>
    Task<bool> TryTakeAsync(long userId, DateTime now, int limit, TimeSpan window, CancellationToken ct);
}

/// <summary>Counted in memory (a restart resets it, which only ever lets more through). For tests and a single-instance trial: <c>Providers:ConciergeLimit</c> = <c>memory</c>.</summary>
public sealed class MemoryConciergeLimiter : IConciergeLimiter
{
    private static readonly TimeSpan Hour = TimeSpan.FromHours(1);
    private readonly ConcurrentDictionary<long, List<DateTime>> _asked = new();

    public Task<bool> TryTakeAsync(long userId, DateTime now, int limit, CancellationToken ct) => Task.FromResult(TryTake(userId, now, limit));

    public Task<bool> TryTakeAsync(long userId, DateTime now, int limit, TimeSpan window, CancellationToken ct) => Task.FromResult(TryTake(userId, now, limit, window));

    public bool TryTake(long userId, DateTime now, int limit = 20, TimeSpan? window = null)
    {
        var span = window ?? Hour;
        var list = _asked.GetOrAdd(userId, _ => []);
        lock (list)
        {
            list.RemoveAll(t => now - t >= span);
            if (list.Count >= limit) return false;
            list.Add(now);
            return true;
        }
    }
}
