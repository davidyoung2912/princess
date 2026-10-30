using System.Data.Common;
using Microsoft.Data.SqlClient;

namespace Princess.Api.Data;

public interface IDbConnectionFactory
{
    /// <summary>Opens a new connection. The caller disposes it.</summary>
    Task<DbConnection> OpenAsync(CancellationToken ct = default);
}

public sealed class SqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public async Task<DbConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = new SqlConnection(connectionString);
        try
        {
            await connection.OpenAsync(ct);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }
}
