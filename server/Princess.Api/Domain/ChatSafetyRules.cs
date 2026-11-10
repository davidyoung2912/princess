namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of chat safety (docs/chat-plan.md, 4.6, 4.7 and phase 7): when a guardian may read a child's conversation, when a conversation shows the "a guardian can read this" notice,
/// and how staff resolve a report. Nothing here touches a store.
/// </summary>
public static class ChatSafetyRules
{
    public const string Open = "open";
    public const string Dismissed = "dismissed";
    public const string Removed = "removed";

    public const string Dismiss = "dismiss";
    public const string Remove = "remove";

    /// <summary>What a removed message says in its place.</summary>
    public const string RemovedText = "This message was removed.";

    /// <summary>How many lines before and after the reported message a reviewer sees. Staff never see more of a conversation than this.</summary>
    public const int ContextLines = 3;

    /// <summary>The most reports one list returns.</summary>
    public const int MaxReports = 100;

    /// <summary>
    /// A guardian reads a supervised child's conversations when they are the child's booker and are not supervised themselves. Nobody else can: not another adult, not a child.
    /// </summary>
    public static bool MayReadAsGuardian(long actorId, bool actorSupervised, bool childSupervised, long? childBookerId) =>
        !actorSupervised && childSupervised && childBookerId == actorId;

    /// <summary>Whether a conversation shows "A parent or guardian can read this chat" to every member: a supervised child is an active member.</summary>
    public static bool GuardianCanRead(IEnumerable<(string Status, bool Supervised)> members) =>
        members.Any(m => m.Status == ChatConversationRules.Active && m.Supervised);

    /// <summary>The status a decision gives a report, or null when the decision is not one of <see cref="Dismiss"/> and <see cref="Remove"/>.</summary>
    public static string? StatusFor(string? decision) => decision switch { Dismiss => Dismissed, Remove => Removed, _ => null };

    /// <summary>Only an open report can be decided; a second decision is a conflict.</summary>
    public static bool CanResolve(string status) => status == Open;

    /// <summary>The statuses a staff list may ask for. Anything else means open.</summary>
    public static string ListStatus(string? status) => status is Dismissed or Removed ? status : Open;
}
