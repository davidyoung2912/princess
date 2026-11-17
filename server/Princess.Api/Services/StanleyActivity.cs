using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// What Stanley did, is watching and remembers, for the signed-in guest only (docs/stanley-actions-and-proactive-plan.md, phase P1). The receipts are the action store's own rows, so there is one record. Watching is the checklist rows the guest
/// switched on and that exist; a paused account watches nothing. Undo goes through <see cref="StanleyActionService.UndoAsync"/>, so the same window, checks and audit apply.
/// </summary>
public sealed class StanleyActivityService(IStanleyActionStore store, StanleyActionService actions, StanleyPermissionService permissions, StanleyMemoryService memory, IClock clock)
{
    public async Task<StanleyActivityDto> GetAsync(UserRecord user, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var rows = (await store.ListAsync(user.Id, StanleyActivityRules.MaxReceipts, ct)).Where(r => StanleyActivityRules.InLedger(r.Status)).ToList();
        var did = rows.Select(r => Receipt(r, now)).ToList();
        var perms = await permissions.GetAsync(user, ct);
        var watching = perms.Paused ? [] : perms.Rows.Where(r => r.Group == "watching" && r.State == "on").Select(r => new StanleyWatchDto(r.Id, r.Wording, r.Example, r.Never)).ToList();
        var mem = await memory.GetAsync(user, ct);
        var remembered = new StanleyRememberedDto(mem.Enabled, mem.Items.Count, [.. mem.Items.Take(StanleyActivityRules.MaxRemembered).Select(i => new StanleyRememberedItemDto(i.Id, i.Text, i.Reason))]);
        return new(perms.Paused, perms.PausedUntil, did.Count(d => d.CanUndo), did, watching, remembered);
    }

    private static StanleyReceiptDto Receipt(StanleyActionRow r, DateTime now)
    {
        var d = StanleyActionService.DataOf(r);
        return StanleyActivityRules.Receipt(r.PublicId.ToString(), StanleyActionService.Receipt(r), r.Kind, r.Status, r.DoneAt ?? r.UpdatedAt, d.Title, d.Who, d.PreparedBy, r.UndoUntil, now);
    }

    /// <summary>Undoes every act that is still inside its window and that the server can reverse. One that cannot be (the team picked up the case) is kept and counted, never forced.</summary>
    public async Task<StanleyUndoAllDto> UndoAllAsync(UserRecord user, CancellationToken ct)
    {
        var now = clock.UtcNow;
        int undone = 0, kept = 0;
        foreach (var r in (await store.ListAsync(user.Id, StanleyActivityRules.MaxReceipts, ct)).Where(r => StanleyActivityRules.Undoable(r.Kind, r.Status, r.UndoUntil, now)))
        {
            try { await actions.UndoAsync(user, r.PublicId, null, ct); undone++; }
            catch (ApiException) { kept++; }
        }
        return new(undone, kept);
    }
}
