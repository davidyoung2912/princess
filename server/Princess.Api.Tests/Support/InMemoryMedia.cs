using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

public sealed class InMemoryMediaStore : IMediaStore
{
    public List<(MediaRow Row, byte[] Data)> Items { get; } = [];

    public Task<(int Count, long Bytes)> UsageAsync(long userId, CancellationToken ct)
    {
        var mine = Items.Where(i => i.Row.UserId == userId).ToList();
        return Task.FromResult((mine.Count, mine.Sum(i => (long)i.Row.ByteCount)));
    }

    public Task<Guid> AddAsync(long userId, string purpose, string reference, string kind, string caption, string contentType, int width, int height, byte[] data, string status, DateTime now, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        Items.Add((new MediaRow(id, userId, purpose, reference, kind, caption, contentType, width, height, data.Length, status, now), data));
        return Task.FromResult(id);
    }

    public Task<List<MediaRow>> ListMineAsync(long userId, string? purpose, CancellationToken ct) =>
        Task.FromResult(Items.Where(i => i.Row.UserId == userId && (purpose is null || i.Row.Purpose == purpose)).Select(i => i.Row).Reverse().ToList());

    public Task<List<MediaRow>> ListByReferenceAsync(string purpose, string reference, int max, CancellationToken ct) =>
        Task.FromResult(Items.Where(i => i.Row.Purpose == purpose && i.Row.Reference == reference && i.Row.Status != "rejected").Select(i => i.Row).Reverse().Take(max).ToList());

    public Task<MediaRow?> FindAsync(Guid publicId, CancellationToken ct) => Task.FromResult(Items.Select(i => (MediaRow?)i.Row).FirstOrDefault(r => r!.PublicId == publicId));

    public Task<byte[]?> BytesAsync(Guid publicId, CancellationToken ct) => Task.FromResult(Items.Where(i => i.Row.PublicId == publicId).Select(i => (byte[]?)i.Data).FirstOrDefault());

    public Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct) =>
        Task.FromResult(Items.RemoveAll(i => i.Row.UserId == userId && i.Row.PublicId == publicId) > 0);
}
