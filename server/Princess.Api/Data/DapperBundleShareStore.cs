using Dapper;

namespace Princess.Api.Data;

public sealed class DapperBundleShareStore(IDbConnectionFactory db) : IBundleShareStore
{
    private const string Columns = "Id, PublicId, UserId, Ref, CreatedAt, ExpiresAt, RevokedAt, Scans";

    public async Task AddAsync(BundleShareRow row, string hash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.BundleShares (PublicId, UserId, TokenHash, Ref, ExpiresAt, CreatedAt)
            VALUES (@PublicId, @UserId, @hash, @Ref, @ExpiresAt, @CreatedAt)
            """, new { row.PublicId, row.UserId, hash, row.Ref, row.ExpiresAt, row.CreatedAt }, null, ct));
    }

    public async Task<BundleShareRow?> FindAsync(string hash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<BundleShareRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.BundleShares WHERE TokenHash = @hash", new { hash }, null, ct));
    }

    public async Task<List<BundleShareRow>> ListLiveAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<BundleShareRow>(Sql.Cmd(
            $"SELECT {Columns} FROM dbo.BundleShares WHERE UserId = @userId AND RevokedAt IS NULL AND ExpiresAt > @now ORDER BY Id DESC", new { userId, now }, null, ct))).ToList();
    }

    public async Task AddScanAsync(long id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.BundleShares SET Scans = Scans + 1 WHERE Id = @id", new { id }, null, ct));
    }

    public async Task<bool> RevokeAsync(long userId, Guid publicId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.BundleShares SET RevokedAt = @now WHERE UserId = @userId AND PublicId = @publicId AND RevokedAt IS NULL", new { userId, publicId, now }, null, ct)) > 0;
    }
}
