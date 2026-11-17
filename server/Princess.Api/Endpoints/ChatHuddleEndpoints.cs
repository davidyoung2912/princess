using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>The trip huddle (docs/chat-features-research.md, phase 15): a private chat around a shortlist, before booking. Any signed-in adult; the thread itself uses the ordinary conversation routes.</summary>
public static class ChatHuddleEndpoints
{
    public static void MapChatHuddleEndpoints(this IEndpointRouteBuilder api)
    {
        var h = api.MapGroup("/me/chat/huddles").WithTags("Chat huddles");

        h.MapPost("", async (ChatHuddleStartBody body, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.StartAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Starts a huddle (no booking needed). 400 name|blocked; 403 supervised, underage, needAge (the caller is not an adult), openAlready (one open at a time) or tooMany (three in all).");

        h.MapGet("/{id:guid}", async (Guid id, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("The huddle's members (first name and last initial), shortlist, seats left and when it is deleted if nobody speaks (60 days; `warn` from day 50). The creator also sees when the live link ends. 404 unless the caller is an active member.");

        h.MapPost("/{id:guid}/link", async (Guid id, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.MakeLinkAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Makes an invite link for the creator to share themselves (the app never contacts anyone), replacing any live one, so this is also refresh. The token is shown once and is kept only as a hash; it lasts 7 days; 10 a day. 403 creator, 429 limit.");

        h.MapDelete("/{id:guid}/link", async (Guid id, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => { await svc.RevokeLinkAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Revokes the live link now (creator only). 403 creator.");

        h.MapPost("/preview", async (ChatHuddleTokenBody body, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.PreviewAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("For a signed-in person with a link: who is in (first name and last initial) and the seats left, and nothing else. 404 invalidLink, the same answer for a wrong, an expired and a revoked link.");

        h.MapPost("/join", async (ChatHuddleTokenBody body, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.JoinAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Joins with a link and the caller's statement that they are 18 or over (`adultConfirmed`). They read only what is said from then on. 404 invalidLink; 403 supervised, underage, needAge, alreadyIn, full or tooMany.");

        h.MapPost("/{id:guid}/leave", async (Guid id, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => { await svc.LeaveAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("The caller leaves at once. They read nothing said after, and the rest see a line in the thread.");

        h.MapPut("/{id:guid}/carry", async (Guid id, ChatHuddleCarryBody body, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.SetCarryAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("The caller's own OK, or taking it back, to carry the huddle's history into the party chat. Off until they say so. 404.");

        h.MapPost("/{id:guid}/convert", async (Guid id, ChatHuddleConvertBody body, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.ConvertAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("\"Make this the party chat\", by the booker for their own confirmed booking. Members on the booking join its party chat; the others stay and the huddle becomes an ordinary group (deleted when no one is left outside the booking). The history is copied only if every member going to the party chat said OK, only text from those members and only from when the last of them joined. 404 noBooking.");

        h.MapPost("/{id:guid}/shortlist", async (Guid id, ChatHuddleCardBody body, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.AddCardAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Adds a public card (sailing, cabinType, port or costBreakdown) with its \"as of\" time. 400 card (an unknown kind, no title or time, or a field about a person's own money or a booking, cabin or document number) or blocked; 409 full (12 cards).");

        h.MapDelete("/{id:guid}/shortlist/{cardId:guid}", async (Guid id, Guid cardId, ICurrentUser me, ChatHuddleService svc, CancellationToken ct) => Results.Ok(await svc.RemoveCardAsync(await me.LoadAsync(ct), id, cardId, ct)))
            .WithSummary("Removes a card the caller added (the creator may remove any). 404.");
    }
}
