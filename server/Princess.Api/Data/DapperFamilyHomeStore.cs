using Dapper;

namespace Princess.Api.Data;

public sealed class DapperFamilyHomeStore(IDbConnectionFactory db) : IFamilyHomeStore
{
    public async Task<int> CountLiveAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.FamilyLinks WHERE UserId = @userId AND RevokedAt IS NULL AND ExpiresAt > @now", new { userId, now }, null, ct));
    }

    public async Task<Guid> AddLinkAsync(long userId, DateTime expiresAt, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<Guid>(Sql.Cmd(
            "INSERT INTO dbo.FamilyLinks (UserId, ExpiresAt, CreatedAt) OUTPUT INSERTED.PublicId VALUES (@userId, @expiresAt, @now)", new { userId, expiresAt, now }, null, ct));
    }

    public async Task<FamilyLinkRow?> FindLinkAsync(Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<FamilyLinkRow>(Sql.Cmd("SELECT PublicId, UserId, ExpiresAt, RevokedAt FROM dbo.FamilyLinks WHERE PublicId = @publicId", new { publicId }, null, ct));
    }

    public async Task<bool> RevokeAsync(long userId, Guid publicId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var found = await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT COUNT(*) FROM dbo.FamilyLinks WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct));
        if (found == 0) return false;
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.FamilyLinks SET RevokedAt = @now WHERE UserId = @userId AND PublicId = @publicId AND RevokedAt IS NULL", new { userId, publicId, now }, null, ct));
        return true;
    }

    public async Task<int> RevokeAllAsync(long userId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.FamilyLinks SET RevokedAt = @now WHERE UserId = @userId AND RevokedAt IS NULL", new { userId, now }, null, ct));
    }

    public async Task AddPostcardAsync(long userId, string kind, string note, DateTime sentAt, int keep, Guid? mediaId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.FamilyPostcards (UserId, Kind, Note, SentAt, MediaId) VALUES (@userId, @kind, @note, @sentAt, @mediaId)", new { userId, kind, note, sentAt, mediaId }, null, ct));
        await c.ExecuteAsync(Sql.Cmd(
            "DELETE FROM dbo.FamilyPostcards WHERE UserId = @userId AND Id NOT IN (SELECT TOP (@keep) Id FROM dbo.FamilyPostcards WHERE UserId = @userId ORDER BY SentAt DESC, Id DESC)", new { userId, keep }, null, ct));
    }

    public async Task<List<FamilyPostcardRow>> ListPostcardsAsync(long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<FamilyPostcardRow>(Sql.Cmd("SELECT TOP (@max) Kind, Note, SentAt, MediaId FROM dbo.FamilyPostcards WHERE UserId = @userId ORDER BY SentAt DESC, Id DESC", new { userId, max }, null, ct))).ToList();
        rows.Reverse();
        return rows;
    }
}
