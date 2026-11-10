using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Guest-made chat groups (docs/chat-plan.md, phase 5): make one from connected people, invite, answer an invitation, rename, remove, leave. Any signed-in guest; a child's invitations go through their guardian.</summary>
public static class ChatGroupEndpoints
{
    public static void MapChatGroupEndpoints(this IEndpointRouteBuilder api)
    {
        var chat = api.MapGroup("/me/chat").WithTags("Chat groups");

        chat.MapPost("/groups", async (ChatGroupCreateBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.CreateAsync(await me.LoadAsync(ct), body, ct)))
            .WithSummary("Makes a group from 2 to 24 people the caller is connected with, and invites each. The caller is the creator. 400 name|blocked|tooFew|tooMany|notConnected|noGuardian, 403 supervised (a child cannot make a group). Returns the group; its id is the conversation id.");

        chat.MapGet("/groups/{id:guid}", async (Guid id, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.GetAsync(await me.LoadAsync(ct), id, ct)))
            .WithSummary("The group's members and its limit; the creator also sees the invitations still waiting. 404 unless the caller is an active member.");

        chat.MapPut("/groups/{id:guid}", async (Guid id, ChatGroupRenameBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.RenameAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Renames the group (creator only) and adds a line to the thread. 400 name|blocked, 403 creator.");

        chat.MapPost("/groups/{id:guid}/invite", async (Guid id, ChatGroupInviteBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.InviteAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Invites more connected people (creator only). People already in the group or already invited are skipped. 400 person|notConnected|noGuardian, 403 creator, 409 full (25 people, counting waiting invitations).");

        chat.MapPost("/groups/{id:guid}/remove", async (Guid id, ChatGroupRemoveBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => { await svc.RemoveAsync(await me.LoadAsync(ct), id, body, ct); return Results.NoContent(); })
            .WithSummary("Removes a member (creator only, never themself) and adds a line to the thread. 400 self, 403 creator, 404 person.");

        chat.MapPut("/groups/{id:guid}/admins/{personId:guid}", async (Guid id, Guid personId, ChatGroupAdminBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.SetAdminAsync(await me.LoadAsync(ct), id, personId, body, ct)))
            .WithSummary("Names or releases the group's second admin (creator only; the creator is always an admin, and a supervised child is never made one). An admin can pin, close a poll early and post in an announcement-only group. 400 self|child|person, 403 creator, 409 adminsFull.");

        chat.MapPut("/groups/{id:guid}/announcement-only", async (Guid id, ChatGroupAnnouncementBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.SetAnnouncementOnlyAsync(await me.LoadAsync(ct), id, body, ct)))
            .WithSummary("Makes the group announcement-only (only admins post; votes, answers and reactions stay open to everyone) or open again. Creator or the second admin. 403 admin.");

        chat.MapPost("/groups/{id:guid}/leave", async (Guid id, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => { await svc.LeaveAsync(await me.LoadAsync(ct), id, ct); return Results.NoContent(); })
            .WithSummary("The caller leaves the group. They read nothing said after, and the rest see a line in the thread. When the creator leaves, the person who has been in longest becomes the creator.");

        chat.MapGet("/group-invites", async (ICurrentUser me, ChatGroupService svc, CancellationToken ct) => Results.Ok(await svc.InvitesAsync(await me.LoadAsync(ct), ct)))
            .WithSummary("Group invitations waiting for the caller (incoming), and for a child the caller is guardian of (approval). Each shows the group name and the inviter's short name, never who else is in it.");

        chat.MapPost("/group-invites/{id:guid}/respond", async (Guid id, ChatGroupRespondBody body, ICurrentUser me, ChatGroupService svc, CancellationToken ct) => { await svc.RespondAsync(await me.LoadAsync(ct), id, body, ct); return Results.NoContent(); })
            .WithSummary("Accepts or declines an invitation (a guardian answers for a child; their yes is the acceptance). A decline is quiet: nobody is told. 409 answered|expired|full, 404 for anyone else.");
    }
}
