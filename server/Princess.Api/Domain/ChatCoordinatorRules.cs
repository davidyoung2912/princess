using Princess.Api.Data;

namespace Princess.Api.Domain;

/// <summary>
/// The group coordinator (docs/chat-features-research.md, phase 11, role R5). Pure rules for what Stanley may say about a poll or a plan in a group: a tally in counts ("3 of 5 have answered, closes in about 5 hours"),
/// a compromise suggestion drawn only from the public options, the organiser's private "what remains", and a gentle reminder to the people who have not answered yet. Nothing here names a person who has not answered,
/// carries a price or a reason, or touches a store or a clock. The group-level gates (an admin, the group's opt-in, no supervised child) are the shared ones in <see cref="ChatGroupMomentRules.Refusal"/>.
/// </summary>
public static class ChatCoordinatorRules
{
    /// <summary>One person is reminded about a thread at most once in this long, however many times an organiser taps Remind.</summary>
    public static readonly TimeSpan ReminderGap = TimeSpan.FromDays(3);

    /// <summary>The longest tally a shared card may be.</summary>
    public const int MaxTally = 300;

    /// <summary>Why a reminder cannot go out (in addition to the refusal codes of <see cref="ChatGroupMomentRules"/>): the poll is closed, it is too soon, or nobody needs one.</summary>
    public const string Closed = "closed", TooSoon = "tooSoon", NoOne = "none";

    /// <summary>The earliest a reminder about a poll or plan may be sent: halfway through the 24 hours a poll is open (a plan has no closing time, so it uses the same wait).</summary>
    public static DateTime RemindFrom(DateTime sentAt) => sentAt + ChatPlanningRules.PollLife / 2;

    /// <summary>How many of a group's active people have answered. Anyone who left is not counted either way.</summary>
    public sealed record Progress(int Answered, int Total);

    public static Progress CountAnswers(IEnumerable<long> activeMembers, IEnumerable<long> answeredBy)
    {
        var active = activeMembers.ToHashSet();
        return new(answeredBy.Where(active.Contains).Distinct().Count(), active.Count);
    }

    /// <summary>The people who have not answered: active members only, by id, never shown by name to the group.</summary>
    public static List<long> Unanswered(IEnumerable<long> activeMembers, IEnumerable<long> answeredBy)
    {
        var done = answeredBy.ToHashSet();
        return [.. activeMembers.Where(id => !done.Contains(id))];
    }

    // ---- What Stanley says ----

    /// <summary>"3 of 5 have answered." Counts only.</summary>
    public static string Answered(Progress p) => p.Total == 1 ? $"{p.Answered} of 1 has answered." : $"{p.Answered} of {p.Total} have answered.";

    /// <summary>When a poll closes, in words that need no clock: "Closes in about 5 hours", "Closes within the hour" or "The poll is closed".</summary>
    public static string ClosesPhrase(bool closed, DateTime closesAt, DateTime now)
    {
        if (closed) return "The poll is closed.";
        var left = closesAt - now;
        if (left <= TimeSpan.FromHours(1)) return "Closes within the hour.";
        var hours = (int)Math.Round(left.TotalHours);
        return $"Closes in about {hours} hours.";
    }

    /// <summary>
    /// A compromise idea for a split poll, from the option words and the counts and nothing else: the two or more options that are level, or one that is a single vote ahead of the next. Null when nobody has voted or one option leads clearly.
    /// It never says who chose what.
    /// </summary>
    public static string? Compromise(IReadOnlyList<string> options, IReadOnlyList<int> counts)
    {
        if (options.Count < 2 || counts.Count != options.Count) return null;
        var top = counts.Max();
        if (top == 0) return null;
        var leaders = Enumerable.Range(0, counts.Count).Where(i => counts[i] == top).ToList();
        if (leaders.Count >= 3) return $"{Join(leaders.Select(i => options[i]))} are level. Could the group fit more than one in?";
        if (leaders.Count == 2) return $"{options[leaders[0]]} and {options[leaders[1]]} are level. Could the group do both?";
        var next = Enumerable.Range(0, counts.Count).Where(i => i != leaders[0]).Select(i => counts[i]).Max();
        if (next > 0 && top - next == 1)
        {
            var second = Enumerable.Range(0, counts.Count).First(i => i != leaders[0] && counts[i] == next);
            return $"{options[leaders[0]]} is just ahead of {options[second]}. Could the group do both?";
        }
        return null;
    }

    private static string Join(IEnumerable<string> parts)
    {
        var list = parts.ToList();
        return list.Count <= 1 ? string.Concat(list) : string.Join(", ", list.Take(list.Count - 1)) + " and " + list[^1];
    }

    /// <summary>A compromise for a plan: when more people cannot make it than are going, a different time might suit more of the group. Counts only; null when the answers do not call for one.</summary>
    public static string? PlanCompromise(int going, int maybe, int no)
    {
        if (going + maybe + no < 2) return null;
        if (no > going) return "More people cannot make it than are going. A different time might suit more of the group.";
        if (going == 0 && maybe > 0) return "Nobody is sure yet. Could the group pick a time that suits more of you?";
        return null;
    }

    /// <summary>The text of a shared poll tally: the question, who has answered in counts, the standings in counts per option, when it closes, and a compromise when the vote is split. Cut to <see cref="MaxTally"/>.</summary>
    public static string? PollTally(ChatPoll poll, IReadOnlyList<int> counts, Progress progress, bool closed, DateTime closesAt, DateTime now)
    {
        var standing = string.Join(", ", poll.Options.Select((o, i) => $"{o} {(i < counts.Count ? counts[i] : 0)}"));
        var parts = new List<string> { $"Poll: {poll.Question}", Answered(progress), $"So far: {standing}.", ClosesPhrase(closed, closesAt, now) };
        if (Compromise(poll.Options, counts) is { } idea) parts.Add(idea);
        return ChatStanleyRules.Filter(string.Join(' ', parts), MaxTally);
    }

    /// <summary>The text of a shared plan tally: the plan's title, who has answered in counts, and a compromise when answers lean against it.</summary>
    public static string? PlanTally(string title, int going, int maybe, int no, Progress progress)
    {
        var parts = new List<string> { $"Plan: {title}", Answered(progress), $"{going} going, {maybe} maybe, {no} cannot go." };
        if (PlanCompromise(going, maybe, no) is { } idea) parts.Add(idea);
        return ChatStanleyRules.Filter(string.Join(' ', parts), MaxTally);
    }

    // ---- Reminders ----

    /// <summary>
    /// Who a reminder goes to, among the people who have not answered: not the asker, not a supervised child, not someone who turned reminders off in this thread, not someone either side has blocked,
    /// and not anyone reminded within <see cref="ReminderGap"/> in this thread.
    /// </summary>
    public static List<long> Recipients(IEnumerable<long> unanswered, long askerId, IReadOnlySet<long> supervised, IReadOnlySet<long> muted, IReadOnlySet<long> blocked,
        IReadOnlyDictionary<long, DateTime> lastReminded, DateTime now) =>
        [.. unanswered.Where(id => id != askerId && !supervised.Contains(id) && !muted.Contains(id) && !blocked.Contains(id)
            && !(lastReminded.TryGetValue(id, out var last) && now - last < ReminderGap))];

    /// <summary>
    /// Why a reminder cannot be sent now, or null when it can: a closed poll, or less than half the poll's time gone. The group-level checks come first, in <see cref="ChatGroupMomentRules.Refusal"/>.
    /// </summary>
    public static string? ReminderRefusal(bool closed, DateTime sentAt, DateTime now) => closed ? Closed : now < RemindFrom(sentAt) ? TooSoon : null;

    /// <summary>
    /// What the person reminded reads, in their own Stanley chat. It names the organiser (so the reminder is never anonymous) and says only that a poll or plan wants an answer: no question, option, time or place,
    /// and nothing about who else has answered.
    /// </summary>
    public static string ReminderText(string organiser, bool poll) => $"{organiser} asked Stanley to remind you: a {(poll ? "poll" : "plan")} in your group chat is waiting for your answer.";

    /// <summary>What the organiser is told after sending: a count, never names.</summary>
    public static string RemindedLine(int count) => count switch { 0 => "Nobody needed a reminder.", 1 => "Reminded 1 person.", _ => $"Reminded {count} people." };

    // ---- What remains (private to the organiser) ----

    /// <summary>One poll or plan as the organiser's "what remains" sees it.</summary>
    public sealed record Item(bool Open, Progress Progress);

    /// <summary>How many open polls and plans still wait for someone, and how many answers are still missing in all. Counts only.</summary>
    public static (int Waiting, int Outstanding) Remaining(IEnumerable<Item> items)
    {
        var waiting = items.Where(i => i.Open && i.Progress.Answered < i.Progress.Total).ToList();
        return (waiting.Count, waiting.Sum(i => i.Progress.Total - i.Progress.Answered));
    }
}
