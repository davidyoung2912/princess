namespace Princess.Api.Data;

public sealed class ChallengeRecord
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public byte[] CodeHash { get; set; } = [];
    public int Attempts { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public sealed record NewAccount(string Email, string PasswordHash, string FirstName, string LastName, DateOnly Dob);

public sealed record OutboxMessage(long? UserId, string Channel, string Category, string To, string Subject, string Body);

/// <summary>Sign-up, one-time codes and the outbox (Phase G4). Kept apart from <see cref="IUserStore"/> so sign-in itself is unchanged.</summary>
public interface ISignInStore
{
    /// <summary>Creates the user and profile in one transaction with a fresh unused 10-digit account number. Returns null when the email is already taken.</summary>
    Task<long?> CreateAccountAsync(NewAccount account, DateTime now, CancellationToken ct);
    /// <summary>Sets a new password, clears any lock and revokes every refresh token the person holds.</summary>
    Task SetPasswordAsync(long userId, string passwordHash, DateTime now, CancellationToken ct);
    /// <summary>Spends any open code for this purpose, then stores the new one.</summary>
    Task ReplaceChallengeAsync(long userId, string purpose, byte[] codeHash, DateTime expiresAt, DateTime now, CancellationToken ct);
    /// <summary>The newest unused, unexpired code for this purpose, or null.</summary>
    Task<ChallengeRecord?> FindOpenChallengeAsync(long userId, string purpose, DateTime now, CancellationToken ct);
    Task AddChallengeAttemptAsync(long challengeId, CancellationToken ct);
    /// <summary>Marks the code used. False when it was already used (a second redeem racing the first).</summary>
    Task<bool> UseChallengeAsync(long challengeId, DateTime now, CancellationToken ct);
    Task AddOutboxAsync(OutboxMessage message, string status, DateTime now, CancellationToken ct);
}
