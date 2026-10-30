namespace Princess.Api.Data;

public sealed class UserRecord
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string AccountNumber { get; set; } = "";
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = "guest";
    public bool IsDemo { get; set; }
    public bool IsSupervised { get; set; }
    public long? BookerUserId { get; set; }
    public string Tier { get; set; } = "none";
    public string TextSize { get; set; } = "standard";
    public string Locale { get; set; } = "en";
    public string Currency { get; set; } = "USD";
    public int FailedLogins { get; set; }
    public DateTime? LockedUntil { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public Guid? BookerPublicId { get; set; }
}

public sealed class RefreshTokenRecord
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public long FamilyId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public sealed record NewRefreshToken(long UserId, long FamilyId, byte[] TokenHash, DateTime ExpiresAt, string? UserAgent, string? Ip);

public sealed class BookingMembership
{
    public long BookingId { get; set; }
    public string Number { get; set; } = "";
    public long BookerUserId { get; set; }
    public bool IsLead { get; set; }
}

public sealed class HelperGrant
{
    public string Permissions { get; set; } = "";
    public string Status { get; set; } = "";
}
