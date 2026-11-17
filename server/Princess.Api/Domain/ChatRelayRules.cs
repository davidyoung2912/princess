namespace Princess.Api.Domain;

/// <summary>
/// Handing a chat to a person, and the group recap (docs/chat-features-research.md, phase 13, roles R7 and R12). Pure.
/// "Get a person": the guest chooses up to <see cref="MaxMessages"/> messages of one conversation; the draft is made only from those, in order, as plain text the guest then reads, edits and agrees to send through
/// the ordinary hand-off route. Photos, cards, polls, system lines, Stanley's lines and deleted messages are never carried. The group recap holds only what each member approved for themselves.
/// </summary>
public static class ChatRelayRules
{
    public const int MaxMessages = 10, MaxPhotosEach = 6, MaxLineLength = 300;
    public const string Intro = "From my chat:";

    /// <summary>The refusal codes: <c>notChat</c> (his own chat, a channel or a room), <c>child</c> (a supervised child cannot hand a chat over), <c>none</c> (nothing usable was chosen), <c>tooMany</c>.</summary>
    public const string NotChat = "notChat", Child = "child", None = "none", TooMany = "tooMany";

    /// <summary>Whether a chat of this kind can be handed over: a person to person chat, never Stanley's own chat, a channel or a room.</summary>
    public static bool Handable(string kind) => ChatSearchRules.Searchable(kind);

    /// <summary>Whether a message can be carried at all: typed by a person, not deleted, not a card or poll, with words in it.</summary>
    public static bool Carriable(string kind, bool system, bool fromStanley, bool deleted, string? text) =>
        !deleted && !system && !fromStanley && kind == "text" && !string.IsNullOrWhiteSpace(text);

    /// <summary>The draft: an opening line, then one line per chosen message, "You:" for the guest's own and the first name and last initial for anyone else's. Cut to the hand-off's own limit at a line break.</summary>
    public static string Draft(IEnumerable<(string Who, string Text)> lines)
    {
        var parts = new List<string> { Intro };
        foreach (var (who, text) in lines)
        {
            var clean = string.Join(' ', (text ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            if (clean.Length > MaxLineLength) clean = clean[..(MaxLineLength - 1)].TrimEnd() + "…";
            var next = $"{(who.Length == 0 ? "You" : who)}: {clean}";
            if (string.Join('\n', parts.Append(next)).Length > StanleyHandoffRules.IssueMax) break;
            parts.Add(next);
        }
        return string.Join('\n', parts);
    }

    // ---- The recap ----

    public const string Plan = "plan", Photo = "photo", Pending = "pending", Approved = "approved", Declined = "declined";

    /// <summary>The refusal codes: <c>notGroup</c> (a recap belongs to a made group), <c>child</c> (a supervised child is in it), <c>small</c> (fewer than two active members), <c>shared</c>, <c>waiting</c>, <c>empty</c>.</summary>
    public const string NotGroup = "notGroup", Small = "small", Shared = "shared", Waiting = "waiting", Empty = "empty";

    public static string? StartRefusal(bool isGroup, bool childActive, int activeMembers) =>
        !isGroup ? NotGroup : childActive ? Child : activeMembers < 2 ? Small : null;

    /// <summary>Only the owner of a part decides it; nobody approves for someone else. Decisions are <c>approved</c> or <c>declined</c>.</summary>
    public static bool MayDecide(long owner, long actor, string decision) => owner == actor && (decision == Approved || decision == Declined);

    /// <summary>A recap may be shared once no part is still pending and at least one is approved. Returns the refusal code, or null.</summary>
    public static string? ShareRefusal(bool alreadyShared, IReadOnlyCollection<string> decisions)
    {
        if (alreadyShared) return Shared;
        if (decisions.Any(d => d == Pending)) return Waiting;
        return decisions.Any(d => d == Approved) ? null : Empty;
    }

    /// <summary>The line the group reads when a recap is shared: who shared it and the counts, never a name against a part.</summary>
    public static string ShareLine(string who, int plans, int photos) =>
        $"{who} shared the trip recap: {Count(plans, "plan")} and {Count(photos, "photo")} that members chose to add.";

    private static string Count(int n, string noun) => n == 1 ? $"1 {noun}" : $"{n} {noun}s";

    /// <summary>How far the group has got, in counts, for a member who is not the owner of the parts: "3 of 5 parts decided." Nobody is named.</summary>
    public static string Progress(int decided, int total) => $"{decided} of {total} parts decided.";
}
