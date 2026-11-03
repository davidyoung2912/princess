using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Princess.Api.Audit;
using Princess.Api.Contracts;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class AuditApiTests : IDisposable
{
    private const string Password = "Sailaway!2027";
    private readonly ApiFactory _f = new();
    private readonly HttpClient _http;

    public AuditApiTests()
    {
        _http = _f.CreateClient();
        _f.Users.Add("gerald@demo.princess.example", Password, first: "Gerald");
    }

    public void Dispose() { _http.Dispose(); _f.Dispose(); }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private Task<HttpResponseMessage> Login(string password) => _http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("gerald@demo.princess.example", password));

    private async Task<string> SignIn()
    {
        var r = await Login(Password);
        return (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!.AccessToken;
    }

    private HttpRequestMessage Authed(HttpMethod method, string url, string token)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return req;
    }

    [Fact]
    public async Task SuccessfulSignInIsRecordedWithTheAccountAndTheirAddress()
    {
        await SignIn();
        var row = Assert.Single(_f.Audit.Rows, r => r.Action == "auth.login" && r.Outcome == AuditOutcome.Success);
        Assert.Equal(AuditCategory.Auth, row.Category);
        Assert.NotNull(row.ActorPublicId);
        Assert.Equal(row.ActorPublicId, row.SubjectPublicId);
        Assert.NotNull(row.CorrelationId);
    }

    [Fact]
    public async Task FailedSignInIsRecordedWithTheReasonButNeverThePassword()
    {
        var r = await Login("not-the-password");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        var row = Assert.Single(_f.Audit.Rows, x => x.Action == "auth.login");
        Assert.Equal(AuditOutcome.Failure, row.Outcome);
        Assert.Contains("wrongPassword", row.Detail);
        Assert.DoesNotContain("not-the-password", string.Join("|", _f.Audit.Rows.Select(x => x.Detail + x.Target + x.Route)));
        // The request itself is also on the trail, as a refusal.
        Assert.Contains(_f.Audit.Rows, x => x.Category == AuditCategory.Request && x.Action == "POST /api/v1/auth/login" && x.StatusCode == 401 && x.Outcome == AuditOutcome.Denied);
    }

    [Fact]
    public async Task UnknownAccountIsRecordedAsAFingerprintNotTheTypedName()
    {
        var r = await _http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("nobody@example.com", "whatever-password"));
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        var row = Assert.Single(_f.Audit.Rows, x => x.Action == "auth.login");
        Assert.Contains("unknownAccount", row.Detail);
        Assert.DoesNotContain("nobody@example.com", row.Detail);
    }

    [Fact]
    public async Task ARequestThatChangesSomethingIsAuditedAndAPlainReadIsNot()
    {
        var token = await SignIn();
        _f.Audit.Rows.Clear();
        (await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/me", token))).Dispose();
        Assert.DoesNotContain(_f.Audit.Rows, r => r.Category == AuditCategory.Request && r.Outcome == AuditOutcome.Success && r.HttpMethod == "GET");
        var denied = await _http.SendAsync(Authed(HttpMethod.Put, "/api/v1/users/" + Guid.NewGuid() + "/profile", token));
        Assert.True((int)denied.StatusCode >= 400);
        Assert.Contains(_f.Audit.Rows, r => r.HttpMethod == "PUT" && r.ActorPublicId is not null && r.StatusCode >= 400);
    }

    [Fact]
    public async Task AProblemReportedByTheAppIsOnTheTrailScrubbedAndAgainstTheSignedInPerson()
    {
        var token = await SignIn();
        var req = Authed(HttpMethod.Post, "/api/v1/telemetry", token);
        req.Content = JsonContent.Create(new
        {
            items = new[] { new { type = "error", kind = "promise", message = "failed for maya@example.com at https://x.test/a card 4111 1111 1111 1111", at = "2027-03-21T10:00:00Z" } },
        });
        var r = await _http.SendAsync(req);
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        var row = Assert.Single(_f.Audit.Rows, x => x.Action == "client.promise");
        Assert.Equal(AuditCategory.Error, row.Category);
        Assert.NotNull(row.ActorPublicId);
        Assert.DoesNotContain("maya@example.com", row.ErrorMessage);
        Assert.DoesNotContain("4111", row.ErrorMessage);
    }

    [Fact]
    public async Task EveryAnsweredRequestCarriesAnId()
    {
        var r = await _http.GetAsync("/api/v1/me");
        Assert.True(r.Headers.Contains("X-Request-Id"));
    }

    [Fact]
    public async Task GuestReadsOnlyTheirOwnActivityNewestFirst()
    {
        var token = await SignIn();
        await Login("wrong-one-here");
        var mine = await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/me/audit", token));
        Assert.Equal(HttpStatusCode.OK, mine.StatusCode);
        var rows = (await mine.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.NotEmpty(rows);
        var times = rows.Select(r => r.GetProperty("at").GetInt64()).ToList();
        Assert.Equal(times.OrderByDescending(t => t), times);
        Assert.All(rows, r => Assert.True(r.GetProperty("byYou").GetBoolean() || r.GetProperty("forYou").GetBoolean()));
    }

    [Fact]
    public async Task OnlyAnAdministratorCanSearchEveryonesTrail()
    {
        var token = await SignIn();
        var r = await _http.SendAsync(Authed(HttpMethod.Get, "/api/v1/audit", token));
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
    }

    [Fact]
    public async Task AFailingAuditStoreNeverFailsTheGuestsRequest()
    {
        using var f = new ApiFactory();
        f.Users.Add("gerald@demo.princess.example", Password, first: "Gerald");
        f.Audit.FailWrites = true;
        using var http = f.CreateClient();
        var r = await http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("gerald@demo.princess.example", Password));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
    }
}
