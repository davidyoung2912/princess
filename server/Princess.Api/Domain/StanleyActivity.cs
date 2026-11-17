using Princess.Api.Services;

namespace Princess.Api.Domain;

/// <summary>
/// One receipt, with the six fields of section 19.1 of the plan: what he did, why, the facts he used, who it affects, how to undo it and how to stop this kind of thing. Only typed fields and words the server wrote; nothing the guest typed is kept here.
/// <c>At</c> is when it was done (the facts were checked again at that moment). <c>CanUndo</c> is true only while the undo window is open and the server can reverse it; <c>Undo</c> says in words what undoing does or why it cannot be done from here.
/// </summary>
public sealed record StanleyReceiptDto(string Id, string Number, string Kind, string Status, DateTime At, string What, string Why, string Facts, string Affects, string Undo, DateTime? UndoUntil, bool CanUndo, string Stop);

/// <summary>Something Stanley is keeping watch on because the guest switched it on. <c>Id</c> is the checklist row, so the guest can switch it off with one tap.</summary>
public sealed record StanleyWatchDto(string Id, string Wording, string Example, string Never);

public sealed record StanleyRememberedItemDto(Guid Id, string Text, string Reason);

/// <summary>What Stanley keeps: the guest's own preferences, each with why he has it. Forgetting one is the memory call.</summary>
public sealed record StanleyRememberedDto(bool Enabled, int Count, List<StanleyRememberedItemDto> Items);

/// <summary>Everything on the Stanley activity screen: what he did, what he is watching, what he remembers, and whether he is paused.</summary>
public sealed record StanleyActivityDto(bool Paused, long? PausedUntil, int UndoableNow, List<StanleyReceiptDto> Did, List<StanleyWatchDto> Watching, StanleyRememberedDto Remembers);

public sealed record StanleyUndoAllDto(int Undone, int Kept);

/// <summary>The ledger is a view over the action store, so there is one record of what Stanley did and it cannot disagree with the receipts. Pure, so it is unit tested.</summary>
public static class StanleyActivityRules
{
    public const int MaxReceipts = 50, MaxRemembered = 12;

    /// <summary>The statuses that belong in the ledger: something was done, failed, is not known yet, or was undone. A preview that was never confirmed is not an act.</summary>
    public static bool InLedger(string status) => status is StanleyActionStatus.Done or StanleyActionStatus.Failed or StanleyActionStatus.Pending or StanleyActionStatus.Undone;

    /// <summary>Whether the server can reverse this kind. A plan change and a reminder live on the device, so only the device can take them back; the other seven are reversed through the same services the screens use.</summary>
    public static bool ServerCanUndo(string kind) => StanleyActionKinds.OnServer(kind);

    public static bool Undoable(string kind, string status, DateTime? undoUntil, DateTime now) =>
        ServerCanUndo(kind) && status == StanleyActionStatus.Done && undoUntil is { } until && now <= until;

    public static string UndoNote(string kind) => kind switch
    {
        StanleyActionKinds.OrderItem => "Cancel the request while it is still with the team.",
        StanleyActionKinds.AddExcursion => "Take the tour out of your cart. Nothing is charged until you check out.",
        StanleyActionKinds.MoveDinner => "Move the table back to where it was.",
        StanleyActionKinds.ReserveDinner => "Cancel the table.",
        StanleyActionKinds.DraftCase => "Withdraw the case, if the team has not picked it up yet.",
        StanleyActionKinds.CreatePoll => "Delete the poll.",
        StanleyActionKinds.ChangeSeating => "Put your old seating back.",
        StanleyActionKinds.PlanChange => "Undo it from your plan on the device where you made the change.",
        StanleyActionKinds.RemindMe => "Remove the reminder from your reminders.",
        _ => "",
    };

    public static string Why(string? preparedBy) =>
        string.IsNullOrWhiteSpace(preparedBy) ? "You asked me to, and you said yes." : $"{preparedBy} prepared this for you, and you said yes.";

    public static string Facts(string kind) => kind switch
    {
        StanleyActionKinds.PlanChange => "Your plan as it was when you said yes.",
        StanleyActionKinds.RemindMe => "The all-aboard time and your plan as they were when you said yes.",
        StanleyActionKinds.DraftCase => "Only what you chose to send. Nothing was added.",
        _ => "The price and availability shown to you, checked again when you said yes.",
    };

    public static string Affects(IReadOnlyList<string> who) => who.Count == 0 || (who.Count == 1 && string.Equals(who[0], "You", StringComparison.OrdinalIgnoreCase)) ? "Only you." : string.Join(", ", who) + ".";

    /// <summary>Every act Stanley takes today is one the guest asked for and confirmed, so there is no switch to turn off; the receipt says so, and says what does stop his own suggestions.</summary>
    public static string Stop() => "Nothing to switch off: I only do this when you ask and say yes. Choosing Just answer, or Pause everything, stops my own suggestions.";

    public static StanleyReceiptDto Receipt(string id, string number, string kind, string status, DateTime at, string title, IReadOnlyList<string> who, string? preparedBy, DateTime? undoUntil, DateTime now)
    {
        var can = Undoable(kind, status, undoUntil, now);
        var undo = status switch
        {
            StanleyActionStatus.Undone => "Undone.",
            StanleyActionStatus.Failed => "Nothing was done, so there is nothing to undo.",
            StanleyActionStatus.Pending => "I do not know yet whether this happened. Check again in a moment.",
            _ when can => UndoNote(kind),
            _ when ServerCanUndo(kind) => "The undo window has closed. " + ContactLine(kind),
            _ => UndoNote(kind),
        };
        return new(id, number, kind, status, at, title, Why(preparedBy), Facts(kind), Affects(who), undo, undoUntil, can, Stop());
    }

    private static string ContactLine(string kind) => kind == StanleyActionKinds.DraftCase ? "Ask the team to close the case." : "You can still change it yourself on its own screen.";
}
