using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>What a sentence of the guest's was read as: one control from a fixed set, shown back in words. <c>NeedsConfirm</c> is false for a control that changes nothing (it only opens or explains).</summary>
public sealed record ControlProposal(bool Understood, string Id, string Label, string Detail, bool NeedsConfirm, string? Route, IReadOnlyList<string> Examples);

public sealed record ControlRequest(string? Text);
public sealed record ControlConfirmRequest(string? Id);

/// <summary>The outcome of a confirmed control, in words, with a screen to open when there is one.</summary>
public sealed record ControlResult(bool Applied, string Message, string? Route);

/// <summary>
/// Control in plain words (19.4). The guest's sentence is matched against a small fixed set and shown back; nothing changes until they confirm, and the sentence itself is never stored or sent to a model.
/// "Do more" never switches anything on: it opens the permissions screen. Pure.
/// </summary>
public static class StanleyControlRules
{
    public const string StopDinners = "stop-dinners", MoreCareful = "more-careful", DoMore = "do-more", PauseToday = "pause-today", UndoToday = "undo-today", WhyLast = "why-last";
    public static readonly string[] Ids = [StopDinners, MoreCareful, DoMore, PauseToday, UndoToday, WhyLast];

    public static readonly IReadOnlyList<string> Examples =
        ["Stop booking dinners", "Be more careful", "Do more", "Pause everything for today", "Undo everything you did today", "Why did you do that?"];

    private static string Words(string text) => Regex.Replace(Regex.Replace(text.ToLowerInvariant(), @"[^a-z0-9' ]", " "), @"\s+", " ").Trim();

    /// <summary>The control this sentence asks for, or null. A sentence of more than 120 characters is not read.</summary>
    public static string? Read(string? text)
    {
        var t = Words(text ?? "");
        if (t.Length is 0 or > 120) return null;
        bool Has(string re) => Regex.IsMatch(t, re);
        if (Has(@"\bwhy did you\b|\bwhy did stanley\b|\bwhy was that\b")) return WhyLast;
        if (Has(@"\bundo\b") && Has(@"\b(everything|all)\b")) return UndoToday;
        if (Has(@"\bpause\b") && Has(@"\b(everything|all|stanley)\b")) return PauseToday;
        if (Has(@"\b(stop|no more|don't|do not|dont)\b") && Has(@"\b(book|booking|reserve|reserving)\w*\b") && Has(@"\bdinner")) return StopDinners;
        if (Has(@"\bmore careful\b|\bbe careful\b|\bless on your own\b|\bask first\b")) return MoreCareful;
        if (Has(@"\bdo more\b|\bhelp more\b|\bmore help\b")) return DoMore;
        return null;
    }

    public static ControlProposal Propose(string? text, int level) => Read(text) switch
    {
        StopDinners => new(true, StopDinners, "Stop booking dinners for you", "I will stop booking free dinners myself. I will still tell you about dinner options and you can book them yourself.", true, null, []),
        MoreCareful => level <= 1
            ? new(true, MoreCareful, "Already as careful as I can be", "You are at the lowest level: I only answer when you ask. Nothing needs to change.", false, "/me/stanley-can", [])
            : new(true, MoreCareful, $"Ask first more often (level {level} to level {level - 1})", "I will do less on my own and ask more. You can raise it again any time.", true, null, []),
        DoMore => new(true, DoMore, "See what more I could do", "I will show you what I could do above your current level. Nothing is switched on until you choose it.", false, "/me/stanley-can", []),
        PauseToday => new(true, PauseToday, "Pause everything for today", "I will not do anything unprompted until the end of today. Answers and safety alerts carry on.", true, null, []),
        UndoToday => new(true, UndoToday, "Undo everything I did today", "I will undo each thing that is still free to undo. Anything that can no longer be undone stays, and I will say which.", true, "/me/stanley-activity", []),
        WhyLast => new(true, WhyLast, "Why did I do that?", "I will open the receipt for the last thing I did.", false, "/me/stanley-activity", []),
        _ => new(false, "", "I did not understand that", "I can only change a few things from a sentence. Try one of these.", false, null, Examples),
    };
}
