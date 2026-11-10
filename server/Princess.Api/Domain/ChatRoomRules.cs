using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>Whether channels and rooms are open, one switch per kind, so staff can turn rooms off without a release (docs/chat-features-research.md, phase 8). Channels default on; rooms default off until a moderator rota exists.</summary>
public sealed class ChatRoomOptions
{
    public const string Section = "Chat:Rooms";
    public bool ChannelsOn { get; set; } = true;
    public bool SailingRoomsOn { get; set; }
    public bool InterestRoomsOn { get; set; }
}

/// <summary>
/// The pure rules of channels and rooms beyond the ship (docs/chat-features-research.md, 8.1 to 8.3). A channel is read by followers and posted to by staff only; a sailing room is posted to by guests
/// with a booking on that sailing; an interest room by guests with any current or past booking. Supervised children never join either. Nothing here touches a store or a clock.
/// </summary>
public static partial class ChatRoomRules
{
    public const string Channel = "channel", Room = "room";
    public const string SailingRoom = "sailing", InterestRoom = "interest";

    /// <summary>Most people in one room before a second room is opened.</summary>
    public const int DefaultMemberCap = 500;

    /// <summary>The fewest named moderators a room needs before it can open: two, so one absence does not close a room.</summary>
    public const int MinModerators = 2;

    /// <summary>Slow mode: one message per member per this long.</summary>
    public static readonly TimeSpan SlowModeGap = TimeSpan.FromSeconds(30);

    public const int MaxRules = 600, MaxName = 80, MaxTopic = 30;

    public static bool IsRoomKind(string kind) => kind is Channel or Room;

    /// <summary>Why a post or a join is refused. Stable codes the front end turns into words.</summary>
    public const string Off = "off", NoBooking = "noBooking", Child = "child", StaffOnly = "staffOnly", Closed = "closed", Muted = "muted", Full = "full", Left = "left", RulesFirst = "rulesNotAccepted", Slow = "slow";

    /// <summary>Whether the switch for this kind of room or channel is on.</summary>
    public static bool IsOn(ChatRoomOptions o, string kind, string? roomKind) =>
        kind == Channel ? o.ChannelsOn : roomKind == InterestRoom ? o.InterestRoomsOn : o.SailingRoomsOn;

    /// <summary>The refusal for a rota that is too thin to open a room, or null. A channel needs no rota (only staff post in it).</summary>
    public static string? OpenProblem(string kind, int moderators) => kind == Room && moderators < MinModerators ? "rota" : null;

    /// <summary>
    /// Why this guest may not join (follow, for a channel), or null when they may. A supervised child never joins. A channel is open to any signed-in guest (it is staff-written, so a guest considering a sailing may follow it);
    /// a sailing room needs a confirmed booking, current or past, on that sailing; an interest room needs one on any sailing.
    /// </summary>
    public static string? JoinProblem(string kind, string? roomKind, bool isSupervised, bool bookedOnSailing, bool anyBooking, int members, int cap, bool on, bool closed)
    {
        if (!on) return Off;
        if (isSupervised) return Child;
        if (closed) return Closed;
        if (kind == Room)
        {
            if (!(roomKind == InterestRoom ? anyBooking : bookedOnSailing)) return NoBooking;
            if (members >= cap) return Full;
        }
        return null;
    }

    /// <summary>
    /// Why this member may not post right now, or null. Order matters: a closed room says closed before it says anything about rules. <paramref name="sinceLastPost"/> is how long since this member last posted (null for never).
    /// </summary>
    public static string? PostProblem(string kind, bool isStaff, bool active, bool closed, bool on, bool rulesAccepted, DateTime? modMutedUntil, bool slow, TimeSpan? sinceLastPost, DateTime now)
    {
        if (!on) return Off;
        if (!active) return Left;
        if (closed) return Closed;
        if (kind == Channel) return isStaff ? null : StaffOnly;
        if (isStaff) return null;
        if (modMutedUntil is { } until && until > now) return Muted;
        if (!rulesAccepted) return RulesFirst;
        if (slow && sinceLastPost is { } since && since < SlowModeGap) return Slow;
        return null;
    }

    /// <summary>How many whole seconds a member must still wait under slow mode (at least 1 while it applies).</summary>
    public static int SlowWaitSeconds(TimeSpan sinceLastPost) => Math.Max(1, (int)Math.Ceiling((SlowModeGap - sinceLastPost).TotalSeconds));

    // ---- Hours ----

    /// <summary>Moderators are on from 08:00 to 23:00 in the room's reference time.</summary>
    public const int HoursFrom = 8, HoursTo = 23;

    public static bool InModeratorHours(DateTime utcNow, int referenceOffsetMinutes)
    {
        var hour = utcNow.AddMinutes(referenceOffsetMinutes).Hour;
        return hour >= HoursFrom && hour < HoursTo;
    }

    /// <summary>Slow mode is on when staff switched it on, and automatically outside moderator hours.</summary>
    public static bool SlowNow(bool staffSlow, DateTime utcNow, int referenceOffsetMinutes) => staffSlow || !InModeratorHours(utcNow, referenceOffsetMinutes);

    /// <summary>
    /// Whether a post is held for staff instead of sent: it carries a link or a phone number, always in a room (a safer default than in private chats). Outside moderator hours the same hold applies,
    /// which is the plan's "link and number hold turned on automatically"; since links and numbers are already held at all hours, the hours only change slow mode (see <see cref="SlowNow"/>).
    /// </summary>
    public static bool NeedsHold(string kind, string text) => kind == Room && ContactPattern().IsMatch(text);

    /// <summary>The words a held post is shown with to its sender.</summary>
    public const string HeldReason = "contact";

    [GeneratedRegex(@"(\d[\s.-]?){7,}|https?://|www\.|\b[\w.+-]+@[\w-]+\.[\w.]+", RegexOptions.IgnoreCase)]
    private static partial Regex ContactPattern();

    // ---- Safety ----

    /// <summary>Words that mean a room is the wrong place: the guest is pointed to Get help now and staff, and the post is not sent.</summary>
    public static bool LooksLikeEmergency(string text)
    {
        var t = text.ToLowerInvariant();
        return t.Contains("man overboard") || t.Contains("medical emergency") || t.Contains("missing person") || t.Contains("mayday") || t.Contains("fire on");
    }

    // ---- Staff actions ----

    public const string ActRemove = "remove", ActMute = "mute", ActUnmute = "unmute", ActKick = "kick", ActSlow = "slow", ActClose = "close", ActOpen = "open", ActRules = "rules", ActHold = "hold", ActRelease = "release", ActReject = "reject", ActPin = "pin";

    public static readonly DateTime NoEnd = new(9999, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>When a staff mute ends: <c>hour</c>, <c>day</c> or <c>room</c> (the rest of the room's life). Null for any other word.</summary>
    public static DateTime? MuteEnd(string? length, DateTime now) => length switch
    {
        ChatControlRules.ForHour => now.AddHours(1),
        ChatControlRules.ForDay => now.AddDays(1),
        "room" => NoEnd,
        _ => null,
    };

    /// <summary>Cleans the rules text a moderator pins: trimmed, 1 to <see cref="MaxRules"/> characters, else null.</summary>
    public static string? CleanRules(string? text)
    {
        var t = (text ?? "").Trim();
        return t.Length is 0 or > MaxRules ? null : t;
    }

    /// <summary>The rules every room starts with, until a moderator pins their own.</summary>
    public const string DefaultRules = "Be kind. Talk about the trip. No phone numbers, links or personal details. Staff may remove posts and people. For anything urgent use Get help now, not this room.";

    public static string? CleanName(string? name)
    {
        var t = (name ?? "").Trim();
        return t.Length is 0 or > MaxName ? null : t;
    }

    public static string? CleanTopic(string? topic)
    {
        var t = (topic ?? "").Trim().ToLowerInvariant();
        return t.Length is 0 or > MaxTopic || !t.All(c => char.IsLetterOrDigit(c) || c == '-') ? null : t;
    }

    // ---- Suggested questions ----

    public const int MaxQuestion = 200, MaxOpenQuestions = 3;
    public const string Suggested = "suggested", Popular = "popular", Rejected = "rejected";

    /// <summary>A suggested question as stored: trimmed, 5 to 200 characters. Null otherwise.</summary>
    public static string? CleanQuestion(string? text)
    {
        var t = (text ?? "").Trim();
        return t.Length is < 5 or > MaxQuestion ? null : t;
    }

    /// <summary>A question may not carry a link, phone number or email (it ends up in a public preview), and a guest has at most three waiting.</summary>
    public static string? QuestionProblem(string text, int waiting) =>
        ContactPattern().IsMatch(text) ? "contactInfo" : waiting >= MaxOpenQuestions ? "tooMany" : null;

    // ---- Weekly summary ----

    /// <summary>Rooms that are open with fewer moderators than the rota needs: the summary lists them so a gap is seen before a guest meets it.</summary>
    public static bool NeedsModerator(string kind, bool closed, int moderators) => kind == Room && !closed && moderators < MinModerators;
}
