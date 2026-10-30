using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests.Support;

public sealed class FakeClock(DateTime start) : IClock
{
    public DateTime UtcNow { get; set; } = start;
}

public sealed class InMemoryUserStore : IUserStore
{
    public List<UserRecord> Users { get; } = [];
    private long _next = 1;

    public UserRecord Add(string? email, string? password, bool supervised = false, UserRecord? booker = null, string? accountNumber = null, string? first = null)
    {
        var id = _next++;
        var user = new UserRecord
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            AccountNumber = accountNumber ?? (4100000000 + id).ToString(),
            Email = email,
            // Low cost so the suite stays quick; Verify honours the iteration count stored in the hash.
            PasswordHash = password is null ? null : TestHashes.Make(password),
            IsSupervised = supervised,
            BookerUserId = booker?.Id,
            BookerPublicId = booker?.PublicId,
            FirstName = first ?? "Test",
            LastName = "User",
        };
        Users.Add(user);
        return user;
    }

    public Task<UserRecord?> FindByIdentifierAsync(string identifier, CancellationToken ct) =>
        Task.FromResult(Users.FirstOrDefault(u => string.Equals(u.Email, identifier, StringComparison.OrdinalIgnoreCase) || u.AccountNumber == identifier));

    public Task<UserRecord?> FindByIdAsync(long id, CancellationToken ct) => Task.FromResult(Users.FirstOrDefault(u => u.Id == id));

    public Task<UserRecord?> FindByPublicIdAsync(Guid publicId, CancellationToken ct) => Task.FromResult(Users.FirstOrDefault(u => u.PublicId == publicId));

    public Task RecordLoginFailureAsync(long userId, int maxFailures, TimeSpan lockout, DateTime now, CancellationToken ct)
    {
        var u = Users.Single(x => x.Id == userId);
        if (u.FailedLogins + 1 >= maxFailures)
        {
            u.LockedUntil = now + lockout;
            u.FailedLogins = 0;
        }
        else
        {
            u.FailedLogins++;
        }
        return Task.CompletedTask;
    }

    public Task RecordLoginSuccessAsync(long userId, DateTime now, CancellationToken ct)
    {
        var u = Users.Single(x => x.Id == userId);
        u.FailedLogins = 0;
        u.LockedUntil = null;
        return Task.CompletedTask;
    }
}

public sealed class InMemoryRefreshTokenStore : IRefreshTokenStore
{
    public sealed class Row
    {
        public RefreshTokenRecord Record { get; init; } = new();
        public byte[] Hash { get; init; } = [];
        public long? ReplacedById { get; set; }
    }

    public List<Row> Rows { get; } = [];
    private long _next = 1;

    public Task<RefreshTokenRecord?> FindByHashAsync(byte[] tokenHash, CancellationToken ct) =>
        Task.FromResult(Rows.FirstOrDefault(r => r.Hash.SequenceEqual(tokenHash))?.Record);

    public Task InsertAsync(NewRefreshToken t, DateTime now, CancellationToken ct)
    {
        Add(t);
        return Task.CompletedTask;
    }

    public Task<bool> TryRotateAsync(long oldTokenId, NewRefreshToken next, DateTime now, CancellationToken ct)
    {
        lock (Rows)
        {
            var old = Rows.Single(r => r.Record.Id == oldTokenId);
            if (old.Record.UsedAt is not null || old.Record.RevokedAt is not null) return Task.FromResult(false);
            old.Record.UsedAt = now;
            old.ReplacedById = Add(next);
            return Task.FromResult(true);
        }
    }

    public Task RevokeFamilyAsync(long userId, long familyId, DateTime now, CancellationToken ct)
    {
        foreach (var r in Rows.Where(r => r.Record.UserId == userId && r.Record.FamilyId == familyId && r.Record.RevokedAt is null))
            r.Record.RevokedAt = now;
        return Task.CompletedTask;
    }

    private long Add(NewRefreshToken t)
    {
        var id = _next++;
        Rows.Add(new Row
        {
            Record = new RefreshTokenRecord { Id = id, UserId = t.UserId, FamilyId = t.FamilyId, ExpiresAt = t.ExpiresAt },
            Hash = t.TokenHash,
        });
        return id;
    }
}

public sealed class InMemoryAccessStore : IAccessStore
{
    public List<(long UserId, BookingMembership Booking)> Members { get; } = [];
    public List<(long HelperId, long GuestId, HelperGrant Grant)> Helpers { get; } = [];

    public Task<BookingMembership?> FindMembershipAsync(long userId, string bookingNumber, CancellationToken ct) =>
        Task.FromResult(Members.Where(m => m.UserId == userId && m.Booking.Number == bookingNumber).Select(m => m.Booking).FirstOrDefault());

    public Task<HelperGrant?> FindLiveHelperGrantAsync(long helperUserId, long guestUserId, CancellationToken ct) =>
        Task.FromResult(Helpers.Where(h => h.HelperId == helperUserId && h.GuestId == guestUserId && h.Grant.Status == "active").Select(h => h.Grant).FirstOrDefault());
}

public static class TestHashes
{
    public static string Make(string password, int iterations = 1000)
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        var hash = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, System.Security.Cryptography.HashAlgorithmName.SHA512, 64);
        return $"pbkdf2${iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }
}
