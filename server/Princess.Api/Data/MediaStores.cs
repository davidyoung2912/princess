namespace Princess.Api.Data;

/// <summary>A picture's details without its bytes. <c>Status</c> is what is stored; the moderator's answer over time is <c>MediaRules.EffectiveStatus</c>.</summary>
public sealed record MediaRow(Guid PublicId, long UserId, string Purpose, string Reference, string Kind, string Caption, string ContentType, int Width, int Height, int ByteCount, string Status, DateTime CreatedAt);

/// <summary>Guest pictures (N7). The bytes are already cleaned when they reach the store.</summary>
public interface IMediaStore
{
    Task<(int Count, long Bytes)> UsageAsync(long userId, CancellationToken ct);
    Task<Guid> AddAsync(long userId, string purpose, string reference, string kind, string caption, string contentType, int width, int height, byte[] data, string status, DateTime now, CancellationToken ct);
    /// <summary>The person's own pictures, newest first, optionally for one purpose.</summary>
    Task<List<MediaRow>> ListMineAsync(long userId, string? purpose, CancellationToken ct);
    /// <summary>Pictures of one purpose and reference from any guest, newest first, at most <paramref name="max"/>; the caller decides which of them may be shown.</summary>
    Task<List<MediaRow>> ListByReferenceAsync(string purpose, string reference, int max, CancellationToken ct);
    Task<MediaRow?> FindAsync(Guid publicId, CancellationToken ct);
    Task<byte[]?> BytesAsync(Guid publicId, CancellationToken ct);
    /// <summary>Deletes one of the person's pictures. False when it is not theirs.</summary>
    Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct);
}
