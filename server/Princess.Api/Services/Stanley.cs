using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley, the cruise chat helper (docs/stanley-plan.md, S2). One turn, in this order, all on the server: the word filter (no model), the safety screen
/// (emergency, medical, legal and "talk to a person" never reach a model), the hourly limit, a cheap topic prescan, then the answer. With no model set up a
/// scripted reply answers cruising messages. Stanley has no tools and no account access. Message text is never logged.
/// </summary>
public sealed class StanleyService(IConciergeModel model, IConciergeLimiter limiter, IClock clock, ILogger<StanleyService> log)
{
    public const string NoTools = "[]";

    public async Task<StanleyReplyDto> AskAsync(long userId, StanleyRequestDto request, CancellationToken ct)
    {
        var turns = StanleyRules.Usable(request.History) ?? throw ApiException.Invalid("badStanley");
        if (ProfanityFilter.IsBlocked(turns.Message)) return new StanleyReplyDto("blocked", "", null, "", null);
        if (ConciergeRules.Screen(turns.Message) is { } handoff) return new StanleyReplyDto("handoff", "", handoff, "", null);

        if (!model.Available)
            return StanleyRules.LooksOnTopic(turns.Message)
                ? new StanleyReplyDto("answer", StanleyRules.ScriptedAnswer, null, "scripted", null)
                : new StanleyReplyDto("offtopic", "", null, "", null);

        if (!await limiter.TryTakeAsync(userId, clock.UtcNow, ConciergeRules.HourlyLimit, ct)) return Unavailable("limit");
        try
        {
            var topic = await model.CompleteAsync(StanleyRules.TopicSystem, NoTools, ToTurns(StanleyRules.TopicMessages(turns)), ct);
            if (!StanleyRules.ReadTopic(TextOf(topic))) return new StanleyReplyDto("offtopic", "", null, "", null);

            var answer = TextOf(await model.CompleteAsync(StanleyRules.AnswerSystem, NoTools, ToTurns(turns.Messages), ct));
            if (answer.Length == 0) throw new ConciergeModelException("bad", "An empty answer.");
            return new StanleyReplyDto("answer", answer, null, "claude", null);
        }
        catch (ConciergeModelException e)
        {
            log.LogWarning("Stanley model failed: {Code}", e.Code);
            return Unavailable(e.Code);
        }
    }

    private static StanleyReplyDto Unavailable(string code) => new("unavailable", "", null, "", code);

    private static JsonArray ToTurns(IEnumerable<ConciergeMessageDto> messages)
    {
        var turns = new JsonArray();
        foreach (var m in messages) turns.Add(new JsonObject { ["role"] = m.Role, ["content"] = m.Text });
        return turns;
    }

    private static string TextOf(JsonObject body) =>
        string.Concat((body["content"] as JsonArray ?? []).OfType<JsonObject>().Where(b => b["type"]?.GetValue<string>() == "text").Select(b => b["text"]?.GetValue<string>())).Trim();
}
