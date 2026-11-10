using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// The Stanley gateway (docs/stanley-gap-analysis-and-plan.md, phase 1): the one server door for every conversational question, so policy, routing, budget, logging
/// and kill switches live in one place. One turn, in this order: the word filter and the safety screen (neither ever reaches a model), the muster question (a fixed answer, no model), the router
/// (<see cref="StanleyRouter"/>: trip, before or open; first the resolvers, <see cref="StanleyResolvers"/>, answer what they can with a card and no model), the switches, then the answer from the tools or the open model, within the call caps and the guest's daily ceiling.
/// When a model cannot be used (none set up, a switch, a cap, a failure) the scripted answers reply and say why. Every reply writes one tier log row with counts and
/// tokens, never message text. Stanley's account knowledge is the PII-free trip facts the server builds (<see cref="StanleyTrip"/>) and, on the tool routes, the
/// tools over the guest's own booking. Message text is never logged.
/// </summary>
public sealed class StanleyService(IConciergeModel model, IConciergeLimiter limiter, IClock clock, IStanleyTrips trips, IStanleyTools tools, IStanleyTierLog tierLog,
    IOptions<StanleyOptions> options, ILogger<StanleyService> log, IStanleyPackets? packets = null, StanleyActionService? actions = null, StanleyMemoryService? memory = null, StanleyChangeService? changes = null, StanleyMoneyService? money = null)
{
    public const string NoTools = "[]";

    private async Task<StanleyCardDto?> MoneyCardAsync(UserRecord user, string message, string? sailingId, CancellationToken ct)
    {
        try { return await money!.ChatAsync(user, message, sailingId, ct); }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            if (StanleyMoneyRules.Classify(message) is null) return null;
            log.LogWarning(e, "Stanley could not read the guest's account for a money question");
            return StanleyMoneyRules.UnreadCard(clock.UtcNow);
        }
    }

    public async Task<StanleyReplyDto> AskAsync(UserRecord user, StanleyRequestDto request, CancellationToken ct)
    {
        var o = options.Value;
        var turns = StanleyRules.Usable(request.History) ?? throw ApiException.Invalid("badStanley");
        var context = StanleyRouter.Clean(request.Context);
        var off = o.Switches.Off();

        async Task<StanleyReplyDto> End(StanleyReplyDto reply, string topicName, string outcome, ModelMeter? used = null)
        {
            reply = reply with { Degraded = off };
            try
            {
                await tierLog.RecordAsync(new StanleyTierEntry
                {
                    At = clock.UtcNow, Tier = reply.Tier, Source = reply.Source, Stage = context.Stage, Topic = topicName, Outcome = outcome,
                    ModelTier = used?.Highest?.ToString().ToLowerInvariant() ?? "", Calls = used?.Calls ?? 0, InputTokens = used?.InputTokens ?? 0, OutputTokens = used?.OutputTokens ?? 0,
                }, ct);
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "Stanley tier log failed"); }
            return reply;
        }

        if (ProfanityFilter.IsBlocked(turns.Message)) return await End(new StanleyReplyDto("blocked", "", null, "", null, "blocked"), "safety", "blocked");
        if (ConciergeRules.Screen(turns.Message) is { } handoff) return await End(new StanleyReplyDto("handoff", "", handoff, "", null, "handoff"), "safety", "handoff");

        // The active voyage: the one the device named, or the only one. With two possible and none named, Stanley asks and never picks (phase 4).
        var packet = packets is null ? null : await packets.BuildAsync(user, context, ct);
        var trip = await trips.LoadAsync(user, packet?.Choice.Chosen?.SailingId, ct);
        if (packet is { Choice.MustAsk: true } && (StanleyResolvers.Takes(turns.Message) || StanleyRouter.Route(turns.Message, context.Stage, true).Route == StanleyRoute.Trip))
            return await End(WhichTrip(packet.Choice.Options), "whichTrip", "asked");
        if (packet is { Choice.MustAsk: true }) trip = null;
        if (StanleyRules.IsMuster(turns.Message))
            return await End(Answer(StanleyRules.MusterAnswer, "scripted", trip is null ? "before" : "trip", null, [new CitationDto("Muster", "/ship/muster")]), "safety", "ok");
        // Things Stanley never does (pay, cancel a booking, change a cabin, share data) are refused here, with where the guest can do them, whatever else is switched on.
        if (StanleyIntents.Refusal(turns.Message) is { } refused)
        {
            var (words, label, path) = StanleyIntents.RefusalText(refused);
            return await End(Answer(words, "scripted", "action", null, [new CitationDto(label, path)]), "action", "refused");
        }
        // Actions (phase 5): a request to change something becomes a typed intent and a stored preview. Nothing is done here: the guest confirms the preview, and only then does the server act.
        var actionCtx = (request.ActionContext ?? new StanleyActionContext()).Clean(packet?.Choice.Chosen?.SailingId ?? context.SailingId);
        var mayAct = o.Switches.Actions && actions is not null && trip is not null;
        if (mayAct && StanleyIntents.Parse(turns.Message, actionCtx) is { } parsed)
        {
            if (parsed.Intent is null) return await End(Answer(parsed.Clarify!, "scripted", "action", null, null), "action", "asked");
            try
            {
                var preview = await actions!.PrepareAsync(user, parsed.Intent, actionCtx, ct);
                return await End(new StanleyReplyDto("answer", StanleyActionText.Ready, null, "scripted", null, "action", [new StanleyBlockDto("text", StanleyActionText.Ready)], [], null, null, preview), "action", "prepared");
            }
            catch (ApiException e)
            {
                return await End(Answer(StanleyActionText.Problem(e.Title), "scripted", "action", null, null), "action", "refused");
            }
        }
        // Money questions (phase 12: is it included for me, my bill, my spending pace, Captain's Circle) are answered by the money rules from the services, as a card. No model is called and no model can change a figure;
        // if the account cannot be read the card says so, and the question does not go on to a model that could make a figure up.
        if (money is not null && o.Switches.Resolver && o.Switches.Money && await MoneyCardAsync(user, turns.Message, packet?.Choice.Chosen?.SailingId ?? context.SailingId, ct) is { } moneyCard)
            return await End(new StanleyReplyDto("answer", moneyCard.Text, null, "scripted", null, "resolver", [new StanleyBlockDto("text", moneyCard.Text)], moneyCard.Links ?? [], null, moneyCard), moneyCard.Id, moneyCard.Abstained ? "abstained" : "ok");
        // Tier 0: the questions about the guest's own trip that need no model. Each answer is a card with its provenance; with the switch off the question moves on to the tools and the model.
        if (trip is not null && o.Switches.Resolver)
        {
            // "What changed" and "explain this change" are answered from the change engine (phase 11), the same cards as Home, with each change's source and how sure it is.
            var useChanges = o.Switches.Changes && changes is not null;
            var explain = useChanges && StanleyChangeRules.IsExplainQuestion(turns.Message);
            var resolved = explain ? null : StanleyResolvers.Resolve(turns.Message, trip, trip.AsOf ?? clock.UtcNow);
            if (useChanges && (explain || resolved?.Id == "changed"))
                resolved = await changes!.ChatAsync(user, packet?.Choice.Chosen?.SailingId ?? context.SailingId, explain, ct) ?? resolved;
            if (resolved is { } card)
                return await End(new StanleyReplyDto("answer", card.Text, null, "scripted", null, "resolver", [new StanleyBlockDto("text", card.Text)], card.Links ?? [], null, card), card.Id, card.Abstained ? "abstained" : "ok");
        }
        // Entry, visa, immigration and customs rules are never answered by Stanley or a model (phase 10): the guest gets the official sources for each country on the sailing.
        if (StanleyTravelRules.IsEntryQuestion(turns.Message))
        {
            var entry = StanleyTravelRules.Entry(trip?.Timeline ?? Timeline.Legacy(DateOnly.FromDateTime(clock.UtcNow)));
            return await End(Answer(StanleyTravelRules.EntryAnswer(entry), "scripted", "entry", null, [new CitationDto("Customs", "/home/disembark/customs")]), "entry", "ok");
        }
        var routing = StanleyRouter.Route(turns.Message, context.Stage, trip is not null);
        var modelUsable = model.Available && o.Switches.Model;
        var meter = new ModelMeter(model, c => limiter.TryTakeAsync(user.Id, clock.UtcNow, o.DailyCeiling, TimeSpan.FromDays(1), c), routing.Planning ? o.PlanningCalls : o.ChatCalls);

        if (routing.Route != StanleyRoute.Open)
        {
            var tier = routing.Route == StanleyRoute.Trip ? "trip" : "before";
            var ctx = await tools.ContextAsync(user, request.Mobility, request.Likes, packet?.Choice.Chosen?.SailingId, ct);
            if (packet?.Data is null && memory is not null) ctx = ctx with { Preferences = await memory.ForAnswersAsync(user, null, ct) };
            string? fallback = null;
            if (o.Switches.Tools && modelUsable)
            {
                try
                {
                    // The model may ask for a preview of one change; it never changes anything itself.
                    var hook = mayAct && !user.IsSupervised ? new StanleyActionHook(i => actions!.PrepareAsync(user, i, actionCtx, ct), actionCtx) : null;
                    var answered = await tools.AskModelAsync(turns.Messages, ctx, meter, routing.Planning ? ModelTier.Large : ModelTier.Default, packet?.Data, hook, ct);
                    var reply = Answer(answered.Text, "claude", tier, null, answered.Citations);
                    if (hook?.Prepared is { } prepared) reply = reply with { Tier = "action", Action = prepared };
                    return await End(reply, hook?.Prepared is null ? routing.Topic : "action", hook?.Prepared is null ? "ok" : "prepared", meter);
                }
                catch (ConciergeModelException e)
                {
                    log.LogWarning("Stanley model failed on the {Tier} route: {Code}", tier, e.Code);
                    fallback = e.Code;
                }
            }
            if (!o.Switches.Resolver) return await End(Unavailable("off"), routing.Topic, "off", meter);
            var scripted = StanleyToolService.Scripted(turns.Message, ctx, fallback);
            return await End(Answer(scripted.Text, "scripted", tier, fallback, scripted.Citations), routing.Topic, fallback ?? "ok", meter);
        }

        if (!modelUsable)
        {
            if (!o.Switches.Resolver) return await End(Unavailable("off"), routing.Topic, "off");
            return StanleyRules.LooksOnTopic(turns.Message)
                ? await End(Answer(StanleyRules.ScriptedAnswerFor(turns.Message, trip), "scripted", "model", null, null), routing.Topic, "ok")
                : await End(new StanleyReplyDto("offtopic", "", null, "", null, "offtopic"), routing.Topic, "offtopic");
        }

        try
        {
            var topic = await meter.CallAsync(StanleyRules.TopicSystem, NoTools, ToTurns(StanleyRules.TopicMessages(turns)), ModelTier.Small, ct);
            if (!StanleyRules.ReadTopic(TextOf(topic))) return await End(new StanleyReplyDto("offtopic", "", null, "", null, "offtopic"), routing.Topic, "offtopic", meter);

            var answer = TextOf(await meter.CallAsync(StanleyRules.AnswerSystemFor(trip), NoTools, ToTurns(turns.Messages), ModelTier.Default, ct));
            if (answer.Length == 0) throw new ConciergeModelException("bad", "An empty answer.");
            return await End(Answer(answer, "claude", "model", null, null), routing.Topic, "ok", meter);
        }
        catch (ConciergeModelException e)
        {
            log.LogWarning("Stanley model failed: {Code} ({Reason})", e.Code, e.Message);
            return await End(Unavailable(e.Code), routing.Topic, e.Code, meter);
        }
    }

    /// <summary>The trip facts the device may keep for use with no signal: <see cref="StanleyResolvers.SavedIds"/>, each with the time the booking was read. Empty when the guest has no current trip.</summary>
    public async Task<StanleyFactsDto> FactsAsync(UserRecord user, CancellationToken ct)
    {
        var trip = await trips.LoadAsync(user, ct);
        return new StanleyFactsDto(trip is null || !options.Value.Switches.Resolver ? [] : StanleyResolvers.SavedFacts(trip, trip.AsOf ?? clock.UtcNow));
    }

    private static StanleyReplyDto Answer(string text, string source, string tier, string? fallback, List<CitationDto>? sources) =>
        new("answer", text, null, source, fallback, tier, [new StanleyBlockDto("text", text)], sources ?? []);

    /// <summary>The question that comes back when two voyages are possible: a card that names them and sends the guest to My trips. It never guesses.</summary>
    private static StanleyReplyDto WhichTrip(IReadOnlyList<StanleyVoyage> options)
    {
        var lines = options.Select(v => $"{v.Ship}, leaving {v.Departure:dddd d MMMM yyyy}").ToList();
        lines.Add("Open the trip you mean on the My trips screen, then ask me again.");
        var card = new StanleyCardDto("whichTrip", "Which trip do you mean?", lines, new StanleyProvenance([StanleyChips.Booking], "Your booking", null, "live", false, "You have more than one trip, so I will not choose for you."), false, [new CitationDto("My trips", "/me/trips")]);
        return new StanleyReplyDto("answer", card.Text, null, "scripted", null, "resolver", [new StanleyBlockDto("text", card.Text)], card.Links ?? [], null, card);
    }

    private static StanleyReplyDto Unavailable(string code) => new("unavailable", "", null, "", code, "unavailable");

    /// <summary>What the device needs to know before the first question: which routes are off. The device carries out <c>library</c> and <c>actions</c> itself.</summary>
    public StanleyStatusDto Status()
    {
        var s = options.Value.Switches;
        return new StanleyStatusDto(s.Library, s.Actions, s.Handoff, s.Off());
    }

    private static JsonArray ToTurns(IEnumerable<ConciergeMessageDto> messages)
    {
        var turns = new JsonArray();
        foreach (var m in messages) turns.Add(new JsonObject { ["role"] = m.Role, ["content"] = m.Text });
        return turns;
    }

    private static string TextOf(JsonObject body) =>
        string.Concat((body["content"] as JsonArray ?? []).OfType<JsonObject>().Where(b => b["type"]?.GetValue<string>() == "text").Select(b => b["text"]?.GetValue<string>())).Trim();
}

/// <summary>Cards for the device to keep (<c>GET /me/stanley/facts</c>).</summary>
public sealed record StanleyFactsDto(List<StanleyCardDto> Cards);

/// <summary>The gateway's switches as the device reads them (<c>GET /me/stanley/status</c>).</summary>
public sealed record StanleyStatusDto(bool Library, bool Actions, bool Handoff, List<string> Degraded);
