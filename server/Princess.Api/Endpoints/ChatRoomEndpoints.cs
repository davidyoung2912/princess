using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>
/// Channels and rooms beyond the ship (docs/chat-features-research.md, phase 8). Guests list, preview, follow or join and leave; posting, reading, reacting and reporting use the ordinary conversation routes
/// with the id returned here. Staff (administrators) run them under <c>/admin/chat/rooms</c>. A booker acting as a child is never a guest here and never staff.
/// </summary>
public static class ChatRoomEndpoints
{
    public static void MapChatRoomEndpoints(this IEndpointRouteBuilder api)
    {
        var chat = api.MapGroup("/me/chat/rooms").WithTags("Chat rooms");

        chat.MapGet("", async (ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("The channels and rooms the caller may see: open channels, interest rooms, and the sailing rooms of sailings the caller is booked on (plus any they are already in). `blocked` says why they cannot join: off, child, closed, noBooking, full, removed.");

        chat.MapGet("/{id:guid}/preview", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.PreviewAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("The rules and what staff chose to show (pinned posts of a room, the latest staff posts of a channel). Never a guest's live post. 404 for a room that is not open to the caller.");

        chat.MapPost("/{id:guid}/join", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.JoinAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Follows a channel or joins a room, muted. The id is the conversation id. 403 child|noBooking|removed, 404, 409 off|closed|full.");

        chat.MapPost("/{id:guid}/leave", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.LeaveAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("Stops following or leaves. Nothing said after is readable; the guest can come back unless staff removed them.");

        chat.MapPost("/{id:guid}/rules", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.AcceptRulesAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("The caller accepts the room's rules (asked on the first post, and again after staff change them). 404 unless a member.");

        chat.MapPost("/{id:guid}/questions", async (Guid id, ChatRoomQuestionBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.SuggestQuestionAsync(await me.LoadAsync(ct), id, body, ct); return Results.NoContent(); })
            .WithSummary("Suggests a question for the room's popular questions (any guest who can see the room; it reaches staff only). 400 text|contactInfo|blocked, 403 child, 404, 429 tooMany (three waiting).");

        var admin = api.MapGroup("/admin/chat/rooms").WithTags("Chat rooms");

        admin.MapGet("", async (ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.ListAdminAsync(await AdminAsync(me, ct), ct)))
            .WithSummary("Administrators only: every channel and room with members, moderators, whether it is closed, slow mode and whether moderators are on duty now.");

        admin.MapPost("", async (ChatRoomCreateBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await AdminAsync(me, ct), body, ct)))
            .WithSummary("Administrators only: opens a channel (live at once) or a room (closed until its rota is named and it is opened). 400 kind|roomKind|name|topic|sailing|rules|cap.");

        admin.MapPost("/{id:guid}/action", async (Guid id, ChatRoomActionBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.ActAsync(await AdminAsync(me, ct), id, body, ct)))
            .WithSummary("Administrators only: `slow` (with `on`), `open` (a room needs two moderators: 409 rota), `close`, `rules` (with `rules`; everyone accepts again) or `moderator` / `unmoderator` (with `personId`). Audited, with no message text.");

        admin.MapPost("/{id:guid}/people/{personId:guid}", async (Guid id, Guid personId, ChatRoomPersonBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.PersonAsync(await AdminAsync(me, ct), id, personId, body, ct); return Results.NoContent(); })
            .WithSummary("Administrators only: `mute` (for hour, day or room), `unmute` or `remove` a person. 404 when they are not in the room. Audited.");

        admin.MapPost("/{id:guid}/messages/{messageId:guid}", async (Guid id, Guid messageId, ChatRoomMessageBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.MessageAsync(await AdminAsync(me, ct), id, messageId, body, ct); return Results.NoContent(); })
            .WithSummary("Administrators only: `remove` a message for everyone (the words are kept for the report case) or `pin` it (3 at most: 409 pinsFull). Audited.");

        admin.MapGet("/{id:guid}/posts", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.PostsAsync(await AdminAsync(me, ct), id, ct)))
            .WithSummary("Administrators only: the latest 50 live posts of a room, newest first, with the sender's first name and last initial, so a post can be removed or pinned. The read is audited.");

        admin.MapGet("/{id:guid}/people", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.PeopleAsync(await AdminAsync(me, ct), id, ct)))
            .WithSummary("Administrators only: the room's active members (first name and last initial) and whether staff muted each, so one can be muted, unmuted or removed. The read is audited.");

        admin.MapGet("/{id:guid}/rota", async (Guid id, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.RotaAsync(await AdminAsync(me, ct), id, ct)))
            .WithSummary("Administrators only: every administrator who could be named a moderator of the room, and whether they are.");

        admin.MapGet("/held", async (ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.HeldAsync(await AdminAsync(me, ct), ct)))
            .WithSummary("Administrators only: posts held because they carry a link or a phone number, oldest first, with the words and the sender's first name and last initial. The read is audited.");

        admin.MapPost("/held/{id:guid}", async (Guid id, ChatHeldDecisionBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.DecideHeldAsync(await AdminAsync(me, ct), id, body, ct); return Results.NoContent(); })
            .WithSummary("Administrators only: `release` posts it as the guest's, now; `reject` clears the words. 400 decision, 404, 409 decided|left.");

        admin.MapGet("/questions", async (ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.QuestionsAsync(await AdminAsync(me, ct), ct)))
            .WithSummary("Administrators only: questions guests suggested for rooms' popular questions, oldest first. No names. The read is audited.");

        admin.MapPost("/questions/{id:guid}", async (Guid id, ChatQuestionDecisionBody body, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => { await svc.DecideQuestionAsync(await AdminAsync(me, ct), id, body, ct); return Results.NoContent(); })
            .WithSummary("Administrators only: `popular` shows it in the room's preview; `reject` clears the words. 400 decision, 404, 409 decided.");

        admin.MapGet("/summary", async (int? days, ICurrentUser me, ChatRoomService svc, CancellationToken ct) => Results.Ok(await svc.SummaryAsync(await AdminAsync(me, ct), days, ct)))
            .WithSummary("Administrators only: the moderation summary for the last 1 to 31 days (default 7): reports, staff actions by kind, the busiest rooms, open rooms without their rota, and posts waiting. Counts only.");
    }

    // A booker viewing as a child is acting as the child, never as staff.
    private static async Task<UserRecord> AdminAsync(ICurrentUser me, CancellationToken ct)
    {
        if (me.ActorPublicId is not null) throw ApiException.Forbidden();
        var user = await me.LoadAsync(ct);
        if (user.Role != "admin") throw ApiException.Forbidden();
        return user;
    }
}
