using Princess.Api.Contracts;

namespace Princess.Api.Auth;

/// <summary>
/// The refresh token as an httpOnly cookie, so page script (and anything injected into it) can never read it. A client opts in by sending the
/// <see cref="Header"/> request header (<c>session</c>: the cookie ends with the browser session; <c>persist</c>: it lasts as long as the refresh token).
/// A custom header cannot be sent cross-site without a CORS preflight, which only the configured origins pass, so the header doubles as the CSRF guard:
/// the cookie is never read, and never set, on a request without it. Clients that do not send the header (tests, tools) keep the token in the body.
/// </summary>
public static class RefreshCookie
{
    public const string Name = "princess_refresh";
    public const string Header = "X-Princess-Cookie";

    public static bool Wanted(HttpContext http) => http.Request.Headers.ContainsKey(Header);

    /// <summary>The token to use: the body's when sent, else (only when the client opted in) the cookie's.</summary>
    public static string? Read(HttpContext http, string? fromBody)
        => !string.IsNullOrEmpty(fromBody) ? fromBody : Wanted(http) ? http.Request.Cookies[Name] : null;

    /// <summary>For a client that opted in, puts the new refresh token in the cookie and blanks it in the body.</summary>
    public static SessionResponse Apply(HttpContext http, SessionResponse session)
    {
        if (!Wanted(http)) return session;
        var persist = string.Equals(http.Request.Headers[Header].ToString(), "persist", StringComparison.OrdinalIgnoreCase);
        http.Response.Cookies.Append(Name, session.RefreshToken, Options(http, persist ? DateTimeOffset.FromUnixTimeMilliseconds(session.RefreshExpiresAt) : null));
        return session with { RefreshToken = "" };
    }

    public static void Clear(HttpContext http)
    {
        if (Wanted(http)) http.Response.Cookies.Delete(Name, Options(http, null));
    }

    /// <summary>
    /// <c>Auth:RefreshCookieSameSite</c>: <c>Lax</c> (the default) when the app reaches the API through its own address (the host forwards /api), which keeps the cookie first-party
    /// so Safari and iOS accept it; <c>None</c> only when the app and the API are on different sites (Safari blocks that).
    /// </summary>
    private static SameSiteMode SameSite(HttpContext http)
        => Enum.TryParse<SameSiteMode>(http.RequestServices.GetRequiredService<IConfiguration>()["Auth:RefreshCookieSameSite"], true, out var mode) ? mode : SameSiteMode.Lax;

    // Scoped to the auth routes; Secure always (browsers treat localhost as secure).
    private static CookieOptions Options(HttpContext http, DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSite(http),
        Path = AuthPath(http),
        Expires = expires,
        IsEssential = true,
    };

    private static string AuthPath(HttpContext http)
    {
        var path = http.Request.Path.Value ?? "";
        var i = path.IndexOf("/auth", StringComparison.OrdinalIgnoreCase);
        return http.Request.PathBase + (i >= 0 ? path[..(i + 5)] : "/auth");
    }
}
