namespace Princess.Api.Contracts;

public sealed record LoginRequest(string? Identifier, string? Password);

public sealed record RefreshRequest(string? RefreshToken);

public sealed record LogoutRequest(string? RefreshToken);

/// <summary>The signed-in person. <c>Id</c> is the public guid (the wire form of <c>PersonaId</c>, D2).</summary>
public sealed record MeResponse(
    Guid Id,
    string AccountNumber,
    string? Email,
    string? FirstName,
    string? LastName,
    string Role,
    string Tier,
    bool IsDemo,
    bool IsSupervised,
    Guid? BookerId,
    string TextSize,
    string Locale,
    string Currency,
    /// <summary>True while a person at Guest Services is checking whether this account duplicates another (IDN-03).</summary>
    bool NeedsReview = false);

/// <summary>Instants are epoch milliseconds (D6).</summary>
public sealed record SessionResponse(string AccessToken, long ExpiresAt, string RefreshToken, long RefreshExpiresAt, MeResponse User);

public sealed record ViewAsResponse(string AccessToken, long ExpiresAt, MeResponse User);

/// <summary>Sign-up. The account holder must be an adult; children are added as supervised guests by their booker. <c>Dob</c> is "yyyy-MM-dd".</summary>
public sealed record RegisterRequest(string? Email, string? Password, string? FirstName, string? LastName, string? Dob, bool? ConfirmedDifferent = null);

/// <summary>Asks for a one-time code by email: for <c>/auth/forgot</c> a password reset, for <c>/auth/magic</c> a sign-in.</summary>
public sealed record CodeRequest(string? Email);

public sealed record ResetRequest(string? Email, string? Code, string? NewPassword);

public sealed record MagicRedeemRequest(string? Email, string? Code);

/// <summary>One seeded demo account for the non-production sign-in help. The shared demo password is not part of it.</summary>
public sealed record DemoAccountDto(string Email, string FirstName, string? LastName, string Role);
