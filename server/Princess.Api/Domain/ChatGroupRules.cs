namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of a guest-made group (docs/chat-plan.md, phase 5): its size, its name, who an invitation waits for, and the words on a phone and in the thread.
/// Kept apart from the store so they can be tested alone (tests: ChatGroupRulesTests).
/// </summary>
public static class ChatGroupRules
{
    public const string AwaitingGuardian = "awaitingGuardian", Pending = "pending", Accepted = "accepted", Declined = "declined", Cancelled = "cancelled", Expired = "expired";

    /// <summary>The most people in a group, counting the creator.</summary>
    public const int MaxMembers = 25;

    /// <summary>A group is three or more people: the creator and at least two invited.</summary>
    public const int MinInvitedAtStart = 2;

    public const int MaxName = 40;

    /// <summary>An invitation waits this long for an answer.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public static bool IsWaiting(string? status) => status is AwaitingGuardian or Pending;

    /// <summary>The group name: trimmed, spaces collapsed, 1 to <see cref="MaxName"/> characters. Null when it is empty or too long.</summary>
    public static string? CleanName(string? name)
    {
        var parts = (name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var clean = string.Join(' ', parts);
        return clean.Length is 0 or > MaxName || clean.Any(char.IsControl) ? null : clean;
    }

    /// <summary>Whether <paramref name="adding"/> more people still fit, counting the people in the group and the invitations still waiting.</summary>
    public static bool Fits(int activeMembers, int waitingInvites, int adding) => activeMembers + waitingInvites + adding <= MaxMembers;

    /// <summary>Where an invitation goes first: to the person, or to their guardian when they are a supervised child (the guardian's yes is the acceptance).</summary>
    public static string StatusFor(bool inviteeSupervised) => inviteeSupervised ? AwaitingGuardian : Pending;

    /// <summary>The line in the thread when someone joins, leaves, is removed or the group is renamed. It names a person only by first name and last initial.</summary>
    public static string JoinedLine(string who) => $"{who} joined the group";
    public static string LeftLine(string who) => $"{who} left the group";
    public static string RemovedLine(string who) => $"{who} was removed from the group";
    public static string RenamedLine(string name) => $"The group is now called {name}";

    /// <summary>The key a notice is logged and de-duplicated under: one per invitation.</summary>
    public static string NoticeKey(string kind, Guid inviteId) => $"chat:group:{kind}:{inviteId:N}";

    public static (string Title, string Body) InviteNotice(string from, string group) => ($"{from} invited you to a group", $"Open Princess to join {group}.");
    public static (string Title, string Body) ApprovalNotice(string child) => ("A group invitation needs your approval", $"Open Princess to review it for {child}.");
}
