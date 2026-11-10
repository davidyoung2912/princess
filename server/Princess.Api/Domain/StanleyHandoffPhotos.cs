namespace Princess.Api.Domain;

/// <summary>A photo kept for a handoff: its id (what the case's attachment holds), its type and size.</summary>
public sealed record StanleyHandoffPhotoDto(string Id, string Type, int Bytes);

/// <summary>
/// Rules for the photo a guest may add to a handoff case, such as the lost item or a receipt (docs/stanley-gap-analysis-and-plan.md, the carry-over list). A JPEG or PNG of at most 5 MB whose bytes really are one,
/// cleaned of its metadata by <see cref="MediaRules.TryClean"/> (place, time, camera) before it is kept, and not more than <see cref="MaxWaiting"/> waiting for a case at once. The photo is deleted with its case,
/// and one that was never attached to a case is deleted after a day. Pure.
/// </summary>
public static class StanleyHandoffPhotoRules
{
    public const int MaxBytes = 5_000_000;
    public const int MaxWaiting = 3;
    /// <summary>A photo nobody attached to a case is deleted after this many hours.</summary>
    public const int UnattachedHours = 24;

    /// <summary>The photo id as the case holds it (32 hex digits), or null when the text is not one. A path is never built from anything else.</summary>
    public static Guid? Parse(string? id) => id is { Length: 32 } && Guid.TryParseExact(id, "N", out var g) ? g : null;

    public static string IdOf(Guid id) => id.ToString("N");

    /// <summary>The first problem with the bytes as a closed code, or null: <c>empty</c>, <c>size</c>, <c>type</c> (not a JPEG or PNG) or <c>unreadable</c>. When there is none, <paramref name="clean"/> is what is kept.</summary>
    public static string? Check(byte[] body, out byte[] clean, out string type)
    {
        clean = [];
        type = "";
        if (body.Length == 0) return "empty";
        if (body.Length > MaxBytes) return "size";
        if (MediaRules.Sniff(body) is not { } sniffed) return "type";
        type = sniffed;
        return MediaRules.TryClean(body, sniffed, out clean, out _, out _) ? null : "unreadable";
    }
}
