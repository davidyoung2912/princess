namespace Princess.Api.Domain;

/// <summary>Limits for a message with several photos (phase 9b). Each photo is still held to <see cref="ServiceRules.PhotoProblem"/>; these only bound the whole message.</summary>
public static class ChatPhotoRules
{
    /// <summary>Photos after the first, so a message has at most 10.</summary>
    public const int MaxMore = 9;
    /// <summary>The most data URL characters one message may carry in all (ship bandwidth and storage).</summary>
    public const int MaxTotalChars = 6_000_000;

    public static bool TotalTooLarge(IEnumerable<string> dataUrls) => dataUrls.Sum(u => (long)u.Length) > MaxTotalChars;
}
