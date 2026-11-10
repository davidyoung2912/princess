using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Chat connections (docs/chat-plan.md, phase 1): find a guest on the sailing by name, ask to chat, answer, withdraw and end. Any signed-in guest; a child's requests go through their guardian.</summary>
public static class ChatConnectionEndpoints
{
    public const string SearchLimiter = "chat-search";

    public static void MapChatConnectionEndpoints(this IEndpointRouteBuilder api)
    {
        var chat = api.MapGroup("/me/chat").WithTags("Chat connections");

        chat.MapGet("/people", async (string? query, ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.SearchAsync(await me.LoadAsync(ct), query, ct)))
            .RequireRateLimiting(SearchLimiter)
            .WithSummary("Finds guests on the caller's sailing by name (3 to 40 letters). Each result is a first name and last initial, and how they relate to the caller (none, asked, waiting, approval, connected). Nobody who blocked the caller or turned off being found. 400 query. Rate-limited per person.");

        chat.MapGet("/connections", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The caller's chat targets (connected), requests waiting for them (incoming), requests they sent (outgoing), declines they have not seen (answers) and a child's requests waiting for their approval (approvals). Requests past their time are closed first.");

        chat.MapGet("/summary", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.SummaryAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The numbers for a chat badge: requests waiting, approvals waiting, answers not yet seen, new connections, and unread messages (0 until messages are per conversation).");

        chat.MapPost("/requests", async (ChatRequestBody body, ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.RequestAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Asks a guest to chat. The other person is told at once. A child's request goes to their guardian first, and a request to a child to theirs. If the person already asked the caller this accepts it. 400 person, self or noGuardian; 404 person (not found on the sailing); 409 connected, alreadyAsked, cooldown (declined within 7 days), tooManyOpen or tooMany.");

        chat.MapPost("/requests/{id:guid}/respond", async (Guid id, ChatRespondBody body, ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.RespondAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Accepts or declines a request waiting for the caller (or for their child, as guardian). A yes from a sender's guardian passes the request on rather than agreeing it. With `block` a no also hides each from the other. The sender is told. 404 for a request that is not theirs; 409 answered or expired.");

        chat.MapPost("/requests/{id:guid}/cancel", async (Guid id, ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => { await svc.CancelAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Withdraws a request that is still waiting. 404 for one that is not the caller's; 409 answered.");

        chat.MapPost("/connections/{id:guid}/end", async (Guid id, ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => { await svc.EndAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Either person stops chatting with the other. The other is not told who ended it. 404; 409 notConnected.");

        chat.MapPost("/connections/seen", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => { await svc.SeenAsync(await me.LoadAsync(ct), ct); return Results.NoContent(); })
            .WithSummary("The caller has seen the answers to their requests (clears the answers and new-connection counts).");
    }
}
