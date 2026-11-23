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

    /// <summary>
    /// Phase B2: things with a day and a time. Their ref is <c>event:&lt;eventId&gt;:&lt;day&gt;</c> (the same <c>eventId:day</c> a plan uses), and the type the bundle carries is <c>excursion</c> for a tour, <c>dinner</c> for a dinner
    /// and <c>event</c> for anything else on the programme or in an Explorer (a show, a class, an activity).
    /// </summary>
    public const string Event = "event", Excursion = "excursion", Dinner = "dinner";

    /// <summary>
    /// Phase B7: a port on the guest's own itinerary (<c>port:&lt;portId&gt;</c>), a place on the ship (<c>place:&lt;placeId&gt;</c>) and a dish on a menu of the guest's ship (<c>dish:&lt;venueId&gt;:&lt;slug&gt;</c>).
    /// None has a day and a time of its own, so none is plannable; a place is a place to find, never a live "meet me here" (that stays the place card).
    /// </summary>
    public const string Port = "port", Place = "place", Dish = "dish";

    /// <summary>The types a ref can name today (the prefix of the ref). More arrive one phase at a time.</summary>
    public static readonly string[] Types = [Venue, Menu, Event, Port, Place, Dish];

    /// <summary>The id in a <c>port:</c> or <c>place:</c> ref, or null when the ref is not one or the id has anything but letters, digits, dashes and underscores.</summary>
    public static string? IdOf(string? shareRef, string type) =>
        shareRef is { } r && r.StartsWith(type + ":", StringComparison.Ordinal) && r[(type.Length + 1)..] is { Length: > 0 and <= 60 } id && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_') ? id : null;

    /// <summary>The venue id and dish slug in a <c>dish:&lt;venueId&gt;:&lt;slug&gt;</c> ref, or null.</summary>
    public static (string VenueId, string Slug)? ParseDishRef(string? shareRef)
    {
        if (shareRef is not { } r || !r.StartsWith("dish:", StringComparison.Ordinal)) return null;
        var parts = r[5..].Split(':');
        return parts.Length == 2 && parts.All(p => p.Length is > 0 and <= 60 && p.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_')) ? (parts[0], parts[1]) : null;
    }

    /// <summary>The types a bundle can carry that have a day and a time: they can be proposed (Going, Maybe, No) and added to a day.</summary>
    public static readonly string[] Plannable = [Event, Excursion, Dinner];

    public static bool IsPlannable(string? type) => type is not null && Plannable.Contains(type);

    /// <summary>The type of a bundle made from an event id: a tour, a dinner or an ordinary event.</summary>
    public static string TypeOfEvent(string eventId) => ChatPlanningRules.ParseTourEvent(eventId) is not null ? Excursion : ChatPlanningRules.ParseDinnerEvent(eventId) is not null ? Dinner : Event;

    /// <summary>The <c>eventId:day</c> part of an <c>event:</c> ref, or null when the ref is not one.</summary>
    public static string? PlanRefOf(string? shareRef) => shareRef is { } r && r.StartsWith("event:", StringComparison.Ordinal) && r.Length > 6 ? r[6..] : null;

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
