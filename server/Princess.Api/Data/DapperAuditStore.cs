using Dapper;
using Princess.Api.Audit;

namespace Princess.Api.Data;

public sealed class DapperAuditStore(IDbConnectionFactory db) : IAuditStore
{
    public const string InsertSql = """
        INSERT INTO dbo.AuditEvents (Category, Action, Outcome, ActorPublicId, ActorRole, SubjectPublicId, Target, HttpMethod, Route, StatusCode, DurationMs,
                                     ErrorCode, ErrorType, ErrorMessage, ErrorDetail, Detail, CorrelationId, Ip, UserAgent, [At])
        VALUES (@Category, @Action, @Outcome, @ActorPublicId, @ActorRole, @SubjectPublicId, @Target, @HttpMethod, @Route, @StatusCode, @DurationMs,
                @ErrorCode, @ErrorType, @ErrorMessage, @ErrorDetail, @Detail, @CorrelationId, @Ip, @UserAgent, @At)
        """;

    public async Task AppendAsync(AuditEntry entry, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(InsertSql, entry, null, ct));
    }

    public async Task<List<AuditEntry>> QueryAsync(AuditQuery q, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<AuditEntry>(Sql.Cmd("""
            SELECT TOP (@max) Id, [At], Category, Action, Outcome, ActorPublicId, ActorRole, SubjectPublicId, Target, HttpMethod, Route, StatusCode, DurationMs,
                   ErrorCode, ErrorType, ErrorMessage, ErrorDetail, Detail, CorrelationId, Ip, UserAgent
            FROM dbo.AuditEvents
            WHERE (@person IS NULL OR ActorPublicId = @person OR SubjectPublicId = @person)
              AND (@actor IS NULL OR ActorPublicId = @actor)
              AND (@subject IS NULL OR SubjectPublicId = @subject)
              AND (@actionPrefix IS NULL OR Action LIKE @actionPrefix + N'%')
              AND (@category IS NULL OR Category = @category)
              AND (@outcome IS NULL OR Outcome = @outcome)
              AND (@from IS NULL OR [At] >= @from)
              AND (@to IS NULL OR [At] < @to)
              AND (@beforeId IS NULL OR Id < @beforeId)
            ORDER BY [At] DESC, Id DESC
            """, new
        {
            max = Math.Clamp(q.Max, 1, 500), person = q.Person, actor = q.Actor, subject = q.Subject, actionPrefix = q.ActionPrefix?.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]"),
            category = q.Category, outcome = q.Outcome, from = q.From, to = q.To, beforeId = q.BeforeId,
        }, null, ct));
        return rows.ToList();
    }
}
