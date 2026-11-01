using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Changes to the trip the ship or the line makes (SUP-06, SAF-06, MNG-15). Ports <c>updates</c> of <c>src/api/careMock.ts</c>. Which changes are in force comes from the person's scenarios (demo users only);
/// seeing one is acknowledged by picking an option, and a change that has ended stays in the record.
/// </summary>
public sealed class UpdatesService(ScopeLoader scopes, IShipboardStore store)
{
    private async Task<List<UpdateViewDto>> ListAsync(UserRecord actor, CancellationToken ct)
    {
        var active = DisruptionRules.Active(await scopes.ScenariosAsync(actor, ct));
        var acks = (await store.ListAcksAsync(actor.Id, ct)).ToDictionary(a => a.ScenarioId);
        UpdateAckDto? AckOf(string id) => acks.TryGetValue(id, out var a) ? new UpdateAckDto(a.Option, Shipboard.Ms(a.At)) : null;
        var current = active.Select(d => new UpdateViewDto(d.Id, d.Severity, true, AckOf(d.Id)));
        var ended = acks.Keys.Where(id => active.All(a => a.Id != id) && DisruptionRules.ById(id) is not null).Select(id => new UpdateViewDto(id, DisruptionRules.ById(id)!.Severity, false, AckOf(id)));
        return [.. current, .. ended];
    }

    public async Task<List<UpdateViewDto>> ListAsync(UserRecord actor, string? number, CancellationToken ct)
    {
        await scopes.LoadAsync(actor, number, write: false, ct);
        return await ListAsync(actor, ct);
    }

    public async Task<List<UpdateViewDto>> AcknowledgeAsync(UserRecord actor, string? number, string? id, AcknowledgeRequest? body, CancellationToken ct)
    {
        var c = await scopes.LoadAsync(actor, number, write: true, ct);
        var def = DisruptionRules.ById(id);
        if (def is null || !DisruptionRules.ValidOption(def, body?.Option)) throw ApiException.Invalid("option");
        if (DisruptionRules.Active(await scopes.ScenariosAsync(actor, ct)).All(a => a.Id != def.Id)) throw ApiException.Conflict("ended");
        await store.SaveAckAsync(actor.Id, def.Id, body!.Option!, c.Now, ct);
        return await ListAsync(actor, ct);
    }
}
