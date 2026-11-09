using Princess.Api.Auth;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Stanley, the one conversational surface (docs/stanley-gap-analysis-and-plan.md, phase 1). The model key never leaves the server.</summary>
public static class StanleyEndpoints
{
    public static void MapStanleyEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/me/stanley", async (StanleyRequestDto body, ICurrentUser me, StanleyService svc, CancellationToken ct) =>
                Results.Ok(await svc.AskAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Stanley")
            .WithSummary("Asks Stanley, the cruise chat helper and the app's only conversational surface. Send the thread so far (oldest first, ending with the guest's message, at most 60 messages, the guest's message at most 500 characters; only the latest 10 clean round trips are used), " +
                "optionally the context packet { stage (one of the eleven journey stages), screen, sailingId, level } and the device's mobility (any, easy, wheelchair) and up to five tour likes. " +
                "Answers { kind, text, handoff, source, fallback, tier, blocks[{ type, text }], sources[{ label, path }], degraded[] }: blocked (a listed word; no model was called), handoff (emergency, medical, legal or person; no model was called), offtopic (not about cruising), " +
                "unavailable (fallback limit, auth, rate, network, bad or off) or answer (source claude, or scripted when no model can be used; fallback says why when it was meant to be a model). " +
                "tier says which route handled it: blocked, handoff, offtopic, unavailable, trip (the guest's own booking, plan and bill, with the tools), before (facts for someone still choosing, with the tools) or model (open chat). " +
                "Text is set only for an answer; the front end words the rest. The server picks the route and the model (small for the prescan, default for answers, large only to plan a day, week or itinerary), " +
                "adds PII-free facts about the guest's own trip to the instructions, caps model calls per request (3 for chat, 5 for planning) and per guest per day (60), and writes one tier log row per reply with no message text. " +
                "degraded lists any route an operator has switched off. 400 badStanley for a thread it cannot answer.");

        api.MapGet("/me/stanley/status", (ICurrentUser me, StanleyService svc) => Results.Ok(svc.Status()))
            .WithTags("Stanley")
            .WithSummary("Which Stanley routes are switched off: { library, actions, degraded[] }. The device honours library (its authored answers) and actions (previews and confirms) itself; the other routes are applied on the server.");

        api.MapGet("/me/stanley/tiers", async (ICurrentUser me, IStanleyTierLog tiers, IClock clock, int? days, CancellationToken ct) =>
            {
                var user = await me.LoadAsync(ct);
                if (user.Role != "admin") throw ApiException.Forbidden();
                return Results.Ok(await tiers.SummaryAsync(clock.UtcNow.AddDays(-Math.Clamp(days ?? 7, 1, 90)), ct));
            })
            .WithTags("Stanley")
            .WithSummary("Administrators only (403 otherwise): Stanley's replies over the last days (default 7, 1 to 90), counted by tier, source, stage, topic, outcome and model tier, with model calls and tokens. Counts only: no message text and no guest.");
    }
}
