using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Ordering to a stateroom or a spot on deck, room service and scheduled breakfast, and what happens when something runs out (DIN-04, DIN-05, DIN-11). Ports <c>orders</c> of <c>src/api/extrasMock.ts</c>.
/// Any guest reads; an adult guest places and changes orders. The stage of an order is worked out from the clock on every read; charges and refunds go on the account when they happen.
/// </summary>
public sealed class OrderService(ScopeLoader scopes, IShipboardStore store, IAccountStore accounts, PlanService plan)
{
    private static string[] Split(string extras) => extras.Length == 0 ? [] : extras.Split(',');

    private async Task<List<OrderGuestInfo>> GuestsAsync(Scope c, CancellationToken ct)
    {
        var e = await plan.PartyEntitlementsAsync(c.Actor, c.Booking, ct);
        return [.. c.Party.Select(p => new OrderGuestInfo(p.Id, p.Age, e.TryGetValue(p.UserId, out var x) ? x.DrinkCapUsd : 0))];
    }

    private async Task<List<DateTime>> ReportTimesAsync(Scope c, CancellationToken ct) => [.. (await store.ListHealthReportsAsync(c.Booking.BookingId, ct)).Select(r => r.At)];

    private static OrderLocation LocationOf(OrderRow o) =>
        o.LocationKind switch { "zone" => new OrderLocation("zone", PlaceId: o.LocationRef), "other" => new OrderLocation("other", Text: o.LocationRef), _ => new OrderLocation("cabin") };

    private static (string Kind, string? Ref) Store(OrderLocation l) =>
        l.Kind switch { "zone" => ("zone", l.PlaceId), "other" => ("other", l.Text!.Trim()), _ => ("cabin", null) };

    private static List<OrderLineIn> LinesOf(Scope c, OrderRow o) =>
        [.. o.Lines.OrderBy(l => l.Seq).Select(l => new OrderLineIn(l.ItemId, l.Qty, Split(l.Extras), c.PersonByUser(l.GuestUserId)?.Id ?? Guid.Empty, l.Note))];

    private static Dictionary<int, string> ChoicesOf(OrderRow o) => o.Lines.Where(l => l.Choice is not null).ToDictionary(l => l.Seq, l => l.Choice!);

    private static bool Cancelled(OrderRow o) => o.Stage == "cancelled";

    private sealed record Calc(Priced Priced, OrderProgress Progress, List<int> Waiting, bool Free);

    private static Calc Work(Scope c, OrderRow o, IReadOnlyList<OrderGuestInfo> guests, IReadOnlyList<DateTime> reports)
    {
        var free = HealthRules.Isolating(reports, o.PlacedAt);
        var lines = LinesOf(c, o);
        var priced = OrderRules.Price(lines, o.Kind, LocationOf(o), o.TipCents, guests, free, ChoicesOf(o));
        var choices = ChoicesOf(o);
        var waiting = o.Lines.Where(l => l.Unavailable && !choices.ContainsKey(l.Seq)).Select(l => l.Seq).OrderBy(i => i).ToList();
        var progress = OrderRules.ProgressOf(
            o.Kind, Shipboard.Ms(o.PlacedAt), o.DeliverAt is { } d ? Shipboard.Ms(d) : null,
            Cancelled(o) && o.ResolvedOrCancelledAt is { } x ? Shipboard.Ms(x) : null, waiting.Count > 0,
            !Cancelled(o) && o.ResolvedOrCancelledAt is { } r ? Shipboard.Ms(r) : null, Shipboard.Ms(c.Now));
        return new Calc(priced, progress, waiting, free);
    }

    private static OrderDto ViewOf(Scope c, OrderRow o, Calc w) => new(
        o.PublicId, o.Kind, Shipboard.Ms(o.PlacedAt), o.DeliverAt is { } d ? Shipboard.Ms(d) : null, LocationOf(o), o.TipCents, w.Progress.Stage, w.Progress.EtaAt,
        w.Priced.Lines, w.Priced.Fee, w.Priced.Service, w.Priced.Total, w.Priced.Covered,
        w.Progress.Stage == "needsChoice" ? w.Waiting : [], Cancelled(o) ? w.Priced.Total : 0, OrderRules.CanCancel(w.Progress.Stage), OrderRules.CanMove(w.Progress.Stage), o.Contacted, w.Free);

    private async Task<OrderDto> ViewAsync(Scope c, OrderRow o, CancellationToken ct) => ViewOf(c, o, Work(c, o, await GuestsAsync(c, ct), await ReportTimesAsync(c, ct)));

    /// <summary>The lines this order puts on the account now: its charges and, once cancelled, the refund.</summary>
    private static List<FolioWrite> FolioOf(Scope c, OrderRow o, Calc w) =>
        Shipboard.Writes(c, OrderRules.FolioLinesOf(
            w.Priced, Shipboard.Ms(o.PlacedAt), Shipboard.DayAt(c, o.PlacedAt), Cancelled(o) && o.ResolvedOrCancelledAt is { } x ? Shipboard.Ms(x) : null,
            c.PersonByUser(o.PlacedByUserId)?.Id ?? Guid.Empty));

    private async Task<OrderRow> OrderAsync(Scope c, Guid id, CancellationToken ct) => await store.GetOrderAsync(c.Booking.BookingId, id, ct) ?? throw ApiException.NotFound();

    public async Task<OrderMenuDto> MenuAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var open = Shipboard.IsAboard(c);
        var scenarios = await scopes.ScenariosAsync(actor, ct);
        var room = Shipboard.Stateroom(c, await Shipboard.NeedsStepFreeAsync(accounts, c, ct));
        var guests = await GuestsAsync(c, ct);
        return new OrderMenuDto(
            open, scenarios.Contains("orderStock") ? [.. OrderRules.OutAtMenu] : [],
            [.. c.Party.Select(p => new OrderGuestDto(p.Id, p.Name, p.Age, guests.First(g => g.Id == p.Id).DrinkCapUsd))],
            room.Number, room.Deck, open ? OrderRules.BreakfastMornings(c.Timeline, c.Now) : [], HealthRules.Isolating(await ReportTimesAsync(c, ct), c.Now), open && !actor.IsSupervised && c.Confirmed);
    }

    public async Task<List<OrderDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: false, ct);
        var guests = await GuestsAsync(c, ct);
        var reports = await ReportTimesAsync(c, ct);
        return [.. (await store.ListOrdersAsync(c.Booking.BookingId, ct)).Select(o => ViewOf(c, o, Work(c, o, guests, reports))).OrderByDescending(o => o.PlacedAt)];
    }

    public async Task<OrderDto> PlaceAsync(UserRecord actor, string? number, PlaceOrderRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        if (body is null) throw ApiException.Invalid("empty");
        var guests = await GuestsAsync(c, ct);
        var scenarios = await scopes.ScenariosAsync(actor, ct);
        var stock = scenarios.Contains("orderStock");
        var lines = (body.Lines ?? []).Select(l => new OrderLineIn(l.ItemId ?? "", l.Qty, [.. l.Extras ?? []], l.Guest, l.Note)).ToList();
        var kind = body.Kind ?? "";
        var problem = OrderRules.OrderProblem(kind, lines, body.Location, body.Tip, body.DeliverAt, guests, stock ? OrderRules.OutAtMenu : []);
        if (problem == "unavailable") throw ApiException.Conflict("unavailable");
        if (problem is not null) throw ApiException.Invalid(problem);
        if (kind == "breakfast" && !OrderRules.BreakfastMornings(c.Timeline, c.Now, 8).Any(m => m.Slots.Any(s => s.At == body.DeliverAt))) throw ApiException.Invalid("noTime");

        var location = Store(body.Location!);
        var order = new OrderRow
        {
            PlacedByUserId = actor.Id, Kind = kind, PlacedAt = c.Now, DeliverAt = kind == "breakfast" ? Shipboard.FromMs(body.DeliverAt!.Value) : null,
            LocationKind = location.Kind, LocationRef = location.Ref, TipCents = body.Tip, Stage = "received",
            Lines = [.. lines.Select((l, i) =>
            {
                var m = OrderRules.ItemById(l.ItemId)!;
                var note = string.IsNullOrWhiteSpace(l.Note) ? null : l.Note.Trim() is var t && t.Length > OrderRules.NoteMax ? t[..OrderRules.NoteMax] : l.Note.Trim();
                return new OrderLineRow
                {
                    Seq = i, ItemId = m.Id, Qty = l.Qty, GuestUserId = c.PersonById(l.Guest)!.UserId, Extras = string.Join(',', l.Extras), Note = note,
                    UnitCents = m.Cents + l.Extras.Sum(e => m.Extras.First(x => x.Id == e).Cents),
                    Unavailable = stock && OrderRules.OutWhilePreparing.Contains(m.Id),
                };
            })],
        };
        var w = Work(c, order, guests, await ReportTimesAsync(c, ct));
        order.FeeCents = w.Priced.Fee;
        order.ServiceCents = w.Priced.Service;
        order.TotalCents = w.Priced.Total;
        order.CoveredCents = w.Priced.Covered;
        var saved = await store.SaveOrderAsync(c.Booking.BookingId, order, FolioOf(c, order, w), ct);
        return ViewOf(c, saved, w);
    }

    public async Task<OrderDto> ResolveAsync(UserRecord actor, string? number, Guid id, ResolveOrderRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var o = await OrderAsync(c, id, ct);
        var guests = await GuestsAsync(c, ct);
        var reports = await ReportTimesAsync(c, ct);
        var before = Work(c, o, guests, reports);
        if (before.Progress.Stage != "needsChoice") throw ApiException.Conflict("nothingToChoose");
        var choices = body?.Choices ?? [];
        foreach (var i in before.Waiting)
        {
            if (!choices.TryGetValue(i, out var choice) || choice is not ("substitute" or "remove")) throw ApiException.Invalid("incomplete");
            var item = OrderRules.ItemById(o.Lines.First(l => l.Seq == i).ItemId);
            if (choice == "substitute" && item?.Substitute is null) throw ApiException.Invalid("noSubstitute");
            o.Lines.First(l => l.Seq == i).Choice = choice;
        }
        o.ResolvedOrCancelledAt = c.Now;
        if (o.Lines.All(l => l.Choice == "remove")) o.Stage = "cancelled";
        var w = Work(c, o, guests, reports);
        o.FeeCents = w.Priced.Fee; o.ServiceCents = w.Priced.Service; o.TotalCents = w.Priced.Total; o.CoveredCents = w.Priced.Covered;
        o.RefundCents = Cancelled(o) ? w.Priced.Total : 0;
        await store.SaveOrderAsync(c.Booking.BookingId, o, FolioOf(c, o, w), ct);
        return ViewOf(c, o, w);
    }

    public async Task<OrderDto> CancelAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var o = await OrderAsync(c, id, ct);
        var guests = await GuestsAsync(c, ct);
        var reports = await ReportTimesAsync(c, ct);
        if (!OrderRules.CanCancel(Work(c, o, guests, reports).Progress.Stage)) throw ApiException.Conflict("tooLate");
        o.Stage = "cancelled";
        o.ResolvedOrCancelledAt = c.Now;
        var w = Work(c, o, guests, reports);
        o.RefundCents = w.Priced.Total;
        await store.SaveOrderAsync(c.Booking.BookingId, o, FolioOf(c, o, w), ct);
        return ViewOf(c, o, w);
    }

    public async Task<OrderDto> MoveAsync(UserRecord actor, string? number, Guid id, MoveOrderRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (OrderRules.LocationProblem(body?.Location) is { } problem) throw ApiException.Invalid(problem);
        var o = await OrderAsync(c, id, ct);
        var guests = await GuestsAsync(c, ct);
        var reports = await ReportTimesAsync(c, ct);
        if (!OrderRules.CanMove(Work(c, o, guests, reports).Progress.Stage)) throw ApiException.Conflict("tooLate");
        (o.LocationKind, o.LocationRef) = Store(body!.Location!);
        var w = Work(c, o, guests, reports);
        o.FeeCents = w.Priced.Fee; o.TotalCents = w.Priced.Total;
        await store.SaveOrderAsync(c.Booking.BookingId, o, FolioOf(c, o, w), ct);
        return ViewOf(c, o, w);
    }

    public async Task<OrderDto> ContactAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var o = await OrderAsync(c, id, ct);
        o.Contacted++;
        await store.SaveOrderAsync(c.Booking.BookingId, o, null, ct);
        return await ViewAsync(c, o, ct);
    }
}
