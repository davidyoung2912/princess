using System.Security.Cryptography;

namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of QR hand-over (docs/chat-bundles-plan.md, 5.6, phase Q1). A public catalogue item (a venue, a menu) is a <b>direct</b> code: the address names the type and ref and needs no server call to make.
/// Anything personal is a <b>handoff</b> code: a short unguessable code that names a stored share with a short life, which its sender can stop. Nothing here touches a store or a clock.
/// </summary>
public static class ShareCodeRules
{
    /// <summary>The lives a handoff code may have, in minutes: 15 minutes (the default), 1 hour or 24 hours.</summary>
    public static readonly int[] LivesMinutes = [15, 60, 1440];

    public const int DefaultMinutes = 15;

    /// <summary>The most live codes one person may hold at once, so a stuck screen cannot fill the table.</summary>
    public const int MaxLive = 20;

    private const string Alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

    public static int? LifeMinutes(int? minutes) => minutes is null ? DefaultMinutes : LivesMinutes.Contains(minutes.Value) ? minutes : null;

    /// <summary>A code of 16 characters from an alphabet with no look-alikes (about 80 bits), read from the system's random source.</summary>
    public static string NewCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return string.Create(16, bytes, static (span, b) => { for (var i = 0; i < span.Length; i++) span[i] = Alphabet[b[i] % Alphabet.Length]; });
    }

    public static bool PlausibleCode(string? code) => code is { Length: >= 4 and <= 64 } && code.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-');

    private static bool Plain(string? s) => s is { Length: > 0 and <= 80 } && s.All(c => char.IsAsciiLetterOrDigit(c) || c is ':' or '_' or '.' or '-');

    /// <summary>The share ref a direct code (<c>t</c> and <c>r</c>) names, or null when the type is not one the server builds or either part holds anything but plain characters.</summary>
    public static string? DirectRef(string? type, string? r) => Plain(type) && Plain(r) && ChatBundleRules.IsKnownType(type) ? $"{type}:{r}" : null;

    /// <summary>Whether a code made at <paramref name="expiresAt"/> and possibly stopped still opens.</summary>
    public static bool Live(DateTime expiresAt, DateTime? revokedAt, DateTime now) => revokedAt is null && now < expiresAt;

    /// <summary>The pin key that saves what a ref names on a ship (<c>venue:ship.venue</c>, as the venue pins use; a menu saves its restaurant), or null when it cannot be saved.</summary>
    public static string? SaveKey(string? shipId, string? shareRef) =>
        shipId is null ? null : ChatCardRules.ParseVenueRef(shareRef) is { } venue ? $"venue:{shipId}.{venue}" : ChatCardRules.ParseMenuRef(shareRef) is { } menu ? $"venue:{shipId}.{menu.VenueId}" : null;

    /// <summary>The ref a group invite code stores (<c>invite:&lt;group id&gt;</c>), which only a made group's creator may make.</summary>
    public static string InviteRef(Guid groupId) => $"invite:{groupId}";

    /// <summary>The group a ref names when it is an invite ref, or null.</summary>
    public static Guid? InviteGroup(string? shareRef) =>
        shareRef is not null && shareRef.StartsWith("invite:", StringComparison.Ordinal) && Guid.TryParse(shareRef.AsSpan(7), out var id) && id != Guid.Empty ? id : null;

    /// <summary>The ref a connect code stores: it names nobody but the person who made it.</summary>
    public const string ConnectRef = "connect:me";

    public static bool IsConnectRef(string? shareRef) => shareRef == ConnectRef;

    /// <summary>Whether a ref is an invitation to a person or group rather than a bundle: such a code can be made only for an adult and never carries a note.</summary>
    public static bool IsIntroduction(string? shareRef) => IsConnectRef(shareRef) || InviteGroup(shareRef) is not null;
}
