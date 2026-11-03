using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Laundry, pressing and dry cleaning (SHP-03): request, pick-up window, tracking. Ports <c>laundry</c> of <c>src/api/extrasMock.ts</c>. A request is on the account from the moment it is made (dated at the pick-up) until it is cancelled.</summary>
public sealed class LaundryService(ScopeLoader scopes, IShipboardStore store, PlanService plan)
{
    private static string Describe(string service, int qty) =>
        $"{qty} × {service switch { "washFold" => "wash and fold", "press" => "pressing", _ => "dry cleaning" }}";

    private async Task<bool> PerkAsync(Scope c, CancellationToken ct) => (await plan.BookerEntitlementsAsync(c.Actor, c.Booking, ct)).Entitlements.Perks.Contains("freeLaundry");

    private async Task<LaundryViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var now = Shipboard.Ms(c.Now);
        var rows = await store.ListLaundryAsync(c.Booking.BookingId, ct);
        var requests = rows.Select(r =>
        {
            var hours = LaundryRules.ServiceById(r.Service)?.Hours ?? 24;
            var (stage, returnAt) = LaundryRules.Stage(Shipboard.Ms(r.PickupAt), hours, r.Stage == "cancelled", now);
            return new LaundryRequestDto(r.PublicId, r.Service, r.Qty, Shipboard.Ms(r.PickupAt), returnAt, stage, r.TotalCents, r.FreeCents, r.Note);
        }).ToList();
        var open = Shipboard.IsAboard(c);
        var freeUsed = rows.Any(r => r.FreeCents > 0 && r.Stage != "cancelled");
        return new LaundryViewDto(
            requests, LaundryRules.Services.ToDictionary(s => s.Id, s => open ? LaundryRules.PickupOptions(c.Timeline, c.Now, s) : []),
            await PerkAsync(c, ct) && !freeUsed, open && !c.Actor.IsSupervised);
    }

    public async Task<LaundryViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<LaundryViewDto> RequestAsync(UserRecord actor, string? number, LaundryRequestBody? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var svc = LaundryRules.ServiceById(body?.Service) ?? throw ApiException.Invalid("badService");
        if (body!.Qty < 1 || body.Qty > svc.MaxQty) throw ApiException.Invalid("badQuantity");
        var note = (body.Note ?? "").Trim();
        if ((body.Note ?? "").Length > LaundryRules.NoteMax) throw ApiException.Invalid("badNote");
        if (!LaundryRules.PickupOptions(c.Timeline, c.Now, svc, 100).Any(p => p.At == body.PickupAt)) throw ApiException.Invalid("badPickup");
        var rows = await store.ListLaundryAsync(c.Booking.BookingId, ct);
        var price = LaundryRules.Price(svc, body.Qty, await PerkAsync(c, ct) && !rows.Any(r => r.FreeCents > 0 && r.Stage != "cancelled"));
        var pickup = Shipboard.FromMs(body.PickupAt);
        var request = new LaundryRow
        {
            Service = svc.Id, Qty = body.Qty, PickupAt = pickup, ReturnAt = pickup.AddHours(svc.Hours), TotalCents = price.Total, FreeCents = price.Free, Note = note, PlacedAt = c.Now, RequestedByUserId = actor.Id,
        };
        var folio = new FolioWrite(actor.Id, Shipboard.DayAt(c, pickup), "laundry", Describe(svc.Id, body.Qty), price.Total, price.Free > 0 ? "fare" : null, pickup);
        await store.AddLaundryAsync(c.Booking.BookingId, request, [folio], ct);
        return await ViewAsync(c, ct);
    }

    public async Task<LaundryViewDto> CancelAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var r = (await store.ListLaundryAsync(c.Booking.BookingId, ct)).FirstOrDefault(x => x.PublicId == id) ?? throw ApiException.NotFound();
        var (stage, _) = LaundryRules.Stage(Shipboard.Ms(r.PickupAt), LaundryRules.ServiceById(r.Service)?.Hours ?? 24, r.Stage == "cancelled", Shipboard.Ms(c.Now));
        if (!LaundryRules.Cancellable(stage)) throw ApiException.Conflict("tooLate");
        await store.CancelLaundryAsync(c.Booking.BookingId, id, ct);
        return await ViewAsync(c, ct);
    }
}
