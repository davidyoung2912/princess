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
        return new DemoStateDto(r.ClockOffsetSeconds, r.ClockSpeed, r.Scenarios);
    }

    public async Task<DemoStateDto> SaveAsync(DemoStateDto body, CancellationToken ct)
    {
        var u = await DemoUserAsync(ct);
        if (DemoRules.Problem(body) is { } problem) throw ApiException.Invalid(problem);
        var clean = DemoRules.Clean(body);
        await store.SaveStateAsync(u.Id, new DemoStateRow(clean.ClockOffsetSeconds, clean.ClockSpeed, clean.Scenarios), clock.UtcNow, ct);
        return clean;
    }
}
