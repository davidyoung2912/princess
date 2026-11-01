using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

public interface IAuthService
{
    Task<SessionResponse> LoginAsync(LoginRequest request, string? userAgent, string? ip, CancellationToken ct);
    Task<SessionResponse> RefreshAsync(RefreshRequest request, string? userAgent, string? ip, CancellationToken ct);
    Task LogoutAsync(UserRecord user, LogoutRequest request, CancellationToken ct);
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
    IOptions<AuthOptions> auth) : IAuthService
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
        var user = await users.FindByIdentifierAsync(identifier, ct);
        var verified = hasher.Verify(request.Password, user?.PasswordHash ?? DummyHash);
        // Every failure looks the same from outside: unknown account, no password (supervised child), locked, wrong password.
        if (user is null || user.PasswordHash is null) throw BadCredentials();
        if (user.LockedUntil is { } until && until > now) throw BadCredentials();
        if (!verified)
        {
            await users.RecordLoginFailureAsync(user.Id, auth.Value.MaxFailedLogins, TimeSpan.FromMinutes(auth.Value.LockoutMinutes), now, ct);
            throw BadCredentials();
        }

        await users.RecordLoginSuccessAsync(user.Id, now, ct);
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
            throw BadRefreshToken();
        }
        if (record.ExpiresAt <= now) throw BadRefreshToken();

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
    }

    public async Task<ViewAsResponse> ViewAsAsync(UserRecord booker, Guid childPublicId, CancellationToken ct)
    {
        var child = await users.FindByPublicIdAsync(childPublicId, ct);
        // Not your child: the same notFound as a child that does not exist.
        if (child is null || !child.IsSupervised || child.BookerUserId != booker.Id) throw ApiException.NotFound();
        var token = tokens.CreateViewAsToken(child, booker.PublicId);
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

        var id = await signIn.CreateAccountAsync(new NewAccount(email, hasher.Hash(request.Password!), first, last, dob), clock.UtcNow, ct)
            ?? throw ApiException.Conflict("emailTaken");
        var user = await users.FindByIdAsync(id, ct) ?? throw ApiException.Invalid();
        return await IssueAsync(user, Random.Shared.NextInt64(1, long.MaxValue), refreshTokenId: null, userAgent, ip, ct);
    }

    public async Task RequestCodeAsync(string purpose, CodeRequest request, CancellationToken ct)
    {
        var email = NormaliseEmail(request.Email);
        if (email is null) throw ApiException.Invalid();
        var user = await users.FindByIdentifierAsync(email, ct);
        // No answer differs for an unknown address, a child account or an account with no password.
        if (user is null || user.IsSupervised || user.PasswordHash is null || user.Email is null) return;

        var now = clock.UtcNow;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        await signIn.ReplaceChallengeAsync(user.Id, purpose, CodeHash(purpose, user.Id, code), now.AddMinutes(CodeMinutes), now, ct);
        var subject = purpose == Reset ? "Your Princess password reset code" : "Your Princess sign-in code";
        var body = $"Your code is {code}. It works once and lasts {CodeMinutes} minutes. If you did not ask for it, ignore this message; nothing has changed.";
        await sender.SendAsync(new OutboxMessage(user.Id, "email", "critical", user.Email, subject, body), ct);
    }

    public async Task ResetPasswordAsync(ResetRequest request, CancellationToken ct)
    {
        if (!ValidPassword(request.NewPassword)) throw ApiException.Invalid();
        var user = await RedeemAsync(Reset, request.Email, request.Code, ct);
        await signIn.SetPasswordAsync(user.Id, hasher.Hash(request.NewPassword!), clock.UtcNow, ct);
    }

    public async Task<SessionResponse> RedeemMagicAsync(MagicRedeemRequest request, string? userAgent, string? ip, CancellationToken ct)
    {
        var user = await RedeemAsync(Magic, request.Email, request.Code, ct);
        await users.RecordLoginSuccessAsync(user.Id, clock.UtcNow, ct);
        return await IssueAsync(user, Random.Shared.NextInt64(1, long.MaxValue), refreshTokenId: null, userAgent, ip, ct);
    }

    /// <summary>Checks a one-time code and spends it. Every failure is the same <c>badCode</c>: wrong, expired, used, too many tries, unknown address.</summary>
    private async Task<UserRecord> RedeemAsync(string purpose, string? emailText, string? code, CancellationToken ct)
    {
        var email = NormaliseEmail(emailText);
        if (email is null || code is null || code.Length != 6 || !code.All(char.IsAsciiDigit)) throw ApiException.Invalid("badCode");
        var user = await users.FindByIdentifierAsync(email, ct);
        var challenge = user is null ? null : await signIn.FindOpenChallengeAsync(user.Id, purpose, clock.UtcNow, ct);
        if (user is null || challenge is null || challenge.Attempts >= MaxCodeAttempts) throw ApiException.Invalid("badCode");
        if (!CryptographicOperations.FixedTimeEquals(challenge.CodeHash, CodeHash(purpose, user.Id, code)))
        {
            await signIn.AddChallengeAttemptAsync(challenge.Id, ct);
            throw ApiException.Invalid("badCode");
        }
        if (!await signIn.UseChallengeAsync(challenge.Id, clock.UtcNow, ct)) throw ApiException.Invalid("badCode");
        return user;
    }

    public static byte[] CodeHash(string purpose, long userId, string code) => SHA256.HashData(Encoding.UTF8.GetBytes($"{purpose}:{userId}:{code}"));

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
        u.BookerPublicId, u.TextSize, u.Locale, u.Currency);

    public static long Ms(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

    private static string? Trim(string? s, int max) => s is null ? null : s.Length <= max ? s : s[..max];
}
