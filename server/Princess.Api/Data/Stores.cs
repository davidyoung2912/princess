namespace Princess.Api.Data;

public interface IUserStore
{
    /// <summary>Finds a user by email or 10-digit account number. Profile names and the booker's public id are included.</summary>
    Task<UserRecord?> FindByIdentifierAsync(string identifier, CancellationToken ct);
    Task<UserRecord?> FindByIdAsync(long id, CancellationToken ct);
    Task<UserRecord?> FindByPublicIdAsync(Guid publicId, CancellationToken ct);
    /// <summary>Adds a failure; at <paramref name="maxFailures"/> locks the account for <paramref name="lockout"/> and resets the count.</summary>
    Task RecordLoginFailureAsync(long userId, int maxFailures, TimeSpan lockout, DateTime now, CancellationToken ct);
    Task RecordLoginSuccessAsync(long userId, DateTime now, CancellationToken ct);
}

public interface IRefreshTokenStore
{
    Task<RefreshTokenRecord?> FindByHashAsync(byte[] tokenHash, CancellationToken ct);
    Task InsertAsync(NewRefreshToken token, DateTime now, CancellationToken ct);
    /// <summary>
    /// In one transaction: marks <paramref name="old"/> used, inserts <paramref name="next"/> in the same family and links them.
    /// Returns false, changing nothing, if the old token was already used or revoked (a lost race or a replay).
    /// </summary>
    Task<bool> TryRotateAsync(long oldTokenId, NewRefreshToken next, DateTime now, CancellationToken ct);
    Task RevokeFamilyAsync(long userId, long familyId, DateTime now, CancellationToken ct);
}

public interface IAccessStore
{
    /// <summary>The booking if the user is a guest on it (D1: membership is one join). Null for no such booking or not a member.</summary>
    Task<BookingMembership?> FindMembershipAsync(long userId, string bookingNumber, CancellationToken ct);
    Task<HelperGrant?> FindLiveHelperGrantAsync(long helperUserId, long guestUserId, CancellationToken ct);
}
