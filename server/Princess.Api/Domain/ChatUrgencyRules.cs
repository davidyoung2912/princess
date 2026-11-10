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

    /// <summary>
    /// Whether a message can be acknowledged by this reader: it is urgent, written by a person (not a system line) and not by the reader. Reading the thread never acknowledges; only the explicit tap does.
    /// </summary>
    public static bool CanAck(string level, bool isSystem, bool isOwn) => level == Urgent && !isSystem && !isOwn;

    /// <summary>Most messages of a level one person may send in an hour (staff and guardians included for urgent), so neither level can be used to spam. Normal has no limit here.</summary>
    public const int ImportantPerHour = 20, UrgentPerHour = 10;

    public static int HourlyLimit(string level) => level switch { Urgent => UrgentPerHour, Important => ImportantPerHour, _ => int.MaxValue };

    /// <summary>Whether sending one more of the level would pass the hourly limit, given how many of that level the person sent in the last hour.</summary>
    public static bool OverLimit(string level, int sentLastHour) => sentLastHour >= HourlyLimit(level);

    /// <summary>The do-not-disturb choices from the Chat screen: for an hour, until the morning, or off.</summary>
    public const string DndHour = "hour", DndMorning = "morning", DndOff = "off";

    /// <summary>
    /// How long a do-not-disturb choice lasts from the guest's local time, or null when the choice is not one of ours. "off" is zero. "morning" runs to the next time the clock reads
    /// <paramref name="morning"/> ("HH:mm", the end of the guest's quiet hours), which is tomorrow when it has already passed today.
    /// </summary>
    public static TimeSpan? DndLength(string? mode, DateTime localNow, string morning)
    {
        switch (mode)
        {
            case DndOff: return TimeSpan.Zero;
            case DndHour: return TimeSpan.FromHours(1);
            case DndMorning:
                if (!TimeOnly.TryParse(morning, out var at)) at = new TimeOnly(7, 0);
                var end = localNow.Date + at.ToTimeSpan();
                if (end <= localNow) end = end.AddDays(1);
                return end - localNow;
            default: return null;
        }
    }

    /// <summary>Whether do-not-disturb (a stored end time in milliseconds, 0 for off) is on at <paramref name="nowMs"/>. It ends by itself.</summary>
    public static bool DndOn(long until, long nowMs) => until > nowMs;

    /// <summary>The words that open a text for the level: urgent and important texts say so, a normal text has no lead.</summary>
    public static string SmsLead(string level) => level switch { Urgent => "URGENT: ", Important => "Important: ", _ => "" };

    /// <summary>The first words of a phone notice for the level (the sender's name follows).</summary>
    public static string NoticeLead(string level) => level switch { Urgent => "Urgent message from", Important => "Important message from", _ => "New message from" };
}
