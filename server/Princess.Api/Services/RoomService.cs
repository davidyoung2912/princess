using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>The stateroom (ROM-01 to ROM-03, ROM-05): the information card, housekeeping preferences, Do Not Disturb and mock smart-room controls. Ports <c>room</c> of <c>src/api/extrasMock.ts</c>.</summary>
public sealed class RoomService(ScopeLoader scopes, IShipboardStore store, IAccountStore accounts)
{
    private async Task<RoomViewDto> ViewAsync(Scope c, CancellationToken ct)
    {
        var a = Shipboard.Stateroom(c, await Shipboard.NeedsStepFreeAsync(accounts, c, ct));
        var settings = await store.GetRoomAsync(c.Booking.BookingId, ct);
        var hk = RoomRules.NormalizeHousekeeping(settings?.Housekeeping);
        return new RoomViewDto(
            a.Number, a.Deck, RoomRules.StewardFor(a.Number), RoomRules.AmenitiesFor(c.Booking.CategoryId, a.Accessible), a.Muster, RoomRules.HasView(c.Booking.CategoryId),
            hk, RoomRules.NormalizeDevices(settings?.Devices), RoomRules.DndCheckDue(hk, Shipboard.Ms(c.Now)), !c.Actor.IsSupervised);
    }

    public async Task<RoomViewDto> ViewAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ViewAsync(await scopes.LoadAsync(actor, number, write: false, ct), ct);

    public async Task<RoomViewDto> SetHousekeepingAsync(UserRecord actor, string? number, HousekeepingPatch? patch, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        patch ??= new HousekeepingPatch(null, null, null);
        if (RoomRules.HousekeepingProblem(patch) is { } problem) throw ApiException.Invalid(problem);
        var settings = await store.GetRoomAsync(c.Booking.BookingId, ct);
        var current = RoomRules.NormalizeHousekeeping(settings?.Housekeeping);
        var mode = patch.Mode ?? current.Mode;
        var next = new Housekeeping(mode, patch.Window ?? current.Window, patch.Turndown ?? current.Turndown, mode == "none" ? null : mode == current.Mode ? current.Since : Shipboard.Ms(c.Now));
        await store.SaveRoomAsync(c.Booking.BookingId, RoomRules.ToJson(next), RoomRules.ToJson(RoomRules.NormalizeDevices(settings?.Devices)), ct);
        return await ViewAsync(c, ct);
    }

    public async Task<RoomViewDto> SetDevicesAsync(UserRecord actor, string? number, DevicesPatch? patch, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        Shipboard.RequireAboard(c);
        patch ??= new DevicesPatch(null, null, null, null);
        if (RoomRules.DevicesProblem(patch, RoomRules.HasView(c.Booking.CategoryId)) is { } problem) throw ApiException.Invalid(problem);
        var settings = await store.GetRoomAsync(c.Booking.BookingId, ct);
        var current = RoomRules.NormalizeDevices(settings?.Devices);
        var next = new Devices(patch.Lights ?? current.Lights, patch.TempF is { } t ? (int)Math.Round(t, MidpointRounding.AwayFromZero) : current.TempF, patch.Tv ?? current.Tv, patch.Shades ?? current.Shades);
        await store.SaveRoomAsync(c.Booking.BookingId, RoomRules.ToJson(RoomRules.NormalizeHousekeeping(settings?.Housekeeping)), RoomRules.ToJson(next), ct);
        return await ViewAsync(c, ct);
    }
}
