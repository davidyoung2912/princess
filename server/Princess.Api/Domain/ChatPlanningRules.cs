using System.Text.Json;

namespace Princess.Api.Domain;

/// <summary>
/// A poll as it travels in <c>ChatMessages.Payload</c>: the question and two to five options (six when one is a bundle). Phase B3: <c>Refs</c> (when present) has one entry per option, a bundle ref (see <see cref="ChatBundleRules"/>) for an option that is a real thing from the app and
/// null for a typed one; the option's text is then the bundle's title, so an older app reads the poll as plain text.
/// </summary>
public sealed record ChatPoll(string Question, List<string> Options, List<string?>? Refs = null, List<string>? Slots = null);

/// <summary>
/// The pure rules of group planning (docs/chat-features-research.md, section 11, phase 4): polls (two to five options, a vote that can be changed, closing on demand or after 24 hours), plans with an RSVP that
/// can put the event on the answerer's programme and take it off again, and who is an admin of a made group. Nothing here touches a store or a clock.
/// </summary>
public static class ChatPlanningRules
{
    public const string Poll = "poll";

    // ---- Polls ----

    public const int MinOptions = 2, MaxOptions = 5, MaxWithBundles = 6, MaxQuestion = 100, MaxOption = 40;

    /// <summary>A poll closes by itself this long after it was sent.</summary>
    public static readonly TimeSpan PollLife = TimeSpan.FromHours(24);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>One line of a poll: trimmed, spaces collapsed, no control characters. Null when empty or longer than <paramref name="max"/>.</summary>
    public static string? CleanLine(string? text, int max)
    {
        var clean = string.Join(' ', (text ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        return clean.Length is 0 || clean.Length > max || clean.Any(char.IsControl) ? null : clean;
    }

    /// <summary>
    /// The poll a sender asked for, cleaned: a question, and two to five different options (the same words twice, in any case, count once). Null when the question is missing or too long, an option is too long, or fewer than two options remain.
    /// </summary>
    public static ChatPoll? CleanPoll(string? question, IEnumerable<string?>? options) => CleanPoll(question, options, null, _ => null);

    /// <summary>
    /// As <see cref="CleanPoll(string?, IEnumerable{string?}?)"/>, where option <c>i</c> is the bundle <c>refs[i]</c> when that is not empty: its text is <paramref name="titleOf"/> of the ref (cut to <see cref="MaxOption"/>), and the same ref twice counts once.
    /// Null when a ref has no title (the caller could not build it).
    /// </summary>
    public static ChatPoll? CleanPoll(string? question, IEnumerable<string?>? options, IList<string?>? refs, Func<string, string?> titleOf)
    {
        var q = CleanLine(question, MaxQuestion);
        if (q is null) return null;
        var kept = new List<string>();
        var keptRefs = new List<string?>();
        var i = 0;
        foreach (var raw in options ?? [])
        {
            var r = refs is not null && i < refs.Count && !string.IsNullOrWhiteSpace(refs[i]) ? refs[i] : null;
            i++;
            string? o;
            if (r is not null)
            {
                if (titleOf(r) is not { } title || CleanLine(title, 200) is not { } cleanTitle) return null;
                o = cleanTitle.Length > MaxOption ? cleanTitle[..(MaxOption - 1)].TrimEnd() + "…" : cleanTitle;
                if (keptRefs.Contains(r)) continue;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(raw)) continue;   // an empty row in the form is simply left out
                o = CleanLine(raw, MaxOption);
                if (o is null) return null;
            }
            if (r is null && kept.Contains(o, StringComparer.OrdinalIgnoreCase)) continue;
            kept.Add(o);
            keptRefs.Add(r);
        }
        var hasRefs = keptRefs.Any(x => x is not null);
        if (kept.Count < MinOptions || kept.Count > (hasRefs ? MaxWithBundles : MaxOptions)) return null;
        return new ChatPoll(q, kept, hasRefs ? keptRefs : null);
    }

    // ---- Phase B5: time-slot polls ----

    /// <summary>How long a slot is taken to last when looking for a clash with the voter's own programme.</summary>
    public const int SlotMinutes = 60;

    public static string SlotRef(int day, string time) => $"{day}@{time}";

    /// <summary>A slot as <c>day@HH:mm</c>, or null for anything else.</summary>
    public static (int Day, string Time)? ParseSlot(string? text)
    {
        var at = text?.IndexOf('@') ?? -1;
        if (at < 1 || !int.TryParse(text![..at], out var day) || day < 1) return null;
        var time = text[(at + 1)..];
        return TimeOnly.TryParseExact(time, "HH:mm", out _) ? (day, time) : null;
    }

    /// <summary>The words of a slot option, written here so the sender supplies no text for it.</summary>
    public static string SlotText(int day, string time) => $"Day {day}, {time}";

    /// <summary>
    /// A time poll: a question and two to six different slots, each on a day of the sailing (1 to <paramref name="days"/>). The options' words are built from the slots. Null when the question is bad, a slot is malformed or off the sailing, or too few or many remain.
    /// </summary>
    public static ChatPoll? CleanSlotPoll(string? question, IEnumerable<string?>? slots, int days)
    {
        var q = CleanLine(question, MaxQuestion);
        if (q is null) return null;
        var kept = new List<string>();
        foreach (var raw in slots ?? [])
        {
            if (ParseSlot(raw) is not { } slot || slot.Day > days) return null;
            var r = SlotRef(slot.Day, slot.Time);
            if (!kept.Contains(r)) kept.Add(r);
        }
        if (kept.Count < MinOptions || kept.Count > MaxWithBundles) return null;
        return new ChatPoll(q, [.. kept.Select(r => { var s = ParseSlot(r)!.Value; return SlotText(s.Day, s.Time); })], null, kept);
    }

    /// <summary>Whether a slot overlaps something of the voter's own on that day. <paramref name="busy"/> is (day, start "HH:mm", minutes). Private to the voter and never sent to anyone else.</summary>
    public static bool SlotClashes(string slot, IEnumerable<(int Day, string Start, int Minutes)> busy)
    {
        if (ParseSlot(slot) is not { } s) return false;
        var a = TimeOnly.ParseExact(s.Time, "HH:mm").ToTimeSpan().TotalMinutes;
        foreach (var b in busy)
        {
            if (b.Day != s.Day || !TimeOnly.TryParseExact(b.Start, "HH:mm", out var t)) continue;
            var bs = t.ToTimeSpan().TotalMinutes;
            if (a < bs + b.Minutes && bs < a + SlotMinutes) return true;
        }
        return false;
    }

    public static string Serialise(ChatPoll poll) => JsonSerializer.Serialize(poll, Json);

    public static ChatPoll? ParsePoll(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { return JsonSerializer.Deserialize<ChatPoll>(payload, Json); }
        catch (JsonException) { return null; }
    }

    /// <summary>The words a list line and a phone alert show for a poll.</summary>
    public static string PollPreview(string question) => $"Poll: {question}";

    public static DateTime ClosesAt(DateTime sentAt) => sentAt + PollLife;

    /// <summary>A poll is closed once someone closed it, or 24 hours after it was sent (on the clock it was stamped with).</summary>
    public static bool IsClosed(DateTime? closedAt, DateTime sentAt, DateTime now) => closedAt is not null || now >= ClosesAt(sentAt);

    /// <summary>Who may close a poll before its time: the person who asked it, and an admin of the group.</summary>
    public static bool MayClose(bool isSender, bool isAdmin) => isSender || isAdmin;

    /// <summary>Phase B4, who may decide a poll: the person who asked it and an admin of a made group, and either person in a direct chat. Deciding closes the poll.</summary>
    public static bool MayDecide(string conversationKind, bool isSender, bool isAdmin) => conversationKind == ChatConversationRules.Direct || MayClose(isSender, isAdmin);

    public static bool ValidOption(int option, int count) => option >= 0 && option < count;

    /// <summary>How many chose each of <paramref name="slots"/> answers. A choice outside the slots (an option a later edit removed) is not counted.</summary>
    public static List<int> Tally(IEnumerable<int> choices, int slots)
    {
        var counts = new int[slots];
        foreach (var c in choices) if (c >= 0 && c < slots) counts[c]++;
        return [.. counts];
    }

    // ---- Phase B10: "Done, how was it?" on a decided poll ----

    /// <summary>How it went, said by someone who did the decided thing: 1 loved it, 2 it was fine, 3 not for me.</summary>
    public const int HowLoved = 1, HowFine = 2, HowNot = 3, Hows = 3;

    /// <summary>The rating named by the app, or null for anything else (null means take mine back).</summary>
    public static int? ParseHow(int? how) => how is >= HowLoved and <= HowNot ? how : null;

    /// <summary>How many gave each rating; a stored value outside the three is not counted.</summary>
    public static List<int> HowCounts(IEnumerable<int> ratings)
    {
        var counts = new int[Hows];
        foreach (var r in ratings) if (r >= HowLoved && r <= HowNot) counts[r - 1]++;
        return [.. counts];
    }

    // ---- Plans ----

    public const int Going = 0, Maybe = 1, No = 2, Answers = 3;

    /// <summary>The answer named by the app (<c>going</c>, <c>maybe</c> or <c>no</c>), or null for anything else.</summary>
    public static int? ParseRsvp(string? name) => name switch { "going" => Going, "maybe" => Maybe, "no" => No, _ => null };

    /// <summary>The ref of a programme event on a day, as the app sends it back: <c>eventId:day</c>.</summary>
    public static string PlanRef(string eventId, int day) => $"{eventId}:{day}";

    public static (string EventId, int Day)? ParsePlanRef(string? text)
    {
        var at = text?.LastIndexOf(':') ?? -1;
        return at > 0 && int.TryParse(text![(at + 1)..], out var day) && day > 0 ? (text[..at], day) : null;
    }

    // ---- Plans for something that is booked, not scheduled (an excursion or a dinner) ----

    /// <summary>The event id of a plan for an excursion: <c>tour~&lt;excursionId&gt;</c>. Such a plan is asked about and answered, never booked: Going records the answer only, and each person books their own place on the normal screen.</summary>
    public static string TourEventId(string excursionId) => $"tour~{excursionId}";

    /// <summary>The event id of a plan for a dinner: <c>dine~&lt;venueId&gt;~&lt;time&gt;</c>.</summary>
    public static string DinnerEventId(string venueId, string time) => $"dine~{venueId}~{time}";

    public static string? ParseTourEvent(string? eventId) => eventId is { } e && e.StartsWith("tour~", StringComparison.Ordinal) && e.Length > 5 ? e[5..] : null;

    public static (string VenueId, string Time)? ParseDinnerEvent(string? eventId)
    {
        if (eventId is not { } e || !e.StartsWith("dine~", StringComparison.Ordinal)) return null;
        var parts = e[5..].Split('~');
        return parts.Length == 2 && parts[0].Length > 0 && parts[1].Length > 0 ? (parts[0], parts[1]) : null;
    }

    /// <summary>Whether a plan's event is booked rather than scheduled. Answering such a plan never changes anyone's programme and never books, pays or reserves anything.</summary>
    public static bool IsBookingPlan(string? eventId) => ParseTourEvent(eventId) is not null || ParseDinnerEvent(eventId) is not null;

    /// <summary>The words a list line and a phone alert show for a plan.</summary>
    public static string PlanPreview(string title) => $"Plan: {title}";

    /// <summary>Whether an answer may change the person's own programme. A supervised child's answer is recorded for the group but never touches their programme (their guardian plans it).</summary>
    public static bool MayChangeProgramme(bool supervised) => !supervised;

    /// <summary>What an answer does to the answerer's programme: put the event on, take it off, and whether the plan is the reason it is there now.</summary>
    public sealed record ProgrammeEffect(bool Add, bool Remove, bool Added);

    /// <summary>
    /// Going puts the event on the programme unless it is already there (an event the person saved themselves is theirs, so it is neither marked as added nor ever taken off by the plan).
    /// Any other answer takes the event off again only when this plan put it there. <paramref name="mayChange"/> is false when the event does not run for the person on that day, or they may not change their programme.
    /// </summary>
    public static ProgrammeEffect Effect(int? previous, bool previousAdded, int next, bool inProgramme, bool mayChange)
    {
        if (next == Going)
        {
            if (!mayChange) return new(false, false, false);
            return inProgramme ? new(false, false, previousAdded) : new(true, false, true);
        }
        return new(false, previous == Going && previousAdded && mayChange && inProgramme, false);
    }

    // ---- Admins ----

    /// <summary>The creator of a made group is its only admin.</summary>
    public static bool IsAdmin(bool isCreator, bool flagged) => isCreator;

    /// <summary>
    /// Whether a person may write a message in a conversation. Everyone may, except in an announcement-only group, where only an admin posts. Votes, answers and reactions are not messages and stay open to everyone.
    /// </summary>
    public static bool MayPost(string kind, bool announcementOnly, bool isAdmin) => kind != ChatConversationRules.Group || !announcementOnly || isAdmin;
}
