using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>What is kept about checking the guest's phone number: the number last confirmed, and the code now waiting (as a salted hash, never the code).</summary>
public sealed record PhoneCheckDoc(string? Verified, string? Phone, string? Hash, string? Salt, long ExpiresAt, int Attempts, long SentAt);

/// <summary>
/// Checking that a phone number is the guest's before texts go to it. A six-digit code is texted to the number on the profile; typing it back confirms that exact
/// number. Changing the number on the profile makes it unconfirmed again, so a typo or someone else's number never gets a notice. The code is kept only as an HMAC
/// under a key derived from the token signing key, lasts 10 minutes, allows 5 wrong tries and can be asked for again after a minute. Pure: no clock, no store.
/// </summary>
public static class PhoneRules
{
    public const int CodeMinutes = 10, MaxAttempts = 5, ResendSeconds = 60;
    public const string StateKey = "phoneCheck";

    /// <summary>The number as digits with a leading plus kept, so spacing and dashes do not matter; empty when there is nothing usable.</summary>
    public static string Normalise(string? phone)
    {
        var s = (phone ?? "").Trim();
        var digits = new string([.. s.Where(char.IsAsciiDigit)]);
        return digits.Length == 0 ? "" : (s.StartsWith('+') ? "+" : "") + digits;
    }

    public static byte[] KeyFrom(string signingKey) => HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), "phone-check"u8);

    public static string NewCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    public static string Hash(byte[] key, string salt, string phone, string code) =>
        Convert.ToBase64String(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{salt}|{phone}|{code}")));

    public static string Compose(string code) => $"Your Princess phone check code is {code}. It works for {CodeMinutes} minutes. If you did not ask for it, ignore this text.";

    public static PhoneCheckDoc Parse(string? json)
    {
        try
        {
            if (JsonNode.Parse(json ?? "null") is JsonObject o)
                return new(Str(o["verified"]), Str(o["phone"]), Str(o["hash"]), Str(o["salt"]), Num(o["expiresAt"]), (int)Num(o["attempts"]), Num(o["sentAt"]));
        }
        catch (JsonException) { }
        return new(null, null, null, null, 0, 0, 0);
    }

    public static string ToJson(PhoneCheckDoc d) => new JsonObject
    {
        ["verified"] = d.Verified, ["phone"] = d.Phone, ["hash"] = d.Hash, ["salt"] = d.Salt,
        ["expiresAt"] = d.ExpiresAt, ["attempts"] = d.Attempts, ["sentAt"] = d.SentAt,
    }.ToJsonString();

    /// <summary>Whether the number on the profile is the one that was confirmed.</summary>
    public static bool IsVerified(PhoneCheckDoc d, string? profilePhone)
    {
        var p = Normalise(profilePhone);
        return p.Length > 0 && d.Verified == p;
    }

    /// <summary>Whether a new code may be sent now (a minute since the last).</summary>
    public static bool CanSend(PhoneCheckDoc d, long nowMs) => nowMs - d.SentAt >= ResendSeconds * 1000L;

    public enum Result { Verified, Wrong, Expired, TooMany, NoCode }

    /// <summary>Judges a typed code against the waiting one for this number. The returned document is what to keep.</summary>
    public static (Result Result, PhoneCheckDoc Doc) Check(PhoneCheckDoc d, byte[] key, string? profilePhone, string? typed, long nowMs)
    {
        var phone = Normalise(profilePhone);
        if (d.Hash is null || d.Salt is null || d.Phone != phone || phone.Length == 0) return (Result.NoCode, d);
        if (d.Attempts >= MaxAttempts) return (Result.TooMany, d);
        if (nowMs > d.ExpiresAt) return (Result.Expired, d);
        var code = (typed ?? "").Trim();
        var expected = Encoding.UTF8.GetBytes(d.Hash);
        var given = Encoding.UTF8.GetBytes(Hash(key, d.Salt, phone, code));
        if (code.Length != 6 || !code.All(char.IsAsciiDigit) || !CryptographicOperations.FixedTimeEquals(expected, given))
            return (Result.Wrong, d with { Attempts = d.Attempts + 1 });
        return (Result.Verified, new(phone, null, null, null, 0, 0, d.SentAt));
    }

    private static string? Str(JsonNode? n) => n is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
    private static long Num(JsonNode? n) => n is JsonValue v && v.TryGetValue<long>(out var l) ? l : 0;
}
