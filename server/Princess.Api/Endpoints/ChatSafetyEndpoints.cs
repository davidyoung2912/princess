using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Domain;
using Princess.Api.Data;
using Princess.Api.Services;

namespace Princess.Api.Endpoints;

/// <summary>Guardians reading a supervised child's chats, and staff reviewing reports (docs/chat-plan.md, phase 7). Every read of someone else's conversation is audited.</summary>
public static class ChatSafetyEndpoints
{
    public static void MapChatSafetyEndpoints(this IEndpointRouteBuilder api)
    {
        var chat = api.MapGroup("/me/chat/children").WithTags("Chat safety");

        chat.MapGet("", async (ICurrentUser me, ChatSafetyService svc, CancellationToken ct) => Results.Ok(await svc.ChildrenAsync(await GuardianAsync(me, ct), ct)))
            .WithSummary("The supervised children the caller is the booker of (id and first name). No conversation is read. A child gets an empty list; a booker acting as a child is refused (403).");

        chat.MapGet("/{childId:guid}/conversations", async (Guid childId, ICurrentUser me, ChatSafetyService svc, CancellationToken ct) => Results.Ok(await svc.ChildConversationsAsync(await GuardianAsync(me, ct), childId, ct)))
            .WithSummary("The child's conversations with members and last line, as the child sees them. Read only, and audited. 404 when the caller is not the child's booker.");

        chat.MapGet("/{childId:guid}/conversations/{id:guid}/messages", async (Guid childId, Guid id, Guid? before, int? limit, ICurrentUser me, ChatSafetyService svc, CancellationToken ct) =>
                Results.Ok(await svc.ChildThreadAsync(await GuardianAsync(me, ct), childId, id, before, limit, ct)))
            .WithSummary("A page of the child's conversation as the child sees it, read only: nothing is marked read and nothing can be sent. Audited. 404 when the caller is not the child's booker or the child is not in it.");

        var admin = api.MapGroup("/admin/chat/reports").WithTags("Chat safety");

        admin.MapGet("", async (string? status, ICurrentUser me, ChatSafetyService svc, CancellationToken ct) => Results.Ok(await svc.ReportsAsync(await AdminAsync(me, ct), status, ct)))
            .WithSummary("Administrators only (403 otherwise): chat reports, oldest first. `status` is open (the default), dismissed or removed. No message text and no names.");

        admin.MapGet("/{id:guid}", async (Guid id, ICurrentUser me, ChatSafetyService svc, CancellationToken ct) => Results.Ok(await svc.CaseAsync(await AdminAsync(me, ct), id, ct)))
            .WithSummary("Administrators only: the reported message and up to three lines either side of it, with first name and last initial. Photos are flagged, never sent. The read is audited. 404.");

        admin.MapPost("/{id:guid}/resolve", async (Guid id, ChatResolveBody body, ICurrentUser me, ChatSafetyService svc, CancellationToken ct) =>
            {
                await svc.ResolveAsync(await AdminAsync(me, ct), id, body, ct);
                return Results.NoContent();
            })
            .WithSummary("Administrators only: `dismiss` closes the report; `remove` also replaces the message for everyone (and closes every other report on it). Audited. 400 decision, 404, 409 resolved.");
    }

    // A booker viewing as a child is acting as the child, never as the child's guardian or staff.
    private static async Task<UserRecord> GuardianAsync(ICurrentUser me, CancellationToken ct)
    {
        if (me.ActorPublicId is not null) throw ApiException.Forbidden();
        return await me.LoadAsync(ct);
    }

    private static async Task<UserRecord> AdminAsync(ICurrentUser me, CancellationToken ct)
    {
        var user = await GuardianAsync(me, ct);
        if (user.Role != "admin") throw ApiException.Forbidden();
        return user;
    }
}
