using System.Data.Common;
using Dapper;

namespace Princess.Api.Data;

/// <summary>Who the background scheduler should look after: people with a phone signed up for alerts, an automatic instalment switched on, or an email address or phone number and a confirmed booking (so email and text notices reach them with no phone subscribed).</summary>
public interface IWatchTargetStore
{
    /// <summary>Up to <paramref name="max"/> user ids above <paramref name="afterId"/>, lowest first.</summary>
    Task<List<long>> ListUserIdsAsync(int max, long afterId, CancellationToken ct);
}

public sealed class DapperWatchTargetStore(IDbConnectionFactory db) : IWatchTargetStore
{
    public async Task<List<long>> ListUserIdsAsync(int max, long afterId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<long>(Sql.Cmd("""
            SELECT TOP (@max) UserId FROM (
              SELECT UserId FROM dbo.PushSubscriptions
              UNION
              SELECT AutoUserId FROM dbo.InstalmentPlans WHERE AutoUserId IS NOT NULL
              UNION
              SELECT u.Id FROM dbo.Users u
                JOIN dbo.BookingGuests g ON g.UserId = u.Id
                JOIN dbo.Bookings b ON b.Id = g.BookingId AND b.Status = 'confirmed'
                LEFT JOIN dbo.Profiles p ON p.UserId = u.Id
               WHERE u.Role = 'guest' AND u.IsDemo = 0
                 AND (NULLIF(u.Email, N'') IS NOT NULL OR NULLIF(p.Phone, N'') IS NOT NULL)
            ) t WHERE UserId > @afterId ORDER BY UserId
            """, new { max, afterId }, null, ct))).ToList();
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
            // A return-value parameter only works with CommandType.StoredProcedure, so declare the variable in the batch and select it.
            var code = await c.ExecuteScalarAsync<int>(Sql.Cmd(
                "DECLARE @code int; EXEC @code = sp_getapplock @Resource = @r, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0; SELECT @code;",
                new { r = Resource }, null, ct));
            if (code >= 0) return new Handle(c);
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
