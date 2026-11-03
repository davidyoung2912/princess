using System.Text.Json.Nodes;

namespace Princess.Api.Domain;

/// <summary>An unread postcard, as far as the server needs to know: its id and the sailing it was written on. The words stay in the guest's own memory document.</summary>
public sealed record PostcardRef(string Id, string SailingId);

/// <summary>
/// The postcard to a future self (small delights DL9). The app keeps a small document of the unread postcards' ids; the server says so once, with none of the
/// guest's words, when a later trip is close. Pure: no clock, no store.
/// </summary>
public static class PostcardRules
{
    /// <summary>A postcard arrives when the next trip is this many days away or closer (the same number as the app).</summary>
    public const int Days = 60;
    public const int MaxItems = 5;

    /// <summary>Reads the stored document; anything that is not a usable item is dropped.</summary>
    public static IReadOnlyList<PostcardRef> Parse(string? json)
    {
        try
        {
            if (JsonNode.Parse(json ?? "null") is not JsonObject o || o["items"] is not JsonArray items) return [];
            var list = new List<PostcardRef>();
            foreach (var x in items)
            {
                if (x is not JsonObject item || item["id"] is not JsonValue i || !i.TryGetValue<string>(out var id) || id.Length is 0 or > 40) continue;
                var sailing = item["sailingId"] is JsonValue s && s.TryGetValue<string>(out var sid) && sid.Length <= 40 ? sid : "";
                if (list.All(p => p.Id != id)) list.Add(new(id, sailing));
                if (list.Count == MaxItems) break;
            }
            return list;
        }
        catch (System.Text.Json.JsonException) { return []; }
    }

    /// <summary>The ids to speak of now: written on an earlier sailing, with the booked trip between today and <see cref="Days"/> days away. Oldest first.</summary>
    public static IReadOnlyList<string> Due(IReadOnlyList<PostcardRef> cards, string currentSailingId, int daysToDeparture) =>
        daysToDeparture is < 0 or > Days ? [] : [.. cards.Where(c => c.SailingId != currentSailingId).Select(c => c.Id)];
}
