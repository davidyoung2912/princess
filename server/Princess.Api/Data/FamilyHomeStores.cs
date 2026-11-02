namespace Princess.Api.Data;

public sealed record FamilyLinkRow(Guid PublicId, long UserId, DateTime ExpiresAt, DateTime? RevokedAt);

public sealed record FamilyPostcardRow(string Kind, string Note, DateTime SentAt);

/// <summary>The links a guest has shared with people at home, and the postcards those people see (multi-device plan 2, Phase 6).</summary>
public interface IFamilyHomeStore
{
    Task<int> CountLiveAsync(long userId, DateTime now, CancellationToken ct);
    Task<Guid> AddLinkAsync(long userId, DateTime expiresAt, DateTime now, CancellationToken ct);
    Task<FamilyLinkRow?> FindLinkAsync(Guid publicId, CancellationToken ct);
    /// <summary>Stops one of the person's links. False when they have no such link.</summary>
    Task<bool> RevokeAsync(long userId, Guid publicId, DateTime now, CancellationToken ct);
    /// <summary>Stops every live link the person has; returns how many.</summary>
    Task<int> RevokeAllAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>Adds a postcard and drops the oldest beyond <paramref name="keep"/>.</summary>
    Task AddPostcardAsync(long userId, string kind, string note, DateTime sentAt, int keep, CancellationToken ct);
    /// <summary>Newest last.</summary>
    Task<List<FamilyPostcardRow>> ListPostcardsAsync(long userId, int max, CancellationToken ct);
}
