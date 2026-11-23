namespace Princess.Api.Data;

/// <summary>A stored hand-over code: only a hash of the code is kept. <c>Ref</c> names the bundle; the receiver's server rebuilds it for them.</summary>
public sealed record BundleShareRow(long Id, Guid PublicId, long UserId, string Ref, DateTime CreatedAt, DateTime ExpiresAt, DateTime? RevokedAt, int Scans);

public interface IBundleShareStore
{
    Task AddAsync(BundleShareRow row, string hash, CancellationToken ct);
    Task<BundleShareRow?> FindAsync(string hash, CancellationToken ct);
    /// <summary>The person's codes that still open at <paramref name="now"/>, newest first.</summary>
    Task<List<BundleShareRow>> ListLiveAsync(long userId, DateTime now, CancellationToken ct);
    Task AddScanAsync(long id, CancellationToken ct);
    /// <summary>Stops the person's own code at once; false when there is none such.</summary>
    Task<bool> RevokeAsync(long userId, Guid publicId, DateTime now, CancellationToken ct);
}
