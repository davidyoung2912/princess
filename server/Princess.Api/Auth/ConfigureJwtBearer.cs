using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Princess.Api.Domain;

namespace Princess.Api.Auth;

/// <summary>Reads the signing key from <see cref="JwtOptions"/> at first use, so configuration added late (user-secrets, tests) is honoured.</summary>
public sealed class ConfigureJwtBearer(IOptions<JwtOptions> jwt) : IConfigureNamedOptions<JwtBearerOptions>
{
    public void Configure(JwtBearerOptions options) => Configure(JwtBearerDefaults.AuthenticationScheme, options);

    public void Configure(string? name, JwtBearerOptions options)
    {
        if (name != JwtBearerDefaults.AuthenticationScheme) return;
        var o = jwt.Value;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = o.Issuer,
            ValidAudience = o.Audience,
            IssuerSigningKey = TokenService.KeyFor(o),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = Claims.Subject,
            RoleClaimType = Claims.Role,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        options.Events = new JwtBearerEvents
        {
            // A password reset ends access tokens already issued, not just refresh tokens. The user row is the cached one every request loads anyway.
            OnTokenValidated = async ctx =>
            {
                if (ctx.SecurityToken is not Microsoft.IdentityModel.JsonWebTokens.JsonWebToken jwt || !Guid.TryParse(jwt.Subject, out var id)) return;
                var user = await ctx.HttpContext.RequestServices.GetRequiredService<Data.IUserStore>().FindByPublicIdAsync(id, ctx.HttpContext.RequestAborted);
                // The stored time is rounded to the second, so allow a second either way.
                if (user?.SessionsValidFrom is { } from && jwt.IssuedAt.AddSeconds(1) < DateTime.SpecifyKind(from, DateTimeKind.Utc))
                    ctx.Fail("sessionEnded");
            },
            // 401 and 403 as problem details; the client refreshes silently on 401 and treats 403 as final.
            OnChallenge = ctx =>
            {
                ctx.HandleResponse();
                return Problems.Write(ctx.HttpContext, ApiErrorCode.Forbidden, "unauthenticated", StatusCodes.Status401Unauthorized);
            },
            OnForbidden = ctx => Problems.Write(ctx.HttpContext, ApiErrorCode.Forbidden, "forbidden", StatusCodes.Status403Forbidden),
        };
    }
}
