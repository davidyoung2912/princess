using System.Security.Cryptography;
using Microsoft.Net.Http.Headers;

namespace Princess.Api.Services;

/// <summary>
/// Strong ETags and a short shared cache for the public reference data that changes only with a release (ships, ports, rooms, packages, limits, content).
/// The body is hashed, so a client that sends <c>If-None-Match</c> gets an empty 304. Reads that depend on the clock, the database or a simulated feed are not listed and stay <c>no-store</c>.
/// </summary>
public static class ReferenceCaching
{
    private const string Prefix = "/api/v1/reference";
    private static readonly string[] Static =
    [
        "/access", "/entry", "/catalogue", "/ship", "/ports", "/packages", "/limits", "/pricing", "/content",
    ];

    public static bool Applies(HttpRequest r)
    {
        if (!HttpMethods.IsGet(r.Method) && !HttpMethods.IsHead(r.Method)) return false;
        var path = r.Path.Value ?? "";
        if (!path.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)) return false;
        var rest = path[Prefix.Length..].TrimEnd('/');
        if (Static.Any(p => rest.Equals(p, StringComparison.OrdinalIgnoreCase))) return true;
        if (rest.StartsWith("/catalogue/", StringComparison.OrdinalIgnoreCase)) return true;
        // /ships/{id}/aboard and /ships/{id}/venues are authored plans; /ships/{id}/program follows the day's changes.
        return rest.StartsWith("/ships/", StringComparison.OrdinalIgnoreCase)
            && (rest.EndsWith("/aboard", StringComparison.OrdinalIgnoreCase) || rest.EndsWith("/venues", StringComparison.OrdinalIgnoreCase));
    }

    public static IApplicationBuilder UseReferenceCaching(this IApplicationBuilder app, TimeSpan maxAge) =>
        app.Use(async (http, next) =>
        {
            if (!Applies(http.Request)) { await next(); return; }
            var original = http.Response.Body;
            await using var buffer = new MemoryStream();
            http.Response.Body = buffer;
            try { await next(); }
            finally { http.Response.Body = original; }

            if (http.Response.StatusCode == StatusCodes.Status200OK && buffer.Length > 0)
            {
                var etag = $"\"{Convert.ToHexString(SHA256.HashData(buffer.GetBuffer().AsSpan(0, (int)buffer.Length)))[..32]}\"";
                var h = http.Response.Headers;
                h.ETag = etag;
                h.CacheControl = $"public, max-age={(int)maxAge.TotalSeconds}";
                h.Vary = HeaderNames.AcceptEncoding;
                if (http.Request.Headers.IfNoneMatch.Any(v => v is not null && v.Split(',').Any(t => t.Trim() == etag || t.Trim() == "*")))
                {
                    http.Response.StatusCode = StatusCodes.Status304NotModified;
                    http.Response.ContentLength = null;
                    http.Response.ContentType = null;
                    return;
                }
            }
            else http.Response.Headers.CacheControl = "no-store";
            buffer.Position = 0;
            http.Response.ContentLength = buffer.Length;
            if (!HttpMethods.IsHead(http.Request.Method)) await buffer.CopyToAsync(original, http.RequestAborted);
        });
}
