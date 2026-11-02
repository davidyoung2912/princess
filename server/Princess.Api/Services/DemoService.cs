using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Reads and writes the caller's demo clock offset and scenarios (data model 6.7). Not for real accounts: 404.</summary>
public sealed class DemoService(ICurrentUser me, IDemoStore store, IClock clock)
{
    private async Task<UserRecord> DemoUserAsync(CancellationToken ct)
    {
        var u = await me.LoadAsync(ct);
        return u.IsDemo ? u : throw ApiException.NotFound();
    }

    public async Task<DemoStateDto> GetAsync(CancellationToken ct)
    {
        var u = await DemoUserAsync(ct);
        var r = await store.GetStateAsync(u.Id, ct);
        return new DemoStateDto(r.ClockOffsetSeconds, r.ClockSpeed, r.Scenarios, r.SavedAt is { } at ? DemoRules.StampMs(at) : 0);
    }

    public async Task<DemoStateDto> SaveAsync(DemoStateDto body, CancellationToken ct)
    {
        var u = await DemoUserAsync(ct);
        if (DemoRules.Problem(body) is { } problem) throw ApiException.Invalid(problem);
        var clean = DemoRules.Clean(body);
        await store.SaveStateAsync(u.Id, new DemoStateRow(clean.ClockOffsetSeconds, clean.ClockSpeed, clean.Scenarios), clock.UtcNow, ct);
        return clean with { SavedAt = DemoRules.StampMs(clock.UtcNow) };
    }

    /// <summary>Moves the clock so "now" reads <c>At</c>, measured against the server's own clock; speed and scenarios stay.</summary>
    public async Task<DemoStateDto> JumpAsync(DemoJumpDto body, CancellationToken ct)
    {
        var u = await DemoUserAsync(ct);
        var now = clock.UtcNow;
        var offset = DemoRules.OffsetForMoment(body.At, now) ?? throw ApiException.Invalid("badOffset");
        var current = await store.GetStateAsync(u.Id, ct);
        await store.SaveStateAsync(u.Id, current with { ClockOffsetSeconds = offset }, now, ct);
        return new DemoStateDto(offset, current.ClockSpeed, current.Scenarios, DemoRules.StampMs(now));
    }

    /// <summary>Real time, normal speed, no scenarios: the state of a demo account that has never been touched.</summary>
    public async Task<DemoStateDto> ResetAsync(CancellationToken ct)
    {
        var u = await DemoUserAsync(ct);
        await store.SaveStateAsync(u.Id, new DemoStateRow(0, 1, []), clock.UtcNow, ct);
        return new DemoStateDto(0, 1, [], DemoRules.StampMs(clock.UtcNow));
    }
}
