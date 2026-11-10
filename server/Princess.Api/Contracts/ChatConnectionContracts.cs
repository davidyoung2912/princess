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
