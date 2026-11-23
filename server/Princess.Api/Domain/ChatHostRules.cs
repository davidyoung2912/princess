namespace Princess.Api.Domain;

/// <summary>One guest who said "introduce me", as the matcher sees them: who, the one interest they stated, when they asked, and whether they are an adult and unsupervised.</summary>
public sealed record IntroCandidate(long UserId, string Interest, DateTime AskedAt, bool Adult, bool Supervised, int IntroducedToday);

/// <summary>An introduction the matcher made: two guests and the one interest they both stated.</summary>
public sealed record IntroPair(long A, long B, string Interest);

/// <summary>
/// The pure rules of Stanley as host for strangers (role R6) and room host (role R11), docs/chat-features-research.md, phase 12. He welcomes people, posts the rules, helps a guest start a meet-up, offers a chat
/// to people who shared a table, introduces two guests who BOTH asked, answers common room questions from a curated library only, and flags a post to staff when a member asks. He never moderates: removing,
/// muting, kicking, closing and pinning stay with staff. Nothing here reads private data: an introduction uses a first name, a last initial and one interest the guest chose from a fixed list.
/// </summary>
public static class ChatHostRules
{
    public const string Host = "R6", RoomHost = "R11";

    /// <summary>Refusal codes, stable words the front end turns into sentences.</summary>
    public const string Supervised = "supervised", NotAdult = "notAdult", Off = "off", Limit = "limit", BadText = "text", ContactInfo = "contactInfo", Closed = "closed", NotAllowed = "notAllowed", Muted = "muted", NoOptIn = "noOptIn", Blocked = "blocked", AlreadyMet = "alreadyMet", Unknown = "unknown";

    // ---- Welcome and rules ----

    /// <summary>The line Stanley posts when someone joins a room: the room's name and its rules, nothing about the person.</summary>
    public static string RoomWelcome(string roomName, string rules) => $"Welcome to {roomName}. House rules: {rules}";

    /// <summary>The line Stanley posts when a made group first opens with him switched on: no names, no plans.</summary>
    public static string GroupWelcome(string groupName, string? to = null) => $"Welcome to {groupName}{(to is null ? "" : $", @{to}")}. I can help you plan something together when you ask. Tap my name to mute me.";

    /// <summary>Stanley's thank-you inside the chat a guest has just accepted an invitation into (a group or a personal chat). It names only the guest's short name and makes no promise beyond saying hello.</summary>
    public static string AcceptThanks(string who) => $"Thanks for accepting this invite, @{who}! It's lovely to have you here. Say hello whenever you're ready, and I'm around if you'd like a hand planning something together.";

    /// <summary>Whether to post a welcome: once per room per member's first join, and never where the member muted Stanley for the room.</summary>
    public static bool ShouldWelcome(bool firstJoin, bool stanleyMutedHere) => firstJoin && !stanleyMutedHere;

    // ---- Meet-ups ----

    public const int MaxMeetUpTitle = 80, MaxMeetUpPlace = 60, MeetUpsPerDay = 3, MaxMeetUpAnswers = 500;
    public const string MeetIn = "in", MeetMaybe = "maybe", MeetNo = "no";

    /// <summary>The answer named by the app (<c>in</c>, <c>maybe</c> or <c>no</c>), or null for anything else.</summary>
    public static string? ParseMeetAnswer(string? name) => name is MeetIn or MeetMaybe or MeetNo ? name : null;

    /// <summary>A title or place: trimmed, spaces collapsed, no control characters; null when empty, too long, or carrying a link, number or email (a meet-up is seen by strangers).</summary>
    public static string? CleanMeetUpText(string? text, int max)
    {
        var clean = ChatPlanningRules.CleanLine(text, max);
        return clean is null || ChatRoomRules.HasContactDetail(clean) ? null : clean;
    }

    /// <summary>
    /// Why a guest may not start a meet-up, or null. Supervised children never do; the room must be open and not slow-mode-blocked for them (the post rules are checked as for any post); three a day.
    /// </summary>
    public static string? MeetUpRefusal(bool supervised, bool on, bool roomClosed, int startedToday) =>
        supervised ? Supervised : !on ? Off : roomClosed ? Closed : startedToday >= MeetUpsPerDay ? Limit : null;

    /// <summary>What everyone may see of a meet-up's answers: how many are in and how many maybe. A "no" is never counted or shown to anyone, so nobody can tell who declined.</summary>
    public sealed record MeetUpCounts(int In, int Maybe);

    public static MeetUpCounts CountMeetUp(IEnumerable<string> answers)
    {
        int i = 0, m = 0;
        foreach (var a in answers) { if (a == MeetIn) i++; else if (a == MeetMaybe) m++; }
        return new(i, m);
    }

    /// <summary>The words a list line and a phone alert show for a meet-up.</summary>
    public static string MeetUpPreview(string title) => $"Meet-up: {title}";

    // ---- Table friends ----

    /// <summary>
    /// Whether to offer a chat to the other people at a group table once it is made: an adult, not supervised, and at least one other adult guest at the table who is a different party. The offer goes to each person
    /// on their own; the chat is made only when they say yes, and nobody learns who did not.
    /// </summary>
    public static bool OfferTableFriends(bool adult, bool supervised, int otherAdultsAtTable) => adult && !supervised && otherAdultsAtTable >= 1;

    public const string TableFriendsText = "You are sharing a table. Would you like a chat with the people at your table? Nobody is added until they say yes.";

    // ---- Introduce me ----

    /// <summary>The one interest a guest may state, from a fixed list, so an introduction never carries free text or anything inferred.</summary>
    public static readonly string[] Interests = ["trivia", "dining", "shows", "music", "games", "photography", "fitness", "reading", "wine", "ports"];

    public const int IntroOptInHours = 24, IntroductionsPerDay = 2, MaxPendingOptIns = 1;

    public static string? CleanInterest(string? interest)
    {
        var t = (interest ?? "").Trim().ToLowerInvariant();
        return Interests.Contains(t) ? t : null;
    }

    /// <summary>Whether a guest may opt in to be introduced: an adult, not supervised, with a valid interest, under their daily cap.</summary>
    public static string? OptInRefusal(bool supervised, bool adult, string? interest, int introducedToday) =>
        supervised ? Supervised : !adult ? NotAdult : CleanInterest(interest) is null ? Unknown : introducedToday >= IntroductionsPerDay ? Limit : null;

    /// <summary>When an opt-in lapses: a day later. A guest may withdraw at any time.</summary>
    public static DateTime OptInEnds(DateTime now) => now.AddHours(IntroOptInHours);

    public static bool OptInLive(DateTime endsAt, DateTime? withdrawnAt, DateTime now) => withdrawnAt is null && endsAt > now;

    /// <summary>
    /// Pairs guests who BOTH opted in for the same interest, oldest request first. A pair is skipped when either has reached the daily cap, is supervised or not an adult, when the two are the same person, when one blocked
    /// the other, or when they were introduced before. A guest is in at most one pair per run. Nothing outside the opt-in (no booking detail, no activity, no profile) is looked at.
    /// </summary>
    public static List<IntroPair> Match(IEnumerable<IntroCandidate> candidates, Func<long, long, bool> blocked, Func<long, long, bool> metBefore)
    {
        var pairs = new List<IntroPair>();
        var used = new HashSet<long>();
        var eligible = candidates.Where(c => c.Adult && !c.Supervised && c.IntroducedToday < IntroductionsPerDay).OrderBy(c => c.AskedAt).ThenBy(c => c.UserId).ToList();
        foreach (var a in eligible)
        {
            if (used.Contains(a.UserId)) continue;
            var b = eligible.FirstOrDefault(x => x.UserId != a.UserId && !used.Contains(x.UserId) && x.Interest == a.Interest && !blocked(a.UserId, x.UserId) && !blocked(x.UserId, a.UserId) && !metBefore(a.UserId, x.UserId));
            if (b is null) continue;
            used.Add(a.UserId); used.Add(b.UserId);
            pairs.Add(new(a.UserId, b.UserId, a.Interest));
        }
        return pairs;
    }

    /// <summary>The words of an introduction: two short names and the one interest they both chose. Never anything else about either.</summary>
    public static string IntroLine(string nameA, string nameB, string interest) => $"{nameA} and {nameB} both said they would like to meet someone who enjoys {interest}.";

    /// <summary>The phone notice for an introduction: it names no one and no interest.</summary>
    public static readonly (string Title, string Body) IntroNotice = ("Stanley made an introduction", "Open your chats to see who.");

    // ---- Rollout (phase 14 thresholds, for roles R6 and R11) ----

    /// <summary>
    /// The rollout verdict for a host role from counts only: <paramref name="things"/> is what the role did (meet-ups started and introductions made for R6, library answers posted for R11) and <paramref name="guests"/> the distinct guests it
    /// touched. Nothing records a dismissal, a mute or a report against these roles yet (a guest flags a person's post, never Stanley's line), so a big enough sample is "unmeasured", never "ok".
    /// </summary>
    public static RolloutVerdict Verdict(string name, int things, int guests) => ChatRolloutRules.JudgeCounts(name, things, guests);

    // ---- Room answers from the library ----

    /// <summary>One curated room answer: words that must all appear in a question (lower case), and the answer. The answer says where to look; it never states a live time, price or availability.</summary>
    public sealed record LibraryEntry(string Id, string[] Keywords, string Answer);

    public static readonly LibraryEntry[] Library =
    [
        new("showtimes", ["show", "time"], "Show times are in Today's plan, which updates through the day. Open it from the Explore tab."),
        new("dining", ["dinner", "time"], "Dining times and reservations are under Dining in the Explore tab."),
        new("dresscode", ["dress"], "Tonight's dress guidance is on the day's card in Today's plan."),
        new("muster", ["muster"], "Your muster station is on your boarding card. Please go there for the drill; staff will guide you."),
        new("wifi", ["wifi"], "Wi-Fi packages and how to connect are under Onboard services."),
        new("tender", ["tender"], "Tender information for a port day is on that port's page."),
        new("lost", ["lost", "found"], "Lost and found is handled by Guest Services. Use Get a person and a team member will help."),
    ];

    public const string NoAnswer = "I only answer a few common questions in a room. Ask Guest Services for anything else.";

    /// <summary>The library entry that answers a question, or null. Matching is by words only, so nothing outside the library can ever be said by Stanley in a room.</summary>
    public static LibraryEntry? FindAnswer(string? question)
    {
        var q = (question ?? "").ToLowerInvariant();
        if (q.Length is 0 or > ChatRoomRules.MaxQuestion) return null;
        return Library.FirstOrDefault(e => e.Keywords.All(k => q.Contains(k)));
    }

    // ---- Flag to staff ----

    public const string FlagSpam = "spam", FlagUnsafe = "unsafe", FlagRude = "rude", FlagOther = "other";
    public static readonly string[] FlagReasons = [FlagSpam, FlagUnsafe, FlagRude, FlagOther];
    public const int FlagsPerDay = 5;

    /// <summary>Whether a member may ask Stanley to flag a post: a reason from the list, and under five a day. The flag reaches the staff queue and nothing happens to the post or the person until staff decide.</summary>
    public static string? FlagRefusal(string? reason, int flaggedToday) =>
        reason is null || !FlagReasons.Contains(reason) ? Unknown : flaggedToday >= FlagsPerDay ? Limit : null;

    /// <summary>The actions that belong to staff and that Stanley never takes in a room or a group.</summary>
    public static readonly string[] StaffOnlyActions = [ChatRoomRules.ActRemove, ChatRoomRules.ActMute, ChatRoomRules.ActUnmute, ChatRoomRules.ActKick, ChatRoomRules.ActClose, ChatRoomRules.ActOpen, ChatRoomRules.ActPin, ChatRoomRules.ActSlow, ChatRoomRules.ActRules, ChatRoomRules.ActHold, ChatRoomRules.ActRelease, "ban"];

    /// <summary>Stanley may only welcome, answer from the library, host a meet-up, introduce (on opt-in) and flag. Every staff action is refused.</summary>
    public static bool StanleyMay(string action) => !StaffOnlyActions.Contains(action);

    /// <summary>Whether Stanley speaks in a room now: not when the member muted him there, and never in a room or group with a supervised child in it.</summary>
    public static bool MaySpeak(bool mutedByMember, bool childPresent) => !mutedByMember && !childPresent;
}
