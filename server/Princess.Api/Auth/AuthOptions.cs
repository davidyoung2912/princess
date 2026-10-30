using System.ComponentModel.DataAnnotations;

namespace Princess.Api.Auth;

/// <summary>Token settings. <c>SigningKey</c> is a secret: user-secrets or an environment variable, never a tracked file.</summary>
public sealed class JwtOptions
{
    public const string Section = "Jwt";

    [Required, MinLength(1)] public string Issuer { get; set; } = "";
    [Required, MinLength(1)] public string Audience { get; set; } = "";
    [MinLength(32, ErrorMessage = "Jwt:SigningKey must be at least 32 characters. Set it with: dotnet user-secrets set \"Jwt:SigningKey\" \"<random 48+ chars>\"")]
    public string SigningKey { get; set; } = "";
    [Range(1, 1440)] public int AccessTokenMinutes { get; set; } = 15;
    [Range(1, 1440)] public int ViewAsTokenMinutes { get; set; } = 15;
    [Range(1, 365)] public int RefreshTokenDays { get; set; } = 30;
}

public sealed class AuthOptions
{
    public const string Section = "Auth";

    [Range(1, 100)] public int MaxFailedLogins { get; set; } = 5;
    [Range(1, 1440)] public int LockoutMinutes { get; set; } = 15;
    [Range(1, 10000)] public int LoginAttemptsPerMinute { get; set; } = 10;
}
