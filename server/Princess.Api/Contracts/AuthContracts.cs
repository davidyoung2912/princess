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
    string Currency);

/// <summary>Instants are epoch milliseconds (D6).</summary>
public sealed record SessionResponse(string AccessToken, long ExpiresAt, string RefreshToken, long RefreshExpiresAt, MeResponse User);

public sealed record ViewAsResponse(string AccessToken, long ExpiresAt, MeResponse User);
