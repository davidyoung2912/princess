using Dapper;

namespace Princess.Api.Data;

/// <summary>Who the background scheduler should look after: people with a phone signed up for alerts, or an automatic instalment switched on.</summary>
public interface IWatchTargetStore
{
    Task<List<long>> ListUserIdsAsync(int max, CancellationToken ct);
}

public sealed class DapperWatchTargetStore(IDbConnectionFactory db) : IWatchTargetStore
{
    public async Task<List<long>> ListUserIdsAsync(int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<long>(Sql.Cmd("""
            SELECT TOP (@max) UserId FROM (
              SELECT UserId FROM dbo.PushSubscriptions
              UNION
              SELECT AutoUserId FROM dbo.InstalmentPlans WHERE AutoUserId IS NOT NULL
            ) t ORDER BY UserId
            """, new { max }, null, ct))).ToList();
    }
}
