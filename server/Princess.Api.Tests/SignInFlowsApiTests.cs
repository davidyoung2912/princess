using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Princess.Api.Auth;
using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class SignInFlowsApiTests : IDisposable
{
    private const string Password = "Sailaway!2027";
    private readonly ApiFactory _f = new();
    private readonly HttpClient _http;
    private readonly UserRecord _gerald;

    public SignInFlowsApiTests()
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

    private Task<HttpResponseMessage> Post(string path, object body) => _http.PostAsJsonAsync("/api/v1/auth/" + path, body);

    private string LastCode()
    {
        var m = Regex.Match(_f.SignIn.Outbox.Last().Body, @"code is (\d{6})");
        Assert.True(m.Success);
        return m.Groups[1].Value;
    }

    private static string Dob(int yearsAgo) => DateTime.UtcNow.AddYears(-yearsAgo).AddDays(-2).ToString("yyyy-MM-dd");

    [Fact]
    public async Task RegisterCreatesAnAccountAndSignsIn()
    {
        var r = await Post("register", new RegisterRequest(" New.Guest@Example.com ", "a-long-password", "Nia", "Guest", Dob(30)));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var s = (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        Assert.Equal("new.guest@example.com", s.User.Email);
        Assert.Equal("Nia", s.User.FirstName);
        Assert.Equal(HttpStatusCode.OK, (await Post("login", new LoginRequest("new.guest@example.com", "a-long-password"))).StatusCode);
    }

    [Theory]
    [InlineData("not-an-email", "a-long-password", 30)]
    [InlineData("a@example.com", "short", 30)]
    [InlineData("a@example.com", "a-long-password", 12)]
    public async Task RegisterRefusesBadInput(string email, string password, int age)
    {
        var r = await Post("register", new RegisterRequest(email, password, "A", "B", Dob(age)));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task RegisterRefusesAnAddressInUse()
    {
        var r = await Post("register", new RegisterRequest("GERALD@demo.princess.example", "a-long-password", "A", "B", Dob(30)));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
    }

    [Fact]
    public async Task ASecondSignUpWithTheSameNameAndBirthdayAsksFirstThenFlagsForAPerson()
    {
        var dob = Dob(40);
        Assert.Equal(HttpStatusCode.OK, (await Post("register", new RegisterRequest("one@example.com", "a-long-password", "Zoë", "Marsh", dob))).StatusCode);
        // Same name (ignoring case) and birthday, another address: asked, not created, and nobody is named.
        var ask = await Post("register", new RegisterRequest("two@example.com", "a-long-password", "ZOË", "marsh", dob));
        Assert.Equal(HttpStatusCode.Conflict, ask.StatusCode);
        Assert.Contains("possibleDuplicate", await ask.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("login", new LoginRequest("two@example.com", "a-long-password"))).StatusCode);
        // The person says they are different: created, and flagged for a person to check.
        var ok = await Post("register", new RegisterRequest("two@example.com", "a-long-password", "ZOË", "marsh", dob, true));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.True((await ok.Content.ReadFromJsonAsync<SessionResponse>(Json))!.User.NeedsReview);
        // A different birthday is not a match.
        Assert.Equal(HttpStatusCode.OK, (await Post("register", new RegisterRequest("three@example.com", "a-long-password", "Zoë", "Marsh", Dob(41)))).StatusCode);
    }

    [Fact]
    public async Task ForgotAnswersTheSameForUnknownAddresses()
    {
        Assert.Equal(HttpStatusCode.NoContent, (await Post("forgot", new CodeRequest("ghost@example.com"))).StatusCode);
        Assert.Empty(_f.SignIn.Outbox);
        Assert.Equal(HttpStatusCode.NoContent, (await Post("forgot", new CodeRequest(_gerald.Email))).StatusCode);
        Assert.Single(_f.SignIn.Outbox);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("forgot", new CodeRequest("nonsense"))).StatusCode);
    }

    [Fact]
    public async Task ResetWithTheCodeSetsThePasswordAndEndsOldSessions()
    {
        var old = (await (await Post("login", new LoginRequest(_gerald.Email, Password))).Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        await Post("forgot", new CodeRequest(_gerald.Email));
        var code = LastCode();

        var r = await Post("reset", new ResetRequest(_gerald.Email, code, "a-brand-new-password"));
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("login", new LoginRequest(_gerald.Email, Password))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post("login", new LoginRequest(_gerald.Email, "a-brand-new-password"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("refresh", new RefreshRequest(old.RefreshToken))).StatusCode);
        // The code works once.
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, code, "another-new-password"))).StatusCode);
    }

    [Fact]
    public async Task SignOutEverywhereEndsEverySessionButKeepsThePassword()
    {
        var one = (await (await Post("login", new LoginRequest(_gerald.Email, Password))).Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        var two = (await (await Post("login", new LoginRequest(_gerald.Email, Password))).Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout-all");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", one.AccessToken);
        Assert.Equal(HttpStatusCode.NoContent, (await _http.SendAsync(req)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("refresh", new RefreshRequest(one.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("refresh", new RefreshRequest(two.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post("login", new LoginRequest(_gerald.Email, Password))).StatusCode);
    }

    private HttpRequestMessage Authed(HttpMethod method, string url, string token, object? body = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body, options: Json);
        return req;
    }

    [Fact]
    public async Task TheDeviceListMarksThisDeviceAndSignsAnotherOut()
    {
        var one = (await (await Post("login", new LoginRequest(_gerald.Email, Password))).Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        var two = (await (await Post("login", new LoginRequest(_gerald.Email, Password))).Content.ReadFromJsonAsync<SessionResponse>(Json))!;
        var list = (await (await _http.SendAsync(Authed(HttpMethod.Post, "/api/v1/auth/sessions/list", one.AccessToken, new SessionListRequest(one.RefreshToken)))).Content
            .ReadFromJsonAsync<List<DeviceSessionDto>>(Json))!;
        Assert.Equal(2, list.Count);
        var mine = Assert.Single(list, d => d.Current);
        var other = Assert.Single(list, d => !d.Current);
        Assert.NotEqual(mine.Id, other.Id);

        Assert.Equal(HttpStatusCode.NoContent, (await _http.SendAsync(Authed(HttpMethod.Delete, $"/api/v1/auth/sessions/{other.Id}", one.AccessToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("refresh", new RefreshRequest(two.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.SendAsync(Authed(HttpMethod.Delete, $"/api/v1/auth/sessions/{other.Id}", one.AccessToken))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post("refresh", new RefreshRequest(one.RefreshToken))).StatusCode);
    }

    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Safari on iPhone")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0", "Edge on Windows")]
    [InlineData(null, "Unknown device")]
    public void ADeviceGetsAShortName(string? userAgent, string expected) => Assert.Equal(expected, DeviceLabel.From(userAgent));

    [Fact]
    public async Task ACodeDiesAfterFiveWrongTriesAndAfterFifteenMinutes()
    {
        await Post("forgot", new CodeRequest(_gerald.Email));
        var code = LastCode();
        var wrong = code == "000000" ? "000001" : "000000";
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, wrong, "a-brand-new-password"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, code, "a-brand-new-password"))).StatusCode);

        await Post("forgot", new CodeRequest(_gerald.Email));
        var fresh = LastCode();
        _f.Clock.UtcNow = _f.Clock.UtcNow.AddMinutes(16);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, fresh, "a-brand-new-password"))).StatusCode);
    }

    [Fact]
    public async Task OnlyThreeCodesAnHourPerAccountAndPurpose()
    {
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.NoContent, (await Post("forgot", new CodeRequest(_gerald.Email))).StatusCode);
        Assert.Equal(3, _f.SignIn.Outbox.Count);
        // Sign-in codes have their own allowance.
        await Post("magic", new CodeRequest(_gerald.Email));
        Assert.Equal(4, _f.SignIn.Outbox.Count);
        _f.Clock.UtcNow = _f.Clock.UtcNow.AddMinutes(61);
        await Post("forgot", new CodeRequest(_gerald.Email));
        Assert.Equal(5, _f.SignIn.Outbox.Count);
    }

    [Fact]
    public async Task WrongTriesCarryOverToAFreshCode()
    {
        for (var round = 0; round < 3; round++)
        {
            await Post("forgot", new CodeRequest(_gerald.Email));
            var wrong = LastCode() == "000000" ? "111111" : "000000";
            for (var i = 0; i < 4; i++) await Post("reset", new ResetRequest(_gerald.Email, wrong, "a-brand-new-password"));
        }
        // Ten wrong tries this hour: even the right code is refused now.
        var challenge = _f.SignIn.Challenges.Last();
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, LastCode(), "a-brand-new-password"))).StatusCode);
        Assert.Null(challenge.UsedAt);
    }

    [Fact]
    public async Task CodesAreStoredSaltedAndKeyed()
    {
        await Post("forgot", new CodeRequest(_gerald.Email));
        var rec = _f.SignIn.Challenges.Single().Record;
        Assert.Equal(16, rec.Salt!.Length);
        var plain = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"reset:{_gerald.Id}:{LastCode()}"));
        Assert.NotEqual(plain, rec.CodeHash);
    }

    [Fact]
    public async Task ANewCodeSpendsTheOldOne()
    {
        await Post("forgot", new CodeRequest(_gerald.Email));
        var first = LastCode();
        await Post("forgot", new CodeRequest(_gerald.Email));
        var second = LastCode();
        if (first != second) Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, first, "a-brand-new-password"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Post("reset", new ResetRequest(_gerald.Email, second, "a-brand-new-password"))).StatusCode);
    }

    [Fact]
    public async Task AResetCodeCannotSignInAndAMagicCodeCannotReset()
    {
        await Post("forgot", new CodeRequest(_gerald.Email));
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("magic/redeem", new MagicRedeemRequest(_gerald.Email, LastCode()))).StatusCode);
        await Post("magic", new CodeRequest(_gerald.Email));
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("reset", new ResetRequest(_gerald.Email, LastCode(), "a-brand-new-password"))).StatusCode);
    }

    [Fact]
    public async Task MagicCodeSignsInOnce()
    {
        await Post("magic", new CodeRequest(_gerald.Email));
        var code = LastCode();
        var r = await Post("magic/redeem", new MagicRedeemRequest(_gerald.Email, code));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(_gerald.PublicId, (await r.Content.ReadFromJsonAsync<SessionResponse>(Json))!.User.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("magic/redeem", new MagicRedeemRequest(_gerald.Email, code))).StatusCode);
    }

    [Fact]
    public async Task ChildAccountsGetNoCode()
    {
        var child = _f.Users.Add("kid@example.com", null, supervised: true, booker: _gerald);
        Assert.Equal(HttpStatusCode.NoContent, (await Post("magic", new CodeRequest(child.Email))).StatusCode);
        Assert.Empty(_f.SignIn.Outbox);
    }

    [Theory]
    [InlineData("a@example.com", true)]
    [InlineData("A@Example.COM", true)]
    [InlineData("a@localhost", false)]
    [InlineData("Name <a@example.com>", false)]
    [InlineData("", false)]
    public void EmailNormalising(string email, bool ok) => Assert.Equal(ok, AuthService.NormaliseEmail(email) is not null);

    [Fact]
    public void AgeRule()
    {
        var today = new DateOnly(2026, 11, 1);
        Assert.True(AuthService.AdultOn(new DateOnly(2008, 11, 1), today));
        Assert.False(AuthService.AdultOn(new DateOnly(2008, 11, 2), today));
        Assert.False(AuthService.AdultOn(new DateOnly(1800, 1, 1), today));
    }
}
