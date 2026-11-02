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
public sealed class ConciergeOptions
{
    public const string Section = "Concierge";
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "claude-sonnet-5-5";
    public string Endpoint { get; set; } = "https://api.anthropic.com/v1/messages";
    public int MaxTokens { get; set; } = 900;
}

/// <summary>Why a model could not answer: auth, rate, network or bad. The service turns it into the scripted concierge plus a <c>fallback</c> code.</summary>
public sealed class ConciergeModelException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>What a model must supply: one request with the tools, answered in the Messages API's shape (<c>content</c> blocks and <c>stop_reason</c>).</summary>
public interface IConciergeModel
{
    /// <summary>False when no model is set up (no key); the service then answers from the script without counting against the hourly limit.</summary>
    bool Available { get; }

    /// <param name="messages">Messages API turns (<c>[{role, content}]</c>), ending with the guest's message or a tool result.</param>
    Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, CancellationToken ct);
}

public sealed class UnavailableConciergeModel : IConciergeModel
{
    public bool Available => false;
    public Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, CancellationToken ct) =>
        throw new ConciergeModelException("bad", "No concierge model is configured.");
}

/// <summary>The Anthropic Messages API. The key lives only here, on the server.</summary>
public sealed class AnthropicConciergeModel(HttpClient http, IOptions<ConciergeOptions> options) : IConciergeModel
{
    public bool Available => true;

    public async Task<JsonObject> CompleteAsync(string system, string toolsJson, JsonArray messages, CancellationToken ct)
    {
        var o = options.Value;
        var body = new JsonObject { ["model"] = o.Model, ["max_tokens"] = o.MaxTokens, ["system"] = system, ["tools"] = JsonNode.Parse(toolsJson), ["messages"] = messages };
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
                    _ => new ConciergeModelException("bad", $"The service answered {(int)res.StatusCode}."),
                };
            try { return JsonNode.Parse(await res.Content.ReadAsStringAsync(ct))?.AsObject() ?? throw new ConciergeModelException("bad", "An empty answer."); }
            catch (JsonException) { throw new ConciergeModelException("bad", "An unreadable answer."); }
        }
    }
}

/// <summary>At most <see cref="ConciergeRules.HourlyLimit"/> model questions an hour per person, counted in memory (a restart resets it, which only ever lets more through).</summary>
public sealed class ConciergeLimiter
{
    private static readonly TimeSpan Hour = TimeSpan.FromHours(1);
    private readonly ConcurrentDictionary<Guid, List<DateTime>> _asked = new();

    public bool TryTake(Guid person, DateTime now, int limit = ConciergeRules.HourlyLimit)
    {
        var list = _asked.GetOrAdd(person, _ => []);
        lock (list)
        {
            list.RemoveAll(t => now - t >= Hour);
            if (list.Count >= limit) return false;
            list.Add(now);
            return true;
        }
    }
}

/// <summary>
/// The AI concierge (multi-device plan 2, Phase 2). One turn: a message needing a person never reaches a model; otherwise the model answers (running the tools
/// over the catalogue and the guest's booking) when one is set up and the hourly limit allows, and the scripted concierge answers when not or when the call fails.
/// </summary>
public sealed class ConciergeService(ITripStore trips, IAccountStore accounts, IUserClock clock, IClock realClock, IConciergeModel model, ConciergeLimiter limiter, ILogger<ConciergeService> log)
{
    public async Task<ConciergeReplyDto> AskAsync(UserRecord user, ConciergeRequestDto request, CancellationToken ct)
    {
        var history = ConciergeRules.Usable(request.History) ?? throw ApiException.Invalid("badConcierge");
        var message = history[^1].Text.Trim();
        if (ConciergeRules.Screen(message) is { } handoff) return new ConciergeReplyDto("", [], "handoff", handoff, null);

        var ctx = await ContextAsync(user, request, ct);
        if (!model.Available) return Scripted(message, ctx, null);
        if (!limiter.TryTake(user.PublicId, realClock.UtcNow)) return Scripted(message, ctx, "limit");
        try
        {
            return await AskModelAsync(history, ctx, ct);
        }
        catch (ConciergeModelException e)
        {
            log.LogWarning("Concierge model failed: {Code}", e.Code);
            return Scripted(message, ctx, e.Code);
        }
    }

    private static ConciergeReplyDto Scripted(string message, ConciergeContext ctx, string? fallback) => ConciergeRules.ScriptedReply(message, ctx) with { Fallback = fallback };

    private async Task<ConciergeContext> ContextAsync(UserRecord user, ConciergeRequestDto request, CancellationToken ct)
    {
        var now = await clock.NowAsync(user, ct);
        var today = DateOnly.FromDateTime(now);
        var sailings = (await trips.ListSailingsAsync(ct)).Where(s => s.BookingOpen && Pricing.HasPrice(s.Id) && DateOnly.FromDateTime(s.Departure) > today).OrderBy(s => s.Departure).ToList();
        var booking = (await trips.ListForUserAsync(user.Id, ct))
            .Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today).OrderBy(b => b.Departure).FirstOrDefault();
        var party = new List<PartyMember>();
        string? first = null;
        if (booking is not null)
        {
            foreach (var g in await accounts.GetPartyAsync(booking.BookingId, ct))
            {
                var dob = DateOnly.FromDateTime(g.Dob);
                var age = today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
                party.Add(new PartyMember(g.FirstName, age));
                if (g.UserId == user.Id) first = g.FirstName;
            }
        }
        var mobility = request.Mobility is "easy" or "wheelchair" ? request.Mobility : "any";
        var likes = (request.Likes ?? []).Where(l => !string.IsNullOrWhiteSpace(l)).Select(l => l.Length > 160 ? l[..160] : l).Take(5).ToList();
        return new ConciergeContext(now, booking?.SailingId, booking is null ? null : DateOnly.FromDateTime(booking.Departure), booking?.ShipName, booking?.CategoryName, first, party, sailings, mobility, likes);
    }

    /// <summary>The Messages API loop: run the tools the model calls until it answers, at most <see cref="ConciergeRules.MaxTurns"/> times.</summary>
    private async Task<ConciergeReplyDto> AskModelAsync(List<ConciergeMessageDto> history, ConciergeContext ctx, CancellationToken ct)
    {
        var turns = new JsonArray();
        foreach (var m in history) turns.Add(new JsonObject { ["role"] = m.Role, ["content"] = m.Text });
        var system = ConciergeRules.SystemPrompt(ctx);
        var citations = new List<CitationDto>();
        for (var n = 0; n < ConciergeRules.MaxTurns; n++)
        {
            var body = await model.CompleteAsync(system, ConciergeRules.ToolsJson, turns, ct);
            var blocks = body["content"] as JsonArray ?? new JsonArray();
            var uses = blocks.OfType<JsonObject>().Where(b => b["type"]?.GetValue<string>() == "tool_use").ToList();
            if (body["stop_reason"]?.GetValue<string>() != "tool_use" || uses.Count == 0)
            {
                var text = string.Concat(blocks.OfType<JsonObject>().Where(b => b["type"]?.GetValue<string>() == "text").Select(b => b["text"]?.GetValue<string>())).Trim();
                if (text.Length == 0) throw new ConciergeModelException("bad", "An empty answer.");
                return new ConciergeReplyDto(text, [.. citations.GroupBy(c => c.Path).Select(g => g.First()).Take(5)], "claude", null, null);
            }
            turns.Add(new JsonObject { ["role"] = "assistant", ["content"] = blocks.DeepClone() });
            var results = new JsonArray();
            foreach (var use in uses)
            {
                var r = ConciergeRules.RunTool(use["name"]?.GetValue<string>() ?? "", use["input"] as JsonObject ?? new JsonObject(), ctx);
                citations.AddRange(r.Citations);
                var result = new JsonObject { ["type"] = "tool_result", ["tool_use_id"] = use["id"]?.GetValue<string>(), ["content"] = r.Content };
                if (r.IsError) result["is_error"] = true;
                results.Add(result);
            }
            turns.Add(new JsonObject { ["role"] = "user", ["content"] = results });
        }
        throw new ConciergeModelException("bad", "Too many steps.");
    }
}
