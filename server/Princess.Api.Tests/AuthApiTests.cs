using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class AuthApiTests : IDisposable
{
    private const string Password = "Sailaway!2027";
    private readonly ApiFactory _f = new();
    private readonly HttpClient _http;
    private readonly UserRecord _gerald;

    public AuthApiTests()
    {
        _http = _f.CreateClient();
        _gerald = _f.Users.Add("gerald@demo.princess.example", Password, first: "Gerald");
    }

    public void Dispose()
    {
        _http.Dispose();
        _f.Dispose();
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private Task<HttpResponseMessage> Login(string identifier, string password) =>
        _http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(identifier, password));

    private async Task<SessionResponse> SignIn(string identifier = "gerald@demo.princess.example")
    {
        var r = await Login(identifier, Password);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!;
    }

    private Task<HttpResponseMessage> Refresh(string token) => _http.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(token));

    private HttpRequestMessage Authed(HttpMethod method, string url, string token, object? body = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body);
        return req;
    }

    private static async Task<(string Type, string Title)> Problem(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        var doc = await r.Content.ReadFromJsonAsync<JsonElement>();
        return (doc.GetProperty("type").GetString()!, doc.GetProperty("title").GetString()!);
    }

    [Fact]
    public async Task LoginByEmailReturnsSessionAndProfile()
    {
        var s = await SignIn();
        Assert.False(string.IsNullOrEmpty(s.AccessToken));
        Assert.False(string.IsNullOrEmpty(s.RefreshToken));
        Assert.Equal(_gerald.PublicId, s.User.Id);
        Assert.Equal("Gerald", s.User.FirstName);
        Assert.True(s.ExpiresAt > new DateTimeOffset(_f.Clock.UtcNow).ToUnixTimeMilliseconds() - 1000);
        Assert.True(s.RefreshExpiresAt > s.ExpiresAt);
    }

    [Fact]
    public async Task LoginByAccountNumberAndCaseInsensitiveEmail()
    {
        Assert.Equal(_gerald.PublicId, (await SignIn(_gerald.AccountNumber)).User.Id);
        Assert.Equal(_gerald.PublicId, (await SignIn("GERALD@Demo.Princess.Example")).User.Id);
    }

    [Fact]
    public async Task WrongPasswordUnknownUserAndChildAllLookTheSame()
    {
        var child = _f.Users.Add(null, null, supervised: true, booker: _gerald);
        var bodies = new List<(HttpStatusCode, string, string)>();
        foreach (var (id, pw) in new[] { ("gerald@demo.princess.example", "nope"), ("ghost@example.com", Password), (child.AccountNumber, Password) })
        {
            var r = await Login(id, pw);
            var (type, title) = await Problem(r);
            bodies.Add((r.StatusCode, type, title));
        }
        Assert.All(bodies, b => Assert.Equal((HttpStatusCode.Unauthorized, "forbidden", "badCredentials"), b));
    }

    [Theory]
    [InlineData("", "x")]
    [InlineData("gerald@demo.princess.example", "")]
    [InlineData(null, null)]
    public async Task MissingFieldsAreInvalid(string? id, string? pw)
    {
        var r = await Login(id!, pw!);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal(("invalid", "invalid"), await Problem(r));
    }

    [Fact]
    public async Task MalformedJsonIsInvalidNotServerError()
    {
        var r = await _http.PostAsync("/api/v1/auth/login", new StringContent("{not json", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("invalid", (await Problem(r)).Type);
    }

    [Fact]
    public async Task FiveFailuresLockTheAccountEvenForTheRightPasswordUntilItExpires()
    {
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.Unauthorized, (await Login(_gerald.Email!, "wrong")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login(_gerald.Email!, Password)).StatusCode);

        _f.Clock.UtcNow = _f.Clock.UtcNow.AddMinutes(16);
        Assert.Equal(HttpStatusCode.OK, (await Login(_gerald.Email!, Password)).StatusCode);
        Assert.Equal(0, _gerald.FailedLogins);
    }

    [Fact]
    public async Task LoginIsRateLimitedPerIp()
    {
        using var limited = new ApiFactory { LoginAttemptsPerMinute = 3 };
        limited.Users.Add("a@example.com", "pw");
        using var c = limited.CreateClient();
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++) codes.Add((await c.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("a@example.com", "bad"))).StatusCode);
        Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests], codes);
    }

    [Fact]
    public async Task ProtectedEndpointsNeedAToken()
    {
        var r = await _http.GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal(("forbidden", "unauthenticated"), await Problem(r));

        var bad = await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/me", "not.a.token"));
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
    }

    [Fact]
    public async Task MeReturnsTheSignedInPerson()
    {
        var s = await SignIn();
        var r = await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/me", s.AccessToken));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var me = (await r.Content.ReadFromJsonAsync<MeResponse>(Json))!;
        Assert.Equal(_gerald.PublicId, me.Id);
        Assert.Equal(_gerald.AccountNumber, me.AccountNumber);
        Assert.False(me.IsSupervised);
    }

    [Fact]
    public async Task ExpiredAccessTokenIsRejected()
    {
        // The host validates against real time; a token issued three hours ago has expired.
        _f.Clock.UtcNow = DateTime.UtcNow.AddHours(-3);
        var old = await SignIn();
        var r = await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/me", old.AccessToken));
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task RefreshRotatesTheToken()
    {
        var s = await SignIn();
        var r = await Refresh(s.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var next = (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        Assert.NotEqual(s.RefreshToken, next.RefreshToken);
        Assert.Equal(_gerald.PublicId, next.User.Id);
        Assert.Single(_f.RefreshTokens.Rows.Select(x => x.Record.FamilyId).Distinct());
        Assert.Equal(HttpStatusCode.OK, (await Refresh(next.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task ReplayingASpentRefreshTokenRevokesTheWholeFamily()
    {
        var first = await SignIn();
        var second = (await (await Refresh(first.RefreshToken)).Content.ReadFromJsonAsync<SessionResponse>(Json))!;

        var replay = await Refresh(first.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal("badRefreshToken", (await Problem(replay)).Title);

        // The legitimate newest token was revoked too: whoever holds it must sign in again.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(second.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task ReplayDoesNotTouchOtherSessions()
    {
        var phone = await SignIn();
        var laptop = await SignIn();
        await Refresh(phone.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(phone.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(laptop.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task ExpiredAndUnknownRefreshTokensAreRejected()
    {
        var s = await SignIn();
        _f.Clock.UtcNow = _f.Clock.UtcNow.AddDays(31);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(s.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh("made-up")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Refresh("")).StatusCode);
    }

    [Fact]
    public async Task RefreshTokensAreStoredHashedNotRaw()
    {
        var s = await SignIn();
        var row = Assert.Single(_f.RefreshTokens.Rows);
        Assert.Equal(32, row.Hash.Length);
        Assert.DoesNotContain(s.RefreshToken, Convert.ToBase64String(row.Hash));
    }

    [Fact]
    public async Task LogoutRevokesTheSession()
    {
        var s = await SignIn();
        var r = await _http.SendAsync(Authed(HttpMethod.Post, "/api/v1/auth/logout", s.AccessToken, new LogoutRequest(s.RefreshToken)));
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(s.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task LogoutIgnoresSomeoneElsesRefreshToken()
    {
        var other = _f.Users.Add("other@example.com", Password);
        var victim = await SignIn();
        var attacker = await SignIn(other.Email!);
        var r = await _http.SendAsync(Authed(HttpMethod.Post, "/api/v1/auth/logout", attacker.AccessToken, new LogoutRequest(victim.RefreshToken)));
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(victim.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task ViewAsIssuesAChildTokenForTheirBookerOnly()
    {
        var child = _f.Users.Add(null, null, supervised: true, booker: _gerald, first: "Maya");
        var stranger = _f.Users.Add("stranger@example.com", Password);

        var s = await SignIn();
        var r = await _http.SendAsync(Authed(HttpMethod.Post, $"/api/v1/me/view-as/{child.PublicId}", s.AccessToken));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var view = (await r.Content.ReadFromJsonAsync<ViewAsResponse>(Json))!;
        Assert.Equal(child.PublicId, view.User.Id);
        Assert.Equal(_gerald.PublicId, view.User.BookerId);

        // With the child token /me is the child, who is supervised.
        var me = (await (await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/me", view.AccessToken))).Content.ReadFromJsonAsync<MeResponse>(Json))!;
        Assert.Equal((child.PublicId, true), (me.Id, me.IsSupervised));

        // A view-as token cannot be chained into another view-as.
        var chained = await _http.SendAsync(Authed(HttpMethod.Post, $"/api/v1/me/view-as/{child.PublicId}", view.AccessToken));
        Assert.Equal(HttpStatusCode.Forbidden, chained.StatusCode);

        // Someone else's child, an adult, and an unknown id all give the same notFound.
        var strangerSession = await SignIn(stranger.Email!);
        foreach (var target in new[] { child.PublicId, _gerald.PublicId, Guid.NewGuid() })
        {
            var nope = await _http.SendAsync(Authed(HttpMethod.Post, $"/api/v1/me/view-as/{target}", strangerSession.AccessToken));
            Assert.Equal(HttpStatusCode.NotFound, nope.StatusCode);
            Assert.Equal("notFound", (await Problem(nope)).Type);
        }
    }

    [Fact]
    public async Task HealthIsOpenAndUnknownRoutesAreNotLeaked()
    {
        var h = await _http.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, h.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _http.GetAsync("/api/v1/nothing-here")).StatusCode);
    }

    [Fact]
    public async Task SwaggerDocumentDescribesAuthAndTheBearerScheme()
    {
        var r = await _http.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var doc = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(doc.GetProperty("paths").TryGetProperty("/api/v1/auth/login", out _));
        Assert.True(doc.GetProperty("paths").TryGetProperty("/api/v1/me", out _));
        Assert.Equal("bearer", doc.GetProperty("components").GetProperty("securitySchemes").GetProperty("Bearer").GetProperty("scheme").GetString());
    }
}
