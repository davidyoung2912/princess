using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Princess.Api.Contracts;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The refresh token as an httpOnly cookie for clients that send <c>X-Princess-Cookie</c>; clients that do not keep it in the body.</summary>
public class RefreshCookieApiTests : IDisposable
{
    private const string Password = "Sailaway!2027";
    private const string Header = "X-Princess-Cookie";
    private const string CookieName = "princess_refresh";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly ApiFactory _f = new();
    private readonly HttpClient _http;

    public RefreshCookieApiTests()
    {
        _http = _f.CreateClient();
        _f.Users.Add("gerald@demo.princess.example", Password, first: "Gerald");
    }

    public void Dispose()
    {
        _http.Dispose();
        _f.Dispose();
    }

    private static HttpRequestMessage Post(string url, object body, string? mode = null, string? cookie = null, string? bearer = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        if (mode is not null) req.Headers.Add(Header, mode);
        if (cookie is not null) req.Headers.Add("Cookie", $"{CookieName}={Uri.EscapeDataString(cookie)}");
        if (bearer is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return req;
    }

    private static string? SetCookie(HttpResponseMessage r) =>
        r.Headers.TryGetValues("Set-Cookie", out var all) ? all.FirstOrDefault(c => c.StartsWith(CookieName + "=", StringComparison.Ordinal)) : null;

    private static string ValueOf(string setCookie) => Uri.UnescapeDataString(setCookie[(CookieName.Length + 1)..].Split(';')[0]);

    private Task<HttpResponseMessage> Login(string? mode) =>
        _http.SendAsync(Post("/api/v1/auth/login", new LoginRequest("gerald@demo.princess.example", Password), mode));

    private Task<HttpResponseMessage> Refresh(string? mode, string? cookie) =>
        _http.SendAsync(Post("/api/v1/auth/refresh", new RefreshRequest(null), mode, cookie));

    [Fact]
    public async Task ASessionCookieIsHttpOnlySecureAndEndsWithTheBrowserSession()
    {
        var r = await Login("session");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var cookie = SetCookie(r);
        Assert.NotNull(cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/v1/auth", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("expires=", cookie, StringComparison.OrdinalIgnoreCase);
        var body = (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        Assert.Equal("", body.RefreshToken);
        Assert.False(string.IsNullOrEmpty(body.AccessToken));
        Assert.False(string.IsNullOrEmpty(ValueOf(cookie)));
    }

    [Fact]
    public async Task APersistentCookieLastsAsLongAsTheRefreshToken()
    {
        var cookie = SetCookie(await Login("persist"));
        Assert.NotNull(cookie);
        Assert.Contains("expires=", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task WithoutTheHeaderTheTokenStaysInTheBodyAndNoCookieIsSet()
    {
        var r = await Login(null);
        Assert.Null(SetCookie(r));
        Assert.False(string.IsNullOrEmpty((await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!.RefreshToken));
    }

    [Fact]
    public async Task RefreshReadsTheCookieAndSetsANewOne()
    {
        var first = ValueOf(SetCookie(await Login("session"))!);
        var r = await Refresh("session", first);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var next = SetCookie(r);
        Assert.NotNull(next);
        Assert.NotEqual(first, ValueOf(next));
        Assert.Equal("", (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!.RefreshToken);
    }

    [Fact]
    public async Task TheCookieIsIgnoredWithoutTheHeader()
    {
        // The header is the CSRF guard: a request that carries only the cookie (what a cross-site form would send) is not a refresh.
        var cookie = ValueOf(SetCookie(await Login("session"))!);
        Assert.Equal(HttpStatusCode.BadRequest, (await Refresh(null, cookie)).StatusCode);
    }

    [Fact]
    public async Task ASecondTabAskingAMomentLaterIsToldToAskAgainInsteadOfEndingTheSession()
    {
        var first = ValueOf(SetCookie(await Login("session"))!);
        var winner = await Refresh("session", first);
        Assert.Equal(HttpStatusCode.OK, winner.StatusCode);
        var loser = await Refresh("session", first);
        Assert.Equal(HttpStatusCode.Conflict, loser.StatusCode);
        var doc = await loser.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("refreshRaced", doc.GetProperty("title").GetString());
        // The winner's session is still alive.
        Assert.Equal(HttpStatusCode.OK, (await Refresh("session", ValueOf(SetCookie(winner)!))).StatusCode);
    }

    [Fact]
    public async Task ASpentTokenReturningLaterStillEndsTheWholeSession()
    {
        var first = ValueOf(SetCookie(await Login("session"))!);
        var winner = await Refresh("session", first);
        _f.Clock.UtcNow = _f.Clock.UtcNow.AddSeconds(30);
        var replay = await Refresh("session", first);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh("session", ValueOf(SetCookie(winner)!))).StatusCode);
    }

    [Fact]
    public async Task LogoutRevokesTheCookieSessionAndClearsTheCookie()
    {
        var login = await Login("session");
        var cookie = ValueOf(SetCookie(login)!);
        var access = (await login.Content.ReadFromJsonAsync<SessionResponse>(Json))!.AccessToken;
        var r = await _http.SendAsync(Post("/api/v1/auth/logout", new LogoutRequest(null), "session", cookie, access));
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        var cleared = SetCookie(r);
        Assert.NotNull(cleared);
        Assert.True(ValueOf(cleared) == "" || cleared.Contains("expires=", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh("session", cookie)).StatusCode);
    }
}
