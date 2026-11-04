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
    /// <summary>Failed tries across every address before the whole account pauses for <see cref="LockoutMinutes"/>. Much higher than <see cref="MaxFailedLogins"/>, which locks one (account, address) pair, so a stranger cannot easily lock the owner out.</summary>
    [Range(1, 100000)] public int MaxFailedLoginsPerAccount { get; set; } = 30;
    /// <summary>The longest an (account, address) lock can grow to; each repeat lock doubles <see cref="LockoutMinutes"/> up to this.</summary>
    [Range(1, 10080)] public int MaxLockoutMinutes { get; set; } = 1440;
    /// <summary>One-time codes (reset or sign-in, counted separately) emailed per account per hour. Also the cap on emails an unauthenticated caller can trigger.</summary>
    [Range(1, 100)] public int CodeRequestsPerHour { get; set; } = 3;
    /// <summary>Wrong tries across every code issued in the past hour, so asking for a fresh code does not refill the guesses.</summary>
    [Range(1, 1000)] public int MaxCodeAttemptsPerHour { get; set; } = 10;
    /// <summary>Whether the 10-digit account number can be typed at the sign-in page. Off: only the email address signs in.</summary>
    public bool AllowAccountNumberLogin { get; set; }
}
