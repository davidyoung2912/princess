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

        chat.MapGet("/eligibility", async (ICurrentUser me, ChatKeepService svc, CancellationToken ct) => Results.Ok(await svc.EligibilityAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("What chat the caller may use now, decided from their journey stage and bookings: the permanent Stanley chat (always), the travel party chat and asking other guests to chat (from a confirmed booking), and whether a chat can be kept. `reason` is beforeBooking when only Stanley is on. Only governs starting new chats; chats already there stay readable.");

        chat.MapGet("/keeps", async (ICurrentUser me, ChatKeepService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Whether each of the caller's conversations is kept past the standard 30 days (every member agreed), who has agreed, and the dates the messages go. A conversation that cannot be kept is left out.");

        chat.MapGet("/conversations/{id:guid}/keep", async (Guid id, ICurrentUser me, ChatKeepService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Whether one conversation is kept: whether the caller agreed, how many of the people have, who has not, the date the messages go by default and the date they go if kept (12 months after the cruise). 404 not a member.");

        chat.MapPut("/conversations/{id:guid}/keep", async (Guid id, ChatKeepBody body, ICurrentUser me, ChatKeepService svc, CancellationToken ct) => Results.Ok(await svc.SetAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Agrees to keep a conversation (on) or takes the agreement back. It is kept only when every person in it has agreed; a supervised child cannot, their guardian does. 403 guardian|stanley; 404 not a member; 409 closed|noTrip|tooLate. Returns the new state.");

        chat.MapGet("/connections", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The caller's chat targets (connected), requests waiting for them (incoming), requests they sent (outgoing), declines they have not seen (answers) and a child's requests waiting for their approval (approvals). Requests past their time are closed first.");

        chat.MapGet("/summary", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.SummaryAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The numbers for a chat badge: requests waiting, approvals waiting, answers not yet seen, new connections, and unread messages (0 until messages are per conversation).");

        chat.MapGet("/settings", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.SettingsAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The caller's chat choices: whether other guests can find them by name (on unless turned off), and whether a notice may show message text (off unless turned on).");

        chat.MapPut("/settings", async (ChatSettingsDto body, ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.SetSettingsAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Saves the caller's chat choices and returns them.");

        chat.MapGet("/sms", async (ICurrentUser me, ChatSmsService svc, CancellationToken ct) => Results.Ok(await svc.SettingsAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The text bridge for when the caller is ashore: on, whether idle time also counts as ashore, and whether it can be turned on (available, with a reason: supervised, noPhone, unverified or off).");

        chat.MapPut("/sms", async (ChatSmsSettingsBody body, ICurrentUser me, ChatSmsService svc, CancellationToken ct) => Results.Ok(await svc.SetSettingsAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Turns the text bridge on or off. Turning it on needs a verified phone number and sends one text that explains it. 400 supervised|noPhone|unverified|off (403 supervised for a child). Returns the new state.");

        chat.MapPost("/hide", async (ICurrentUser me, ChatConnectionService svc, CancellationToken ct) => Results.Ok(await svc.HideAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Hide me: turns off being found by name, ends every chat with the caller and withdraws every waiting request, in one step. Nobody is told who ended it. Turning being found back on does not restore chats. Returns the new settings.");

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
