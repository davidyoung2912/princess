using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Ship Wi-Fi (NET-02): plans, devices, a usage meter. Ports <c>wifi</c> of <c>src/api/extrasMock.ts</c>. What a device cost, and whether a package paid, is its line on the account.</summary>
public sealed class WifiService(ScopeLoader scopes, IShipboardStore store, PlanService plan)
{
    private static string Describe(string plan, string name, int days) => $"Wi-Fi {plan}, {name}, {days} {(days == 1 ? "day" : "days")}";

    private async Task<WifiViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var now = Shipboard.Ms(c.Now);
        var rows = await store.ListWifiAsync(c.Booking.BookingId, ct);
        var included = (await plan.BookerEntitlementsAsync(c.Actor, c.Booking, ct)).Entitlements.WifiDevices;
        var devices = rows.Select(r =>
        {
            var addedAt = Shipboard.Ms(r.AddedAt);
            var expires = Shipboard.Ms(r.ExpiresAt);
            return new WifiDeviceDto(
                r.PublicId, r.Name, r.Plan, addedAt, r.Days, r.Included, r.PaidCents, WifiRules.UsedTodayMb(r.PublicId.ToString(), addedAt, now), WifiRules.PlanById(r.Plan)?.CapMb, expires, expires <= now);
        }).ToList();
        return new WifiViewDto(devices, Math.Max(0, included - rows.Count(r => r.Included)), Shipboard.IsAboard(c) && !c.Actor.IsSupervised);
    }

    public async Task<WifiViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<WifiViewDto> AddAsync(UserRecord actor, string? number, AddWifiRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        var rows = await store.ListWifiAsync(c.Booking.BookingId, ct);
        if (WifiRules.AddProblem(body?.Name, body?.Plan, body?.Days, [.. rows.Select(r => r.Name)]) is { } problem) throw ApiException.Invalid(problem);
        var chosen = WifiRules.PlanById(body!.Plan)!;
        var free = (await ViewAsync(c, ct)).IncludedLeft > 0 && chosen.Rank <= WifiRules.PlanById(WifiRules.IncludedPlan)!.Rank;
        var name = body.Name!.Trim();
        var (plan, days, paid) = free ? (WifiRules.IncludedPlan, WifiRules.MaxDays, 0L) : (chosen.Id, body.Days!.Value, chosen.PerDay * body.Days!.Value);
        var device = new WifiRow { Name = name, Plan = plan, Days = days, AddedAt = c.Now, ExpiresAt = Shipboard.FromMs(WifiRules.ExpiresAt(Shipboard.Ms(c.Now), days)), PaidCents = paid, Included = free, BuyerUserId = actor.Id };
        await store.AddWifiAsync(c.Booking.BookingId, device, [new FolioWrite(actor.Id, Shipboard.DayAt(c, c.Now), "internet", Describe(plan, name, days), paid, free ? "package" : null, c.Now)], ct);
        return await ViewAsync(c, ct);
    }

    public async Task<WifiViewDto> UpgradeAsync(UserRecord actor, string? number, Guid id, UpgradeWifiRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var dev = (await store.ListWifiAsync(c.Booking.BookingId, ct)).FirstOrDefault(d => d.PublicId == id) ?? throw ApiException.NotFound();
        var to = WifiRules.PlanById(body?.Plan) ?? throw ApiException.Invalid("badPlan");
        var now = Shipboard.Ms(c.Now);
        var expires = Shipboard.Ms(dev.ExpiresAt);
        if (expires <= now) throw ApiException.Invalid("expired");
        if (to.Rank <= (WifiRules.PlanById(dev.Plan)?.Rank ?? 0)) throw ApiException.Invalid("notAnUpgrade");
        var paid = dev.PaidCents + WifiRules.UpgradeCost(dev.Plan, expires, to, now);
        var line = new FolioWrite(dev.BuyerUserId == 0 ? actor.Id : dev.BuyerUserId, Shipboard.DayAt(c, dev.AddedAt), "internet", Describe(to.Id, dev.Name, dev.Days), paid, dev.Included ? "package" : null, dev.AddedAt);
        await store.UpgradeWifiAsync(c.Booking.BookingId, id, to.Id, [line], ct);
        return await ViewAsync(c, ct);
    }

    public async Task<WifiViewDto> RemoveAsync(UserRecord actor, string? number, Guid id, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        if (!await store.RemoveWifiAsync(c.Booking.BookingId, id, ct)) throw ApiException.NotFound();
        return await ViewAsync(c, ct);
    }
}
