namespace Princess.Api.Data;

/// <summary>A caregiver or advisor link. Only a hash of its secret is kept, so the address is shown once.</summary>
public sealed record ShareLinkRow(long Id, Guid PublicId, long BookingId, long UserId, string Kind, string Label, DateTime CreatedAt, DateTime ExpiresAt, DateTime? LastCheckInAt, string Note);

/// <summary>Read-only links a guest makes for someone at home or a travel advisor (next-level plan N4.6). Deleting a link ends access at once.</summary>
public interface IShareStore
{
    Task<List<ShareLinkRow>> ListAsync(long bookingId, long userId, CancellationToken ct);
    Task AddAsync(ShareLinkRow row, string hash, CancellationToken ct);
    /// <summary>Removes the person's own link; false when there is none such.</summary>
    Task<bool> RevokeAsync(long bookingId, long userId, Guid publicId, CancellationToken ct);
    /// <summary>Records the person's "I am fine" with a short note; false when the link is not theirs.</summary>
    Task<bool> SaveCheckInAsync(long bookingId, long userId, Guid publicId, string note, DateTime at, CancellationToken ct);
    Task<ShareLinkRow?> FindAsync(string hash, CancellationToken ct);
}
