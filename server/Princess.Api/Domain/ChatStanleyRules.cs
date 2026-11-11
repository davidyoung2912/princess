using System.Text.RegularExpressions;
using Princess.Api.Data;

namespace Princess.Api.Domain;

/// <summary>
/// Stanley on tap in a thread (docs/chat-features-research.md, phase 10). Pure rules for the four things a member can ask for: a private catch-up on what they may already read, a poll preview made from one message,
/// the plain meaning of a cruise word, and a draft for a delayed or meeting message. Nothing here calls a model: the catch-up only quotes what people wrote (so a message that tries to give Stanley
/// instructions is just a quoted line), and everything it says passes <see cref="Filter"/>. Nothing touches a store or a clock.
/// </summary>
public static partial class ChatStanleyRules
{
    /// <summary>The most messages a catch-up reads, and how far back: whichever is smaller.</summary>
    public const int MaxMessages = 60;
    public static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);
    /// <summary>Fewer messages than this is not worth a summary; the app says so instead.</summary>
    public const int MinMessages = 3;
    /// <summary>The catch-up button shows once more than this many messages are unread (the app mirrors it).</summary>
    public const int UnreadThreshold = 15;
    /// <summary>Catch-ups one person may ask for in <see cref="CapWindow"/>.</summary>
    public const int HourlyCap = 3;
    public static readonly TimeSpan CapWindow = TimeSpan.FromHours(1);
    /// <summary>Messages before the chosen one that may help make a plan.</summary>
    public const int MaxContext = 2;
    public const int MaxLine = 100;
    public const int MaxListed = 5;
    public const int MaxTerms = 5;
    public const int MaxPlace = 40;
    public const int MaxDelay = 180;

    /// <summary>Why Stanley's help is not offered in a conversation.</summary>
    public const string KindOff = "kind", ChildOff = "child", SwitchedOff = "off";

    /// <summary>
    /// Why Stanley's help is not offered in a conversation, or null when it is. Only a conversation between people has it: not Stanley's own chat, and not a channel or room (other guests' public words).
    /// Not where a supervised child is a member (their guardian already decides who they talk to, and nothing about a child's chat is summarised), and not where the creator switched it off.
    /// </summary>
    public static string? Unavailable(string kind, bool anyChildMember, bool switchedOff) =>
        kind is not (ChatConversationRules.Party or ChatConversationRules.Direct or ChatConversationRules.Group) ? KindOff
        : anyChildMember ? ChildOff
        : switchedOff ? SwitchedOff
        : null;

    /// <summary>
    /// Who may switch his help off for a conversation: the guest who made a group, or either person in a direct chat. The booking's group and the rest have no creator, so nobody (it stays on).
    /// The one switch covers asking him in the thread (<c>@Stanley</c>) and the catch-up.
    /// </summary>
    public static bool MayConfigure(string kind, long actorId, long? createdBy) =>
        kind == ChatConversationRules.Direct || (kind == ChatConversationRules.Group && createdBy is { } c && c == actorId);

    /// <summary>The line the conversation shows when his help is switched off or on, so nobody is surprised by his silence.</summary>
    public static string SwitchLine(bool off) => off ? "Stanley's help was turned off in this chat." : "Stanley's help was turned on in this chat.";

    /// <summary>Whether another catch-up is allowed: fewer than <see cref="HourlyCap"/> in the last hour.</summary>
    public static bool UnderCap(int usesInWindow) => usesInWindow < HourlyCap;

    /// <summary>
    /// The messages a catch-up may read, oldest first: what the person could read anyway (their own window), only plain text a person wrote (no system line, deleted message, card, poll, plan or Stanley line),
    /// no older than a day, and at most <see cref="MaxMessages"/>.
    /// </summary>
    public static List<ChatMessageRow> Window(IEnumerable<ChatMessageRow> rows, string kind, DateTime joinedAt, DateTime? leftAt, DateTime now) =>
        [.. rows.Where(r => r.DeletedAt is null && !r.IsSystem && !r.FromStanley && r.Kind == "text" && !string.IsNullOrWhiteSpace(r.Text)
                && ChatConversationRules.CanRead(kind, r.At, joinedAt, leftAt) && r.At >= now - MaxAge)
            .OrderBy(r => r.At).ThenBy(r => r.Id).TakeLast(MaxMessages)];

    // ---- What Stanley may say ----

    [GeneratedRegex(@"(https?://|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|co|app|me|info|biz|ly)\b\S*", RegexOptions.IgnoreCase)]
    private static partial Regex LinkPattern();

    [GeneratedRegex(@"\+?\d[\d\s().-]{5,}\d")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"[\$€£]\s?\d[\d,.]*|\b\d[\d,.]*\s?(usd|dollars?|euros?|bucks)\b", RegexOptions.IgnoreCase)]
    private static partial Regex MoneyPattern();

    /// <summary>
    /// A line Stanley may say: control characters read as spaces and doubled spaces gone, a link shown as "[link]" and a phone number as "[number]", cut to <paramref name="max"/> characters with an ellipsis.
    /// Null when it fails the word filter or nothing is left.
    /// </summary>
    public static string? Filter(string? text, int max = MaxLine)
    {
        if (string.IsNullOrWhiteSpace(text) || ProfanityFilter.IsBlocked(text)) return null;
        var clean = new string([.. text.Select(c => char.IsControl(c) ? ' ' : c)]);
        clean = LinkPattern().Replace(clean, "[link]");
        clean = PhonePattern().Replace(clean, "[number]");
        clean = string.Join(' ', clean.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (clean.Length == 0) return null;
        return clean.Length <= max ? clean : clean[..(max - 1)].TrimEnd() + "…";
    }

    // ---- The catch-up ----

    /// <summary>One message as the summary sees it: who said it (a short name), and the words.</summary>
    public sealed record Said(long FromUserId, string Who, string Text);

    /// <summary>What a catch-up holds: what looks settled, what looks open, and the latest few lines so it is never empty. Each line is a short quote with its speaker.</summary>
    public sealed record Summary(List<string> Decided, List<string> Open, List<string> Latest);

    [GeneratedRegex(@"\b(let'?s|we'?ll|we will|agreed|sounds good|deal|see you|meet at|meeting at|booked|it'?s on|count me in|i'?m in|confirmed)\b", RegexOptions.IgnoreCase)]
    private static partial Regex DecidedPattern();

    private static string Line(string who, string quoted) => $"{who}: “{quoted}”";

    /// <summary>
    /// A summary of <paramref name="said"/> (oldest first), built only by quoting. A line that looks settled ("let's", "agreed", "see you at") is listed as <c>Decided</c>. A question is <c>Open</c> when nobody else
    /// has written since. The newest three are <c>Latest</c>. Each list is cut to <see cref="MaxListed"/>, newest kept, and every quote passes <see cref="Filter"/>.
    /// </summary>
    public static Summary Summarise(IReadOnlyList<Said> said)
    {
        var decided = new List<string>();
        var open = new List<string>();
        for (var i = 0; i < said.Count; i++)
        {
            var s = said[i];
            var quoted = Filter(s.Text);
            if (quoted is null) continue;
            var shown = Line(s.Who, quoted);
            if (quoted.Contains('?') && said.Skip(i + 1).All(x => x.FromUserId == s.FromUserId)) open.Add(shown);
            else if (DecidedPattern().IsMatch(quoted)) decided.Add(shown);
        }
        var latest = said.TakeLast(3).Select(s => Filter(s.Text) is { } q ? Line(s.Who, q) : null).OfType<string>().ToList();
        return new([.. decided.TakeLast(MaxListed)], [.. open.TakeLast(MaxListed)], latest);
    }

    // ---- Make this a plan ----

    /// <summary>A poll the app may offer to post: the question and two to five options. Nothing is posted by it.</summary>
    public sealed record PollPreview(string Question, List<string> Options);

    [GeneratedRegex(@"(?<=\b(?:at|by|around|or)\s)(?:1[0-2]|0?[1-9])(?::[0-5]\d)?(?:\s?(?:am|pm))?(?![\w:])|(?<![\w:])(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)(?!\w)", RegexOptions.IgnoreCase)]
    private static partial Regex TimePattern();

    private static readonly string[] YesNoOptions = ["I'm in", "Maybe", "Can't make it"];

    /// <summary>
    /// The poll that turns one message into a question for the group. When the message names two or more times ("7 or 8?") each time is an option, with "Can't make it"; otherwise the options are
    /// "I'm in", "Maybe" and "Can't make it". A message too short to stand alone ("7?") borrows the one before it. Any price is taken out of the question (money never goes to a group card).
    /// Null when nothing usable remains or it fails the checks of a poll.
    /// </summary>
    public static PollPreview? PlanFrom(string? chosen, IReadOnlyList<string> earlier)
    {
        var text = MoneyPattern().Replace(chosen ?? "", " ");
        var plain = TimePattern().Replace(text, " ");
        var words = plain.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Count(w => w.Any(char.IsLetter));
        if (words < 2 && earlier.Count > 0) text = MoneyPattern().Replace(earlier[^1], " ") + " " + text;
        var times = TimePattern().Matches(text).Select(m => m.Value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Take(ChatPlanningRules.MaxOptions - 1).ToList();
        var line = Filter(text.Trim().TrimEnd('?', '.', '!', ' '), ChatPlanningRules.MaxQuestion - 1);
        if (line is null) return null;
        List<string> options = times.Count >= 2 ? [.. times, "Can't make it"] : [.. YesNoOptions];
        var poll = ChatPlanningRules.CleanPoll(line + "?", options);
        return poll is null ? null : new(poll.Question, poll.Options);
    }

    // ---- Plain words ----

    /// <summary>The meanings in the library, in plain words. A lookup of a word in a message is a search of this list, never a model.</summary>
    private static readonly (string Term, string Meaning)[] Glossary =
    [
        ("muster drill", "The safety drill every guest attends before the ship sails, to learn where to go in an emergency."),
        ("muster", "The safety drill every guest attends before the ship sails, to learn where to go in an emergency."),
        ("tender", "A small boat that carries guests between the ship and shore when the ship cannot dock."),
        ("tendering", "Using small boats to carry guests between the ship and shore when the ship cannot dock."),
        ("embarkation", "Boarding the ship at the start of the cruise."),
        ("embark", "To board the ship."),
        ("disembarkation", "Leaving the ship at the end of the cruise, or at a port."),
        ("disembark", "To leave the ship."),
        ("gangway", "The ramp or walkway between the ship and the dock."),
        ("port side", "The left side of the ship when you face the front."),
        ("starboard", "The right side of the ship when you face the front."),
        ("bow", "The front of the ship."),
        ("stern", "The back of the ship."),
        ("aft", "Towards the back of the ship."),
        ("forward", "Towards the front of the ship."),
        ("stateroom", "A guest's cabin."),
        ("lido", "The pool deck, usually with a casual buffet nearby."),
        ("atrium", "The tall open area in the middle of the ship, often with shops and a bar."),
        ("promenade", "A walking deck, indoors or outdoors."),
        ("folio", "Your account on board: everything charged to your cabin."),
        ("shore excursion", "A tour or activity booked for a port day."),
        ("all aboard", "The time by which every guest must be back on the ship before it sails."),
        ("sea day", "A day spent sailing, with no port stop."),
        ("port day", "A day when the ship is docked or anchored at a stop."),
        ("formal night", "An evening when many guests dress up for dinner. It is optional."),
        ("guest services", "The desk on board for questions, problems and changes to your booking."),
        ("gratuities", "Tips for the crew, usually added to your account each day."),
        ("knots", "The unit of a ship's speed: nautical miles an hour."),
        ("nautical mile", "A unit of distance at sea, a little longer than a mile on land."),
        ("bridge", "The room from which the ship is steered."),
        ("deck", "A floor of the ship."),
        ("pax", "Short for passengers."),
    ];

    /// <summary>One meaning found in a message.</summary>
    public sealed record Term(string Word, string Meaning);

    /// <summary>
    /// The cruise words in <paramref name="text"/> that the library knows (whole words, any case, longest phrase first so "muster drill" is not also "muster"), in the order they appear, at most <see cref="MaxTerms"/>.
    /// </summary>
    public static List<Term> Explain(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var found = new List<(int At, int Length, string Term, string Meaning)>();
        foreach (var (term, meaning) in Glossary.OrderByDescending(g => g.Term.Length))
        {
            var m = Regex.Match(text, $@"(?<!\w){Regex.Escape(term)}(?!\w)", RegexOptions.IgnoreCase);
            if (!m.Success || found.Any(f => m.Index < f.At + f.Length && f.At < m.Index + m.Length)) continue;
            found.Add((m.Index, m.Length, term, meaning));
        }
        return [.. found.OrderBy(f => f.At).Take(MaxTerms).Select(f => new Term(f.Term, f.Meaning))];
    }

    // ---- Help me write ----

    public const string Late = "late", Meet = "meet";

    [GeneratedRegex(@"^(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)?$", RegexOptions.IgnoreCase)]
    private static partial Regex ClockPattern();

    /// <summary>
    /// A short message to edit before sending. <c>late</c> says how late (5 to 180 minutes, or nothing) and for where; <c>meet</c> asks to meet at a place and, if given, a time. Null when the kind is unknown,
    /// a place or time is not usable, or the minutes are out of range. The place and time are the person's own words, passed through <see cref="Filter"/>; nothing is looked up or guessed.
    /// </summary>
    public static string? Draft(string? kind, int? minutes, string? place, string? time)
    {
        var where = string.IsNullOrWhiteSpace(place) ? null : ChatPlanningRules.CleanLine(Filter(place, MaxPlace), MaxPlace);
        if (!string.IsNullOrWhiteSpace(place) && where is null) return null;
        var at = string.IsNullOrWhiteSpace(time) ? null : time.Trim();
        if (at is not null && !ClockPattern().IsMatch(at)) return null;
        switch (kind)
        {
            case Late:
                if (minutes is { } m && (m < 5 || m > MaxDelay)) return null;
                return $"I'm running {(minutes is { } n ? $"about {n} minutes" : "a little")} late{(where is null ? "" : $" for {where}")}. Sorry! Please start without me, I'll find you.";
            case Meet:
                if (where is null) return null;
                return $"Shall we meet at {where}{(at is null ? "" : $" at {at}")}? Let me know if that works for you.";
            default:
                return null;
        }
    }
}
