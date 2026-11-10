using Microsoft.AspNetCore.SignalR;

namespace Princess.Api.Realtime;

/// <summary>The real <see cref="IRealtimeHub"/>: sends to the person's group on <see cref="ChatHub"/> and waits for the acknowledgement.</summary>
public sealed class SignalRRealtimeHub(IHubContext<ChatHub> hub, RealtimeState state, ILogger<SignalRRealtimeHub> log) : IRealtimeHub
{
    public bool IsConnected(Guid userPublicId) => state.IsConnected(userPublicId);

    public async Task<bool> PublishAsync(Guid userPublicId, ChatEvent evt, TimeSpan wait, CancellationToken ct)
    {
        if (!state.IsConnected(userPublicId)) return false;
        using var waiter = state.Expect(evt.Id);
        try
        {
            await hub.Clients.Group(ChatHub.GroupFor(userPublicId)).SendAsync(ChatHub.Event, evt, ct);
            return await waiter.WaitAsync(wait, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Chat nudge {Kind} could not be sent", evt.Kind);
            return false;
        }
    }
}
