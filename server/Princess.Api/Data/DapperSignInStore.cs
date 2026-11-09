using Dapper;

namespace Princess.Api.Data;

/// <summary>The throttle arithmetic, shared by the SQL store and the in-memory one so they cannot drift.</summary>
public static class LoginThrottle
{
    public static ThrottleState Next(ThrottleState? old, DateTime? lastAt, int maxFailures, TimeSpan baseLockout, TimeSpan maxLockout, DateTime now)
    {
        // A day of quiet forgets the history.
        var stale = old is null || lastAt is null || now - lastAt > TimeSpan.FromDays(1);
        var strikes = stale ? 0 : old!.Strikes;
        var failures = (stale ? 0 : old!.Failures) + 1;
        if (failures < maxFailures) return new ThrottleState(failures, strikes, null);
        var seconds = Math.Min(baseLockout.TotalSeconds * Math.Pow(2, Math.Min(strikes, 20)), maxLockout.TotalSeconds);
        return new ThrottleState(0, strikes + 1, now.AddSeconds(seconds));
    }
}

internal sealed record ThrottleRow(int Failures, int Strikes, DateTime UpdatedAt);

public sealed class DapperSignInStore(IDbConnectionFactory db, UserCache users) : ISignInStore
{
    public async Task<long?> CreateAccountAsync(NewAccount a, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var taken = await c.ExecuteScalarAsync<int>(new CommandDefinition("SELECT COUNT(1) FROM dbo.Users WHERE Email = @Email", new { a.Email }, tx, cancellationToken: ct));
        if (taken > 0) return null;
        // A random 10-digit number starting with 4; retry on the rare clash with the unique index.
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var number = (4_000_000_000L + Random.Shared.NextInt64(0, 1_000_000_000L)).ToString();
            var exists = await c.ExecuteScalarAsync<int>(new CommandDefinition("SELECT COUNT(1) FROM dbo.Users WHERE AccountNumber = @number", new { number }, tx, cancellationToken: ct));
            if (exists > 0) continue;
            var id = await c.ExecuteScalarAsync<long>(new CommandDefinition("""
                INSERT INTO dbo.Users (AccountNumber, Email, PasswordHash, ReviewReason, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.Id
                VALUES (@number, @Email, @PasswordHash, @ReviewReason, @now, @now)
                """, new { number, a.Email, a.PasswordHash, a.ReviewReason, now }, tx, cancellationToken: ct));
            await c.ExecuteAsync(new CommandDefinition(
                "INSERT INTO dbo.Profiles (UserId, FirstName, LastName, Dob, CreatedAt, UpdatedAt) VALUES (@id, @FirstName, @LastName, @Dob, @now, @now)",
                new { id, a.FirstName, a.LastName, Dob = a.Dob.ToDateTime(TimeOnly.MinValue), now }, tx, cancellationToken: ct));
            await tx.CommitAsync(ct);
            return id;
        }
        throw new InvalidOperationException("Could not find a free account number.");
    }

    public async Task SetPasswordAsync(long userId, string passwordHash, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Users SET PasswordHash = @passwordHash, FailedLogins = 0, LockedUntil = NULL, SessionsValidFrom = @now, UpdatedAt = @now WHERE Id = @userId",
            new { userId, passwordHash, now }, tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.RefreshTokens SET RevokedAt = @now WHERE UserId = @userId AND RevokedAt IS NULL AND UsedAt IS NULL",
            new { userId, now }, tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition("DELETE FROM dbo.LoginThrottle WHERE UserId = @userId", new { userId }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        users.Invalidate();
    }

    public async Task<Guid?> FindPossibleDuplicateAsync(string firstName, string lastName, DateOnly dob, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT TOP 1 u.PublicId FROM dbo.Users u JOIN dbo.Profiles p ON p.UserId = u.Id
            WHERE u.IsSupervised = 0 AND u.IsDemo = 0 AND p.Dob = @dob
              AND p.FirstName COLLATE Latin1_General_CI_AI = @firstName COLLATE Latin1_General_CI_AI
              AND p.LastName COLLATE Latin1_General_CI_AI = @lastName COLLATE Latin1_General_CI_AI
            ORDER BY u.Id
            """, new { firstName, lastName, dob = dob.ToDateTime(TimeOnly.MinValue) }, cancellationToken: ct));
    }

    public async Task EndAllSessionsAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Users SET SessionsValidFrom = @now, UpdatedAt = @now WHERE Id = @userId",
            new { userId, now }, tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.RefreshTokens SET RevokedAt = @now WHERE UserId = @userId AND RevokedAt IS NULL AND UsedAt IS NULL",
            new { userId, now }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        users.Invalidate();
    }

    public async Task ReplaceChallengeAsync(long userId, string purpose, byte[] codeHash, byte[] salt, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.AuthChallenges SET UsedAt = @now WHERE UserId = @userId AND Purpose = @purpose AND UsedAt IS NULL",
            new { userId, purpose, now }, tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition(
            "INSERT INTO dbo.AuthChallenges (UserId, Purpose, CodeHash, Salt, ExpiresAt, CreatedAt) VALUES (@userId, @purpose, @codeHash, @salt, @expiresAt, @now)",
            new { userId, purpose, codeHash, salt, expiresAt, now }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
    }

    public async Task<ChallengeRecord?> FindOpenChallengeAsync(long userId, string purpose, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<ChallengeRecord>(new CommandDefinition("""
            SELECT TOP 1 Id, UserId, CodeHash, Salt, Attempts, ExpiresAt FROM dbo.AuthChallenges
            WHERE UserId = @userId AND Purpose = @purpose AND UsedAt IS NULL AND ExpiresAt > @now
            ORDER BY CreatedAt DESC, Id DESC
            """, new { userId, purpose, now }, cancellationToken: ct));
    }

    public async Task<ChallengeUsage> ChallengeUsageAsync(long userId, string purpose, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleAsync<ChallengeUsage>(new CommandDefinition(
            "SELECT COUNT(1) AS Requests, COALESCE(SUM(Attempts), 0) AS Attempts FROM dbo.AuthChallenges WHERE UserId = @userId AND Purpose = @purpose AND CreatedAt >= @since",
            new { userId, purpose, since }, cancellationToken: ct));
    }

    public async Task<ThrottleState?> GetThrottleAsync(long userId, string ip, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<ThrottleState>(new CommandDefinition(
            "SELECT Failures, Strikes, LockedUntil FROM dbo.LoginThrottle WHERE UserId = @userId AND Ip = @ip", new { userId, ip }, cancellationToken: ct));
    }

    public async Task<ThrottleState> RecordThrottleFailureAsync(long userId, string ip, int maxFailures, TimeSpan baseLockout, TimeSpan maxLockout, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var row = await c.QueryFirstOrDefaultAsync<ThrottleRow>(new CommandDefinition(
            "SELECT Failures, Strikes, UpdatedAt FROM dbo.LoginThrottle WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @userId AND Ip = @ip", new { userId, ip }, tx, cancellationToken: ct));
        var next = LoginThrottle.Next(row is { } r ? new ThrottleState(r.Failures, r.Strikes, null) : null, row?.UpdatedAt, maxFailures, baseLockout, maxLockout, now);
        if (row is null)
            await c.ExecuteAsync(new CommandDefinition(
                "INSERT INTO dbo.LoginThrottle (UserId, Ip, Failures, Strikes, LockedUntil, UpdatedAt) VALUES (@userId, @ip, @Failures, @Strikes, @LockedUntil, @now)",
                new { userId, ip, next.Failures, next.Strikes, next.LockedUntil, now }, tx, cancellationToken: ct));
        else
            await c.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.LoginThrottle SET Failures = @Failures, Strikes = @Strikes, LockedUntil = @LockedUntil, UpdatedAt = @now WHERE UserId = @userId AND Ip = @ip",
                new { userId, ip, next.Failures, next.Strikes, next.LockedUntil, now }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        return next;
    }

    public async Task ClearThrottleAsync(long userId, string ip, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(new CommandDefinition("DELETE FROM dbo.LoginThrottle WHERE UserId = @userId AND Ip = @ip", new { userId, ip }, cancellationToken: ct));
    }

    public async Task AddChallengeAttemptAsync(long challengeId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(new CommandDefinition("UPDATE dbo.AuthChallenges SET Attempts = Attempts + 1 WHERE Id = @challengeId", new { challengeId }, cancellationToken: ct));
    }

    public async Task<bool> UseChallengeAsync(long challengeId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.ExecuteAsync(new CommandDefinition("UPDATE dbo.AuthChallenges SET UsedAt = @now WHERE Id = @challengeId AND UsedAt IS NULL", new { challengeId, now }, cancellationToken: ct));
        return rows == 1;
    }

    public async Task AddOutboxAsync(OutboxMessage m, string status, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(new CommandDefinition("""
            INSERT INTO dbo.Outbox (UserId, Channel, Category, ToAddress, Subject, Body, Status, SentAt, CreatedAt)
            VALUES (@UserId, @Channel, @Category, @To, @Subject, @Body, @status, CASE WHEN @status = 'sent' THEN @now END, @now)
            """, new { m.UserId, m.Channel, m.Category, m.To, m.Subject, m.Body, status, now }, cancellationToken: ct));
    }
}
