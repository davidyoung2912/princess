using Princess.Api.Data;

namespace Princess.Api.Tests.Support;

public sealed class InMemorySignInStore(InMemoryUserStore users, InMemoryRefreshTokenStore refresh) : ISignInStore
{
    public sealed class Challenge
    {
        public ChallengeRecord Record { get; init; } = new();
        public string Purpose { get; init; } = "";
        public DateTime? UsedAt { get; set; }
        public DateTime CreatedAt { get; init; }
    }

    public List<Challenge> Challenges { get; } = [];
    public List<OutboxMessage> Outbox { get; } = [];
    public Dictionary<(long UserId, string Ip), (ThrottleState State, DateTime At)> Throttles { get; } = [];
    private long _next = 1;

    public Task<ChallengeUsage> ChallengeUsageAsync(long userId, string purpose, DateTime since, CancellationToken ct)
    {
        var rows = Challenges.Where(c => c.Record.UserId == userId && c.Purpose == purpose && c.CreatedAt >= since).ToList();
        return Task.FromResult(new ChallengeUsage(rows.Count, rows.Sum(c => c.Record.Attempts)));
    }

    public Task<ThrottleState?> GetThrottleAsync(long userId, string ip, CancellationToken ct) =>
        Task.FromResult(Throttles.TryGetValue((userId, ip), out var t) ? t.State : null);

    public Task<ThrottleState> RecordThrottleFailureAsync(long userId, string ip, int maxFailures, TimeSpan baseLockout, TimeSpan maxLockout, DateTime now, CancellationToken ct)
    {
        Throttles.TryGetValue((userId, ip), out var old);
        var next = LoginThrottle.Next(old.State, old.State is null ? null : old.At, maxFailures, baseLockout, maxLockout, now);
        Throttles[(userId, ip)] = (next, now);
        return Task.FromResult(next);
    }

    public Task ClearThrottleAsync(long userId, string ip, CancellationToken ct)
    {
        Throttles.Remove((userId, ip));
        return Task.CompletedTask;
    }

    public List<(Guid Id, string First, string Last, DateOnly Dob)> People { get; } = [];

    public Task<Guid?> FindPossibleDuplicateAsync(string firstName, string lastName, DateOnly dob, CancellationToken ct) =>
        Task.FromResult(People.Where(p => p.Dob == dob && string.Equals(p.First, firstName, StringComparison.OrdinalIgnoreCase) && string.Equals(p.Last, lastName, StringComparison.OrdinalIgnoreCase)).Select(p => (Guid?)p.Id).FirstOrDefault());

    public Task<IReadOnlyList<ReviewItem>> ListReviewsAsync(CancellationToken ct)
    {
        var items = users.Users.Where(u => u.ReviewReason is not null).Select(u =>
        {
            var me = People.First(p => p.Id == u.PublicId);
            var matches = People.Where(p => p.Id != me.Id && p.Dob == me.Dob && string.Equals(p.First, me.First, StringComparison.OrdinalIgnoreCase) && string.Equals(p.Last, me.Last, StringComparison.OrdinalIgnoreCase))
                .Select(p => new ReviewMatch(p.Id, users.Users.First(x => x.PublicId == p.Id).AccountNumber, DateTime.UtcNow)).ToList();
            return new ReviewItem(u.PublicId, u.AccountNumber, me.First, me.Last, me.Dob, DateTime.UtcNow, matches);
        }).ToList();
        return Task.FromResult<IReadOnlyList<ReviewItem>>(items);
    }

    public Task<bool> ClearReviewAsync(Guid publicId, DateTime now, CancellationToken ct)
    {
        var user = users.Users.FirstOrDefault(u => u.PublicId == publicId && u.ReviewReason is not null);
        if (user is null) return Task.FromResult(false);
        user.ReviewReason = null;
        return Task.FromResult(true);
    }

    public Task<long?> CreateAccountAsync(NewAccount a, DateTime now, CancellationToken ct)
    {
        if (users.Users.Any(u => string.Equals(u.Email, a.Email, StringComparison.OrdinalIgnoreCase))) return Task.FromResult<long?>(null);
        var user = users.Add(a.Email, null, first: a.FirstName);
        user.PasswordHash = a.PasswordHash;
        user.LastName = a.LastName;
        user.ReviewReason = a.ReviewReason;
        People.Add((user.PublicId, a.FirstName, a.LastName, a.Dob));
        return Task.FromResult<long?>(user.Id);
    }

    public Task SetPasswordAsync(long userId, string passwordHash, DateTime now, CancellationToken ct)
    {
        var u = users.Users.Single(x => x.Id == userId);
        u.PasswordHash = passwordHash;
        u.FailedLogins = 0;
        u.LockedUntil = null;
        u.SessionsValidFrom = now;
        foreach (var key in Throttles.Keys.Where(k => k.UserId == userId).ToList()) Throttles.Remove(key);
        foreach (var row in refresh.Rows.Where(r => r.Record.UserId == userId && r.Record.RevokedAt is null && r.Record.UsedAt is null)) row.Record.RevokedAt = now;
        return Task.CompletedTask;
    }

    public Task EndAllSessionsAsync(long userId, DateTime now, CancellationToken ct)
    {
        users.Users.Single(x => x.Id == userId).SessionsValidFrom = now;
        foreach (var row in refresh.Rows.Where(r => r.Record.UserId == userId && r.Record.RevokedAt is null && r.Record.UsedAt is null)) row.Record.RevokedAt = now;
        return Task.CompletedTask;
    }

    public Task ReplaceChallengeAsync(long userId, string purpose, byte[] codeHash, byte[] salt, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        foreach (var c in Challenges.Where(c => c.Record.UserId == userId && c.Purpose == purpose && c.UsedAt is null)) c.UsedAt = now;
        Challenges.Add(new Challenge { Purpose = purpose, CreatedAt = now, Record = new ChallengeRecord { Id = _next++, UserId = userId, CodeHash = codeHash, Salt = salt, ExpiresAt = expiresAt } });
        return Task.CompletedTask;
    }

    public Task<ChallengeRecord?> FindOpenChallengeAsync(long userId, string purpose, DateTime now, CancellationToken ct) =>
        Task.FromResult(Challenges.LastOrDefault(c => c.Record.UserId == userId && c.Purpose == purpose && c.UsedAt is null && c.Record.ExpiresAt > now)?.Record);

    public Task AddChallengeAttemptAsync(long challengeId, CancellationToken ct)
    {
        Challenges.Single(c => c.Record.Id == challengeId).Record.Attempts++;
        return Task.CompletedTask;
    }

    public Task<bool> UseChallengeAsync(long challengeId, DateTime now, CancellationToken ct)
    {
        var c = Challenges.Single(x => x.Record.Id == challengeId);
        if (c.UsedAt is not null) return Task.FromResult(false);
        c.UsedAt = now;
        return Task.FromResult(true);
    }

    public Task AddOutboxAsync(OutboxMessage message, string status, DateTime now, CancellationToken ct)
    {
        Outbox.Add(message);
        return Task.CompletedTask;
    }
}
