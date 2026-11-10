using System.Collections.Concurrent;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Who is typing where, right now (docs/chat-features-research.md, phase 2). Kept in memory only and never stored: an entry lives <see cref="ChatControlRules.TypingExpiry"/>,
/// and a restart simply shows nobody typing. One instance for the whole server.
/// </summary>
public sealed class ChatTypingTracker
{
    private readonly ConcurrentDictionary<(long Group, long User), DateTime> last = new();
    private DateTime swept = DateTime.MinValue;

    /// <summary>Notes that the person is typing in the conversation. True when a nudge should go out (the first since <see cref="ChatControlRules.TypingThrottle"/>); false when it is too soon, so a fast typist costs one nudge per few seconds.</summary>
    public bool Touch(long group, long user, DateTime now)
    {
        Sweep(now);
        var send = false;
        last.AddOrUpdate((group, user), _ => { send = true; return now; }, (_, old) =>
        {
            send = ChatControlRules.ShouldSendTyping(old, now);
            return send ? now : old;
        });
        return send;
    }

    /// <summary>The person sent their message or stopped: they are no longer typing.</summary>
    public void Clear(long group, long user) => last.TryRemove((group, user), out _);

    /// <summary>The people typing in the conversation now, other than <paramref name="except"/>.</summary>
    public List<long> Active(long group, long except, DateTime now) =>
        [.. last.Where(e => e.Key.Group == group && e.Key.User != except && ChatControlRules.IsTyping(e.Value, now)).Select(e => e.Key.User)];

    /// <summary>Forgets expired entries now and then so the table cannot grow without end.</summary>
    private void Sweep(DateTime now)
    {
        if (now - swept < TimeSpan.FromMinutes(1)) return;
        swept = now;
        foreach (var e in last.Where(e => !ChatControlRules.IsTyping(e.Value, now))) last.TryRemove(e.Key, out _);
    }
}
