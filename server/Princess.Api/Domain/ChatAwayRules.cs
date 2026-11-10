namespace Princess.Api.Domain;

/// <summary>
/// The pure rules for "tell the people in this chat when I leave or return to the ship" (docs/chat-ashore-plan.md). The flag is each member's own, per conversation, off by default.
/// Only the ship-level change is shared (left or returned), never where in port. A member hears it only if they are connected to the sender (an accepted connection) and have not blocked them.
/// </summary>
public static class ChatAwayRules
{
    public const string Ashore = "ashore", Back = "back";

    public enum Change { None, Left, Returned }

    /// <summary>Whether the presence status is one this feature acts on (the "leaving" status says nothing yet).</summary>
    public static bool IsStatus(string? status) => status is Ashore or Back;

    /// <summary>
    /// What a change of presence means for the chat. Going ashore is always news; coming back is news only after an ashore the chat knew about
    /// (a first "back" just records where the guest is). The same status again tells no one.
    /// </summary>
    public static Change Transition(string? previous, string? next) => (previous, next) switch
    {
        (_, _) when previous == next => Change.None,
        (_, Ashore) => Change.Left,
        (Ashore, Back) => Change.Returned,
        _ => Change.None,
    };

    /// <summary>The system line in the conversation.</summary>
    public static string Line(string who, Change change) => change == Change.Left ? $"{who} left the ship" : $"{who} is back on the ship";

    /// <summary>The phone notice. It carries no more than the line does.</summary>
    public static (string Title, string Body) Notice(string who, Change change) => (Line(who, change), "Open Princess to see the chat.");

    /// <summary>The key a notice is logged and de-duplicated under: one per person, conversation, change and moment.</summary>
    public static string NoticeKey(Guid conversationId, long userId, Change change, long atMs) => $"chat:away:{conversationId:N}:{userId}:{(change == Change.Left ? "left" : "back")}:{atMs}";

    /// <summary>
    /// The people a conversation's header shows as back on the ship: those whose last recorded presence is <see cref="Back"/>. The store has already left out everyone who did not turn the feature on,
    /// is not connected to the reader, or is blocked either way, so this is only the choice of words and order.
    /// </summary>
    public static List<string> BackNames(IEnumerable<(string Name, string? Status)> people) =>
        [.. people.Where(p => p.Status == Back).Select(p => p.Name).Order(StringComparer.Ordinal)];

    /// <summary>Whether a person may switch the flag on: a supervised child may not (their guardian already controls who they chat with).</summary>
    public static bool MayEnable(bool supervised) => !supervised;
}
