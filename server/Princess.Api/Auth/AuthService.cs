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
}

public sealed class AuthService(
    IUserStore users,
    IRefreshTokenStore refreshTokens,
    IPasswordHasher hasher,
    ITokenService tokens,
    IClock clock,
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
