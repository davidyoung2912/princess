using System.Text.Json.Nodes;
using Microsoft.AspNetCore.DataProtection;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Account state for every device (docs/multi-device-plan.md): small documents per person (<c>/me/state</c>) and per booking (<c>/bookings/{n}/state</c>).
/// A save carries the version the device last saw; if another device saved since, it is a 409 and the device fetches the newer copy and merges.
/// </summary>
public sealed class StateService(IStateStore store, ITripStore trips, AccessService access, IUserClock clock, IDataProtectionProvider protection)
{
    private readonly IDataProtector _protector = protection.CreateProtector("Princess.Api.State.v1");

    /// <summary>Encrypted keys are stored as <c>{"enc":"..."}</c>; everything else as the document itself.</summary>
    private StateDto Dto(StateRow r)
    {
        var node = JsonNode.Parse(r.Json);
        if (StateRules.EncryptedKeys.Contains(r.Key) && node is JsonObject o && o["enc"]?.GetValue<string>() is { } cipher)
        {
            try { node = JsonNode.Parse(_protector.Unprotect(cipher)); }
            catch (System.Security.Cryptography.CryptographicException) { node = new JsonObject(); }   // key ring lost: treat as empty rather than fail the whole export
        }
        return new StateDto(r.Key, r.Version, node, TripRules.ToMs(r.UpdatedAt));
    }

    private string Stored(string key, JsonNode data) =>
        StateRules.EncryptedKeys.Contains(key) ? new JsonObject { ["enc"] = _protector.Protect(data.ToJsonString()) }.ToJsonString() : data.ToJsonString();

    private static IReadOnlyDictionary<string, int> Keys(bool booking) => booking ? StateRules.BookingKeys : StateRules.UserKeys;

    /// <summary>The owner row id and whether the caller may write: a person's own state, or a booking's for any member (read) or adult member (write).</summary>
    private async Task<long> OwnerAsync(UserRecord actor, bool booking, string? number, bool write, CancellationToken ct)
    {
        if (!booking) return actor.Id;
        var m = write ? await access.RequireAdultMemberAsync(actor, number, ct) : await access.RequireMemberAsync(actor, number, ct);
        return m.BookingId;
    }

    public async Task<List<StateSummaryDto>> ListAsync(UserRecord actor, bool booking, string? number, CancellationToken ct)
    {
        var owner = await OwnerAsync(actor, booking, number, false, ct);
        return [.. (await store.ListAsync(booking, owner, ct)).Select(r => new StateSummaryDto(r.Key, r.Version, TripRules.ToMs(r.UpdatedAt)))];
    }

    /// <summary>The document, or null when nothing is saved under the key yet.</summary>
    public async Task<StateDto?> GetAsync(UserRecord actor, bool booking, string? number, string key, CancellationToken ct)
    {
        if (!Keys(booking).ContainsKey(key)) throw ApiException.Invalid("badKey");
        var owner = await OwnerAsync(actor, booking, number, false, ct);
        return await store.GetAsync(booking, owner, key, ct) is { } row ? Dto(row) : null;
    }

    public async Task<StateDto> SaveAsync(UserRecord actor, bool booking, string? number, string key, SaveStateRequest? body, CancellationToken ct)
    {
        if (StateRules.Problem(Keys(booking), key, body?.Data) is { } problem) throw ApiException.Invalid(problem);
        if (body!.BaseVersion < 0) throw ApiException.Invalid("badVersion");
        var owner = await OwnerAsync(actor, booking, number, true, ct);
        if (StateRules.EncryptedKeys.Contains(key) && !await HasConsentAsync(owner, ct)) throw ApiException.Forbidden();
        var saved = await store.SaveAsync(booking, owner, key, Stored(key, body.Data!), body.BaseVersion, await clock.NowAsync(actor, ct), ct);
        return saved is null ? throw ApiException.Conflict("stale") : Dto(saved);
    }

    private async Task<bool> HasConsentAsync(long userId, CancellationToken ct) =>
        await store.GetAsync(false, userId, "settings", ct) is { } row && JsonNode.Parse(row.Json) is JsonObject o && o["syncPrivate"] is JsonValue v && v.TryGetValue<bool>(out var on) && on;

    public async Task DeleteAsync(UserRecord actor, bool booking, string? number, string key, CancellationToken ct)
    {
        if (!Keys(booking).ContainsKey(key)) throw ApiException.Invalid("badKey");
        var owner = await OwnerAsync(actor, booking, number, true, ct);
        await store.DeleteAsync(booking, owner, key, ct);
    }

    /// <summary>Privacy export: every document held for the person, and for each booking they are a guest on or have linked.</summary>
    public async Task<StateExportDto> ExportAsync(UserRecord actor, CancellationToken ct)
    {
        var now = await clock.NowAsync(actor, ct);
        var account = (await store.ListAsync(false, actor.Id, ct)).Select(Dto).ToList();
        var bookings = new List<BookingStateExportDto>();
        foreach (var b in await trips.ListForUserAsync(actor.Id, ct))
        {
            var docs = (await store.ListAsync(true, b.BookingId, ct)).Select(Dto).ToList();
            if (docs.Count > 0) bookings.Add(new BookingStateExportDto(b.Number, docs));
        }
        return new StateExportDto(TripRules.ToMs(now), account, bookings);
    }

    /// <summary>"Delete my data": removes every document of the person's own. Booking documents are shared with the other guests and are left to the booking.</summary>
    public async Task DeleteAllAsync(UserRecord actor, CancellationToken ct) => await store.DeleteAllAsync(false, actor.Id, ct);
}
