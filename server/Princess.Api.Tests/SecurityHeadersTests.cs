using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

public class SecurityHeadersTests : IDisposable
{
    private readonly ApiFactory _f = new();

    public void Dispose()
    {
        _f.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task DataRoutesAreNotFramedSniffedOrCached()
    {
        using var http = _f.CreateClient();
        var r = await http.GetAsync("/health");
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", r.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", r.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("frame-ancestors 'none'", r.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Contains("no-store", r.Headers.GetValues("Cache-Control").Single());
    }

    [Fact]
    public async Task ErrorAnswersCarryTheHeadersToo()
    {
        using var http = _f.CreateClient();
        var r = await http.GetAsync("/api/v1/trips");   // no token
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Fact]
    public async Task SecurityTxtIsPublicPlainText()
    {
        using var http = _f.CreateClient();
        var r = await http.GetAsync("/.well-known/security.txt");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
        Assert.StartsWith("text/plain", r.Content.Headers.ContentType!.ToString());
        Assert.Contains("Contact:", await r.Content.ReadAsStringAsync());
    }
}
