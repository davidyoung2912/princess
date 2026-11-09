using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>
/// Stopping text notices by replying to one with STOP. Pure: reads the reply, decides whether a number is the one a profile has, and turns the text channel off for
/// every category the guest can switch (safety notices cannot be switched off and keep their text channel).
/// </summary>
public static class SmsReplyRules
{
    private static readonly string[] StopWords = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];

    /// <summary>Whether the reply is a stop word on its own (any case, spacing or trailing punctuation), as carriers define it.</summary>
    public static bool IsStop(string? body) =>
        Array.IndexOf(StopWords, (body ?? "").Trim().TrimEnd('.', '!').Trim().ToLowerInvariant()) >= 0;

    private static string Digits(string? s) => new([.. (s ?? "").Where(char.IsAsciiDigit)]);

    /// <summary>The last four digits of a number, used to narrow the profiles looked at; null when there are fewer than seven digits.</summary>
    public static string? Tail(string? phone) => Digits(phone) is { Length: >= 7 } d ? d[^4..] : null;

    /// <summary>Whether the number a text came from is the profile's number: the same digits, or (when both have a country code) one ends with the other.</summary>
    public static bool SameNumber(string? from, string? profilePhone)
    {
        string a = Digits(from), b = Digits(profilePhone);
        if (a.Length < 7 || b.Length < 7) return false;
        if (a == b) return true;
        return Math.Min(a.Length, b.Length) >= 10 && (a.EndsWith(b, StringComparison.Ordinal) || b.EndsWith(a, StringComparison.Ordinal));
    }

    /// <summary>The preferences with the text channel off for every category that can be switched; push and email are as they were.</summary>
    public static JsonObject WithSmsOff(JsonObject prefs)
    {
        var next = NotificationRules.NormalizePrefs(prefs);
        if (next["channels"] is JsonObject ch)
            foreach (var c in NotificationRules.Categories)
                if (c != "critical" && ch[c] is JsonObject row) row["sms"] = false;
        return next;
    }

    public const int SignatureToleranceSeconds = 300;

    /// <summary>The signature a text provider's adapter puts in <c>X-Signature</c>: <c>sha256=</c> and the lower-case hex HMAC-SHA256, under the signing key, of <c>{timestamp}.{raw body}</c>.</summary>
    public static string Sign(string signingKey, string timestamp, string rawBody) =>
        "sha256=" + Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes($"{timestamp}.{rawBody}"))).ToLowerInvariant();

    /// <summary>Whether the signature is right for this body and the timestamp (Unix seconds) is within five minutes of now, so a captured request cannot be replayed later. False when no key is set.</summary>
    public static bool SignatureOk(string? signingKey, string? timestamp, string? signature, string rawBody, long nowUnixSeconds)
    {
        if (string.IsNullOrEmpty(signingKey) || string.IsNullOrEmpty(signature) || !long.TryParse(timestamp, out var ts)) return false;
        if (Math.Abs(nowUnixSeconds - ts) > SignatureToleranceSeconds) return false;
        return SecretOk(Sign(signingKey, timestamp!, rawBody), signature.Trim().ToLowerInvariant());
    }

    /// <summary>Whether the shared secret sent with an inbound text is the configured one (compared in constant time). False when none is configured.</summary>
    public static bool SecretOk(string? configured, string? given)
    {
        if (string.IsNullOrEmpty(configured) || string.IsNullOrEmpty(given)) return false;
        return CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(configured)), SHA256.HashData(Encoding.UTF8.GetBytes(given)));
    }
}
