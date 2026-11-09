namespace Princess.Api.Data;

public sealed class ChallengeRecord
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public byte[] CodeHash { get; set; } = [];
    /// <summary>Per-challenge random salt mixed into the keyed hash; null on a code issued before salts existed (it can no longer match).</summary>
    public byte[]? Salt { get; set; }
    public int Attempts { get; set; }
    public DateTime ExpiresAt { get; set; }
}

/// <summary>Codes asked for, and wrong tries made, in a window; the caps on re-issuing a code read it.</summary>
public sealed record ChallengeUsage(int Requests, int Attempts);

/// <summary>Where one person's failed password tries from one address stand.</summary>
public sealed record ThrottleState(int Failures, int Strikes, DateTime? LockedUntil);

public sealed record NewAccount(string Email, string PasswordHash, string FirstName, string LastName, DateOnly Dob);

public sealed record OutboxMessage(long? UserId, string Channel, string Category, string To, string Subject, string Body);

/// <summary>Sign-up, one-time codes and the outbox (Phase G4). Kept apart from <see cref="IUserStore"/> so sign-in itself is unchanged.</summary>
public interface ISignInStore
{
    /// <summary>Creates the user and profile in one transaction with a fresh unused 10-digit account number. Returns null when the email is already taken.</summary>
    Task<long?> CreateAccountAsync(NewAccount account, DateTime now, CancellationToken ct);
    /// <summary>Sets a new password, clears any lock and revokes every refresh token and every access token issued before now.</summary>
    Task SetPasswordAsync(long userId, string passwordHash, DateTime now, CancellationToken ct);
    /// <summary>Revokes every refresh token and every access token issued before now, leaving the password as it is.</summary>
    Task EndAllSessionsAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>Spends any open code for this purpose, then stores the new one.</summary>
    Task ReplaceChallengeAsync(long userId, string purpose, byte[] codeHash, byte[] salt, DateTime expiresAt, DateTime now, CancellationToken ct);
    /// <summary>Codes issued and wrong tries made for this purpose since <paramref name="since"/>, spent codes included.</summary>
    Task<ChallengeUsage> ChallengeUsageAsync(long userId, string purpose, DateTime since, CancellationToken ct);
    /// <summary>The password-try throttle for this account from this address, or null when it has none.</summary>
    Task<ThrottleState?> GetThrottleAsync(long userId, string ip, CancellationToken ct);
    /// <summary>Counts a failed try. At <paramref name="maxFailures"/> it locks the pair for <paramref name="baseLockout"/> doubled once per earlier lock (capped at <paramref name="maxLockout"/>); strikes older than a day are forgotten. Returns the new state.</summary>
    Task<ThrottleState> RecordThrottleFailureAsync(long userId, string ip, int maxFailures, TimeSpan baseLockout, TimeSpan maxLockout, DateTime now, CancellationToken ct);
    Task ClearThrottleAsync(long userId, string ip, CancellationToken ct);
    /// <summary>The newest unused, unexpired code for this purpose, or null.</summary>
    Task<ChallengeRecord?> FindOpenChallengeAsync(long userId, string purpose, DateTime now, CancellationToken ct);
    Task AddChallengeAttemptAsync(long challengeId, CancellationToken ct);
    /// <summary>Marks the code used. False when it was already used (a second redeem racing the first).</summary>
    Task<bool> UseChallengeAsync(long challengeId, DateTime now, CancellationToken ct);
    Task AddOutboxAsync(OutboxMessage message, string status, DateTime now, CancellationToken ct);
}
