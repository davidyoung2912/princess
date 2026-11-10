using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

/// <summary>An in-memory <see cref="IChatSmsStore"/> for the API tests.</summary>
public sealed class InMemoryChatSmsStore : IChatSmsStore
{
    private readonly Dictionary<long, ChatSmsSettingsRow> settings = [];
    private readonly Dictionary<long, ChatSmsStateRow> state = [];
    public List<(long UserId, long? GroupId, string Direction, string Outcome, DateTime At, long? MessageId)> Log { get; } = [];
    /// <summary>Urgent texts the tests say went out and are unconfirmed; the fake does not join messages and acknowledgements itself.</summary>
    public List<UrgentTextRow> UrgentTexts { get; } = [];

    public Task<ChatSmsSettingsRow> GetSettingsAsync(long userId, CancellationToken ct) => Task.FromResult(settings.GetValueOrDefault(userId) ?? new(false, false));
    public Task SetSettingsAsync(long userId, bool on, bool idle, CancellationToken ct) { settings[userId] = new(on, idle); return Task.CompletedTask; }
    public Task<Dictionary<long, ChatSmsSettingsRow>> ListSettingsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct) =>
        Task.FromResult(settings.Where(kv => userIds.Contains(kv.Key)).ToDictionary(kv => kv.Key, kv => kv.Value));
    public Task<ChatSmsStateRow> GetStateAsync(long userId, CancellationToken ct) => Task.FromResult(state.GetValueOrDefault(userId) ?? new(null, null));
    public Task SetLastGroupAsync(long userId, long groupId, DateTime now, CancellationToken ct) { state[userId] = (state.GetValueOrDefault(userId) ?? new(null, null)) with { LastGroupId = groupId }; return Task.CompletedTask; }
    public Task SetBackAsync(long userId, DateTime now, CancellationToken ct) { state[userId] = (state.GetValueOrDefault(userId) ?? new(null, null)) with { BackAt = now }; return Task.CompletedTask; }
    public Task<int> CountAsync(long userId, string direction, long? groupId, DateTime since, CancellationToken ct) =>
        Task.FromResult(Log.Count(l => l.UserId == userId && l.Direction == direction && l.At >= since && (groupId is null || l.GroupId == groupId)));
    public Task LogAsync(long userId, long? groupId, string direction, string outcome, DateTime at, CancellationToken ct, long? messageId = null) { Log.Add((userId, groupId, direction, outcome, at, messageId)); return Task.CompletedTask; }
    public Task<List<UrgentTextRow>> ListUrgentTextsAsync(DateTime since, CancellationToken ct) =>
        Task.FromResult(UrgentTexts.Where(u => u.At >= since && !Log.Any(l => l.UserId == u.UserId && l.MessageId == u.MessageId && l.Outcome == "retry")).ToList());
    public Task<List<long>> ListOnAsync(IReadOnlyCollection<long> userIds, CancellationToken ct) =>
        Task.FromResult(userIds.Where(id => settings.TryGetValue(id, out var s) && s.On).ToList());
}
