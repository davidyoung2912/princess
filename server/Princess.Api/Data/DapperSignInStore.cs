using Dapper;

namespace Princess.Api.Data;

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
                INSERT INTO dbo.Users (AccountNumber, Email, PasswordHash, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.Id
                VALUES (@number, @Email, @PasswordHash, @now, @now)
                """, new { number, a.Email, a.PasswordHash, now }, tx, cancellationToken: ct));
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
            "UPDATE dbo.Users SET PasswordHash = @passwordHash, FailedLogins = 0, LockedUntil = NULL, UpdatedAt = @now WHERE Id = @userId",
            new { userId, passwordHash, now }, tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.RefreshTokens SET RevokedAt = @now WHERE UserId = @userId AND RevokedAt IS NULL AND UsedAt IS NULL",
            new { userId, now }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        users.Invalidate();
    }

    public async Task ReplaceChallengeAsync(long userId, string purpose, byte[] codeHash, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.AuthChallenges SET UsedAt = @now WHERE UserId = @userId AND Purpose = @purpose AND UsedAt IS NULL",
            new { userId, purpose, now }, tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition(
            "INSERT INTO dbo.AuthChallenges (UserId, Purpose, CodeHash, ExpiresAt, CreatedAt) VALUES (@userId, @purpose, @codeHash, @expiresAt, @now)",
            new { userId, purpose, codeHash, expiresAt, now }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
    }

    public async Task<ChallengeRecord?> FindOpenChallengeAsync(long userId, string purpose, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<ChallengeRecord>(new CommandDefinition("""
            SELECT TOP 1 Id, UserId, CodeHash, Attempts, ExpiresAt FROM dbo.AuthChallenges
            WHERE UserId = @userId AND Purpose = @purpose AND UsedAt IS NULL AND ExpiresAt > @now
            ORDER BY CreatedAt DESC, Id DESC
            """, new { userId, purpose, now }, cancellationToken: ct));
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
