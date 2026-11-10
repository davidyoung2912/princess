namespace Princess.Api.Realtime;

/// <summary>
/// A "something changed" nudge for an open app (docs/chat-plan.md, 4.4). It carries no message text and no names: the app refetches over REST, so a lost nudge costs nothing.
/// <paramref name="Id"/> is what the app sends back to say it got the nudge.
/// </summary>
public sealed record ChatEvent(string Id, string Kind);

/// <summary>Sends nudges to a person's open apps. The real one is <see cref="SignalRRealtimeHub"/>; tests use a fake.</summary>
public interface IRealtimeHub
{
    /// <summary>Whether this person has an app open and connected to this server.</summary>
    bool IsConnected(Guid userPublicId);

    /// <summary>
    /// Sends the nudge to every open app of the person. The result is true when one of them acknowledged it within <paramref name="wait"/>, false when none did
    /// (or none is connected, which answers false at once). Never throws for a lost connection.
    /// </summary>
    Task<bool> PublishAsync(Guid userPublicId, ChatEvent evt, TimeSpan wait, CancellationToken ct);
}
