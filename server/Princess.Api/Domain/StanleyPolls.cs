using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>One group poll as the signed-in person sees it. <c>MyAnswers</c> is only their own; everyone else's answers are totals in <c>Status</c>, with no names and no reasons.</summary>
public sealed record StanleyPollDto(Guid Id, string Question, List<GroupOption> Options, long CreatedAt, long? ClosesAt, bool Closed, bool Mine, string Owner, Dictionary<string, string> MyAnswers, GroupStatusDto Status);

/// <summary>A new poll: the question, two to six choices and how many days it stays open.</summary>
public sealed record StanleyPollRequest(string? Question, List<string>? Options, int? Days);

/// <summary>An answer to one choice: yes, maybe or no.</summary>
public sealed record StanleyPollAnswerRequest(string? OptionId, string? Answer);

/// <summary>The stored poll: its choices, and each person's answers by user id. Never holds a reason.</summary>
public sealed class StanleyPollDoc
{
    public string Question { get; set; } = "";
    public List<GroupOption> Options { get; set; } = [];
    public Dictionary<long, Dictionary<string, string>> Answers { get; set; } = [];
}

/// <summary>Rules for a group poll made through Stanley (the server side of what was a device document). Pure.</summary>
public static class StanleyPollRules
{
    public const int QuestionMax = 120, LabelMax = 40, MinOptions = 2, MaxOptions = 6, MaxOpen = 5;
    public static readonly int[] Days = [1, 3, 7];
    public static readonly string[] Answers = ["yes", "maybe", "no"];

    private static string Tidy(string? s) => Regex.Replace((s ?? "").Replace('\n', ' ').Replace('\r', ' '), @"\s+", " ").Trim();

    /// <summary>The cleaned question and choices, or the first problem as a closed code: <c>question</c>, <c>options</c> (fewer than two, more than six, a blank or too long one, or a repeat) or <c>days</c>.</summary>
    public static (string? Problem, string Question, List<GroupOption> Options, int Days) Clean(StanleyPollRequest? r)
    {
        var q = Tidy(r?.Question);
        var labels = (r?.Options ?? []).Select(Tidy).ToList();
        var days = r?.Days ?? 3;
        if (q.Length == 0 || q.Length > QuestionMax) return ("question", q, [], days);
        if (labels.Count is < MinOptions or > MaxOptions || labels.Any(l => l.Length == 0 || l.Length > LabelMax) || labels.Select(l => l.ToLowerInvariant()).Distinct().Count() != labels.Count) return ("options", q, [], days);
        if (!Days.Contains(days)) return ("days", q, [], days);
        return (null, q, [.. labels.Select((l, i) => new GroupOption("o" + (i + 1), l))], days);
    }

    public static bool AnswerOk(StanleyPollDoc doc, string? optionId, string? answer) => doc.Options.Any(o => o.Id == optionId) && Answers.Contains(answer ?? "");

    /// <summary>The poll's status from its answers, counting only the people who may answer (adults on the booking) and only answers given. Silence is never a yes.</summary>
    public static GroupStatusDto StatusOf(StanleyPollDoc doc, IReadOnlyList<(long UserId, string Name)> voters, DateTime createdAt, DateTime? closesAt, bool closed, bool organiser, long nowMs)
    {
        var members = voters.Select(v => new GroupMember(v.Name, doc.Answers.TryGetValue(v.UserId, out var a) ? a : null)).ToList();
        long Ms(DateTime d) => new DateTimeOffset(DateTime.SpecifyKind(d, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        return StanleyPlannerRules.GroupStatus(new GroupStatusRequest(doc.Question, doc.Options, members, Ms(createdAt), closesAt is { } c ? Ms(c) : null, closed, organiser), nowMs);
    }

    /// <summary>"Poll the group: snorkel or beach?" read from the words: the question and its choices, or null when the words do not ask for a poll.</summary>
    public static StanleyPollRequest? FromWords(string message)
    {
        var lower = message.ToLowerInvariant();
        if (!Regex.IsMatch(lower, @"\b(create|start|make|set up|run|do)\b.{0,20}\b(poll|vote)\b|\bpoll (the|my) (group|party|family|friends|others)\b|\bask (the group|everyone|everybody|the others|the party)\b|\bvote on\b")) return null;
        var colon = message.IndexOf(':');
        var rest = colon >= 0 ? message[(colon + 1)..] : Regex.Replace(message, @"^.*?\b(poll (the|my) (group|party|family|friends|others)|ask (the group|everyone|everybody|the others|the party)|(create|start|make|set up|run|do) (a )?(poll|vote)( on| about| for)?|vote on)\b", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        rest = Tidy(rest).TrimEnd('?', '.', '!').Trim();
        var parts = Regex.Split(rest, @"\s+or\s+|,\s*(?:or\s+)?|\s*/\s*", RegexOptions.IgnoreCase).Select(p => Tidy(p).Trim('?', '.', '!')).Where(p => p.Length > 0).ToList();
        return new StanleyPollRequest(rest.Length == 0 ? "" : rest + "?", parts, 3);
    }
}
