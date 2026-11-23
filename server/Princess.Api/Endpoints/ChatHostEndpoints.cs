using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Stanley as host for strangers and room host (docs/chat-features-research.md, phase 12). The id in a path is the room's or group's conversation id. Staff see flags under <c>/admin/chat/host</c>.</summary>
public static class ChatHostEndpoints
{
    public static void MapChatHostEndpoints(this IEndpointRouteBuilder api)
    {
        var h = api.MapGroup("/me/chat/host").WithTags("Chat: host");

        h.MapGet("/{id:guid}/meetups", async (Guid id, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.ListMeetUpsAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("The meet-ups of a room or made group, newest first, with how many are in and how many maybe, and the caller's own answer. A decline is never counted or shown.");

        h.MapPost("/{id:guid}/meetups", async (Guid id, ChatMeetUpBody body, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.StartMeetUpAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Starts a meet-up, posted as the caller's own words through the ordinary send (so the room's rules apply). 400 text; 403 supervised; 404; 409 off|closed and the room's post refusals; 429 limit (three a day).");

        h.MapPut("/meetups/{meetUpId:guid}/answer", async (Guid meetUpId, ChatMeetUpAnswerBody body, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.AnswerMeetUpAsync(await me.LoadAsync(ct), meetUpId, body, ct)))
            .WithSummary("Answers in, maybe or no; it can be changed. 400 answer; 403 supervised; 404 unless a member.");

        h.MapGet("/{id:guid}/intro", async (Guid id, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.IntroStatusAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("Where \"introduce me\" stands for the caller in this room, and the interests to choose from.");

        h.MapPost("/{id:guid}/intro", async (Guid id, ChatIntroBody body, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.IntroOptInAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Asks to be introduced to someone in this room who chose the same interest (a fixed list; a day; two a day at most). Both must ask. 400 unknown; 403 supervised|notAdult; 404; 409 off|notRoom; 429 limit.");

        h.MapDelete("/intro", async (ICurrentUser me, ChatHostService svc, CancellationToken ct) => { await svc.WithdrawIntroAsync(await me.LoadAsync(ct), ct); return Results.NoContent(); })
            .WithSummary("Takes back every live \"introduce me\" request, now.");

        h.MapGet("/{id:guid}/welcome", async (Guid id, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.WelcomeAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("The room's welcome line, rules and the questions Stanley can answer. The line is null when room hosting is off, the caller muted Stanley, or a supervised child is present.");

        h.MapPost("/{id:guid}/ask", async (Guid id, ChatHostAskBody body, ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.AskAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("A question to Stanley in a room. Only a curated library answer is given (and posted to the room). 400 text; 404; 409 off.");

        h.MapPost("/messages/{messageId:guid}/flag", async (Guid messageId, ChatHostFlagBody body, ICurrentUser me, ChatHostService svc, CancellationToken ct) => { await svc.FlagAsync(await me.LoadAsync(ct), messageId, body, ct); return Results.NoContent(); })
            .WithSummary("Flags a post to staff (spam, unsafe, rude, other). Nothing happens to the post or the person until staff decide. 400 unknown; 403 supervised; 404; 429 limit (five a day).");

        var admin = api.MapGroup("/admin/chat/host").WithTags("Chat: host");

        admin.MapGet("/flags", async (ICurrentUser me, ChatHostService svc, CancellationToken ct) => Results.Ok(await svc.ListFlagsAsync(await AdminAsync(me, ct), ct)))
            .WithSummary("Administrators only: flags waiting, oldest first, with the room, the post's id, the reason and when. Never the words.");

        admin.MapPost("/flags/{id:guid}", async (Guid id, ICurrentUser me, ChatHostService svc, CancellationToken ct) => { await svc.DecideFlagAsync(await AdminAsync(me, ct), id, ct); return Results.NoContent(); })
            .WithSummary("Administrators only: marks a flag looked at. 404 when it is gone or already decided.");
    }

    private static async Task<UserRecord> AdminAsync(ICurrentUser me, CancellationToken ct)
    {
        if (me.ActorPublicId is not null) throw ApiException.Forbidden();
        var user = await me.LoadAsync(ct);
        if (user.Role != "admin") throw ApiException.Forbidden();
        return user;
    }
}
