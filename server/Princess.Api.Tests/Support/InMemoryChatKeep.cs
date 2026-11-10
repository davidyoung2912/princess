using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>An in-memory <see cref="IChatKeepStore"/>: who agreed to keep which conversation, and the kept date.</summary>
public sealed class InMemoryChatKeepStore : IChatKeepStore
{
    public HashSet<(long GroupId, long UserId)> Agreed { get; } = [];
    public Dictionary<long, DateTime> Until { get; } = [];

    public Task<List<ChatKeepRow>> ListAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct) =>
        Task.FromResult(Agreed.Where(a => groupIds.Contains(a.GroupId)).Select(a => new ChatKeepRow { GroupId = a.GroupId, UserId = a.UserId }).ToList());

    public Task SetAsync(long groupId, long userId, bool on, DateTime now, CancellationToken ct)
    {
        if (on) Agreed.Add((groupId, userId)); else Agreed.Remove((groupId, userId));
        return Task.CompletedTask;
    }

    public Task<Dictionary<long, DateTime>> KeepUntilForAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct) =>
        Task.FromResult(Until.Where(u => groupIds.Contains(u.Key)).ToDictionary(u => u.Key, u => u.Value));

    public Task SetKeepUntilAsync(long groupId, DateTime? until, CancellationToken ct)
    {
        if (until is { } d) Until[groupId] = d; else Until.Remove(groupId);
        return Task.CompletedTask;
    }
}
