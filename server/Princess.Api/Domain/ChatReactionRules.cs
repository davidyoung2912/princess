namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of reactions, reply quotes and delivery (docs/chat-features-research.md, section 11, phase 1). Nothing here touches a store.
/// A reaction is one of six emoji, one per person per message: a different one replaces it, the same one again takes it away.
/// </summary>
public static class ChatReactionRules
{
    /// <summary>The six reactions a message can carry, in the order the picker shows them.</summary>
    public static readonly IReadOnlyList<string> Allowed = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

    /// <summary>The longest quote of a replied-to message shown above a reply, in characters.</summary>
    public const int QuoteLength = 120;

    /// <summary>What a quote of a message that is gone shows.</summary>
    public const string RemovedText = "Message removed";

    public static bool IsAllowed(string? emoji) => emoji is not null && Allowed.Contains(emoji);

    /// <summary>
    /// What the person's reaction becomes when they pick <paramref name="picked"/> while holding <paramref name="current"/> (null when they have none): the same one clears it, anything else sets it.
    /// </summary>
    public static string? Toggle(string? current, string picked) => current == picked ? null : picked;

    /// <summary>One reaction on a message: how many people chose it and whether the reader is one of them. Names are first name and last initial of the others, for a screen reader.</summary>
    public sealed record Tally(string Emoji, int Count, bool Mine, IReadOnlyList<string> Names);

    /// <summary>
    /// The chips under a message: one per emoji in use, in picker order, with counts. A person the reader has blocked is left out, so a block hides their reactions as it hides their messages.
    /// <paramref name="byUser"/> is (user id, emoji, short name); the reader's own are counted but not named.
    /// </summary>
    public static List<Tally> Summarise(IEnumerable<(long UserId, string Emoji, string Name)> byUser, long reader, ISet<long>? blocked = null)
    {
        var shown = byUser.Where(r => IsAllowed(r.Emoji) && (blocked is null || !blocked.Contains(r.UserId))).ToList();
        return [.. Allowed
            .Select(e => (Emoji: e, Who: shown.Where(r => r.Emoji == e).ToList()))
            .Where(g => g.Who.Count > 0)
            .Select(g => new Tally(g.Emoji, g.Who.Count, g.Who.Any(r => r.UserId == reader), [.. g.Who.Where(r => r.UserId != reader).Select(r => r.Name)]))];
    }

    /// <summary>The words a quote shows for a message: its text cut at <see cref="QuoteLength"/>, or "Photo" for one with no words.</summary>
    public static string QuoteText(string? text, bool hasPhoto)
    {
        var t = ChatConversationRules.Preview(text, QuoteLength);
        return t.Length > 0 ? t : hasPhoto ? "Photo" : "";
    }

    /// <summary>A message can be replied to or reacted to when a person said it: not a line about the group and not a notice.</summary>
    public static bool CanTarget(bool isSystem, bool fromStanley) => !isSystem && !fromStanley;

    /// <summary>Where one of your own messages stands: sent, delivered to a device of someone else, or read. Delivered and read each need both sides to have receipts on, which the caller applies.</summary>
    public static string StateOf(bool read, bool delivered) => read ? "read" : delivered ? "delivered" : "sent";
}
