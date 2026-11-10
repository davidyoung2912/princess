namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of a conversation (docs/chat-plan.md, 4.1 and 4.5): which messages a member may read, what a conversation is called, when sending is closed, and the words a phone shows for a message.
/// Nothing here touches a store, so a member of one conversation can be shown never to read another (tests: ChatConversationRulesTests).
/// </summary>
public static class ChatConversationRules
{
    public const string Party = "party";
    public const string Direct = "direct";
    public const string Group = "group";
    /// <summary>Every account's permanent 1:1 chat with Stanley (docs/chat-features-research.md, section 15).</summary>
    public const string Stanley = "stanley";
    /// <summary>Phase 8: a staff-written channel and a guest room (docs/chat-features-research.md, section 8). Both are public to their members, so a late joiner reads what came before.</summary>
    public const string Channel = "channel";
    public const string Room = "room";

    public const string Active = "active";

    /// <summary>The longest message, in characters.</summary>
    public const int MaxText = 2000;

    /// <summary>How many messages the first page of a thread holds. Older ones are fetched on scroll.</summary>
    public const int PageSize = 30;

    /// <summary>The most one request may ask for.</summary>
    public const int MaxPage = 100;

    /// <summary>Characters of a message shown on a lock screen when the guest opted in.</summary>
    public const int PreviewLength = 80;

    public static int ClampPage(int? limit) => limit is null or <= 0 ? PageSize : Math.Min(limit.Value, MaxPage);

    /// <summary>
    /// A member reads a message only if it was sent while they were a member: from <paramref name="joinedAt"/> until <paramref name="leftAt"/> (no end while they are still in).
    /// The booking's "My group" is the exception: it keeps showing everything, as before (the old chat had no join time).
    /// </summary>
    public static bool CanRead(string kind, DateTime sentAt, DateTime joinedAt, DateTime? leftAt) =>
        kind is Party or Stanley or Channel or Room || (sentAt >= joinedAt && (leftAt is null || sentAt <= leftAt));

    /// <summary>Whether sending is closed to this member: they are no longer an active member, or a direct chat has ended or staff closed a channel or room (the store reports both as "ended").</summary>
    public static bool IsClosed(string kind, string memberStatus, bool directEnded) =>
        kind != Stanley && (memberStatus != Active || (kind is Direct or Channel or Room && directEnded));

    /// <summary>
    /// What a member may do to a conversation. The permanent Stanley chat cannot be left, ended, archived, muted, hidden, blocked, renamed or given an away notice,
    /// and the guest cannot post into it: a question to Stanley goes through his own route, not through <c>POST messages</c>.
    /// </summary>
    public static bool IsPermanent(string kind) => kind == Stanley;

    /// <summary>What the list calls a conversation: the other person for a direct chat, "My group" for the booking's group, else the group's own name.</summary>
    public static string DisplayName(string kind, string? stored, IReadOnlyList<string> others) => kind switch
    {
        Party => "My group",
        Stanley => StanleyPersonaRules.Name,
        Direct => others.Count > 0 ? others[0] : "Chat",
        _ => string.IsNullOrWhiteSpace(stored) ? (others.Count > 0 ? string.Join(", ", others.Take(3)) : "Group") : stored.Trim(),
    };

    /// <summary>The message as stored: trimmed, 1 to <see cref="MaxText"/> characters. Null when it is empty or too long.</summary>
    public static string? CleanText(string? text)
    {
        var t = (text ?? "").Trim();
        return t.Length is 0 or > MaxText ? null : t;
    }

    /// <summary>The line shown for a conversation in the list: the text, cut at <paramref name="max"/> characters with an ellipsis.</summary>
    public static string Preview(string? text, int max = PreviewLength)
    {
        var t = (text ?? "").Trim().ReplaceLineEndings(" ");
        return t.Length <= max ? t : t[..(max - 1)].TrimEnd() + "…";
    }

    /// <summary>Everything that was said after <paramref name="lastReadId"/> by someone else counts as unread.</summary>
    public static bool IsUnread(long messageId, long fromUserId, long me, long? lastReadId) => fromUserId != me && messageId > (lastReadId ?? 0);

    /// <summary>The key a message notice is logged and de-duplicated under: one per message.</summary>
    public static string NoticeKey(Guid conversationId, Guid messageId) => $"chat:message:{conversationId:N}:{messageId:N}";

    /// <summary>The tag a phone collapses a conversation's notices under, so a busy group shows one line, not twenty.</summary>
    public static string NoticeTag(Guid conversationId) => $"chat:conversation:{conversationId:N}";

    /// <summary>The path a tap on a message notice opens: that conversation.</summary>
    public static string NoticePath(Guid conversationId) => $"/chat?c={conversationId}";

    /// <summary>The words a phone shows. The title names the sender by first name and last initial; the body carries message text only when the guest opted in.</summary>
    public static (string Title, string Body) MessageNotice(string from, string? text, bool showPreview, string urgency = ChatUrgencyRules.Normal, bool mentioned = false) =>
        ($"{ChatUrgencyRules.NoticeLead(urgency)} {from}{(mentioned ? " mentioned you" : "")}", showPreview && !string.IsNullOrWhiteSpace(text) ? Preview(text) : "Open Princess to read it.");
}
