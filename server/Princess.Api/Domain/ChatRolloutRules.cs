namespace Princess.Api.Domain;

/// <summary>What was measured for one Stanley role or moment over the window: counts only, no person and no text. A signal that has no figure yet is null and is skipped.</summary>
public sealed record RolloutSample(string Name, int CardsShown, int GuestsExposed, int Dismissed, int DontShowAgain, int GuestsMuted, int RemindersSent, int RemindersMuted, int Lines, int Reports, int CatchUps, int CatchUpsWrong, double? PushOptOutPoints, int? Acted);

/// <summary>One signal against its two lines.</summary>
public sealed record RolloutSignal(string Name, double Value, double RewriteAt, double PauseAt, string Verdict);

/// <summary>The decision for one role or moment: <c>notEnough</c> (too few to judge), <c>ok</c>, <c>rewrite</c> or <c>pause</c>, with the signals that led to it.</summary>
public sealed record RolloutVerdict(string Name, string Verdict, IReadOnlyList<RolloutSignal> Signals);

/// <summary>
/// The rollout thresholds of docs/chat-features-research.md, phase 14, as pure rules. A role or moment is judged only once there is a sample (at least 200 cards shown or 50 guests exposed) over a full sailing or 14 days, whichever
/// is longer. Each signal has a "rewrite the moment" line and a "pause the role until fixed" line; the worst one decides. A "hard stop" (a private fact in a shared thread, a push or a log; a Stanley line in a conversation with a
/// supervised child; an unconfirmed mutating action) needs no sample and switches the role off at once. The stage gate says whether a wider audience may be admitted. The owner may change the numbers; they are all here.
/// </summary>
public static class ChatRolloutRules
{
    public const string NotEnough = "notEnough", Ok = "ok", Rewrite = "rewrite", Pause = "pause";
    public const int MinCards = 200, MinGuests = 50, MinDays = 14;

    public const string StageStaff = "staff", StageCohort = "cohort", StageEveryone = "everyone";
    /// <summary>The cohort stage is about 5% of guests for one full sailing.</summary>
    public const double CohortShare = 0.05;

    public const string PrivateFact = "privateFact", ChildLine = "childLine", Unconfirmed = "unconfirmedAction";
    public static readonly string[] HardStops = [PrivateFact, ChildLine, Unconfirmed];

    /// <summary>The window to measure over: a full sailing or 14 days, whichever is longer.</summary>
    public static int WindowDays(int sailingDays) => Math.Max(MinDays, sailingDays);

    public static bool EnoughSample(int cardsShown, int guestsExposed) => cardsShown >= MinCards || guestsExposed >= MinGuests;

    private static double Share(int part, int whole) => whole <= 0 ? 0 : (double)part / whole;

    private static string Above(double v, double rewrite, double pause) => v > pause ? Pause : v > rewrite ? Rewrite : Ok;
    private static string Below(double v, double rewrite, double pause) => v < pause ? Pause : v < rewrite ? Rewrite : Ok;

    private static RolloutSignal High(string name, double v, double rewrite, double pause) => new(name, v, rewrite, pause, Above(v, rewrite, pause));
    private static RolloutSignal Low(string name, double v, double rewrite, double pause) => new(name, v, rewrite, pause, Below(v, rewrite, pause));

    /// <summary>Every signal that can be worked out from the sample, in the table's order. A signal with no denominator (no reminders sent, no catch-ups) is left out rather than counted as good.</summary>
    public static List<RolloutSignal> Signals(RolloutSample s)
    {
        var list = new List<RolloutSignal>();
        if (s.CardsShown > 0)
        {
            list.Add(High("dismiss", Share(s.Dismissed, s.CardsShown), 0.60, 0.80));
            list.Add(High("dontShowAgain", Share(s.DontShowAgain, s.CardsShown), 0.10, 0.20));
            if (s.Acted is { } acted) list.Add(Low("actionRate", Share(acted, s.CardsShown), 0.08, 0.03));
        }
        if (s.GuestsExposed > 0) list.Add(High("mute", Share(s.GuestsMuted, s.GuestsExposed), 0.05, 0.10));
        if (s.RemindersSent > 0) list.Add(High("remindersMuted", Share(s.RemindersMuted, s.RemindersSent), 0.10, 0.20));
        if (s.Lines > 0) list.Add(High("reportsPer1000", 1000.0 * s.Reports / s.Lines, 1, 3));
        if (s.CatchUps > 0) list.Add(High("catchUpWrong", Share(s.CatchUpsWrong, s.CatchUps), 0.05, 0.10));
        if (s.PushOptOutPoints is { } p) list.Add(High("pushOptOutPoints", p, 1, 2));
        return list;
    }

    /// <summary>The decision for one role or moment: too few to judge, or the worst of its signals.</summary>
    public static RolloutVerdict Judge(RolloutSample s)
    {
        if (!EnoughSample(s.CardsShown, s.GuestsExposed)) return new(s.Name, NotEnough, []);
        var signals = Signals(s);
        var verdict = signals.Any(x => x.Verdict == Pause) ? Pause : signals.Any(x => x.Verdict == Rewrite) ? Rewrite : Ok;
        return new(s.Name, verdict, signals);
    }

    /// <summary>
    /// What the notice log already shows for suggestion cards: cards written, "Not now" (snooze) and "Don't show this again" (dismiss). Guests exposed, mutes, reports, the primary button and push opt-outs are not logged yet, so those signals are
    /// left out (null or zero) rather than guessed, and a figure the log cannot give is never counted as good.
    /// </summary>
    public static RolloutSample FromSuggestionLog(IEnumerable<(string Event, int Count)> rows)
    {
        int Sum(string e) => rows.Where(r => r.Event == e).Sum(r => r.Count);
        var dont = Sum(StanleyNoticeRules.EventDismiss);
        return new("suggestion", Sum(StanleyNoticeRules.EventPosted), 0, Sum(StanleyNoticeRules.EventSnooze) + dont, dont, 0, 0, 0, 0, 0, 0, 0, null, null);
    }

    /// <summary>A hard stop is any one of the three named cases: it switches the role off at once and needs a written review before it is on again.</summary>
    public static bool IsHardStop(string? kind) => kind is not null && HardStops.Contains(kind);

    /// <summary>
    /// Whether the next stage may open. Staff only needs no thresholds, only no hard stop; a cohort of about 5% for one full sailing follows; everyone only if no signal is in the pause column and at most one is in the rewrite
    /// column. A critical-lane card is measured for delivery and accuracy, never for dismiss rates, so it is not passed in here.
    /// </summary>
    public static bool MayWiden(string stage, bool hardStop, IReadOnlyList<RolloutVerdict> verdicts)
    {
        if (hardStop) return false;
        if (stage == StageStaff) return true;
        if (stage != StageCohort) return false;
        if (verdicts.Count == 0 || verdicts.Any(v => v.Verdict == NotEnough)) return false;
        if (verdicts.Any(v => v.Verdict == Pause)) return false;
        return verdicts.SelectMany(v => v.Signals).Count(x => x.Verdict == Rewrite) <= 1;
    }

    /// <summary>The stage a guest is in, from a stable hash (no person stored): staff first, then about 5%, then everyone.</summary>
    public static bool InCohort(int bucket100, bool staff, string stage) => stage == StageEveryone || staff || (stage == StageCohort && bucket100 >= 0 && bucket100 < (int)(CohortShare * 100));
}
