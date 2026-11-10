using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Where handoff photos are kept. A photo belongs to one guest; every call is scoped to a user id, and an id that is not theirs is the same as one that does not exist.</summary>
public interface IHandoffPhotoStore
{
    Task SaveAsync(long userId, Guid id, byte[] data, CancellationToken ct);
    Task<byte[]?> OpenAsync(long userId, Guid id, CancellationToken ct);
    Task<bool> DeleteAsync(long userId, Guid id, CancellationToken ct);
    /// <summary>How many photos the guest has kept.</summary>
    Task<int> CountAsync(long userId, CancellationToken ct);
    /// <summary>Every photo kept before <paramref name="cutoff"/> (by the time it was saved), for the retention job.</summary>
    Task<List<(long UserId, Guid Id)>> ListOlderThanAsync(DateTime cutoff, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryHandoffPhotoStore(IClock clock) : IHandoffPhotoStore
{
    private readonly Dictionary<(long, Guid), (byte[] Data, DateTime At)> _files = [];

    public Task SaveAsync(long userId, Guid id, byte[] data, CancellationToken ct)
    {
        lock (_files) _files[(userId, id)] = ([.. data], clock.UtcNow);
        return Task.CompletedTask;
    }

    public Task<byte[]?> OpenAsync(long userId, Guid id, CancellationToken ct)
    {
        lock (_files) return Task.FromResult(_files.TryGetValue((userId, id), out var f) ? (byte[]?)[.. f.Data] : null);
    }

    public Task<bool> DeleteAsync(long userId, Guid id, CancellationToken ct)
    {
        lock (_files) return Task.FromResult(_files.Remove((userId, id)));
    }

    public Task<int> CountAsync(long userId, CancellationToken ct)
    {
        lock (_files) return Task.FromResult(_files.Keys.Count(k => k.Item1 == userId));
    }

    public Task<List<(long UserId, Guid Id)>> ListOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        lock (_files) return Task.FromResult(_files.Where(kv => kv.Value.At < cutoff).Select(kv => (kv.Key.Item1, kv.Key.Item2)).ToList());
    }
}

/// <summary>
/// Keeps each photo as one file named for its guest and id, in one folder. The name is built only from a number and a Guid, so nothing the guest sends can reach another path. Swapping this for a blob store
/// is a registration change: the service and the rules do not know where the bytes live.
/// </summary>
public sealed class LocalHandoffPhotoStore : IHandoffPhotoStore
{
    private readonly string _dir;

    public LocalHandoffPhotoStore(string dir)
    {
        _dir = Path.GetFullPath(dir);
        Directory.CreateDirectory(_dir);
    }

    private string PathOf(long userId, Guid id) => Path.Combine(_dir, $"{userId}-{StanleyHandoffPhotoRules.IdOf(id)}.img");

    public async Task SaveAsync(long userId, Guid id, byte[] data, CancellationToken ct) => await File.WriteAllBytesAsync(PathOf(userId, id), data, ct);

    public async Task<byte[]?> OpenAsync(long userId, Guid id, CancellationToken ct) => File.Exists(PathOf(userId, id)) ? await File.ReadAllBytesAsync(PathOf(userId, id), ct) : null;

    public Task<bool> DeleteAsync(long userId, Guid id, CancellationToken ct)
    {
        var path = PathOf(userId, id);
        if (!File.Exists(path)) return Task.FromResult(false);
        File.Delete(path);
        return Task.FromResult(true);
    }

    public Task<int> CountAsync(long userId, CancellationToken ct) => Task.FromResult(Directory.EnumerateFiles(_dir, $"{userId}-*.img").Count());

    public Task<List<(long UserId, Guid Id)>> ListOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        var found = new List<(long, Guid)>();
        foreach (var file in Directory.EnumerateFiles(_dir, "*.img"))
        {
            if (File.GetLastWriteTimeUtc(file) >= cutoff) continue;
            var name = Path.GetFileNameWithoutExtension(file).Split('-', 2);
            if (name.Length == 2 && long.TryParse(name[0], out var user) && StanleyHandoffPhotoRules.Parse(name[1]) is { } id) found.Add((user, id));
        }
        return Task.FromResult(found);
    }
}

/// <summary>
/// The photo a guest adds to a handoff case. Uploading checks the bytes, cleans the metadata off and keeps the picture under the guest; only the guest can open or delete it; a child account cannot upload. The case
/// holds the photo's id, and the photo goes when the case does (<see cref="StanleyRetention"/>).
/// </summary>
public sealed class StanleyHandoffPhotoService(IHandoffPhotoStore store, IMediaScanner scanner, IAuditLog audit)
{
    public async Task<StanleyHandoffPhotoDto> UploadAsync(UserRecord user, byte[] body, CancellationToken ct)
    {
        if (user.IsSupervised) throw ApiException.Forbidden();
        if (StanleyHandoffPhotoRules.Check(body, out var clean, out var type) is { } problem) throw ApiException.Invalid(problem);
        if (!await scanner.IsCleanAsync(clean, type, ct)) throw ApiException.Invalid("scan");
        if (await store.CountAsync(user.Id, ct) >= StanleyHandoffPhotoRules.MaxWaiting) throw ApiException.Conflict("tooMany");
        var id = Guid.NewGuid();
        await store.SaveAsync(user.Id, id, clean, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.handoff.photo", Outcome = AuditOutcome.Success, Detail = type }, ct);
        return new(StanleyHandoffPhotoRules.IdOf(id), type, clean.Length);
    }

    /// <summary>The picture and its type for the guest who owns it. 404 for anyone else's, or one that is gone.</summary>
    public async Task<(byte[] Data, string Type)> OpenAsync(UserRecord user, string? id, CancellationToken ct)
    {
        var guid = StanleyHandoffPhotoRules.Parse(id) ?? throw ApiException.NotFound();
        var data = await store.OpenAsync(user.Id, guid, ct) ?? throw ApiException.NotFound();
        return (data, MediaRules.Sniff(data) ?? "application/octet-stream");
    }

    public async Task DeleteAsync(UserRecord user, string? id, CancellationToken ct)
    {
        var guid = StanleyHandoffPhotoRules.Parse(id) ?? throw ApiException.NotFound();
        if (!await store.DeleteAsync(user.Id, guid, ct)) throw ApiException.NotFound();
    }

    /// <summary>Whether the guest has this photo, for a case that names it.</summary>
    public async Task<bool> HasAsync(long userId, string? id, CancellationToken ct) =>
        StanleyHandoffPhotoRules.Parse(id) is { } guid && await store.OpenAsync(userId, guid, ct) is not null;
}
