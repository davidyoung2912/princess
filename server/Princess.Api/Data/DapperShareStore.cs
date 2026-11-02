using Dapper;

namespace Princess.Api.Data;

public sealed class DapperShareStore(IDbConnectionFactory db) : IShareStore
{
    private const string Columns = "Id, PublicId, BookingId, UserId, Kind, Label, CreatedAt, ExpiresAt, LastCheckInAt, Note";

    public async Task<List<ShareLinkRow>> ListAsync(long bookingId, long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ShareLinkRow>(Sql.Cmd(
            $"SELECT {Columns} FROM dbo.ShareLinks WHERE BookingId = @bookingId AND UserId = @userId ORDER BY Id", new { bookingId, userId }, null, ct))).ToList();
    }

    public async Task AddAsync(ShareLinkRow row, string hash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.ShareLinks (PublicId, BookingId, UserId, Kind, Label, TokenHash, ExpiresAt, Note, CreatedAt)
            VALUES (@PublicId, @BookingId, @UserId, @Kind, @Label, @hash, @ExpiresAt, N'', @CreatedAt)
            """, new { row.PublicId, row.BookingId, row.UserId, row.Kind, row.Label, hash, row.ExpiresAt, row.CreatedAt }, null, ct));
    }

    public async Task<bool> RevokeAsync(long bookingId, long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ShareLinks WHERE BookingId = @bookingId AND UserId = @userId AND PublicId = @publicId", new { bookingId, userId, publicId }, null, ct)) > 0;
    }

    public async Task<bool> SaveCheckInAsync(long bookingId, long userId, Guid publicId, string note, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.ShareLinks SET LastCheckInAt = @at, Note = @note WHERE BookingId = @bookingId AND UserId = @userId AND PublicId = @publicId AND Kind = 'caregiver'",
            new { bookingId, userId, publicId, note, at }, null, ct)) > 0;
    }

    public async Task<ShareLinkRow?> FindAsync(string hash, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<ShareLinkRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.ShareLinks WHERE TokenHash = @hash", new { hash }, null, ct));
    }
}
