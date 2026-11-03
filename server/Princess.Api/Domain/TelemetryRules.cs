using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>One queued item: <c>error</c> (kind and scrubbed message) or <c>event</c> (a named count, optionally the screen).</summary>
public sealed record TelemetryItemDto(string Type, string? Kind, string? Message, string? Name, string? Screen, string At);

public sealed record TelemetryBatchDto(List<TelemetryItemDto>? Items);

/// <summary>What may be sent as telemetry. Mirrors <c>src/diagnostics/telemetry.ts</c>; anything outside it is refused, so no person, booking or typed text can arrive by accident.</summary>
public static class TelemetryRules
{
    public const int MaxItems = 100, MaxMessage = 500;
    public static readonly string[] Kinds = ["error", "promise", "screen", "storage", "slow"];
    public static readonly string[] Events = ["screen", "install", "offlineUse", "dataLight"];
    private static readonly Regex Screen = new("^[a-z0-9][a-z0-9/-]{0,39}$", RegexOptions.Compiled);

    private static readonly Regex Links = new(@"https?://\S+", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex Emails = new(@"[\w.+-]+@[\w-]+\.[\w.-]+", RegexOptions.Compiled);
    private static readonly Regex Numbers = new(@"\d[\d\s-]{5,}\d", RegexOptions.Compiled);

    /// <summary>The same scrub the app applies (addresses, e-mail and long digit runs out), repeated here because a client message is never trusted to have been scrubbed.</summary>
    public static string Scrub(string text) => Numbers.Replace(Emails.Replace(Links.Replace(text, "[link]"), "[email]"), "[number]").Trim();

    public static bool Valid(IReadOnlyList<TelemetryItemDto>? items) =>
        items is { Count: > 0 and <= MaxItems } && items.All(ValidItem);

    private static bool ValidItem(TelemetryItemDto? i)
    {
        if (i is null || !DateTimeOffset.TryParse(i.At, out _) || i.At.Length > 40) return false;
        return i.Type switch
        {
            "error" => Array.IndexOf(Kinds, i.Kind) >= 0 && i.Message is { Length: <= MaxMessage } && i.Name is null && i.Screen is null,
            "event" => Array.IndexOf(Events, i.Name) >= 0 && (i.Screen is null || Screen.IsMatch(i.Screen)) && i.Kind is null && i.Message is null,
            _ => false,
        };
    }
}
