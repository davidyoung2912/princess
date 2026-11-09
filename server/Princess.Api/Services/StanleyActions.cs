using System.Text.Json;
using Microsoft.Extensions.Options;
using Princess.Api.Audit;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Where an action is in its life: prepared (a preview, nothing done), executing (confirmed, in progress), done, failed (the service refused), pending (the outcome is not known yet), expired, changed (the price or availability moved) or undone.</summary>
public static class StanleyActionStatus
{
    public const string Prepared = "prepared", Executing = "executing", Done = "done", Failed = "failed", Pending = "pending", Expired = "expired", Changed = "changed", Undone = "undone";
}

/// <summary>The stored form of one action. <c>Data</c> is JSON (<see cref="StanleyActionData"/>); the columns are what the lifecycle looks up.</summary>
public sealed class StanleyActionRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long UserId { get; set; }
    public string Kind { get; set; } = "";
    public string Status { get; set; } = StanleyActionStatus.Prepared;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string Fingerprint { get; set; } = "";
    public string? IdemKey { get; set; }
    public string Data { get; set; } = "{}";
    /// <summary>What the effect made, so it can be undone (a request id, an excursion id, a table and its old slot, a case id).</summary>
    public string Ref { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTime? DoneAt { get; set; }
    public DateTime? UndoUntil { get; set; }
}

public sealed record StanleyActionData(string? SailingId, string Title, List<string> Lines, List<string> Who, long? Cents, string? Terms, Dictionary<string, string> Args);

public interface IStanleyActionStore
{
    Task AddAsync(StanleyActionRow row, CancellationToken ct);
    /// <summary>The action, only when it belongs to this guest. Anyone else's gets null, the same as one that does not exist.</summary>
    Task<StanleyActionRow?> GetAsync(Guid publicId, long userId, CancellationToken ct);
    Task<StanleyActionRow?> FindByKeyAsync(long userId, string key, CancellationToken ct);
    /// <summary>Moves a prepared action to executing and records the idempotency key, in one step. False when it was not prepared (another confirm got there first).</summary>
    Task<bool> TryBeginAsync(Guid publicId, long userId, string key, DateTime now, CancellationToken ct);
    Task UpdateAsync(StanleyActionRow row, CancellationToken ct);
    Task<List<StanleyActionRow>> ListAsync(long userId, int max, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyActionStore : IStanleyActionStore
{
    private readonly List<StanleyActionRow> _rows = [];
    private long _next;

    public IReadOnlyList<StanleyActionRow> Rows { get { lock (_rows) return [.. _rows.Select(Copy)]; } }

    private static StanleyActionRow Copy(StanleyActionRow r) => new()
    {
        Id = r.Id, PublicId = r.PublicId, UserId = r.UserId, Kind = r.Kind, Status = r.Status, CreatedAt = r.CreatedAt, ExpiresAt = r.ExpiresAt, UpdatedAt = r.UpdatedAt,
        Fingerprint = r.Fingerprint, IdemKey = r.IdemKey, Data = r.Data, Ref = r.Ref, Reason = r.Reason, DoneAt = r.DoneAt, UndoUntil = r.UndoUntil,
    };

    public Task AddAsync(StanleyActionRow row, CancellationToken ct)
    {
        lock (_rows) { row.Id = ++_next; _rows.Add(Copy(row)); }
        return Task.CompletedTask;
    }

    public Task<StanleyActionRow?> GetAsync(Guid publicId, long userId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.PublicId == publicId && r.UserId == userId).Select(Copy).FirstOrDefault());
    }

    public Task<StanleyActionRow?> FindByKeyAsync(long userId, string key, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId && r.IdemKey == key).Select(Copy).FirstOrDefault());
    }

    public Task<bool> TryBeginAsync(Guid publicId, long userId, string key, DateTime now, CancellationToken ct)
    {
        lock (_rows)
        {
            var r = _rows.FirstOrDefault(x => x.PublicId == publicId && x.UserId == userId && x.Status == StanleyActionStatus.Prepared);
            if (r is null) return Task.FromResult(false);
            r.Status = StanleyActionStatus.Executing; r.IdemKey = key; r.UpdatedAt = now;
            return Task.FromResult(true);
        }
    }

    public Task UpdateAsync(StanleyActionRow row, CancellationToken ct)
    {
        lock (_rows)
        {
            var i = _rows.FindIndex(r => r.PublicId == row.PublicId && r.UserId == row.UserId);
            if (i >= 0) { var id = _rows[i].Id; _rows[i] = Copy(row); _rows[i].Id = id; }
        }
        return Task.CompletedTask;
    }

    public Task<List<StanleyActionRow>> ListAsync(long userId, int max, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId).OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).Take(max).Select(Copy).ToList());
    }
}

/// <summary>What a preview shows, worked out from the live data. <c>Facts</c> is a string of everything the preview depends on (price, availability, what exists); a change in it between prepare and confirm voids the preview.</summary>
public sealed record StanleyPreviewFacts(string Title, List<string> Lines, List<string> Who, long? Cents, string? Terms, string Facts, Dictionary<string, string>? Resolved = null);

/// <summary>What carrying an action out made: <c>Ref</c> lets it be undone.</summary>
public sealed record StanleyEffectResult(string Ref);

/// <summary>
/// What the action service needs from the rest of the server, so the lifecycle is tested without the stores. The real one (<see cref="StanleyEffects"/>) goes through the same services the screens use,
/// so their own rules and permission checks apply on every call.
/// </summary>
public interface IStanleyEffects
{
    /// <summary>The preview for an intent, from current data. Checks access as the guest (a child account or a stranger is refused) and that the thing can be done now. Throws <see cref="ApiException"/> when it cannot.</summary>
    Task<StanleyPreviewFacts> PreviewAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct);
    Task<StanleyEffectResult> ExecuteAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct);
    /// <summary>Whether the effect of an intent already exists, used to settle an outcome that is not known before anything is tried again.</summary>
    Task<bool> ExistsAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct);
    Task UndoAsync(UserRecord user, StanleyIntent intent, string effectRef, StanleyActionContext ctx, CancellationToken ct);
}

/// <summary>
/// Bounded action orchestration (docs/stanley-gap-analysis-and-plan.md, phase 5). The model, or the guest's words, only ever produce a typed intent. <see cref="PrepareAsync"/> turns it into a stored,
/// non-binding preview with an expiry. <see cref="ConfirmAsync"/> takes the preview id and an idempotency key, checks again that it has not expired, that the guest may still do it and that the price and
/// availability are what was shown, then carries it out through the existing services and returns a receipt. A repeat of the same confirm returns the same receipt; an outcome that is not known is
/// settled against what exists before anything is tried again. Paying, cancelling a booking, changing a cabin and sharing data are not actions and have no code path here.
/// </summary>
public sealed class StanleyActionService(IStanleyActionStore store, IStanleyEffects effects, IClock clock, IAuditLog audit, IOptions<StanleyOptions> options, ILogger<StanleyActionService> log)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private void RequireOn(UserRecord user)
    {
        if (!options.Value.Switches.Actions) throw ApiException.Conflict("off");
        // A child account cannot make changes. Stanley is no way round that.
        if (user.IsSupervised) throw ApiException.Forbidden();
    }

    public static StanleyActionData DataOf(StanleyActionRow row) => JsonSerializer.Deserialize<StanleyActionData>(row.Data, Json) ?? new StanleyActionData(null, "", [], [], null, null, new Dictionary<string, string>());

    public static StanleyActionDto ToDto(StanleyActionRow row)
    {
        var d = DataOf(row);
        return new StanleyActionDto(row.PublicId.ToString(), row.Kind, row.Status, d.Title, d.Lines, d.Who, d.Cents, d.Terms, row.ExpiresAt, StanleyActionKinds.OnDevice.Contains(row.Kind),
            row.DoneAt, row.UndoUntil, row.Reason.Length == 0 ? null : row.Reason, d.Args, row.Status is StanleyActionStatus.Done or StanleyActionStatus.Undone ? Receipt(row) : null);
    }

    /// <summary>A short receipt number the guest can quote: the first eight characters of the action's id.</summary>
    public static string Receipt(StanleyActionRow row) => "STN-" + row.PublicId.ToString("N")[..8].ToUpperInvariant();

    private static StanleyActionContext Ctx(StanleyActionContext? given, string? sailingId) => new(given?.Plan, given?.AllAboard, sailingId);

    /// <summary>Makes a preview. Nothing is changed. The preview lives for <see cref="StanleyActionRules.PreviewMinutes"/> minutes.</summary>
    public async Task<StanleyActionDto> PrepareAsync(UserRecord user, StanleyIntent intent, StanleyActionContext? context, CancellationToken ct)
    {
        RequireOn(user);
        if (!StanleyActionKinds.All.Contains(intent.Kind)) throw ApiException.Invalid("badAction");
        var ctx = Ctx(context, context?.SailingId);
        var facts = await effects.PreviewAsync(user, intent, ctx, ct);
        var args = new Dictionary<string, string>(intent.Args);
        foreach (var (k, v) in facts.Resolved ?? new Dictionary<string, string>()) args[k] = v;
        var now = clock.UtcNow;
        var row = new StanleyActionRow
        {
            PublicId = Guid.NewGuid(), UserId = user.Id, Kind = intent.Kind, Status = StanleyActionStatus.Prepared, CreatedAt = now, UpdatedAt = now,
            ExpiresAt = now.AddMinutes(StanleyActionRules.PreviewMinutes), Fingerprint = StanleyActionRules.Fingerprint(facts.Facts),
            Data = JsonSerializer.Serialize(new StanleyActionData(ctx.SailingId, facts.Title, facts.Lines, facts.Who, facts.Cents, facts.Terms, args), Json),
        };
        await store.AddAsync(row, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.action.prepare", Outcome = AuditOutcome.Success, Target = intent.Kind + ":" + row.PublicId, Detail = intent.Kind }, ct);
        return ToDto(row);
    }

    /// <summary>
    /// Confirms a preview. <paramref name="key"/> is the idempotency key: the same key and preview give the same receipt however many times it is sent, and a key used for a different preview is refused.
    /// 404 for a preview that is not the guest's (or does not exist), 409 expired, 409 changed (the preview is void and the guest is asked again), 403 for a child account.
    /// </summary>
    public async Task<StanleyActionDto> ConfirmAsync(UserRecord user, Guid id, string? key, StanleyActionContext? context, CancellationToken ct)
    {
        RequireOn(user);
        if (!StanleyActionRules.KeyOk(key)) throw ApiException.Invalid("badKey");
        var row = await store.GetAsync(id, user.Id, ct) ?? throw ApiException.NotFound();
        var used = await store.FindByKeyAsync(user.Id, key!, ct);
        if (used is not null && used.PublicId != id) throw ApiException.Conflict("keyUsed");
        if (row.Status != StanleyActionStatus.Prepared) return await SettleAsync(user, row, context, ct);

        var now = clock.UtcNow;
        if (now > row.ExpiresAt)
        {
            row.Status = StanleyActionStatus.Expired; row.UpdatedAt = now;
            await store.UpdateAsync(row, ct);
            throw ApiException.Conflict("expired");
        }
        var data = DataOf(row);
        var intent = new StanleyIntent(row.Kind, data.Args);
        var ctx = Ctx(context, data.SailingId);
        // The guest's permission, the price and the availability are checked again now, not trusted from the preview.
        var facts = await effects.PreviewAsync(user, intent, ctx, ct);
        if (StanleyActionRules.Fingerprint(facts.Facts) != row.Fingerprint)
        {
            row.Status = StanleyActionStatus.Changed; row.UpdatedAt = now;
            await store.UpdateAsync(row, ct);
            await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.action.changed", Outcome = AuditOutcome.Denied, Target = row.Kind + ":" + row.PublicId, Detail = row.Kind }, ct);
            throw ApiException.Conflict("changed");
        }
        // One confirm wins. A second one, sent at the same moment, finds the action no longer prepared and gets whatever the first produced.
        if (!await store.TryBeginAsync(id, user.Id, key!, now, ct))
            return await SettleAsync(user, await store.GetAsync(id, user.Id, ct) ?? throw ApiException.NotFound(), context, ct);

        row = await store.GetAsync(id, user.Id, ct) ?? throw ApiException.NotFound();
        if (StanleyActionKinds.OnDevice.Contains(row.Kind)) return await CompleteAsync(row, "", ct);
        try
        {
            var r = await effects.ExecuteAsync(user, intent, ctx, ct);
            return await CompleteAsync(row, r.Ref, ct);
        }
        catch (ApiException e)
        {
            // The service refused (a clash, a full table, a duplicate): nothing was done, and the receipt says why.
            row.Status = StanleyActionStatus.Failed; row.Reason = e.Title; row.UpdatedAt = clock.UtcNow;
            await store.UpdateAsync(row, ct);
            await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.action.confirm", Outcome = AuditOutcome.Failure, Target = row.Kind + ":" + row.PublicId, Detail = e.Title }, ct);
            return ToDto(row);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // We do not know whether it happened. It is settled against what exists before anyone retries.
            log.LogWarning(e, "Stanley action {Kind} ended with an unknown outcome", row.Kind);
            row.Status = StanleyActionStatus.Pending; row.UpdatedAt = clock.UtcNow;
            await store.UpdateAsync(row, ct);
            return ToDto(row);
        }
    }

    private async Task<StanleyActionDto> CompleteAsync(StanleyActionRow row, string effectRef, CancellationToken ct)
    {
        var now = clock.UtcNow;
        row.Status = StanleyActionStatus.Done; row.Ref = effectRef; row.Reason = ""; row.DoneAt = now; row.UpdatedAt = now; row.UndoUntil = now.AddMinutes(StanleyActionRules.UndoMinutes);
        await store.UpdateAsync(row, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.action.confirm", Outcome = AuditOutcome.Success, Target = row.Kind + ":" + row.PublicId, Detail = row.Kind }, ct);
        return ToDto(row);
    }

    /// <summary>
    /// What to say about an action that is not prepared. Done, failed, expired, changed and undone are final and are returned as they are (a repeated confirm gets the same receipt). An action that is
    /// executing or pending is checked against what exists: if its effect is there it is done; if it is not and the attempt is old, it goes back to prepared so the guest can confirm again; otherwise it stays pending.
    /// </summary>
    private async Task<StanleyActionDto> SettleAsync(UserRecord user, StanleyActionRow row, StanleyActionContext? context, CancellationToken ct)
    {
        if (row.Status is not (StanleyActionStatus.Executing or StanleyActionStatus.Pending)) return ToDto(row);
        var data = DataOf(row);
        var intent = new StanleyIntent(row.Kind, data.Args);
        if (await effects.ExistsAsync(user, intent, Ctx(context, data.SailingId), ct)) return await CompleteAsync(row, row.Ref, ct);
        if ((clock.UtcNow - row.UpdatedAt).TotalSeconds >= StanleyActionRules.StaleSeconds)
        {
            row.Status = StanleyActionStatus.Prepared; row.IdemKey = null; row.UpdatedAt = clock.UtcNow;
            await store.UpdateAsync(row, ct);
        }
        return ToDto(row);
    }

    /// <summary>The action as it stands now, settling an outcome that was not known. 404 for one that is not the guest's.</summary>
    public async Task<StanleyActionDto> GetAsync(UserRecord user, Guid id, StanleyActionContext? context, CancellationToken ct)
    {
        var row = await store.GetAsync(id, user.Id, ct) ?? throw ApiException.NotFound();
        return await SettleAsync(user, row, context, ct);
    }

    /// <summary>Undoes a done action within two hours. A device action is undone by the device; here it is only marked. 409 tooLate after that, or when it was not done.</summary>
    public async Task<StanleyActionDto> UndoAsync(UserRecord user, Guid id, StanleyActionContext? context, CancellationToken ct)
    {
        RequireOn(user);
        var row = await store.GetAsync(id, user.Id, ct) ?? throw ApiException.NotFound();
        if (row.Status == StanleyActionStatus.Undone) return ToDto(row);
        var now = clock.UtcNow;
        if (row.Status != StanleyActionStatus.Done || row.UndoUntil is not { } until || now > until) throw ApiException.Conflict("tooLate");
        if (StanleyActionKinds.OnServer(row.Kind))
        {
            var data = DataOf(row);
            await effects.UndoAsync(user, new StanleyIntent(row.Kind, data.Args), row.Ref, Ctx(context, data.SailingId), ct);
        }
        row.Status = StanleyActionStatus.Undone; row.UpdatedAt = now;
        await store.UpdateAsync(row, ct);
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.action.undo", Outcome = AuditOutcome.Success, Target = row.Kind + ":" + row.PublicId, Detail = row.Kind }, ct);
        return ToDto(row);
    }

    /// <summary>The guest's receipts, newest first: what was done, what failed, what was undone. This is what the Trust Ledger lists.</summary>
    public async Task<List<StanleyActionDto>> ReceiptsAsync(UserRecord user, CancellationToken ct) =>
        [.. (await store.ListAsync(user.Id, 50, ct)).Where(r => r.Status is StanleyActionStatus.Done or StanleyActionStatus.Failed or StanleyActionStatus.Pending or StanleyActionStatus.Undone).Select(ToDto)];
}

/// <summary>
/// The real effects: each action goes through the service the screens use (stateroom requests, the excursion cart, dining, cases), as the guest, so those services' own checks, limits and
/// permission rules apply at execution time. A day-plan change and a reminder are checked here and applied by the device.
/// </summary>
public sealed class StanleyEffects(ITripStore trips, IPlanStore plan, PlanService planService, ServiceRequestService requests, CaseService cases, ScopeLoader scopes, IUserClock clock) : IStanleyEffects
{
    private async Task<BookingRow> BookingAsync(UserRecord user, string? sailingId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        var list = (await trips.ListForUserAsync(user.Id, ct)).Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today).OrderBy(b => b.Departure).ToList();
        if (sailingId is not null) return list.FirstOrDefault(b => b.SailingId == sailingId) ?? throw ApiException.NotFound();
        return list.Count switch { 0 => throw ApiException.NotFound(), 1 => list[0], _ => throw ApiException.Invalid("whichTrip") };
    }

    private static string Money(long cents) => "$" + (cents / 100m).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);

    public async Task<StanleyPreviewFacts> PreviewAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct)
    {
        switch (intent.Kind)
        {
            case StanleyActionKinds.PlanChange:
            {
                var entry = (ctx.Plan ?? []).FirstOrDefault(p => p.Id == intent.Arg("itemId")) ?? throw ApiException.Invalid("notInPlan");
                var op = intent.Arg("op");
                var to = intent.Arg("to");
                var title = op switch { "move" => $"Move {entry.Title} to {to}", "drop" => $"Drop {entry.Title}", _ => $"Add {entry.Title} at {entry.Start}" };
                var lines = new List<string> { op == "add" ? $"{entry.Title} at {entry.Start}, day {entry.Day}." : $"{entry.Title} is at {entry.Start} now, day {entry.Day}." };
                lines.Add(op == "drop" ? "It stays in your list, struck through, until the day ends." : "Nothing else in your plan changes.");
                return new StanleyPreviewFacts(title, lines, ["You"], null, "This only changes your own plan on this device. You can undo it for two hours.", $"{op}|{entry.Id}|{entry.Title}|{entry.Start}|{to}");
            }
            case StanleyActionKinds.RemindMe:
            {
                var at = intent.Arg("at");
                var text = intent.Arg("text");
                var lines = new List<string> { $"At {at}: {text}" };
                if (ctx.AllAboard is { } a) lines.Add($"All aboard is {a.At} ({a.Label}).");
                return new StanleyPreviewFacts($"Remind you at {at}", lines, ["You"], null, "The reminder is kept on this device and shows when you open the app after that time. It is not a phone alarm.", $"remind|{at}|{text}");
            }
        }

        var booking = await BookingAsync(user, ctx.SailingId, ct);
        // An adult on the booking, or a refusal: the same check the screens make.
        var scope = await scopes.LoadAsync(user, booking.Number, write: true, ct);
        switch (intent.Kind)
        {
            case StanleyActionKinds.OrderItem:
            {
                var item = ServiceRules.RequestItemById(intent.Arg("item")) ?? throw ApiException.Invalid("badItem");
                var qty = int.TryParse(intent.Arg("qty"), out var n) ? Math.Min(Math.Max(1, n), item.MaxQty) : 1;
                var label = StanleyActionRules.ItemLabel(item.Id);
                return new StanleyPreviewFacts($"Send {qty} × {label.ToLowerInvariant()} to your stateroom", [$"{qty} × {label}", $"Usually about {item.EtaMin} minutes.", $"Handled by {ServiceRules.TeamFor(item.Group)}."], ["Your stateroom"], null,
                    "No charge. You can cancel it until it is on its way.", $"order|{item.Id}|{qty}|{item.EtaMin}");
            }
            case StanleyActionKinds.AddExcursion:
            {
                var x = ExcursionRules.ById(intent.Arg("excursionId")) ?? throw ApiException.Invalid("tour");
                var people = WhoFor(user, booking, scope, intent.Arg("who"));
                var total = people.Sum(p => ExcursionRules.GuestPrice(x, p.Age));
                var lines = new List<string> { x.Name, x.Summary, $"{x.Hours:0.#} hours. {x.Meeting}" };
                lines.AddRange(people.Select(p => $"{p.First}: {Money(ExcursionRules.GuestPrice(x, p.Age))}"));
                lines.Add("This puts it in your cart. Nothing is charged until you check out on the Excursions screen.");
                return new StanleyPreviewFacts($"Add {x.Name} to your cart", lines, [.. people.Select(p => p.First)], total,
                    $"Free to cancel until {ExcursionRules.FreeCancelDays} days before the port day, then no refund.", $"tour|{x.Id}|{string.Join(",", people.Select(p => p.Id))}|{total}");
            }
            case StanleyActionKinds.MoveDinner:
            {
                var table = await TableAsync(scope, booking, intent, ct);
                var venue = DiningRules.VenueById(table.VenueId) ?? throw ApiException.Invalid("slot");
                var toDay = int.TryParse(intent.Arg("day"), out var d) && d > 0 ? d : table.Day;
                var toTime = intent.Arg("time");
                if (!DiningRules.IsDinnerDay(scope.Timeline, toDay) || !DiningRules.DinnerTimes.Contains(toTime)) throw ApiException.Invalid("slot");
                if (toDay == table.Day && toTime == table.Time) throw ApiException.Conflict("unchanged");
                if (DiningRules.DinnerPast(scope.Timeline, toDay, toTime, scope.Now)) throw ApiException.Conflict("closed");
                var grid = DiningRules.SlotsFor(venue.Id, booking.SailingId, toDay).First(s => s.Time == toTime);
                var left = grid.Tables - await plan.CountTablesAsync(booking.SailingId, venue.Id, toDay, toTime, table.Id, ct);
                if (left <= 0) throw ApiException.Conflict("full");
                var who = scope.Named(table.GuestIds).Select(g => g.Name).ToList();
                return new StanleyPreviewFacts($"Move {venue.Name} to night {toDay}, {toTime}", [$"{venue.Name}: night {table.Day}, {table.Time} → night {toDay}, {toTime}", "Your current table is kept until the new time is confirmed; it is moved in one step, so you are never left without one."],
                    who, null, "No charge to move a table.", $"dinner|{table.PublicId}|{toDay}|{toTime}|{left}", new Dictionary<string, string> { ["tableId"] = table.PublicId.ToString(), ["day"] = toDay.ToString(), ["fromDay"] = table.Day.ToString(), ["fromTime"] = table.Time });
            }
            case StanleyActionKinds.ReserveDinner:
            {
                var ship = AboardPlans.ShipOfSailing(booking.SailingId);
                var venue = ShipDining.VenuesOf(ship).FirstOrDefault(v => v.Kind == "main" && !v.WalkIn) ?? throw ApiException.Invalid("slot");
                if (booking.Dining != "anytime") throw ApiException.Conflict("fixedSeating");
                var day = int.TryParse(intent.Arg("day"), out var dd) ? dd : 0;
                var time = intent.Arg("time");
                if (!DiningRules.IsDinnerDay(scope.Timeline, day) || !DiningRules.DinnerTimes.Contains(time)) throw ApiException.Invalid("slot");
                if (DiningRules.DinnerPast(scope.Timeline, day, time, scope.Now)) throw ApiException.Conflict("closed");
                var people = WhoForDinner(user, booking, scope, intent.Arg("who"));
                if (people.Count > DiningRules.MaxParty) throw ApiException.Invalid("partySize");
                if (!people.Any(p => p.Age >= ExcursionRules.AdultAge)) throw ApiException.Conflict("age");
                var grid = DiningRules.SlotsFor(venue.Id, booking.SailingId, day).First(s => s.Time == time);
                var left = grid.Tables - await plan.CountTablesAsync(booking.SailingId, venue.Id, day, time, null, ct);
                if (left <= 0) throw ApiException.Conflict("full");
                var held = (await plan.ListTablesAsync(booking.BookingId, ct)).Select(t => new ReservedTable(t.VenueId, t.Day, t.Time, scope.Ids(t.GuestIds))).ToList();
                var ids = people.Select(p => p.Id).ToList();
                if (DiningRules.TableClash(held, day, time, ids).Count > 0) throw ApiException.Conflict("clash");
                return new StanleyPreviewFacts($"Reserve a table in the {venue.Name}, night {day}, {time}",
                    [$"{venue.Name}: night {day}, {time}", $"{people.Count} {(people.Count == 1 ? "guest" : "guests")}: {string.Join(", ", people.Select(p => p.First))}", $"{left} {(left == 1 ? "table is" : "tables are")} left at that time.", "Main dining is included in your fare."],
                    [.. people.Select(p => p.First)], null, "No charge. You can move or cancel the table on the dining screen.", $"dinner-new|{venue.Id}|{day}|{time}|{left}",
                    new Dictionary<string, string> { ["venueId"] = venue.Id, ["day"] = day.ToString(), ["guests"] = string.Join(",", ids) });
            }
            case StanleyActionKinds.DraftCase:
            {
                var kind = intent.Arg("caseKind");
                var summary = intent.Arg("summary");
                var place = intent.Arg("place");
                if (PostCruiseRules.CaseProblem(kind, summary, place, null, 0) is { } problem) throw ApiException.Invalid(problem);
                var lines = new List<string> { kind == "lostItem" ? "A lost item" : "A complaint", $"What you said: {summary}" };
                if (place.Length > 0) lines.Add($"Where: {place}");
                lines.Add($"Guest Services replies within {PostCruiseRules.SlaHours(kind)} hours.");
                return new StanleyPreviewFacts("Send this to Guest Services", lines, ["You"], null, "Nothing is sent until you confirm. You can withdraw it until it is picked up.", $"case|{kind}|{summary}|{place}");
            }
            default:
                throw ApiException.Invalid("badAction");
        }
    }

    private static List<ScopePerson> WhoFor(UserRecord user, BookingRow booking, Scope scope, string who)
    {
        var asked = who.Trim();
        List<ScopePerson> people;
        if (asked.Length == 0 || asked.Equals("me", StringComparison.OrdinalIgnoreCase)) people = [.. new[] { scope.PersonByUser(user.Id) }.OfType<ScopePerson>()];
        else people = [.. scope.Party.Where(p => p.First.Equals(asked, StringComparison.OrdinalIgnoreCase))];
        // A traveller the guest may not act for is reported like one who is not there.
        people = [.. people.Where(p => StanleyActionRules.MayActFor(user.Id, booking.BookerUserId, p.UserId))];
        if (people.Count == 0) throw ApiException.Invalid("guests");
        return people;
    }

    /// <summary>Who a table is for: "all" is everyone the guest may act for, otherwise as for an excursion.</summary>
    private static List<ScopePerson> WhoForDinner(UserRecord user, BookingRow booking, Scope scope, string who)
    {
        if (!who.Trim().Equals("all", StringComparison.OrdinalIgnoreCase)) return WhoFor(user, booking, scope, who);
        var people = scope.Party.Where(p => StanleyActionRules.MayActFor(user.Id, booking.BookerUserId, p.UserId)).ToList();
        return people.Count == 0 ? throw ApiException.Invalid("guests") : people;
    }

    private async Task<TableRow> TableAsync(Scope scope, BookingRow booking, StanleyIntent intent, CancellationToken ct)
    {
        var tables = await plan.ListTablesAsync(booking.BookingId, ct);
        if (Guid.TryParse(intent.Arg("tableId"), out var id)) return tables.FirstOrDefault(t => t.PublicId == id) ?? throw ApiException.NotFound();
        var upcoming = tables.Where(t => !DiningRules.DinnerPast(scope.Timeline, t.Day, t.Time, scope.Now)).ToList();
        if (upcoming.Count == 0) throw ApiException.NotFound("noDinner");
        if (upcoming.Count == 1) return upcoming[0];
        var onNight = int.TryParse(intent.Arg("day"), out var d) ? upcoming.Where(t => t.Day == d).ToList() : [];
        return onNight.Count == 1 ? onNight[0] : throw ApiException.Invalid("whichDinner");
    }

    public async Task<StanleyEffectResult> ExecuteAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct)
    {
        var booking = await BookingAsync(user, ctx.SailingId, ct);
        switch (intent.Kind)
        {
            case StanleyActionKinds.OrderItem:
            {
                var list = await requests.CreateAsync(user, booking.Number, new CreateServiceRequest(intent.Arg("item"), int.Parse(intent.Arg("qty")), ""), ct);
                var made = list.Where(r => r.Item == intent.Arg("item")).OrderByDescending(r => r.PlacedAt).First();
                return new StanleyEffectResult(made.Id.ToString());
            }
            case StanleyActionKinds.AddExcursion:
            {
                var scope = await scopes.LoadAsync(user, booking.Number, write: true, ct);
                var people = WhoFor(user, booking, scope, intent.Arg("who"));
                await planService.AddToCartAsync(user, booking.Number, intent.Arg("excursionId"), new CartRequest([.. people.Select(p => p.Id)]), ct);
                return new StanleyEffectResult(intent.Arg("excursionId"));
            }
            case StanleyActionKinds.MoveDinner:
            {
                var id = Guid.Parse(intent.Arg("tableId"));
                await planService.MoveTableAsync(user, booking.Number, id, new MoveRequest(int.Parse(intent.Arg("day")), intent.Arg("time")), ct);
                return new StanleyEffectResult($"{id}|{intent.Arg("fromDay")}|{intent.Arg("fromTime")}");
            }
            case StanleyActionKinds.ReserveDinner:
            {
                var venueId = intent.Arg("venueId");
                var day = int.Parse(intent.Arg("day"));
                var time = intent.Arg("time");
                var guests = intent.Arg("guests").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Guid.Parse).ToList();
                var view = await planService.ReserveAsync(user, booking.Number, new ReserveRequest(venueId, day, time, guests, null), ct);
                var made = view.Reservations.First(r => r.VenueId == venueId && r.Day == day && r.Time == time);
                return new StanleyEffectResult(made.Id.ToString());
            }
            case StanleyActionKinds.DraftCase:
            {
                var view = await cases.OpenAsync(user, booking.Number, new OpenCaseRequest(intent.Arg("caseKind"), intent.Arg("summary"), intent.Arg("place"), null, 0), ct);
                var made = view.Cases.Where(c => c.Kind == intent.Arg("caseKind") && c.Summary == intent.Arg("summary")).OrderByDescending(c => c.OpenedAt).First();
                return new StanleyEffectResult(made.Id.ToString());
            }
            default:
                throw ApiException.Invalid("badAction");
        }
    }

    public async Task<bool> ExistsAsync(UserRecord user, StanleyIntent intent, StanleyActionContext ctx, CancellationToken ct)
    {
        if (!StanleyActionKinds.OnServer(intent.Kind)) return false;
        var booking = await BookingAsync(user, ctx.SailingId, ct);
        switch (intent.Kind)
        {
            case StanleyActionKinds.OrderItem:
                return (await requests.ListAsync(user, booking.Number, ct)).Any(r => r.Item == intent.Arg("item") && r.Stage is "received" or "onTheWay");
            case StanleyActionKinds.AddExcursion:
                return (await planService.ExcursionsAsync(user, booking.Number, ct)).Cart.Any(l => l.ExcursionId == intent.Arg("excursionId"));
            case StanleyActionKinds.MoveDinner:
                return (await plan.ListTablesAsync(booking.BookingId, ct)).Any(t => t.PublicId.ToString() == intent.Arg("tableId") && t.Day.ToString() == intent.Arg("day") && t.Time == intent.Arg("time"));
            case StanleyActionKinds.ReserveDinner:
                return (await plan.ListTablesAsync(booking.BookingId, ct)).Any(t => t.VenueId == intent.Arg("venueId") && t.Day.ToString() == intent.Arg("day") && t.Time == intent.Arg("time"));
            default:
                return (await cases.ListAsync(user, booking.Number, ct)).Cases.Any(c => c.Kind == intent.Arg("caseKind") && c.Summary == intent.Arg("summary") && c.CanWithdraw);
        }
    }

    public async Task UndoAsync(UserRecord user, StanleyIntent intent, string effectRef, StanleyActionContext ctx, CancellationToken ct)
    {
        var booking = await BookingAsync(user, ctx.SailingId, ct);
        switch (intent.Kind)
        {
            case StanleyActionKinds.OrderItem:
                await requests.CancelAsync(user, booking.Number, Guid.Parse(effectRef), ct);
                break;
            case StanleyActionKinds.AddExcursion:
                await planService.RemoveFromCartAsync(user, booking.Number, effectRef, ct);
                break;
            case StanleyActionKinds.MoveDinner:
            {
                // Back to where it was, in one step. The table keeps its place until the move back is accepted.
                var parts = effectRef.Split('|');
                await planService.MoveTableAsync(user, booking.Number, Guid.Parse(parts[0]), new MoveRequest(int.Parse(parts[1]), parts[2]), ct);
                break;
            }
            case StanleyActionKinds.ReserveDinner:
                await planService.CancelTableAsync(user, booking.Number, Guid.Parse(effectRef), ct);
                break;
            default:
                await cases.WithdrawAsync(user, booking.Number, Guid.Parse(effectRef), ct);
                break;
        }
    }
}
