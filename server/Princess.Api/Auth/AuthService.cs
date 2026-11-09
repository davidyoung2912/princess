using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

public interface IAuthService
{
    Task<SessionResponse> LoginAsync(LoginRequest request, string? userAgent, string? ip, CancellationToken ct);
    Task<SessionResponse> RefreshAsync(RefreshRequest request, string? userAgent, string? ip, CancellationToken ct);
    Task LogoutAsync(UserRecord user, LogoutRequest request, CancellationToken ct);
    /// <summary>Ends every session this person has, on every device, this one included.</summary>
    Task LogoutEverywhereAsync(UserRecord user, CancellationToken ct);
    /// <summary>The devices this person is signed in on, the one holding <paramref name="currentRefreshToken"/> marked.</summary>
    Task<IReadOnlyList<DeviceSessionDto>> ListSessionsAsync(UserRecord user, string? currentRefreshToken, CancellationToken ct);
    /// <summary>Signs one device out. Not found for a device that is not this person's or is already signed out.</summary>
    Task EndSessionAsync(UserRecord user, string id, CancellationToken ct);
    Task<ViewAsResponse> ViewAsAsync(UserRecord booker, Guid childPublicId, CancellationToken ct);
    Task<SessionResponse> RegisterAsync(RegisterRequest request, string? userAgent, string? ip, CancellationToken ct);
    /// <summary>Always completes without saying whether the address has an account.</summary>
    Task RequestCodeAsync(string purpose, CodeRequest request, CancellationToken ct);
    Task ResetPasswordAsync(ResetRequest request, CancellationToken ct);
    Task<SessionResponse> RedeemMagicAsync(MagicRedeemRequest request, string? userAgent, string? ip, CancellationToken ct);
}

public sealed class AuthService(
    IUserStore users,
    IRefreshTokenStore refreshTokens,
    IPasswordHasher hasher,
    ITokenService tokens,
    IClock clock,
    ISignInStore signIn,
    IMessageSender sender,
    IOptions<JwtOptions> jwt,
    IOptions<AuthOptions> auth,
    IAuditLog audit) : IAuthService
{
    // Verified against when no real hash applies, so an unknown account costs the same time as a wrong password.
    private static readonly string DummyHash = new Pbkdf2PasswordHasher().Hash("not-a-real-password");

    public static ApiException BadCredentials() => ApiException.Unauthenticated("badCredentials");
    public static ApiException BadRefreshToken() => ApiException.Unauthenticated("badRefreshToken");

    public async Task<SessionResponse> LoginAsync(LoginRequest request, string? userAgent, string? ip, CancellationToken ct)
    {
        var identifier = request.Identifier?.Trim();
        if (string.IsNullOrEmpty(identifier) || string.IsNullOrEmpty(request.Password) || identifier.Length > 254 || request.Password.Length > 200)
            throw ApiException.Invalid();

        var now = clock.UtcNow;
        // With account numbers off, a number is just an unknown account: the same time and the same answer.
        var user = IsAccountNumber(identifier) && !auth.Value.AllowAccountNumberLogin ? null : await users.FindByIdentifierAsync(identifier, ct);
        var verified = hasher.Verify(request.Password, user?.PasswordHash ?? DummyHash);
        var address = ip ?? "unknown";
        // Every failure looks the same from outside: unknown account, no password (supervised child), locked, wrong password.
        // The response is the same for every failure; the audit row says which it was.
        if (user is null || user.PasswordHash is null)
        {
            await Audit("auth.login", AuditOutcome.Failure, user, new { reason = user is null ? "unknownAccount" : "noPassword", attempt = AuditContext.Fingerprint(identifier) }, ct);
            throw BadCredentials();
        }
        // Two locks: this account from this address (short, backing off), and the account as a whole (a far higher bar).
        var throttle = await signIn.GetThrottleAsync(user.Id, address, ct);
        if (user.LockedUntil is { } until && until > now || throttle?.LockedUntil is { } pairUntil && pairUntil > now)
        {
            await Audit("auth.login", AuditOutcome.Denied, user, new { reason = "locked" }, ct);
            throw BadCredentials();
        }
        if (!verified)
        {
            var baseLock = TimeSpan.FromMinutes(auth.Value.LockoutMinutes);
            await users.RecordLoginFailureAsync(user.Id, auth.Value.MaxFailedLoginsPerAccount, baseLock, now, ct);
            var state = await signIn.RecordThrottleFailureAsync(user.Id, address, auth.Value.MaxFailedLogins, baseLock, TimeSpan.FromMinutes(auth.Value.MaxLockoutMinutes), now, ct);
            var locks = state.LockedUntil is not null;
            await Audit("auth.login", AuditOutcome.Failure, user, new { reason = "wrongPassword", failedLogins = user.FailedLogins + 1, lockedNow = locks }, ct);
            if (locks) await Audit("auth.lockout", AuditOutcome.Denied, user, new { minutes = (int)(state.LockedUntil!.Value - now).TotalMinutes, strikes = state.Strikes }, ct);
            throw BadCredentials();
        }

        await users.RecordLoginSuccessAsync(user.Id, now, ct);
        if (throttle is not null) await signIn.ClearThrottleAsync(user.Id, address, ct);
        await Audit("auth.login", AuditOutcome.Success, user, new { previousLogin = user.LastLoginAt }, ct);
        var familyId = Random.Shared.NextInt64(1, long.MaxValue);
        return await IssueAsync(user, familyId, refreshTokenId: null, userAgent, ip, ct);
    }

    public async Task<SessionResponse> RefreshAsync(RefreshRequest request, string? userAgent, string? ip, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.RefreshToken) || request.RefreshToken.Length > 200) throw ApiException.Invalid();

        var now = clock.UtcNow;
        var record = await refreshTokens.FindByHashAsync(tokens.HashRefreshToken(request.RefreshToken), ct) ?? throw BadRefreshToken();
        // A spent or revoked token coming back means it was copied: end the whole family, the thief's and the owner's.
        if (record.UsedAt is not null || record.RevokedAt is not null)
        {
            await refreshTokens.RevokeFamilyAsync(record.UserId, record.FamilyId, now, ct);
            await AuditById("auth.refresh.reuse", AuditOutcome.Denied, record.UserId, new { reason = "spentTokenReturned", sessionEnded = true }, ct);
            throw BadRefreshToken();
        }
        if (record.ExpiresAt <= now)
        {
            await AuditById("auth.refresh", AuditOutcome.Failure, record.UserId, new { reason = "expired" }, ct);
            throw BadRefreshToken();
        }

        var user = await users.FindByIdAsync(record.UserId, ct) ?? throw BadRefreshToken();
        return await IssueAsync(user, record.FamilyId, record.Id, userAgent, ip, ct);
    }

    public async Task LogoutAsync(UserRecord user, LogoutRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.RefreshToken)) return;
        var record = await refreshTokens.FindByHashAsync(tokens.HashRefreshToken(request.RefreshToken), ct);
        // Someone else's token is ignored, not revoked: signing out must not be a way to end another person's session.
        if (record is null || record.UserId != user.Id) return;
        await refreshTokens.RevokeFamilyAsync(record.UserId, record.FamilyId, clock.UtcNow, ct);
        await Audit("auth.logout", AuditOutcome.Success, user, null, ct);
    }

    public async Task LogoutEverywhereAsync(UserRecord user, CancellationToken ct)
    {
        await signIn.EndAllSessionsAsync(user.Id, clock.UtcNow, ct);
        await Audit("auth.logoutEverywhere", AuditOutcome.Success, user, null, ct);
    }

    public async Task<IReadOnlyList<DeviceSessionDto>> ListSessionsAsync(UserRecord user, string? currentRefreshToken, CancellationToken ct)
    {
        var now = clock.UtcNow;
        long? current = string.IsNullOrEmpty(currentRefreshToken) || currentRefreshToken.Length > 200
            ? null
            : await refreshTokens.FindOpenFamilyAsync(user.Id, tokens.HashRefreshToken(currentRefreshToken), now, ct);
        var rows = await refreshTokens.ListSessionsAsync(user.Id, now, ct);
        return rows.Select(r => new DeviceSessionDto(
            r.FamilyId.ToString(System.Globalization.CultureInfo.InvariantCulture), DeviceLabel.From(r.UserAgent),
            Ms(r.SignedInAt), Ms(r.LastActiveAt), r.FamilyId == current)).ToList();
    }

    public async Task EndSessionAsync(UserRecord user, string id, CancellationToken ct)
    {
        if (!long.TryParse(id, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var family)) throw ApiException.NotFound();
        var now = clock.UtcNow;
        // Only this person's open sessions count, so an id of someone else's looks the same as one that does not exist.
        if (!(await refreshTokens.ListSessionsAsync(user.Id, now, ct)).Any(r => r.FamilyId == family)) throw ApiException.NotFound();
        await refreshTokens.RevokeFamilyAsync(user.Id, family, now, ct);
        await Audit("auth.sessionEnded", AuditOutcome.Success, user, null, ct);
    }

    public async Task<ViewAsResponse> ViewAsAsync(UserRecord booker, Guid childPublicId, CancellationToken ct)
    {
        var child = await users.FindByPublicIdAsync(childPublicId, ct);
        // Not your child: the same notFound as a child that does not exist.
        if (child is null || !child.IsSupervised || child.BookerUserId != booker.Id) throw ApiException.NotFound();
        var token = tokens.CreateViewAsToken(child, booker.PublicId);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Auth, Action = "auth.viewAs", Outcome = AuditOutcome.Success, ActorPublicId = booker.PublicId, ActorRole = booker.Role, SubjectPublicId = child.PublicId }, ct);
        return new ViewAsResponse(token.Token, Ms(token.ExpiresAt), Me(child));
    }

    public const string Reset = "reset";
    public const string Magic = "magic";
    public const int MinPasswordLength = 10;
    public const int CodeMinutes = 15;
    public const int MaxCodeAttempts = 5;
    public const int MinAccountAge = 18;

    public async Task<SessionResponse> RegisterAsync(RegisterRequest request, string? userAgent, string? ip, CancellationToken ct)
    {
        var email = NormaliseEmail(request.Email);
        var first = request.FirstName?.Trim();
        var last = request.LastName?.Trim();
        if (email is null || !ValidPassword(request.Password) || string.IsNullOrEmpty(first) || string.IsNullOrEmpty(last) || first.Length > 60 || last.Length > 60)
            throw ApiException.Invalid();
        if (!DateOnly.TryParseExact(request.Dob, "yyyy-MM-dd", out var dob) || !AdultOn(dob, DateOnly.FromDateTime(clock.UtcNow)))
            throw ApiException.Invalid("tooYoung");

        // IDN-03: the same name and date of birth as an existing account. Never merged by machine and never said who: the person says whether it is them, and a person at Guest Services settles it.
        var twin = await signIn.FindPossibleDuplicateAsync(first, last, dob, ct);
        if (twin is not null && request.ConfirmedDifferent != true)
        {
            await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Auth, Action = "auth.register", Outcome = AuditOutcome.Denied, Detail = AuditContext.Json(new { reason = "possibleDuplicate", attempt = AuditContext.Fingerprint(email) }) }, ct);
            throw ApiException.Conflict("possibleDuplicate");
        }
        var id = await signIn.CreateAccountAsync(new NewAccount(email, hasher.Hash(request.Password!), first, last, dob, twin is null ? null : "duplicate"), clock.UtcNow, ct)
            ?? await EmailTakenAsync(email, ct);
        var user = await users.FindByIdAsync(id, ct) ?? throw ApiException.Invalid();
        await Audit("auth.register", AuditOutcome.Success, user, twin is null ? null : new { review = "duplicate", matches = twin }, ct);
        return await IssueAsync(user, Random.Shared.NextInt64(1, long.MaxValue), refreshTokenId: null, userAgent, ip, ct);
    }

    public async Task RequestCodeAsync(string purpose, CodeRequest request, CancellationToken ct)
    {
        var email = NormaliseEmail(request.Email);
        if (email is null) throw ApiException.Invalid();
        var user = await users.FindByIdentifierAsync(email, ct);
        // No answer differs for an unknown address, a child account or an account with no password.
        if (user is null || user.IsSupervised || user.PasswordHash is null || user.Email is null)
        {
            await Audit($"auth.{purpose}.request", AuditOutcome.Failure, user, new { reason = user is null ? "unknownAddress" : "notEligible", attempt = AuditContext.Fingerprint(email) }, ct);
            return;
        }

        var now = clock.UtcNow;
        // The same answer as any other request, but no email: a stranger cannot fill someone's inbox with codes.
        var used = await signIn.ChallengeUsageAsync(user.Id, purpose, now.AddHours(-1), ct);
        if (used.Requests >= auth.Value.CodeRequestsPerHour)
        {
            await Audit($"auth.{purpose}.request", AuditOutcome.Denied, user, new { reason = "tooManyRequests" }, ct);
            return;
        }
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var salt = RandomNumberGenerator.GetBytes(16);
        await signIn.ReplaceChallengeAsync(user.Id, purpose, CodeHash(purpose, user.Id, code, salt), salt, now.AddMinutes(CodeMinutes), now, ct);
        var subject = purpose == Reset ? "Your Princess password reset code" : "Your Princess sign-in code";
        var body = $"Your code is {code}. It works once and lasts {CodeMinutes} minutes. If you did not ask for it, ignore this message; nothing has changed.";
        await sender.SendAsync(new OutboxMessage(user.Id, "email", "critical", user.Email, subject, body), ct);
        await Audit($"auth.{purpose}.request", AuditOutcome.Success, user, null, ct);
    }

    public async Task ResetPasswordAsync(ResetRequest request, CancellationToken ct)
    {
        if (!ValidPassword(request.NewPassword)) throw ApiException.Invalid();
        var user = await RedeemAsync(Reset, request.Email, request.Code, ct);
        await signIn.SetPasswordAsync(user.Id, hasher.Hash(request.NewPassword!), clock.UtcNow, ct);
        await Audit("auth.password.reset", AuditOutcome.Success, user, new { sessionsEnded = true }, ct);
    }

    public async Task<SessionResponse> RedeemMagicAsync(MagicRedeemRequest request, string? userAgent, string? ip, CancellationToken ct)
    {
        var user = await RedeemAsync(Magic, request.Email, request.Code, ct);
        await users.RecordLoginSuccessAsync(user.Id, clock.UtcNow, ct);
        await Audit("auth.login", AuditOutcome.Success, user, new { method = "magicCode", previousLogin = user.LastLoginAt }, ct);
        return await IssueAsync(user, Random.Shared.NextInt64(1, long.MaxValue), refreshTokenId: null, userAgent, ip, ct);
    }

    /// <summary>Checks a one-time code and spends it. Every failure is the same <c>badCode</c>: wrong, expired, used, too many tries, unknown address.</summary>
    private async Task<UserRecord> RedeemAsync(string purpose, string? emailText, string? code, CancellationToken ct)
    {
        var email = NormaliseEmail(emailText);
        if (email is null || code is null || code.Length != 6 || !code.All(char.IsAsciiDigit)) throw ApiException.Invalid("badCode");
        var user = await users.FindByIdentifierAsync(email, ct);
        var challenge = user is null ? null : await signIn.FindOpenChallengeAsync(user.Id, purpose, clock.UtcNow, ct);
        // Wrong tries add up across every code issued this hour, so asking for a new code does not refill the guesses.
        var recent = user is null || challenge is null ? null : await signIn.ChallengeUsageAsync(user.Id, purpose, clock.UtcNow.AddHours(-1), ct);
        if (user is null || challenge is null || challenge.Attempts >= MaxCodeAttempts || recent!.Attempts >= auth.Value.MaxCodeAttemptsPerHour)
        {
            await Audit($"auth.{purpose}.redeem", AuditOutcome.Failure, user, new { reason = user is null ? "unknownAddress" : challenge is null ? "noOpenCode" : "tooManyTries", attempt = AuditContext.Fingerprint(email) }, ct);
            throw ApiException.Invalid("badCode");
        }
        var matches = challenge.Salt is { } salt && CryptographicOperations.FixedTimeEquals(challenge.CodeHash, CodeHash(purpose, user.Id, code, salt));
        if (!matches)
        {
            await signIn.AddChallengeAttemptAsync(challenge.Id, ct);
            await Audit($"auth.{purpose}.redeem", AuditOutcome.Failure, user, new { reason = "wrongCode", attempts = challenge.Attempts + 1 }, ct);
            throw ApiException.Invalid("badCode");
        }
        if (!await signIn.UseChallengeAsync(challenge.Id, clock.UtcNow, ct))
        {
            await Audit($"auth.{purpose}.redeem", AuditOutcome.Failure, user, new { reason = "alreadyUsed" }, ct);
            throw ApiException.Invalid("badCode");
        }
        return user;
    }

    /// <summary>HMAC-SHA-256 under a key derived from the server's signing key, over the challenge's own salt, the purpose, the account and the code. A copy of the table cannot be ground against the 10^6 codes without the key.</summary>
    private byte[] CodeHash(string purpose, long userId, string code, byte[] salt)
    {
        var key = HMACSHA256.HashData(Encoding.UTF8.GetBytes(jwt.Value.SigningKey), "auth-code-hash"u8);
        return HMACSHA256.HashData(key, (byte[])[.. salt, .. Encoding.UTF8.GetBytes($"|{purpose}|{userId}|{code}")]);
    }

    private static bool IsAccountNumber(string identifier) => identifier.Length == 10 && identifier.All(char.IsAsciiDigit);

    public static bool ValidPassword(string? p) => p is { Length: >= MinPasswordLength and <= 200 };

    public static bool AdultOn(DateOnly dob, DateOnly today) => dob <= today.AddYears(-MinAccountAge) && dob.Year >= 1900;

    /// <summary>A lower-cased address that looks like one, or null.</summary>
    public static string? NormaliseEmail(string? email)
    {
        var e = email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(e) || e.Length > 254 || !MailAddress.TryCreate(e, out var m) || m.Address != e || !e.Contains('.', StringComparison.Ordinal)) return null;
        return e;
    }

    private async Task<SessionResponse> IssueAsync(UserRecord user, long familyId, long? refreshTokenId, string? userAgent, string? ip, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var access = tokens.CreateAccessToken(user);
        var refresh = tokens.NewRefreshToken();
        var expires = now.AddDays(jwt.Value.RefreshTokenDays);
        var next = new NewRefreshToken(user.Id, familyId, tokens.HashRefreshToken(refresh), expires, Trim(userAgent, 200), Trim(ip, 45));
        if (refreshTokenId is { } old)
        {
            if (!await refreshTokens.TryRotateAsync(old, next, now, ct))
            {
                // Lost a race with a second use of the same token: treat it as a replay.
                await refreshTokens.RevokeFamilyAsync(user.Id, familyId, now, ct);
                throw BadRefreshToken();
            }
        }
        else
        {
            await refreshTokens.InsertAsync(next, now, ct);
        }
        return new SessionResponse(access.Token, Ms(access.ExpiresAt), refresh, Ms(expires), Me(user));
    }

    public static MeResponse Me(UserRecord u) => new(
        u.PublicId, u.AccountNumber, u.Email, u.FirstName, u.LastName, u.Role, u.Tier, u.IsDemo, u.IsSupervised,
        u.BookerPublicId, u.TextSize, u.Locale, u.Currency, u.ReviewReason is not null);

    public static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    /// <summary>One authentication event about <paramref name="user"/> (null when the account is unknown). The actor is the person signing in, who is not yet on a token.</summary>
    private Task Audit(string action, string outcome, UserRecord? user, object? detail, CancellationToken ct) =>
        audit.RecordAsync(new AuditEntry
        {
            Category = AuditCategory.Auth, Action = action, Outcome = outcome,
            ActorPublicId = user?.PublicId, ActorRole = user?.Role ?? "anonymous", SubjectPublicId = user?.PublicId,
            Detail = detail is null ? null : AuditContext.Json(detail),
        }, ct);

    private async Task AuditById(string action, string outcome, long userId, object? detail, CancellationToken ct) =>
        await Audit(action, outcome, await users.FindByIdAsync(userId, ct), detail, ct);

    private async Task<long> EmailTakenAsync(string email, CancellationToken ct)
    {
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Auth, Action = "auth.register", Outcome = AuditOutcome.Failure, Detail = AuditContext.Json(new { reason = "emailTaken", attempt = AuditContext.Fingerprint(email) }) }, ct);
        throw ApiException.Conflict("emailTaken");
    }

    private static string? Trim(string? s, int max) => s is null ? null : s.Length <= max ? s : s[..max];
}
