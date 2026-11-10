using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Princess.Api.Auth;

namespace Princess.Api.Realtime;

/// <summary>
/// The live connection of an open app (docs/chat-plan.md, 4.4), at <c>/hubs/chat</c>. The access token comes in the <c>access_token</c> query value (a browser WebSocket cannot set headers).
/// Each person is in the group <c>user:{publicId}</c>; the server sends <c>chatChanged</c> to it, and the app answers with <see cref="Ack"/>.
/// The hub takes no other calls: a client cannot send chat text, join another group or ask about anyone.
/// </summary>
[Authorize]
public sealed class ChatHub(RealtimeState state) : Hub
{
    public const string Path = "/hubs/chat";
    public const string Event = "chatChanged";

    public static string GroupFor(Guid publicId) => $"user:{publicId:D}";

    public override async Task OnConnectedAsync()
    {
        if (UserOf(Context) is not { } id) { Context.Abort(); return; }
        state.Connected(id);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(id));
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (UserOf(Context) is { } id) state.Disconnected(id);
        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>The app got the nudge with this id, so no phone alert is needed.</summary>
    public void Ack(string eventId)
    {
        if (eventId is { Length: > 0 and <= 80 }) state.Ack(eventId);
    }

    private static Guid? UserOf(HubCallerContext c) =>
        Guid.TryParse(c.User?.FindFirst(Claims.Subject)?.Value, out var id) ? id : null;
}
