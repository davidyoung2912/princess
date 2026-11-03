using Princess.Api.Auth;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Stanley, the cruise chat helper (docs/stanley-plan.md). The model key never leaves the server.</summary>
public static class StanleyEndpoints
{
    public static void MapStanleyEndpoints(this IEndpointRouteBuilder api) =>
        api.MapPost("/me/stanley", async (StanleyRequestDto body, ICurrentUser me, StanleyService svc, CancellationToken ct) =>
                Results.Ok(await svc.AskAsync(await me.LoadAsync(ct), body, ct)))
            .WithTags("Stanley")
            .WithSummary("Asks Stanley, the cruise chat helper. Send the thread so far (oldest first, ending with the guest's message, at most 60 messages, the guest's message at most 500 characters; only the latest 10 clean round trips are used). " +
                "Answers { kind, text, handoff, source, fallback }: blocked (a listed word; no model was called), handoff (emergency, medical, legal or person; no model was called), offtopic (not about cruising), " +
                "unavailable (fallback limit, auth, rate, network or bad) or answer (source claude, or scripted when no model is set up). Text is set only for an answer; the front end words the rest. " +
                "The server adds PII-free facts about the guest's own trip (sailing, ports and times, cabin category, party size and ages, dinners and tours booked, package names) to the instructions; the client never sends them. Shares the concierge's 20 model questions an hour per person. 400 badStanley for a thread it cannot answer.");
}
