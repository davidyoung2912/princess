using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Stanley as a friendly host in chat (docs/chat-stanley-plan.md, phases 1 and 2): the status and wording for the request screens, a reworded or polished draft, and icebreakers. A model is used only on a guest's tap,
/// on the small tier, behind <see cref="ModelMeter"/> and the daily ceiling, and only for text that passes the safety screen; every suggestion goes through the output filter and is dropped when it fails. Nothing is stored,
/// nothing is sent for the guest, and draft or suggestion text is never logged or audited (an audit row holds the kind and outcome only). A supervised child never gets any of it (403 <c>supervised</c>).
/// With the switch off, the model unavailable or a cap reached, chat works exactly as before and each call answers with a plain line.
/// </summary>
public sealed class ChatHelpService(IConciergeModel model, IConciergeLimiter limiter, IOptions<StanleyOptions> options, IAuditLog audit)
{
    private static string TextOf(JsonObject body) =>
        string.Concat((body["content"] as JsonArray ?? []).OfType<JsonObject>().Where(b => b["type"]?.GetValue<string>() == "text").Select(b => b["text"]?.GetValue<string>())).Trim();

    private static JsonArray One(string text) => [new JsonObject { ["role"] = "user", ["content"] = text }];

    private bool On => options.Value.Switches.Chat;

    /// <summary>Whether the help is on for the caller (never for a supervised child), with the lines the screens show.</summary>
    public ChatStanleyStatusDto Status(UserRecord actor) => new(On && !actor.IsSupervised, ChatStanleyVoice.All());

    private Task RecordAsync(string action, string outcome, CancellationToken ct) =>
        audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = action, Outcome = AuditOutcome.Success, Target = "chat", Detail = outcome }, ct);

    private ModelMeter Meter(UserRecord actor)
    {
        var o = options.Value;
        return new ModelMeter(model, c => limiter.TryTakeAsync(actor.Id, DateTime.UtcNow, o.DailyCeiling, TimeSpan.FromDays(1), c), 1);
    }

    private ChatRewordDto Refused(string reason, string message) => new(null, reason, message);

    /// <summary>
    /// One suggestion for a draft. 400 <c>mode</c> or <c>empty</c> (blank or over 500 characters); 403 <c>supervised</c>. Otherwise 200 with either a suggestion or a <c>Reason</c>: <c>unavailable</c> (switch off, no model, a failed call),
    /// <c>limit</c> (the daily ceiling), <c>safety</c> (emergency, medical, legal or person text is never sent to a model) or <c>none</c> (nothing usable came back).
    /// </summary>
    public async Task<ChatRewordDto> RewordAsync(UserRecord actor, ChatRewordBody? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        if (!ChatRewordRules.IsMode(body?.Mode)) throw ApiException.Invalid(ChatRewordRules.BadMode);
        var draft = ChatRewordRules.Draft(body?.Text) ?? throw ApiException.Invalid(ChatRewordRules.Empty);
        var mode = body!.Mode!;
        var none = mode == ChatRewordRules.Reword ? ChatRewordRules.NoKinderWay : ChatRewordRules.NoSuggestionLine;
        if (!On || !model.Available || !options.Value.Switches.Model) { await RecordAsync("chat.reword", mode + ":unavailable", ct); return Refused(ChatRewordRules.Unavailable, ChatRewordRules.UnavailableLine); }
        if (!ChatRewordRules.MayCall(draft)) { await RecordAsync("chat.reword", mode + ":safety", ct); return Refused(ChatRewordRules.Safety, ChatRewordRules.SafetyLine); }
        string? text;
        try { text = TextOf(await Meter(actor).CallAsync(ChatRewordRules.System(mode), StanleyService.NoTools, One(ChatRewordRules.UserTurn(draft)), ModelTier.Small, ct)); }
        catch (ConciergeModelException e)
        {
            var limited = e.Code == "limit";
            await RecordAsync("chat.reword", mode + (limited ? ":limit" : ":failed"), ct);
            return limited ? Refused(ChatRewordRules.Limit, ChatRewordRules.LimitLine) : Refused(ChatRewordRules.Unavailable, ChatRewordRules.UnavailableLine);
        }
        var clean = ChatRewordRules.Clean(text, draft);
        await RecordAsync("chat.reword", mode + (clean is null ? ":none" : ":ok"), ct);
        return clean is null ? Refused(ChatRewordRules.NoSuggestion, none) : new(clean, null, "Here's a suggestion. You can use it, change it or ignore it.");
    }

    /// <summary>
    /// Up to three openers. The scripted set is the default and needs no model; <c>More</c> asks the model for a different set and falls back to the next scripted set when it cannot. 403 <c>supervised</c>.
    /// Never anything about the other person, and never a link, phone number, plan, price or time.
    /// </summary>
    public async Task<ChatIcebreakersDto> IcebreakersAsync(UserRecord actor, ChatIcebreakersBody? body, CancellationToken ct)
    {
        if (actor.IsSupervised) throw ApiException.Forbidden("supervised");
        var seed = (int)(actor.Id % 1000) + DateTime.UtcNow.DayOfYear + (body?.More == true ? 1 : 0);
        if (body?.More == true && On && model.Available && options.Value.Switches.Model)
        {
            try
            {
                var lines = ChatRewordRules.ParseOpeners(TextOf(await Meter(actor).CallAsync(ChatRewordRules.IcebreakerSystem, StanleyService.NoTools, One(ChatRewordRules.IcebreakerUserTurn), ModelTier.Small, ct)));
                await RecordAsync("chat.icebreakers", lines.Count == 0 ? "more:none" : "more:ok", ct);
                if (lines.Count > 0) return new(lines, true);
            }
            catch (ConciergeModelException e) { await RecordAsync("chat.icebreakers", e.Code == "limit" ? "more:limit" : "more:failed", ct); }
        }
        else await RecordAsync("chat.icebreakers", "scripted", ct);
        return new(ChatRewordRules.ScriptedOpeners(seed), On && model.Available);
    }
}
