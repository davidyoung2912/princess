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
    /// <summary>Access tokens issued before this moment are refused (set when the password is reset).</summary>
    public DateTime? SessionsValidFrom { get; set; }
    /// <summary>The last successful sign-in before this one (shown in the activity report as "previous sign-in").</summary>
    public DateTime? LastLoginAt { get; set; }
    /// <summary>Why a person must look at this account ('duplicate'), or null.</summary>
    public string? ReviewReason { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public Guid? BookerPublicId { get; set; }

    /// <summary>A copy, so a cached row is never shared between requests.</summary>
    public UserRecord Copy() => (UserRecord)MemberwiseClone();
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

/// <summary>One signed-in device: a refresh-token family that is still open. Times are UTC.</summary>
public sealed class SessionRow
{
    public long FamilyId { get; set; }
    public string? UserAgent { get; set; }
    public DateTime SignedInAt { get; set; }
    public DateTime LastActiveAt { get; set; }
}

public sealed record NewRefreshToken(long UserId, long FamilyId, byte[] TokenHash, DateTime ExpiresAt, string? UserAgent, string? Ip);

public sealed class BookingMembership
{
    public long BookingId { get; set; }
    public string Number { get; set; } = "";
    public long BookerUserId { get; set; }
    public bool IsLead { get; set; }
}

/// <summary>A guest who named this user as a live helper.</summary>
public sealed record HelpedGuest(long GuestUserId, string Relationship, string Permissions, DateTime ChangedAt);

public sealed class HelperGrant
{
    public string Permissions { get; set; } = "";
    public string Status { get; set; } = "";
    /// <summary>When the guest last saved the link. A helper's Stanley permission lasts <c>StanleyHelperRules.GrantDays</c> from here.</summary>
    public DateTime ChangedAt { get; set; }
}
