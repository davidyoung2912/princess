namespace Princess.Api.Contracts;

// Chat connections (docs/chat-plan.md, phase 1). People are the public guid of their user (D2). Instants are epoch ms (D6).
// Another guest is only ever shown as a first name and a last initial.

/// <summary>A search result. <c>Relation</c> is none, asked (the caller already asked), waiting (they asked the caller), connected or approval (waiting for a guardian).</summary>
public sealed record ChatPersonDto(Guid Id, string Name, string Relation);

/// <summary>
/// One request or connection from the caller's point of view. <c>Kind</c>: <c>connected</c>, <c>incoming</c> (waiting for the caller), <c>outgoing</c> (the caller is waiting),
/// <c>declined</c> (an answer the caller has not seen) or <c>approval</c> (a child's request waiting for the caller as guardian).
/// <c>ConversationId</c> is the direct conversation once connected. <c>ChildId</c> and <c>ChildName</c> are set for an approval, and say which child and what they asked.
/// <c>IsNew</c> is a connection the sender has not yet seen accepted.
/// </summary>
public sealed record ChatConnectionDto(Guid Id, string Kind, Guid PersonId, string Name, Guid? ConversationId, Guid? ChildId, string? ChildName, bool IsNew, long At, long ExpiresAt);

public sealed record ChatConnectionsDto(
    List<ChatConnectionDto> Connected, List<ChatConnectionDto> Incoming, List<ChatConnectionDto> Outgoing,
    List<ChatConnectionDto> Answers, List<ChatConnectionDto> Approvals);

/// <summary>The numbers for a badge. <c>Unread</c> counts unread messages (phase 4; 0 until then).</summary>
public sealed record ChatSummaryDto(int Incoming, int Approvals, int Answers, int NewlyConnected, int Unread);

public sealed record ChatRequestBody(Guid ToUserId);

/// <summary>Answer a request. <c>Block</c> with a no also stops that person finding or writing to the caller.</summary>
public sealed record ChatRespondBody(bool Accept, bool Block = false);

/// <summary>The caller's chat choices. <c>Findable</c>: other guests on the sailing can find them by name. <c>ShowPreview</c>: a notice may show the message text (used from phase 4).</summary>
public sealed record ChatSettingsDto(bool Findable, bool ShowPreview);

// ---- Conversations and messages (phase 4) ----

/// <summary>The last line of a conversation, for the list. <c>Text</c> is empty for a photo with no caption.</summary>
public sealed record ChatLastDto(string Text, bool Photo, bool Mine, string FromName, long At);

/// <summary>
/// One conversation as the caller sees it. <c>Kind</c> is party (the booking's "My group"), direct or group. <c>Name</c> is the other person for a direct chat.
/// <c>Members</c> are first name and last initial, the caller excluded. <c>Closed</c>: sending has stopped (a chat that ended, or a caller who left). <c>Unread</c> is the same on every device.
/// </summary>
public sealed record ChatConversationDto(Guid Id, string Kind, string Name, List<string> Members, ChatLastDto? Last, int Unread, bool Muted, bool Closed, long At);

/// <summary>The latest page of a conversation, oldest first. <c>HasMore</c>: older messages can be fetched with <c>before</c>.</summary>
/// <summary><c>Ashore</c>: first name and last initial of people in it who are ashore and answer by text, so a reply is not expected at once.</summary>
public sealed record ChatThreadDto(ChatConversationDto Conversation, List<ChatMessageDto> Messages, bool HasMore, List<string>? Ashore = null);

public sealed record ChatMuteRequest(bool On);

// ---- SMS bridge (phase 6) ----

/// <summary>
/// The text bridge for a guest ashore. <c>On</c>: people on the ship can reach them by text. <c>Idle</c>: also count them as ashore after 30 minutes with no live app connection.
/// <c>Available</c> is false when the bridge cannot be turned on, and <c>Reason</c> says why: <c>supervised</c>, <c>noPhone</c>, <c>unverified</c> or <c>off</c> (switched off for everyone).
/// </summary>
public sealed record ChatSmsDto(bool On, bool Idle, bool Available, string? Reason);

public sealed record ChatSmsSettingsBody(bool On, bool Idle);
