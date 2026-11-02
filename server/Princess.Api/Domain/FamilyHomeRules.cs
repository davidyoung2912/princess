using System.Text.Json.Nodes;
using System.Security.Cryptography;
using System.Text;

namespace Princess.Api.Domain;

/// <summary>
/// Family-at-home links (multi-device plan 2, Phase 6). A link is <c>owner.link.expiresMs.signature</c>: the owner's and the link's public ids, the expiry in
/// Unix milliseconds, and an HMAC-SHA256 over those three with a key derived from the token signing key. The signature shows the link was made here and not
/// altered; the <c>FamilyLinks</c> row decides whether it is still live (revoked or not), so a guest can stop a link at any moment.
/// </summary>
public static class FamilyHomeRules
{
    public static readonly int[] DayChoices = [3, 7, 14];
    public const int DefaultDays = 7;
    public const int MaxLiveLinks = 20;
    public const int MaxPostcards = 30;
    public const int MaxNote = 140;
    public static readonly string[] PostcardKinds = ["ok", "sea", "port", "late", "love"];

    /// <summary>The key for link signatures: not the token key itself, so a link signature can never be a sign-in token.</summary>
    public static byte[] KeyFrom(string signingKey) => HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), "family-link"u8);

    public static int DaysOrDefault(int? days) => days is { } d && Array.IndexOf(DayChoices, d) >= 0 ? d : DefaultDays;

    /// <summary>The note a postcard keeps: trimmed, at most <see cref="MaxNote"/> characters. Null for a kind that is not one of the five.</summary>
    public static bool ValidPostcard(string? kind, string? note, out string cleanNote)
    {
        cleanNote = (note ?? "").Trim();
        if (cleanNote.Length > MaxNote) cleanNote = cleanNote[..MaxNote];
        return kind is not null && Array.IndexOf(PostcardKinds, kind) >= 0;
    }

    private static string Payload(Guid owner, Guid link, long expiresMs) => $"{owner:N}.{link:N}.{expiresMs}";

    private static string Sign(byte[] key, string payload) => Convert.ToBase64String(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload))).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Token(byte[] key, Guid owner, Guid link, long expiresMs)
    {
        var payload = Payload(owner, link, expiresMs);
        return $"{payload}.{Sign(key, payload)}";
    }

    /// <summary>Reads a token and checks its signature. False for anything malformed or altered (the same answer for both, so nothing is learned by guessing).</summary>
    public static bool TryRead(byte[] key, string? token, out Guid owner, out Guid link, out long expiresMs)
    {
        owner = link = Guid.Empty;
        expiresMs = 0;
        var parts = (token ?? "").Split('.');
        if (parts.Length != 4 || parts[3].Length == 0) return false;
        if (!Guid.TryParseExact(parts[0], "N", out owner) || !Guid.TryParseExact(parts[1], "N", out link) || !long.TryParse(parts[2], out expiresMs) || expiresMs <= 0) return false;
        var expected = Encoding.ASCII.GetBytes(Sign(key, Payload(owner, link, expiresMs)));
        return CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(parts[3]));
    }

    /// <summary>
    /// The minutes the guest is late, when they have said so and agreed to share it: the open delay in their <c>hub</c> document, told to the party, with ETA sharing on
    /// (the same test as the app's <c>delayVisibleToOthers</c>). Null otherwise, and for a document that is missing or not in the expected shape.
    /// </summary>
    public static int? SharedDelayMinutes(JsonNode? hub)
    {
        if (hub is not JsonObject h || h["delay"] is not JsonObject delay) return null;
        if (delay["shareEta"] is JsonValue share && share.TryGetValue<bool>(out var on) && !on) return null;
        if (delay["current"] is not JsonObject current || current["told"] is not JsonArray told) return null;
        if (!told.Any(x => x is JsonValue v && v.TryGetValue<string>(out var who) && who == "party")) return null;
        return current["lateMinutes"] is JsonValue late && late.TryGetValue<double>(out var minutes) && minutes > 0 ? (int)Math.Min(minutes, 480) : null;
    }
}
