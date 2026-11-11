using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Stanley on tap in a thread (docs/chat-features-research.md, phase 10). Private to the asker; nothing here posts to a conversation.</summary>
public static class ChatStanleyEndpoints
{
    public static void MapChatStanleyEndpoints(this IEndpointRouteBuilder api)
    {
        var chat = api.MapGroup("/me/chat").WithTags("Chat Stanley");

        chat.MapGet("/stanley", async (ICurrentUser me, ChatHelpService svc, CancellationToken ct) => Results.Ok(svc.Status(await me.LoadAsync(ct))))
            .WithSummary("Whether Stanley's friendly chat help is on for the caller (never for a supervised child), and the lines the request screens show.");

        chat.MapPost("/stanley/reword", async (ChatRewordBody body, ICurrentUser me, ChatHelpService svc, CancellationToken ct) => Results.Ok(await svc.RewordAsync(await me.LoadAsync(ct), body, ct)))
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithSummary("One suggestion for a draft (`mode`: reword, friendlier or shorter), on the small model, only on the guest's tap. The draft is not stored or logged and nothing is sent. 200 with a `suggestion` or a `reason` (unavailable, limit, safety, none) and Stanley's `message`; 400 mode|empty; 403 supervised.");

        chat.MapPost("/stanley/icebreakers", async (ChatIcebreakersBody body, ICurrentUser me, ChatHelpService svc, CancellationToken ct) => Results.Ok(await svc.IcebreakersAsync(await me.LoadAsync(ct), body, ct)))
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithSummary("Up to three short openers. Scripted unless `more` is true, which may use the small model. 403 supervised.");

        chat.MapGet("/conversations/{id:guid}/stanley", async (Guid id, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => Results.Ok(await svc.TapAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Whether Stanley's help (catch me up, make a plan, plain words) is on in the conversation, why not (`kind`: his own chat, a channel or a room; `child`: a supervised child is a member; `off`: the creator turned it off), and whether the caller may switch it. 404 not a member.");

        chat.MapPut("/conversations/{id:guid}/stanley", async (Guid id, ChatStanleyOffBody body, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => Results.Ok(await svc.SetOffAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("The guest who made a group turns Stanley's help off or on for it. 403 notCreator; 400 off; 404 not a member.");

        chat.MapPut("/conversations/{id:guid}/stanley/mute", async (Guid id, ChatStanleyMuteBody body, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => Results.Ok(await svc.SetMutedAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("The caller hides Stanley's answers in this conversation for themselves, or shows them again. No notice is sent to anyone. 400 muted; 403 kind (his own chat, a channel or room); 404 not a member.");

        chat.MapPost("/conversations/{id:guid}/stanley/catch-up", async (Guid id, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => Results.Ok(await svc.CatchUpAsync(await me.LoadAsync(ct), id, ct)))
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithSummary("A private summary of what the caller may read here (the last 60 messages or the last day, whichever is smaller): what looks decided, what looks open, the latest lines. Built by quoting, never stored in the thread, never shown to anyone else. 403 kind|child|off; 404; 409 tooShort; 429 catchUpLimit (3 an hour).");

        chat.MapPost("/conversations/{id:guid}/stanley/plan", async (Guid id, ChatPlanBody body, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => Results.Ok(await svc.MakePlanAsync(await me.LoadAsync(ct), id, body, ct)))
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithSummary("A poll preview made from one message (and the one before it when it is too short): a question and two to five options, never a price. Nothing is posted; the app posts it through the ordinary poll route when the caller agrees. 400 notMessage|noPlan; 403 kind|child|off; 404.");

        chat.MapPost("/conversations/{id:guid}/stanley/words", async (Guid id, ChatPlanBody body, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => Results.Ok(await svc.ExplainAsync(await me.LoadAsync(ct), id, body, ct)))
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithSummary("The cruise words in one message that the library knows, in plain words (no model). 400 notMessage; 403 kind|child|off; 404.");

        chat.MapPost("/stanley/draft", async (ChatDraftBody body, ICurrentUser me, ChatStanleyService svc, CancellationToken ct) => { await me.LoadAsync(ct); return Results.Ok(await svc.DraftAsync(body)); })
            .RequireRateLimiting(ChatConnectionEndpoints.SearchLimiter)
            .WithSummary("A short message to edit before sending: `late` (5 to 180 minutes, a place) or `meet` (a place, optionally a time). Nothing is sent. 400 draft.");
    }
}
