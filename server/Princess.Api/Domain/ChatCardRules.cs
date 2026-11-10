using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>A card or place as it travels in <c>ChatMessages.Payload</c>: names, times and places only. Built by the server from its own data, never from what a client sent.</summary>
public sealed record ChatCard(string Type, string Title, string? Subtitle = null, int? Day = null, string? Time = null, string? Place = null, string? Path = null, long? ExpiresAt = null, string? Note = null, Guid? Ref = null);

/// <summary>
/// The pure rules of typed chat messages (docs/chat-features-research.md, section 11, phase 3): the kinds of card a guest can share from the app, the place card with its expiry, pins and mentions.
/// A card carries a title, a day, a time and a place, and nothing about money or identity: <see cref="HasForbiddenKey"/> is the guard every payload passes before it is stored. Nothing here touches a store or a clock.
/// </summary>
public static class ChatCardRules
{
    public const string Text = "text", Card = "card", Place = "place";

    /// <summary>The kinds a message can have: a typed message is a card or a place; everything else is ordinary text.</summary>
    public static bool IsTyped(string? kind) => kind is Card or Place;

    // What a card can be.
    public const string Excursion = "excursion", Dining = "dining", Booking = "booking", PortDay = "portDay", PlaceType = "place";

    public static readonly string[] CardTypes = [Excursion, Dining, Booking, PortDay];

    /// <summary>The screen a card opens. The app shows "no longer available" when the guest cannot open what it points at.</summary>
    public static string PathOf(string type, string? portId = null) => type switch
    {
        Excursion => "/plan/excursions",
        Dining => "/plan/dining",
        Booking => "/plan/reservations",
        PortDay => portId is { Length: > 0 } ? $"/home/ports/{portId}" : "/plan/ahead",
        _ => "/chat",
    };

    // ---- Place cards ----

    /// <summary>A "Meet me here" place card stops being current this long after it was sent.</summary>
    public static readonly TimeSpan PlaceLife = TimeSpan.FromHours(6);

    public const int MaxNote = 80;

    public static DateTime PlaceExpiry(DateTime sentAt) => sentAt + PlaceLife;

    /// <summary>The cards whose source can be cancelled (an excursion or a dinner) and so can go stale: their source ids.</summary>
    public static IEnumerable<Guid> SourceIds(IEnumerable<ChatCard?> cards) => cards.Where(c => c is { Type: Excursion or Dining, Ref: not null }).Select(c => c!.Ref!.Value).Distinct();

    /// <summary>A card is gone when it names a source that is no longer booked. A card with no source (a place, the trip, a port day) never is.</summary>
    public static bool IsGone(ChatCard card, IReadOnlySet<Guid> stillBooked) => card.Ref is { } r && !stillBooked.Contains(r);

    public static bool IsExpired(long? expiresAt, long nowMs) => expiresAt is { } e && e <= nowMs;

    /// <summary>The note under a place: trimmed, one line, at most <see cref="MaxNote"/> characters; null when empty.</summary>
    public static string? CleanNote(string? note)
    {
        var t = (note ?? "").ReplaceLineEndings(" ").Trim();
        if (t.Length == 0) return null;
        return t.Length > MaxNote ? t[..MaxNote].TrimEnd() : t;
    }

    // ---- Payload ----

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    /// <summary>Words that must never appear as a key of a payload: the facts a shared card is not allowed to carry.</summary>
    public static readonly string[] ForbiddenKeys = ["price", "cost", "total", "cents", "folio", "cabin", "stateroom", "booking", "bookingnumber", "number", "email", "phone", "card", "payment", "dob"];

    public static string Serialise(ChatCard card) => JsonSerializer.Serialize(card, Json);

    public static ChatCard? Parse(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { return JsonSerializer.Deserialize<ChatCard>(payload, Json); }
        catch (JsonException) { return null; }
    }

    /// <summary>True when the payload has a key that names money or identity. The service refuses to store one, so a card can never leak a price, a folio line, a cabin or a booking number.</summary>
    public static bool HasForbiddenKey(string payload)
    {
        try
        {
            using var doc = JsonDocument.Parse(payload);
            return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.EnumerateObject().Any(p => ForbiddenKeys.Contains(p.Name.ToLowerInvariant()));
        }
        catch (JsonException) { return true; }
    }

    /// <summary>The words a list line and a phone alert show for a typed message (never the payload).</summary>
    public static string Preview(string kind, ChatCard? card) => kind switch
    {
        Place => card is null ? "Meeting point" : $"Meet me at {card.Title}",
        Card => card?.Title ?? "Shared from the app",
        _ => "",
    };

    // ---- Pins ----

    public const int MaxPins = 3;

    /// <summary>
    /// Who may pin or unpin: either person in a direct chat and any member of the booking's group, but only the creator of a made group (admins arrive with phase 4). Nobody pins in the Stanley chat.
    /// </summary>
    public static bool MayPin(string kind, bool isCreator) => kind is ChatConversationRules.Party or ChatConversationRules.Direct || (kind == ChatConversationRules.Group && isCreator);

    /// <summary>Whether another pin fits.</summary>
    public static bool CanAddPin(int pinned) => pinned < MaxPins;

    // ---- Mentions ----

    public const int MaxMentions = 10;

    public const string StanleyHandle = "@Stanley";

    /// <summary>
    /// The people a message mentions: the ones the sender named, that are active members other than the sender, without repeats and at most <see cref="MaxMentions"/>. A name that is not a member is dropped, not an error, so a stale picker never fails a send.
    /// </summary>
    public static List<long> ValidMentions(IEnumerable<Guid>? named, IReadOnlyDictionary<Guid, long> activeMembers, long sender)
    {
        var ids = new List<long>();
        foreach (var g in named ?? [])
            if (activeMembers.TryGetValue(g, out var id) && id != sender && !ids.Contains(id)) ids.Add(id);
        return ids.Count > MaxMentions ? ids[..MaxMentions] : ids;
    }

    /// <summary>Whether the text calls Stanley with <c>@Stanley</c>. The hook the Stanley plan builds on; nothing answers it yet.</summary>
    public static bool MentionsStanley(string? text) => text is not null && text.Contains(StanleyHandle, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Whether a recipient gets a phone alert for a message. A mention breaks through a mute and through mentions-only, but never through do-not-disturb (the notifier applies that); a member who chose
    /// mentions-only is alerted only when mentioned.
    /// </summary>
    public static bool AlertsRecipient(bool muted, bool mentionsOnly, bool mentioned) => mentioned || (!muted && !mentionsOnly);
}
