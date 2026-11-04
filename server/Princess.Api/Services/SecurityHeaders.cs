namespace Princess.Api.Services;

/// <summary>
/// Response headers for every reply (SEC-01). The API returns JSON only, so it can be strict:
/// nothing may frame it, sniff its types or cache its answers. Swagger's pages need inline script, so they keep to the basic set.
/// </summary>
public static class SecurityHeaders
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app, bool hsts) =>
        app.Use(async (http, next) =>
        {
            http.Response.OnStarting(() =>
            {
                var h = http.Response.Headers;
                h["X-Content-Type-Options"] = "nosniff";
                h["X-Frame-Options"] = "DENY";
                h["Referrer-Policy"] = "no-referrer";
                h["Cross-Origin-Resource-Policy"] = "same-site";
                h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
                if (hsts && http.Request.IsHttps) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
                if (IsData(http.Request.Path))
                {
                    h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
                    // The reference reads set their own revalidating policy (ReferenceCaching); everything else is never stored.
                    if (!ReferenceCaching.Applies(http.Request)) h["Cache-Control"] = "no-store";
                }
                return Task.CompletedTask;
            });
            await next();
        });

    private static bool IsData(PathString path) =>
        path.StartsWithSegments("/api") || path.StartsWithSegments("/health");
}
