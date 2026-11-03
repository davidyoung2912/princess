using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Princess.Api.Auth;
using Princess.Api.Domain;

namespace Princess.Api.Audit;

/// <summary>Categories and outcomes of an audit row; they match the CHECK constraints on <c>dbo.AuditEvents</c>.</summary>
public static class AuditCategory
{
    public const string Auth = "auth", Request = "request", Domain = "domain", Error = "error", System = "system";
}

public static class AuditOutcome
{
    public const string Success = "success", Failure = "failure", Denied = "denied", Error = "error";
}

/// <summary>One line of the trail: who did what to whom, when, from where, and how it ended. Never holds a request body, password or card number.</summary>
public sealed class AuditEntry
{
    public long Id { get; set; }
    public DateTime At { get; set; }
    public string Category { get; set; } = AuditCategory.Request;
    public string Action { get; set; } = "";
    public string Outcome { get; set; } = AuditOutcome.Success;
    public Guid? ActorPublicId { get; set; }
    public string ActorRole { get; set; } = "anonymous";
    public Guid? SubjectPublicId { get; set; }
    public string? Target { get; set; }
    public string? HttpMethod { get; set; }
    public string? Route { get; set; }
    public int? StatusCode { get; set; }
    public int? DurationMs { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorType { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorDetail { get; set; }
    public string? Detail { get; set; }
    public string? CorrelationId { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
}

/// <summary>A search of the trail. Newest first; <see cref="BeforeId"/> pages back from the last row of the previous page.</summary>
public sealed class AuditQuery
{
    /// <summary>Rows where this person is the actor or the subject.</summary>
    public Guid? Person { get; set; }
    public Guid? Actor { get; set; }
    public Guid? Subject { get; set; }
    public string? ActionPrefix { get; set; }
    public string? Category { get; set; }
    public string? Outcome { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public long? BeforeId { get; set; }
    public int Max { get; set; } = 100;
}

public interface IAuditStore
{
    Task AppendAsync(AuditEntry entry, CancellationToken ct);
    Task<List<AuditEntry>> QueryAsync(AuditQuery query, CancellationToken ct);
}

public interface IAuditLog
{
    /// <summary>Appends a row, filling in the time, the request's trace id, address, device and signed-in person where the entry has none. Never throws: a failing audit write must not fail the guest's request.</summary>
    Task RecordAsync(AuditEntry entry, CancellationToken ct = default);
}

public sealed class AuditLog(IAuditStore store, IClock clock, IHttpContextAccessor http, ILogger<AuditLog> log) : IAuditLog
{
    public async Task RecordAsync(AuditEntry e, CancellationToken ct = default)
    {
        try
        {
            e.At = clock.UtcNow;   // real time, never the demo clock
            var ctx = http.HttpContext;
            if (ctx is not null)
            {
                e.CorrelationId ??= AuditContext.Correlation(ctx);
                e.Ip ??= Cut(ctx.Connection.RemoteIpAddress?.ToString(), 45);
                e.UserAgent ??= Cut(ctx.Request.Headers.UserAgent.ToString(), 200);
                if (e.ActorPublicId is null) AuditContext.FillActor(ctx, e);
            }
            else if (e.ActorPublicId is null && e.ActorRole == "anonymous") e.ActorRole = "system";
            e.Action = Cut(e.Action, 120)!;
            e.Target = Cut(e.Target, 200);
            e.Detail = Cut(e.Detail, 1000);
            await store.AppendAsync(e, ct);
        }
        catch (Exception ex)
        {
            // The trail is lost for this event, so say so loudly where an operator will see it.
            log.LogError(ex, "Audit write failed for {Action} ({Outcome})", e.Action, e.Outcome);
        }
    }

    public static string? Cut(string? s, int max) => string.IsNullOrEmpty(s) ? null : s.Length <= max ? s : s[..max];
}

public static class AuditContext
{
    public static string Correlation(HttpContext http) => AuditLog.Cut(Activity.Current?.Id ?? http.TraceIdentifier, 64)!;

    /// <summary>The real actor is the booker on a view-as token; the token's subject is then the person acted for.</summary>
    public static void FillActor(HttpContext http, AuditEntry e)
    {
        var sub = Guid.TryParse(http.User.FindFirst(Claims.Subject)?.Value, out var s) ? s : (Guid?)null;
        var act = Guid.TryParse(http.User.FindFirst(Claims.Actor)?.Value, out var a) ? a : (Guid?)null;
        if (sub is null) return;
        e.ActorPublicId = act ?? sub;
        e.SubjectPublicId ??= act is null ? null : sub;
        e.ActorRole = act is not null ? "guest" : http.User.FindFirst(Claims.Role)?.Value is { Length: > 0 } r ? r : "guest";
    }

    /// <summary>A short stable fingerprint of text we must not store (an attempted sign-in name), so repeated attempts can be matched.</summary>
    public static string Fingerprint(string? text) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes((text ?? "").Trim().ToLowerInvariant())))[..12];

    public static string Json(object detail) => JsonSerializer.Serialize(detail);
}

/// <summary>
/// Audits every request that changes something (POST, PUT, PATCH, DELETE) and every request that fails (4xx, 5xx, rejected by the rate limit, or an
/// unhandled exception), so a concern can be answered with "this was (or was not) done, by whom, when, and how it ended". Plain reads that succeed are
/// not audited, and a path that matches no endpoint is not audited (scanners). It sits inside the exception handler, so it sees exceptions first.
/// </summary>
public sealed class AuditMiddleware(RequestDelegate next)
{
    private static readonly string[] Skipped = ["/health", "/swagger", "/.well-known", "/api/v1/telemetry"];   // telemetry writes its own rows
    private static readonly string[] SecretRouteKeys = ["token", "code", "secret", "key", "password"];

    public async Task InvokeAsync(HttpContext http, IAuditLog audit)
    {
        if (Skipped.Any(p => http.Request.Path.StartsWithSegments(p))) { await next(http); return; }
        var correlation = AuditContext.Correlation(http);
        http.Response.OnStarting(() => { http.Response.Headers["X-Request-Id"] = correlation; return Task.CompletedTask; });

        var watch = Stopwatch.StartNew();
        Exception? error = null;
        try { await next(http); }
        catch (Exception e) { error = e; throw; }
        finally
        {
            watch.Stop();
            await Write(http, audit, error, (int)watch.ElapsedMilliseconds, correlation);
        }
    }

    private static async Task Write(HttpContext http, IAuditLog audit, Exception? error, int ms, string correlation)
    {
        var api = error as ApiException;
        var status = error is null ? http.Response.StatusCode : api?.Status ?? (error is BadHttpRequestException or JsonException ? 400 : 500);
        var endpoint = http.GetEndpoint();
        var changes = HttpMethods.IsPost(http.Request.Method) || HttpMethods.IsPut(http.Request.Method) || HttpMethods.IsPatch(http.Request.Method) || HttpMethods.IsDelete(http.Request.Method);
        if (!changes && status < 400) return;
        if (endpoint is null && status == 404) return;

        var unhandled = error is not null && api is null && error is not (BadHttpRequestException or JsonException);
        var entry = new AuditEntry
        {
            Category = unhandled ? AuditCategory.Error : AuditCategory.Request,
            Outcome = unhandled ? AuditOutcome.Error : status is 401 or 403 or 429 ? AuditOutcome.Denied : status >= 400 ? AuditOutcome.Failure : AuditOutcome.Success,
            HttpMethod = http.Request.Method,
            Route = AuditLog.Cut((endpoint as RouteEndpoint)?.RoutePattern.RawText ?? http.Request.Path.Value, 200),
            StatusCode = status,
            DurationMs = ms,
            CorrelationId = correlation,
            Target = Target(http),
        };
        entry.Action = $"{entry.HttpMethod} {entry.Route}";
        if (api is not null) { entry.ErrorCode = ApiException.CodeName(api.Code); entry.ErrorMessage = api.Title; }
        else if (status == 429) { entry.ErrorCode = "forbidden"; entry.ErrorMessage = "tooManyRequests"; }
        else if (unhandled)
        {
            entry.ErrorCode = "server";
            entry.ErrorType = AuditLog.Cut(error!.GetType().FullName, 120);
            entry.ErrorMessage = AuditLog.Cut(error.Message, 400);
            entry.ErrorDetail = AuditLog.Cut(error.StackTrace, 2000);
        }
        // CancellationToken.None: a guest who closed the tab must not lose the record of what they did.
        await audit.RecordAsync(entry, CancellationToken.None);
    }

    /// <summary>The route values (a booking number, an id) of the request, leaving out anything that looks like a secret link token.</summary>
    private static string? Target(HttpContext http)
    {
        var values = http.Request.RouteValues.Where(kv => kv.Value is not null && !SecretRouteKeys.Any(s => kv.Key.Contains(s, StringComparison.OrdinalIgnoreCase)))
            .Select(kv => $"{kv.Key}={kv.Value}").ToList();
        return values.Count == 0 ? null : string.Join(", ", values);
    }
}
