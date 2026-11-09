using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What the gateway needs from the tools route, so it can be tested without the stores.</summary>
public interface IStanleyTools
{
    Task<ConciergeContext> ContextAsync(UserRecord user, string? mobilityWish, List<string>? likeWishes, CancellationToken ct);
    Task<ConciergeReplyDto> AskModelAsync(List<ConciergeMessageDto> history, ConciergeContext ctx, ModelMeter meter, ModelTier tier, CancellationToken ct);
}

/// <summary>
/// The tools behind Stanley's trip and before routes: what the separate concierge used to be, now only reachable through <see cref="StanleyService"/> (decision 4).
/// It builds the facts the tools may use (the guest's own booking and the catalogue), runs the model's tool loop through a <see cref="ModelMeter"/> so the call caps apply,
/// and holds the scripted answers used when no model can be called. It does not screen, limit or log; the gateway does.
/// </summary>
public sealed class StanleyToolService(ITripStore trips, IAccountStore accounts, IUserClock clock) : IStanleyTools
{
    /// <summary>Public ship, port and excursion answers by content version, tool, input and sailing. Guest-specific tools are never cached.</summary>
    private static readonly ConcurrentDictionary<string, ToolOutcome> Cache = new();
    private static readonly HashSet<string> Cacheable = ["get_itinerary", "get_port", "search_excursions", "list_restaurants"];
    private const int MaxCached = 512;

    public async Task<ConciergeContext> ContextAsync(UserRecord user, string? mobilityWish, List<string>? likeWishes, CancellationToken ct)
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
        var mobility = mobilityWish is "easy" or "wheelchair" ? mobilityWish : "any";
        var likes = (likeWishes ?? []).Where(l => !string.IsNullOrWhiteSpace(l)).Select(l => l.Length > 160 ? l[..160] : l).Take(5).ToList();
        return new ConciergeContext(now, booking?.SailingId, booking is null ? null : DateOnly.FromDateTime(booking.Departure), booking?.ShipName, booking?.CategoryName, first, party, sailings, mobility, likes);
    }

    /// <summary>The scripted answer, grounded on the same tools as the model, with <paramref name="fallback"/> saying why a model was not used.</summary>
    public static ConciergeReplyDto Scripted(string message, ConciergeContext ctx, string? fallback) => ConciergeRules.ScriptedReply(message, ctx) with { Fallback = fallback };

    /// <summary>The Messages API loop: run the tools the model calls until it answers, at most <see cref="ConciergeRules.MaxTurns"/> times and never past the meter's call cap.</summary>
    public async Task<ConciergeReplyDto> AskModelAsync(List<ConciergeMessageDto> history, ConciergeContext ctx, ModelMeter meter, ModelTier tier, CancellationToken ct)
    {
        var turns = new JsonArray();
        foreach (var m in history) turns.Add(new JsonObject { ["role"] = m.Role, ["content"] = m.Text });
        var system = ConciergeRules.SystemPrompt(ctx);
        var citations = new List<CitationDto>();
        for (var n = 0; n < ConciergeRules.MaxTurns; n++)
        {
            var body = await meter.CallAsync(system, ConciergeRules.ToolsJson, turns, tier, ct);
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
                var r = Run(use["name"]?.GetValue<string>() ?? "", use["input"] as JsonObject ?? new JsonObject(), ctx);
                citations.AddRange(r.Citations);
                var result = new JsonObject { ["type"] = "tool_result", ["tool_use_id"] = use["id"]?.GetValue<string>(), ["content"] = r.Content };
                if (r.IsError) result["is_error"] = true;
                results.Add(result);
            }
            turns.Add(new JsonObject { ["role"] = "user", ["content"] = results });
        }
        throw new ConciergeModelException("bad", "Too many steps.");
    }

    /// <summary>Runs one tool, answering the public catalogue tools from the cache when the content version, tool, input and sailing are the same.</summary>
    public static ToolOutcome Run(string name, JsonObject input, ConciergeContext ctx)
    {
        if (!Cacheable.Contains(name)) return ConciergeRules.RunTool(name, input, ctx);
        var key = $"{StanleyRules.ContentVersion}|{name}|{input.ToJsonString()}|{ctx.SailingId}|{ctx.Departure:yyyy-MM-dd}|{ctx.Mobility}";
        if (Cache.TryGetValue(key, out var hit)) return hit;
        var result = ConciergeRules.RunTool(name, input, ctx);
        if (!result.IsError)
        {
            if (Cache.Count >= MaxCached) Cache.Clear();
            Cache[key] = result;
        }
        return result;
    }

    /// <summary>For tests: how many tool answers are held.</summary>
    public static int CachedCount => Cache.Count;
}
