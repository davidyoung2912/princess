namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of message urgency (docs/chat-urgency-plan.md). A message is <c>normal</c> (the default), <c>important</c> ("please read soon") or <c>urgent</c> (needs attention now).
/// Anyone may send the first two; <c>urgent</c> is limited to staff and to a guardian writing into a conversation their supervised child is in, so it keeps its weight and cannot be used to spam.
/// Only <c>urgent</c> breaks through do-not-disturb (quiet hours, calm mode) and a muted conversation.
/// </summary>
public static class ChatUrgencyRules
{
    public const string Normal = "normal";
    public const string Important = "important";
    public const string Urgent = "urgent";

    public static readonly string[] Levels = [Normal, Important, Urgent];

    /// <summary>The level asked for: missing or blank is <see cref="Normal"/>; anything that is not one of <see cref="Levels"/> is null (the request is refused).</summary>
    public static string? Parse(string? level)
    {
        if (string.IsNullOrWhiteSpace(level)) return Normal;
        var l = level.Trim().ToLowerInvariant();
        return Levels.Contains(l) ? l : null;
    }

    /// <summary>
    /// Whether the sender may use the level. <paramref name="isStaff"/> is an administrator; <paramref name="isGuardianHere"/> is the booker of a supervised child who is an active member of this conversation (and is not supervised themselves).
    /// A supervised child may send <see cref="Normal"/> and <see cref="Important"/> only.
    /// </summary>
    public static bool MaySend(string level, bool isStaff, bool isGuardianHere) => level != Urgent || isStaff || isGuardianHere;

    /// <summary>Whether the member is a guardian of a supervised child in this conversation: the child is an active member, supervised, and booked by the sender, who is not supervised.</summary>
    public static bool IsGuardianHere(long senderId, bool senderSupervised, IEnumerable<(string Status, bool Supervised, long? BookerId)> members) =>
        members.Any(m => m.Status == ChatConversationRules.Active && ChatSafetyRules.MayReadAsGuardian(senderId, senderSupervised, m.Supervised, m.BookerId));

    /// <summary>Whether the notice skips do-not-disturb, calm mode and a muted conversation.</summary>
    public static bool BreaksThrough(string level) => level == Urgent;

    /// <summary>Messages that arrive by text or as photos are always <see cref="Normal"/>: the sender there cannot be checked for the right to use more.</summary>
    public static string ForChannel(bool viaSmsOrPhoto, string level) => viaSmsOrPhoto ? Normal : level;

    /// <summary>The first words of a phone notice for the level (the sender's name follows).</summary>
    public static string NoticeLead(string level) => level switch { Urgent => "Urgent message from", Important => "Important message from", _ => "New message from" };
}
