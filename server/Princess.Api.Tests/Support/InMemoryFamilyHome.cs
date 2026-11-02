using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

public sealed class InMemoryFamilyHomeStore : IFamilyHomeStore
{
    public List<FamilyLinkRow> Links { get; } = [];
    public List<(long UserId, FamilyPostcardRow Card)> Cards { get; } = [];

    public Task<int> CountLiveAsync(long userId, DateTime now, CancellationToken ct) =>
        Task.FromResult(Links.Count(l => l.UserId == userId && l.RevokedAt is null && l.ExpiresAt > now));

    public Task<Guid> AddLinkAsync(long userId, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        Links.Add(new FamilyLinkRow(id, userId, expiresAt, null));
        return Task.FromResult(id);
    }

    public Task<FamilyLinkRow?> FindLinkAsync(Guid publicId, CancellationToken ct) => Task.FromResult(Links.FirstOrDefault(l => l.PublicId == publicId));

    public Task<bool> RevokeAsync(long userId, Guid publicId, DateTime now, CancellationToken ct)
    {
        var i = Links.FindIndex(l => l.UserId == userId && l.PublicId == publicId);
        if (i < 0) return Task.FromResult(false);
        if (Links[i].RevokedAt is null) Links[i] = Links[i] with { RevokedAt = now };
        return Task.FromResult(true);
    }

    public Task<int> RevokeAllAsync(long userId, DateTime now, CancellationToken ct)
    {
        var n = 0;
        for (var i = 0; i < Links.Count; i++)
            if (Links[i].UserId == userId && Links[i].RevokedAt is null) { Links[i] = Links[i] with { RevokedAt = now }; n++; }
        return Task.FromResult(n);
    }

    public Task AddPostcardAsync(long userId, string kind, string note, DateTime sentAt, int keep, CancellationToken ct)
    {
        Cards.Add((userId, new FamilyPostcardRow(kind, note, sentAt)));
        var mine = Cards.Where(c => c.UserId == userId).ToList();
        foreach (var old in mine.Take(Math.Max(0, mine.Count - keep))) Cards.Remove(old);
        return Task.CompletedTask;
    }

    public Task<List<FamilyPostcardRow>> ListPostcardsAsync(long userId, int max, CancellationToken ct) =>
        Task.FromResult(Cards.Where(c => c.UserId == userId).Select(c => c.Card).TakeLast(max).ToList());
}
