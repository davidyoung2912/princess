using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// A bundle as it travels in <c>ChatMessages.Payload</c> (docs/chat-bundles-plan.md, section 5.1): something from the app sent into a chat. <c>Title</c>, <c>Subtitle</c>, <c>Path</c>, <c>Day</c>, <c>Time</c> and <c>Place</c>
/// are plain fields so any client can show a bundle without understanding its type; <c>Ref</c> names what it is. Built by the server from its own data, never from what a client sent.
/// </summary>
public sealed record ChatBundle(string Type, int V, string Title, string? Subtitle = null, string? Path = null, int? Day = null, string? Time = null, string? Place = null, string? Ref = null, string? Note = null);

/// <summary>
/// The pure rules of bundle messages, phase B1: the types the server can build (a venue and a menu so far), their refs, the payload and the words a list line and a phone alert show.
/// A bundle carries no money or identity: it passes <see cref="ChatCardRules.HasForbiddenKey"/> before it is stored, like any card. Nothing here touches a store or a clock.
/// </summary>
public static class ChatBundleRules
{
    public const string Kind = "bundle";

    /// <summary>The shape of the payload. A reader that does not know a larger number shows the title and subtitle only.</summary>
    public const int Version = 1;

    public const string Venue = ChatCardRules.Venue, Menu = ChatCardRules.Menu;

    /// <summary>The types the server builds today. More arrive one phase at a time.</summary>
    public static readonly string[] Types = [Venue, Menu];

    public static bool IsKnownType(string? type) => type is not null && Types.Contains(type);

    /// <summary>The type a ref names (the part before the first colon), or null when the ref is empty or names no known type.</summary>
    public static string? TypeOfRef(string? shareRef)
    {
        if (string.IsNullOrWhiteSpace(shareRef)) return null;
        var colon = shareRef.IndexOf(':');
        var type = colon < 0 ? shareRef : shareRef[..colon];
        return IsKnownType(type) ? type : null;
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    public static string Serialise(ChatBundle bundle) => JsonSerializer.Serialize(bundle, Json);

    /// <summary>The bundle in a payload, or null when it is empty, malformed or has no type or title. An unknown type still parses: the reader decides how to show it.</summary>
    public static ChatBundle? Parse(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { return JsonSerializer.Deserialize<ChatBundle>(payload, Json) is { Type.Length: > 0, Title.Length: > 0 } b ? b : null; }
        catch (JsonException) { return null; }
    }

    /// <summary>A card (built from the server's own data) as a bundle of the type its ref names.</summary>
    public static ChatBundle FromCard(string type, string shareRef, ChatCard card, string? note) =>
        new(type, Version, card.Title, card.Subtitle, card.Path, card.Day, card.Time, card.Place, shareRef, ChatCardRules.CleanNote(note));

    /// <summary>The words a list line, a pin and a phone alert show for a bundle (never the payload).</summary>
    public static string Preview(ChatBundle? bundle) => bundle is null ? "Shared from the app" : bundle.Subtitle is { Length: > 0 } s ? $"{bundle.Title}: {s}" : bundle.Title;
}
