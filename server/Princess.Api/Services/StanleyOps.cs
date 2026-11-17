using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Where the operator's switches and the pending global proposal are kept, so every server instance sees the same ones.</summary>
public interface IStanleyOpsStore
{
    Task<List<OpsSwitchRow>> ListAsync(CancellationToken ct);
    Task SetAsync(OpsSwitchRow row, CancellationToken ct);
    Task<OpsProposal?> GetProposalAsync(CancellationToken ct);
    Task SaveProposalAsync(OpsProposal? proposal, CancellationToken ct);
}

public sealed class MemoryStanleyOpsStore : IStanleyOpsStore
{
    private readonly Dictionary<string, OpsSwitchRow> _rows = [];
    private OpsProposal? _proposal;

    public Task<List<OpsSwitchRow>> ListAsync(CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Values.OrderBy(r => r.Scope).ThenBy(r => r.Name).ToList());
    }

    public Task SetAsync(OpsSwitchRow row, CancellationToken ct)
    {
        lock (_rows) _rows[row.Scope + "/" + row.Name] = row;
        return Task.CompletedTask;
    }

    public Task<OpsProposal?> GetProposalAsync(CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_proposal);
    }

    public Task SaveProposalAsync(OpsProposal? proposal, CancellationToken ct)
    {
        lock (_rows) _proposal = proposal;
        return Task.CompletedTask;
    }
}

public sealed class DapperStanleyOpsStore(IDbConnectionFactory db) : IStanleyOpsStore
{
    private sealed class SwitchRow { public string Scope { get; set; } = ""; public string Name { get; set; } = ""; public bool Off { get; set; } public string Reason { get; set; } = ""; public Guid ByPublicId { get; set; } public DateTime At { get; set; } }
    private sealed class ProposalRow { public bool Off { get; set; } public string Reason { get; set; } = ""; public Guid ByPublicId { get; set; } public DateTime At { get; set; } }

    public async Task<List<OpsSwitchRow>> ListAsync(CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<SwitchRow>(Sql.Cmd("SELECT Scope, Name, [Off], Reason, ByPublicId, [At] FROM dbo.StanleyOpsSwitch", null, null, ct)))
            .Select(r => new OpsSwitchRow(r.Scope, r.Name, r.Off, r.Reason, r.ByPublicId, r.At)).ToList();
    }

    public async Task SetAsync(OpsSwitchRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.StanleyOpsSwitch SET [Off] = @Off, Reason = @Reason, ByPublicId = @By, [At] = @At WHERE Scope = @Scope AND Name = @Name; " +
            "IF @@ROWCOUNT = 0 INSERT INTO dbo.StanleyOpsSwitch (Scope, Name, [Off], Reason, ByPublicId, [At]) VALUES (@Scope, @Name, @Off, @Reason, @By, @At)", row, null, ct));
    }

    public async Task<OpsProposal?> GetProposalAsync(CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var r = await c.QueryFirstOrDefaultAsync<ProposalRow>(Sql.Cmd("SELECT TOP (1) [Off], Reason, ByPublicId, [At] FROM dbo.StanleyOpsProposal", null, null, ct));
        return r is null ? null : new(r.Off, r.Reason, r.ByPublicId, r.At);
    }

    public async Task SaveProposalAsync(OpsProposal? p, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyOpsProposal", null, null, ct));
        if (p is not null)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.StanleyOpsProposal ([Off], Reason, ByPublicId, [At]) VALUES (@Off, @Reason, @By, @At)", p, null, ct));
    }
}
