using Dapper;

namespace Princess.Api.Data;

public sealed class DapperMediaStore(IDbConnectionFactory db) : IMediaStore
{
    private const string Columns = "PublicId, UserId, Purpose, Reference, Kind, Caption, ContentType, Width, Height, ByteCount, Status, CreatedAt";

    public async Task<(int Count, long Bytes)> UsageAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleAsync<(int Count, long Bytes)>(Sql.Cmd("SELECT COUNT(*) AS Count, COALESCE(SUM(CAST(ByteCount AS BIGINT)), 0) AS Bytes FROM dbo.GuestMedia WHERE UserId = @userId", new { userId }, null, ct));
        return row;
    }

    public async Task<Guid> AddAsync(long userId, string purpose, string reference, string kind, string caption, string contentType, int width, int height, byte[] data, string status, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<Guid>(Sql.Cmd(
            "INSERT INTO dbo.GuestMedia (UserId, Purpose, Reference, Kind, Caption, ContentType, Width, Height, ByteCount, Status, Data, CreatedAt) OUTPUT INSERTED.PublicId " +
            "VALUES (@userId, @purpose, @reference, @kind, @caption, @contentType, @width, @height, @count, @status, @data, @now)",
            new { userId, purpose, reference, kind, caption, contentType, width, height, count = data.Length, status, data, now }, null, ct));
    }

    public async Task<List<MediaRow>> ListMineAsync(long userId, string? purpose, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<MediaRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.GuestMedia WHERE UserId = @userId AND (@purpose IS NULL OR Purpose = @purpose) ORDER BY CreatedAt DESC, Id DESC", new { userId, purpose }, null, ct))).ToList();
    }

    public async Task<List<MediaRow>> ListByReferenceAsync(string purpose, string reference, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<MediaRow>(Sql.Cmd($"SELECT TOP (@max) {Columns} FROM dbo.GuestMedia WHERE Purpose = @purpose AND Reference = @reference AND Status <> 'rejected' ORDER BY CreatedAt DESC, Id DESC", new { purpose, reference, max }, null, ct))).ToList();
    }

    public async Task<MediaRow?> FindAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<MediaRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.GuestMedia WHERE PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<byte[]?> BytesAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<byte[]>(Sql.Cmd("SELECT Data FROM dbo.GuestMedia WHERE PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.GuestMedia WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct)) > 0;
    }
}
