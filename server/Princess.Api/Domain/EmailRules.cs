using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>
/// Checking that an email address is the guest's before payment and travel notices go to it (the same method as <see cref="PhoneRules"/>, and the same stored
/// document: <c>Phone</c> holds the address here). A six-digit code is emailed to the address on the account; typing it back confirms that exact address.
/// Pure: no clock, no store.
/// </summary>
public static class EmailRules
{
    public const string StateKey = "emailCheck";

    /// <summary>The address trimmed and in lower case, so capital letters do not matter; empty when there is nothing usable.</summary>
    public static string Normalise(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public static byte[] KeyFrom(string signingKey) => HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), "email-check"u8);

    public static string Compose(string code) =>
        $"Your Princess email check code is {code}. It works for {PhoneRules.CodeMinutes} minutes. If you did not ask for it, ignore this email.";

    public static bool IsVerified(PhoneCheckDoc d, string? accountEmail)
    {
        var e = Normalise(accountEmail);
        return e.Length > 0 && d.Verified == e;
    }

    /// <summary>Judges a typed code against the waiting one for this address. The returned document is what to keep.</summary>
    public static (PhoneRules.Result Result, PhoneCheckDoc Doc) Check(PhoneCheckDoc d, byte[] key, string? accountEmail, string? typed, long nowMs)
    {
        var email = Normalise(accountEmail);
        if (d.Hash is null || d.Salt is null || d.Phone != email || email.Length == 0) return (PhoneRules.Result.NoCode, d);
        if (d.Attempts >= PhoneRules.MaxAttempts) return (PhoneRules.Result.TooMany, d);
        if (nowMs > d.ExpiresAt) return (PhoneRules.Result.Expired, d);
        var code = (typed ?? "").Trim();
        var expected = Encoding.UTF8.GetBytes(d.Hash);
        var given = Encoding.UTF8.GetBytes(PhoneRules.Hash(key, d.Salt, email, code));
        if (code.Length != 6 || !code.All(char.IsAsciiDigit) || !CryptographicOperations.FixedTimeEquals(expected, given))
            return (PhoneRules.Result.Wrong, d with { Attempts = d.Attempts + 1 });
        return (PhoneRules.Result.Verified, new(email, null, null, null, 0, 0, d.SentAt));
    }
}
