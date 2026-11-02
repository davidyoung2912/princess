using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>The guest's "remind me in a week": when, which sailing, and whether they also asked for one email.</summary>
public sealed record ReminderDoc(long At, string SailingId, bool Email);

/// <summary>
/// "Remind me in a week" by email (small delights DL5). One plain email, sent only because the guest turned it on, once for the date they chose, with a link that
/// switches it off with no sign-in. The link carries the user, the reminder's date and an HMAC under a key derived from the token signing key, so it cannot be made
/// up or reused for another reminder, and it can never be a sign-in token. Pure: no clock, no store.
/// </summary>
public static class ReminderRules
{
    public static byte[] KeyFrom(string signingKey) => HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), "reminder-unsubscribe"u8);

    private static string Sign(byte[] key, string payload) =>
        Convert.ToBase64String(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload))).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Token(byte[] key, long userId, long at) => $"{userId}.{at}.{Sign(key, $"reminder|{userId}|{at}")}";

    /// <summary>The user and date the token was made for, or null when it is malformed or the signature does not match.</summary>
    public static (long UserId, long At)? Verify(byte[] key, string? token)
    {
        var parts = (token ?? "").Split('.');
        if (parts.Length != 3 || !long.TryParse(parts[0], out var user) || !long.TryParse(parts[1], out var at) || user <= 0 || at <= 0) return null;
        var expected = Encoding.UTF8.GetBytes(Sign(key, $"reminder|{user}|{at}"));
        return CryptographicOperations.FixedTimeEquals(expected, Encoding.UTF8.GetBytes(parts[2])) ? (user, at) : null;
    }

    /// <summary>Reads the stored document; null when there is no usable date.</summary>
    public static ReminderDoc? Parse(string? json)
    {
        try
        {
            if (JsonNode.Parse(json ?? "null") is not JsonObject o || o["at"] is not JsonValue a || !a.TryGetValue<long>(out var at) || at <= 0) return null;
            var sailing = o["sailingId"] is JsonValue s && s.TryGetValue<string>(out var id) ? id : "";
            return new(at, sailing.Length > 40 ? "" : sailing, o["email"] is JsonValue e && e.TryGetValue<bool>(out var on) && on);
        }
        catch (System.Text.Json.JsonException) { return null; }
    }

    /// <summary>The same document with the email switched off.</summary>
    public static string WithoutEmail(string? json)
    {
        var o = (JsonNode.Parse(json ?? "{}") as JsonObject) ?? new JsonObject();
        o["email"] = false;
        return o.ToJsonString();
    }

    /// <summary>Whether an email should go: asked for, the time has come, the guest has an address, and it was not sent for this date.</summary>
    public static bool EmailDue(ReminderDoc? r, long nowMs, string? address, bool alreadySent) =>
        r is { Email: true } && nowMs >= r.At && !string.IsNullOrWhiteSpace(address) && !alreadySent;

    public static string EmailKey(long at) => $"reminder:{at}:email";

    public static (string Subject, string Body) Compose(string? departure, string unsubscribeUrl)
    {
        var about = departure is { Length: > 0 } ? $"the sailing on {departure}" : "your cruise";
        return ("A week has passed",
            $"You asked us to remind you, once, to think about {about}.\n\nYour notes are in the app whenever you are ready. Nothing is booked or held, and no price or cabin is kept for you.\n\n" +
            $"This is the only email we will send about it. To make sure you get no other, or to stop it before it arrives:\n{unsubscribeUrl}");
    }
}
