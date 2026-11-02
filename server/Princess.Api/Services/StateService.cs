using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Account state for every device (docs/multi-device-plan.md): small documents per person (<c>/me/state</c>) and per booking (<c>/bookings/{n}/state</c>).
/// A save carries the version the device last saw; if another device saved since, it is a 409 and the device fetches the newer copy and merges.
/// </summary>
public sealed class StateService(IStateStore store, AccessService access, IUserClock clock)
{
    private static StateDto Dto(StateRow r) => new(r.Key, r.Version, JsonNode.Parse(r.Json), TripRules.ToMs(r.UpdatedAt));

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
        var saved = await store.SaveAsync(booking, owner, key, body.Data!.ToJsonString(), body.BaseVersion, await clock.NowAsync(actor, ct), ct);
        return saved is null ? throw ApiException.Conflict("stale") : Dto(saved);
    }

    public async Task DeleteAsync(UserRecord actor, bool booking, string? number, string key, CancellationToken ct)
    {
        if (!Keys(booking).ContainsKey(key)) throw ApiException.Invalid("badKey");
        var owner = await OwnerAsync(actor, booking, number, true, ct);
        await store.DeleteAsync(booking, owner, key, ct);
    }
}
