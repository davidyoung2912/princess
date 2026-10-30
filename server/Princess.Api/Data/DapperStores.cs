using Dapper;

namespace Princess.Api.Data;

public sealed class DapperUserStore(IDbConnectionFactory db) : IUserStore
{
    private const string Select = """
        SELECT u.Id, u.PublicId, u.AccountNumber, u.Email, u.PasswordHash, u.Role, u.IsDemo, u.IsSupervised, u.BookerUserId,
               u.Tier, u.[TextSize], u.Locale, u.Currency, u.FailedLogins, u.LockedUntil,
               p.FirstName, p.LastName, b.PublicId AS BookerPublicId
        FROM dbo.Users u
        LEFT JOIN dbo.Profiles p ON p.UserId = u.Id
        LEFT JOIN dbo.Users b ON b.Id = u.BookerUserId
        """;

    public async Task<UserRecord?> FindByIdentifierAsync(string identifier, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var isAccountNumber = identifier.Length == 10 && identifier.All(char.IsAsciiDigit);
        var where = isAccountNumber ? "u.AccountNumber = @identifier" : "u.Email = @identifier";
        return await c.QuerySingleOrDefaultAsync<UserRecord>(new CommandDefinition($"{Select} WHERE {where}", new { identifier }, cancellationToken: ct));
    }

    public async Task<UserRecord?> FindByIdAsync(long id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<UserRecord>(new CommandDefinition($"{Select} WHERE u.Id = @id", new { id }, cancellationToken: ct));
    }

    public async Task<UserRecord?> FindByPublicIdAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<UserRecord>(new CommandDefinition($"{Select} WHERE u.PublicId = @publicId", new { publicId }, cancellationToken: ct));
    }

    public async Task RecordLoginFailureAsync(long userId, int maxFailures, TimeSpan lockout, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        // One statement, so concurrent failures cannot lose a count. SET clauses read the old row values.
        await c.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.Users SET
              LockedUntil = CASE WHEN FailedLogins + 1 >= @maxFailures THEN DATEADD(SECOND, @lockSeconds, @now) ELSE LockedUntil END,
              FailedLogins = CASE WHEN FailedLogins + 1 >= @maxFailures THEN 0 ELSE FailedLogins + 1 END,
              UpdatedAt = @now
            WHERE Id = @userId
            """, new { userId, maxFailures, lockSeconds = (int)lockout.TotalSeconds, now }, cancellationToken: ct));
    }

    public async Task RecordLoginSuccessAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Users SET FailedLogins = 0, LockedUntil = NULL, LastLoginAt = @now, UpdatedAt = @now WHERE Id = @userId",
            new { userId, now }, cancellationToken: ct));
    }
}

public sealed class DapperRefreshTokenStore(IDbConnectionFactory db) : IRefreshTokenStore
{
    private const string InsertSql = """
        INSERT INTO dbo.RefreshTokens (UserId, FamilyId, TokenHash, ExpiresAt, UserAgent, Ip, CreatedAt)
        OUTPUT INSERTED.Id
        VALUES (@UserId, @FamilyId, @TokenHash, @ExpiresAt, @UserAgent, @Ip, @now)
        """;

    public async Task<RefreshTokenRecord?> FindByHashAsync(byte[] tokenHash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<RefreshTokenRecord>(new CommandDefinition(
            "SELECT Id, UserId, FamilyId, ExpiresAt, UsedAt, RevokedAt FROM dbo.RefreshTokens WHERE TokenHash = @tokenHash",
            new { tokenHash }, cancellationToken: ct));
    }

    public async Task InsertAsync(NewRefreshToken t, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteScalarAsync<long>(new CommandDefinition(InsertSql, Params(t, now), cancellationToken: ct));
    }

    public async Task<bool> TryRotateAsync(long oldTokenId, NewRefreshToken next, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var claimed = await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.RefreshTokens SET UsedAt = @now WHERE Id = @oldTokenId AND UsedAt IS NULL AND RevokedAt IS NULL",
            new { oldTokenId, now }, tx, cancellationToken: ct));
        if (claimed != 1)
        {
            await tx.RollbackAsync(ct);
            return false;
        }
        var newId = await c.ExecuteScalarAsync<long>(new CommandDefinition(InsertSql, Params(next, now), tx, cancellationToken: ct));
        await c.ExecuteAsync(new CommandDefinition("UPDATE dbo.RefreshTokens SET ReplacedById = @newId WHERE Id = @oldTokenId", new { newId, oldTokenId }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        return true;
    }

    public async Task RevokeFamilyAsync(long userId, long familyId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.RefreshTokens SET RevokedAt = @now WHERE UserId = @userId AND FamilyId = @familyId AND RevokedAt IS NULL",
            new { userId, familyId, now }, cancellationToken: ct));
    }

    private static object Params(NewRefreshToken t, DateTime now) =>
        new { t.UserId, t.FamilyId, t.TokenHash, t.ExpiresAt, t.UserAgent, t.Ip, now };
}

public sealed class DapperAccessStore(IDbConnectionFactory db) : IAccessStore
{
    public async Task<BookingMembership?> FindMembershipAsync(long userId, string bookingNumber, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<BookingMembership>(new CommandDefinition("""
            SELECT b.Id AS BookingId, b.Number, b.BookerUserId, g.IsLead
            FROM dbo.Bookings b
            JOIN dbo.BookingGuests g ON g.BookingId = b.Id AND g.UserId = @userId
            WHERE b.Number = @bookingNumber
            """, new { userId, bookingNumber }, cancellationToken: ct));
    }

    public async Task<HelperGrant?> FindLiveHelperGrantAsync(long helperUserId, long guestUserId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<HelperGrant>(new CommandDefinition(
            "SELECT Permissions, Status FROM dbo.HelperLinks WHERE HelperUserId = @helperUserId AND GuestUserId = @guestUserId AND Status = 'active'",
            new { helperUserId, guestUserId }, cancellationToken: ct));
    }
}
