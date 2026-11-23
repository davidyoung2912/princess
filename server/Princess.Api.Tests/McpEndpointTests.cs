using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Princess.Api.Contracts;
using Princess.Api.Services.Mcp;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The public MCP endpoint over HTTP (docs/mcp-integration-plan.md, phase 7). Written and compiled; not run, per the working rules.</summary>
public class McpEndpointTests : IDisposable
{
    private const string Password = "Sailaway!2027";
    private readonly ApiFactory _f = new();
    private readonly HttpClient _http;

    public McpEndpointTests()
    {
        _http = _f.CreateClient();
        _f.Users.Add("gerald@demo.princess.example", Password, first: "Gerald");
    }

    public void Dispose() { _http.Dispose(); _f.Dispose(); }

    private async Task<HttpResponseMessage> Post(string body, bool signedIn = true)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/mcp") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (signedIn)
        {
            var login = await _http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("gerald@demo.princess.example", Password));
            var token = (await login.Content.ReadFromJsonAsync<SessionResponse>(new JsonSerializerOptions(JsonSerializerDefaults.Web)))!.AccessToken;
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return await _http.SendAsync(req);
    }

    [Fact]
    public async Task NeedsASignIn() => Assert.Equal(HttpStatusCode.Unauthorized, (await Post("""{"jsonrpc":"2.0","id":1,"method":"ping"}""", signedIn: false)).StatusCode);

    [Fact]
    public async Task InitializeNegotiatesTheVersionAndIssuesASessionId()
    {
        var r = await Post("""{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}""");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.True(r.Headers.Contains("Mcp-Session-Id"));
        var body = JsonNode.Parse(await r.Content.ReadAsStringAsync())!;
        Assert.Equal("2024-11-05", body["result"]!["protocolVersion"]!.GetValue<string>());
        var other = JsonNode.Parse(await (await Post("""{"jsonrpc":"2.0","id":2,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}""")).Content.ReadAsStringAsync())!;
        Assert.Equal(PrincessMcpServer.SupportedVersions[0], other["result"]!["protocolVersion"]!.GetValue<string>());
    }

    [Fact]
    public async Task ANotificationAnswers202AndABatchAnswersAnArray()
    {
        Assert.Equal(HttpStatusCode.Accepted, (await Post("""{"jsonrpc":"2.0","method":"notifications/initialized"}""")).StatusCode);
        var batch = JsonNode.Parse(await (await Post("""[{"jsonrpc":"2.0","id":1,"method":"ping"},{"jsonrpc":"2.0","id":2,"method":"tools/list"},{"jsonrpc":"2.0","method":"notifications/initialized"}]""")).Content.ReadAsStringAsync())!.AsArray();
        Assert.Equal(2, batch.Count);
    }

    [Fact]
    public async Task RefusesBadJsonAndOversizedBodies()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("{not json")).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await Post(new string('x', 20_000))).StatusCode);
    }

    [Fact]
    public async Task GetIsNotAllowed()
    {
        var login = await _http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("gerald@demo.princess.example", Password));
        var token = (await login.Content.ReadFromJsonAsync<SessionResponse>(new JsonSerializerOptions(JsonSerializerDefaults.Web)))!.AccessToken;
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/v1/mcp");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await _http.SendAsync(req)).StatusCode);
    }
}
