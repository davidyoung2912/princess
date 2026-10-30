using System.Buffers.Text;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

public static class Claims
{
    public const string Subject = "sub";
    public const string Role = "role";
    /// <summary>Set only on a view-as token: the booker acting for the supervised child named by <c>sub</c> (D13).</summary>
    public const string Actor = "act";
}

public sealed record AccessToken(string Token, DateTime ExpiresAt);

public interface ITokenService
{
    AccessToken CreateAccessToken(UserRecord user);
    AccessToken CreateViewAsToken(UserRecord child, Guid actorPublicId);
    /// <summary>Random 256-bit refresh token, URL-safe base64.</summary>
    string NewRefreshToken();
    byte[] HashRefreshToken(string token);
}

public sealed class TokenService(IOptions<JwtOptions> options, IClock clock) : ITokenService
{
    private readonly JwtOptions _o = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public static SymmetricSecurityKey KeyFor(JwtOptions o) => new(Encoding.UTF8.GetBytes(o.SigningKey));

    public AccessToken CreateAccessToken(UserRecord user) => Create(user, null, _o.AccessTokenMinutes);

    public AccessToken CreateViewAsToken(UserRecord child, Guid actorPublicId) => Create(child, actorPublicId, _o.ViewAsTokenMinutes);

    private AccessToken Create(UserRecord user, Guid? actor, int minutes)
    {
        var now = clock.UtcNow;
        var expires = now.AddMinutes(minutes);
        var claims = new Dictionary<string, object>
        {
            [Claims.Subject] = user.PublicId.ToString(),
            [Claims.Role] = user.Role,
        };
        if (actor is { } a) claims[Claims.Actor] = a.ToString();
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _o.Issuer,
            Audience = _o.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            Claims = claims,
            SigningCredentials = new SigningCredentials(KeyFor(_o), SecurityAlgorithms.HmacSha256),
        };
        return new AccessToken(_handler.CreateToken(descriptor), expires);
    }

    public string NewRefreshToken() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    public byte[] HashRefreshToken(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
