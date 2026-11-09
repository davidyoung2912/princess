using Dapper;

namespace Princess.Api.Data;

/// <summary>Finds the guests whose profile phone number may be the one a text came from.</summary>
public interface IPhoneLookupStore
{
    /// <summary>Ids and phone numbers of profiles whose number ends in the given four digits (the caller compares the whole number).</summary>
    Task<List<(long UserId, string Phone)>> FindByTailAsync(string tail, CancellationToken ct);
}

public sealed class DapperPhoneLookupStore(IDbConnectionFactory db) : IPhoneLookupStore
{
    public async Task<List<(long UserId, string Phone)>> FindByTailAsync(string tail, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<Row>(Sql.Cmd("SELECT TOP (50) UserId, Phone FROM dbo.Profiles WHERE Phone LIKE N'%' + @tail", new { tail }, null, ct));
        return [.. rows.Select(r => (r.UserId, r.Phone))];
    }

    private sealed class Row { public long UserId { get; set; } public string Phone { get; set; } = ""; }
}
