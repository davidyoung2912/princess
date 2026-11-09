using System.Data.Common;
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

/// <summary>Lets only one server instance run the scheduler pass at a time. A handle is held for the whole pass and released when disposed; null means another instance has it.</summary>
public interface IWatchLock
{
    Task<IAsyncDisposable?> TryAcquireAsync(CancellationToken ct);
}

/// <summary>A SQL Server session application lock (<c>sp_getapplock</c>) on a connection kept open for the pass. If the instance dies the connection drops and the lock goes with it.</summary>
public sealed class DapperWatchLock(IDbConnectionFactory db) : IWatchLock
{
    private const string Resource = "princess.watch-scheduler";

    public async Task<IAsyncDisposable?> TryAcquireAsync(CancellationToken ct)
    {
        var c = await db.OpenAsync(ct);
        try
        {
            var p = new DynamicParameters();
            p.Add("r", Resource);
            p.Add("code", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.ReturnValue);
            await c.ExecuteAsync(Sql.Cmd("EXEC @code = sp_getapplock @Resource = @r, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0", p, null, ct));
            if (p.Get<int>("code") >= 0) return new Handle(c);
        }
        catch { await c.DisposeAsync(); throw; }
        await c.DisposeAsync();
        return null;
    }

    private sealed class Handle(DbConnection c) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try { await c.ExecuteAsync("EXEC sp_releaseapplock @Resource = @r, @LockOwner = 'Session'", new { r = Resource }); }
            finally { await c.DisposeAsync(); }
        }
    }
}
