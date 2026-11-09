using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>
/// The "stop these emails" link on payment and travel notice emails. The link carries the user, the notice category and an HMAC under a key derived from the token
/// signing key, so it cannot be made up, cannot be used for another category's setting, and can never be a sign-in token. It turns off only the email channel for that
/// one category, which is the same switch the guest has in their notification settings. Safety (critical) notices have no link as they cannot be turned off. Pure.
/// </summary>
public static class NoticeEmailRules
{
    public static byte[] KeyFrom(string signingKey) => HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), "notice-email-unsubscribe"u8);

    private static string Sign(byte[] key, string payload) =>
        Convert.ToBase64String(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload))).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool CanUnsubscribe(string category) => category != "critical" && Array.IndexOf(NotificationRules.Categories, category) >= 0;

    /// <summary>The token for a user and category; null for a category that cannot be switched off.</summary>
    public static string? Token(byte[] key, long userId, string category) =>
        CanUnsubscribe(category) ? $"{userId}.{category}.{Sign(key, $"notice-email|{userId}|{category}")}" : null;

    /// <summary>The user and category the token was made for, or null when it is malformed or the signature does not match.</summary>
    public static (long UserId, string Category)? Verify(byte[] key, string? token)
    {
        var parts = (token ?? "").Split('.');
        if (parts.Length != 3 || !long.TryParse(parts[0], out var user) || user <= 0 || !CanUnsubscribe(parts[1])) return null;
        var expected = Encoding.UTF8.GetBytes(Sign(key, $"notice-email|{user}|{parts[1]}"));
        return CryptographicOperations.FixedTimeEquals(expected, Encoding.UTF8.GetBytes(parts[2])) ? (user, parts[1]) : null;
    }

    /// <summary>The preferences with the email channel off for the category; everything else is as it was.</summary>
    public static JsonObject WithEmailOff(JsonObject prefs, string category)
    {
        var next = NotificationRules.NormalizePrefs(prefs);
        if (CanUnsubscribe(category) && next["channels"] is JsonObject ch && ch[category] is JsonObject row) row["email"] = false;
        return next;
    }

    /// <summary>The email body with a plain line at the end saying how to stop these emails; unchanged when there is no link.</summary>
    public static string WithFooter(string body, string? url) =>
        url is null ? body : $"{body}\n\nTo stop these emails, open {url}";
}
