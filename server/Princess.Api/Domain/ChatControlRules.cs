namespace Princess.Api.Domain;

/// <summary>
/// The pure rules of chat control and safety (docs/chat-features-research.md, section 11, phase 2): the 15-minute edit and delete window, the typing indicator's throttle and expiry,
/// timed mute, and the per-member send rate limit. Nothing here touches a store or a clock.
/// </summary>
public static class ChatControlRules
{
    /// <summary>How long after sending a person may edit or delete their own message, on server time.</summary>
    public static readonly TimeSpan ChangeWindow = TimeSpan.FromMinutes(15);

    /// <summary>What a deleted message's quote and list line show.</summary>
    public const string DeletedText = "Message deleted";

    /// <summary>Open from the moment of sending up to and including 15:00 later; a message dated after "now" (a clock a little behind) is still open.</summary>
    public static bool InWindow(DateTime sentAt, DateTime now) => now - sentAt <= ChangeWindow;

    /// <summary>The earliest send time still inside the window at <paramref name="now"/>: the store's guard against a change that races the window closing.</summary>
    public static DateTime WindowStart(DateTime now) => now - ChangeWindow;

    public const string NotMessage = "notMessage", NotYours = "notYours", Deleted = "deleted", TooLate = "tooLate", Photo = "photo", Urgent = "urgent";

    /// <summary>
    /// Why a person may not edit (<paramref name="forEdit"/>) or delete this message, or null when they may. A line about the group and a notice are not messages; only the sender changes a message;
    /// a deleted one is gone; the window must be open; and an edit is for plain text (a photo or an important or urgent message can only be deleted, so what others acknowledged cannot be rewritten).
    /// </summary>
    public static string? ChangeProblem(bool isSystem, bool fromStanley, bool isMine, bool deleted, bool hasPhoto, string urgency, DateTime sentAt, DateTime now, bool forEdit)
    {
        if (isSystem || fromStanley) return NotMessage;
        if (!isMine) return NotYours;
        if (deleted) return Deleted;
        if (!InWindow(sentAt, now)) return TooLate;
        if (forEdit && hasPhoto) return Photo;
        if (forEdit && urgency != ChatUrgencyRules.Normal) return Urgent;
        return null;
    }

    // ---- Typing ----

    /// <summary>At most one "is typing" nudge from one person to one conversation in this long.</summary>
    public static readonly TimeSpan TypingThrottle = TimeSpan.FromSeconds(3);

    /// <summary>A person shown as typing stops being shown this long after their last event.</summary>
    public static readonly TimeSpan TypingExpiry = TimeSpan.FromSeconds(6);

    public static bool ShouldSendTyping(DateTime? last, DateTime now) => last is null || now - last.Value >= TypingThrottle;

    public static bool IsTyping(DateTime last, DateTime now) => now - last < TypingExpiry;

    // ---- Mute ----

    public const string ForHour = "hour", ForDay = "day", ForWeek = "week";

    /// <summary>How long a timed mute lasts, or null for any other word (the caller treats no word as muted until turned off).</summary>
    public static TimeSpan? MuteSpan(string? length) => length switch
    {
        ForHour => TimeSpan.FromHours(1),
        ForDay => TimeSpan.FromDays(1),
        ForWeek => TimeSpan.FromDays(7),
        _ => null,
    };

    public static bool IsKnownMuteLength(string? length) => length is null || MuteSpan(length) is not null;

    /// <summary>Whether a conversation is muted right now: switched on, and either with no end or not yet at it.</summary>
    public static bool IsMuted(bool muted, DateTime? until, DateTime now) => muted && (until is null || until > now);

    // ---- Rate limit ----

    /// <summary>The most messages one member may send to one conversation in <see cref="SendPeriod"/>.</summary>
    public const int SendLimit = 20;
    public static readonly TimeSpan SendPeriod = TimeSpan.FromMinutes(1);

    public static bool OverSendLimit(int sentInPeriod) => sentInPeriod >= SendLimit;
}
