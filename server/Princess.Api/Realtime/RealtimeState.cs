using System.Collections.Concurrent;

namespace Princess.Api.Realtime;

/// <summary>
/// What this server knows about live connections: how many each person has open, and which nudges are waiting for an acknowledgement.
/// In memory and per server. With more than one server, an app connected to another server counts as not connected here, so the worst case is a
/// push sent to a phone that also has the app open (never a lost notice). See server/README.md, "Realtime chat".
/// </summary>
public sealed class RealtimeState
{
    private readonly ConcurrentDictionary<Guid, int> open = new();
    private readonly ConcurrentDictionary<string, TaskCompletionSource> waiting = new();

    public void Connected(Guid user) => open.AddOrUpdate(user, 1, (_, n) => n + 1);

    public void Disconnected(Guid user)
    {
        if (!open.TryGetValue(user, out var n)) return;
        if (n <= 1) open.TryRemove(new KeyValuePair<Guid, int>(user, n));
        else open.TryUpdate(user, n - 1, n);
    }

    public bool IsConnected(Guid user) => open.TryGetValue(user, out var n) && n > 0;

    /// <summary>Starts waiting for the acknowledgement of a nudge. Dispose the result to forget it.</summary>
    public Waiter Expect(string eventId)
    {
        var tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        waiting[eventId] = tcs;
        return new Waiter(this, eventId, tcs.Task);
    }

    /// <summary>An app said it got the nudge. An unknown or repeated id is ignored.</summary>
    public void Ack(string eventId)
    {
        if (waiting.TryGetValue(eventId, out var tcs)) tcs.TrySetResult();
    }

    public int Waiting => waiting.Count;

    public sealed class Waiter(RealtimeState owner, string id, Task done) : IDisposable
    {
        /// <summary>True when acknowledged before <paramref name="wait"/> passed.</summary>
        public async Task<bool> WaitAsync(TimeSpan wait, CancellationToken ct)
        {
            try { await done.WaitAsync(wait, ct); return true; }
            catch (TimeoutException) { return false; }
        }

        public void Dispose() => owner.waiting.TryRemove(id, out _);
    }
}
