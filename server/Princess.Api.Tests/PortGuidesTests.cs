using System.Net;
using System.Text.Json;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The port guides behind the Port Details page: the embedded content loads, the list and each guide agree, and the routes answer.</summary>
public class PortGuidesRulesTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void TheListNamesEveryPortWithAVersion()
    {
        var list = Parse(PortGuides.ListJson);
        var ports = list.GetProperty("ports").EnumerateArray().ToList();
        Assert.Equal(16, list.GetProperty("version").GetString()!.Length);
        Assert.True(ports.Count >= 90);
        Assert.Equal(ports.Count, ports.Select(p => p.GetProperty("id").GetString()).Distinct().Count());
        Assert.All(ports, p =>
        {
            Assert.False(string.IsNullOrWhiteSpace(p.GetProperty("id").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(p.GetProperty("name").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(p.GetProperty("shortDescription").GetString()));
            Assert.Matches("^[a-z]{2}$", p.GetProperty("countryId").GetString()!);
            Assert.False(string.IsNullOrWhiteSpace(p.GetProperty("countryName").GetString()));
        });
    }

    [Fact]
    public void EveryListedPortHasAGuideWithTheSameIdAndName()
    {
        foreach (var p in Parse(PortGuides.ListJson).GetProperty("ports").EnumerateArray())
        {
            var id = p.GetProperty("id").GetString()!;
            var guide = Parse(PortGuides.Json(id) ?? throw new Xunit.Sdk.XunitException($"no guide for {id}"));
            Assert.Equal(id, guide.GetProperty("id").GetString());
            Assert.Equal(p.GetProperty("name").GetString(), guide.GetProperty("name").GetString());
        }
    }

    [Fact]
    public void AGuideHoldsWhatThePageShows()
    {
        var g = Parse(PortGuides.Json("nassau")!);
        Assert.NotEmpty(g.GetProperty("attractions").EnumerateArray());
        Assert.NotEmpty(g.GetProperty("tips").EnumerateArray());
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("gettingAshore").GetString()));
        Assert.NotEqual(JsonValueKind.Null, g.GetProperty("stats").ValueKind);
        Assert.All(g.GetProperty("attractions").EnumerateArray(), a =>
        {
            Assert.False(string.IsNullOrWhiteSpace(a.GetProperty("tier").GetString()));
            var map = a.GetProperty("map");
            Assert.InRange(map.GetProperty("lat").GetDouble(), -90, 90);
            Assert.InRange(map.GetProperty("lng").GetDouble(), -180, 180);
        });
    }

    [Fact]
    public void AnUnknownPortHasNoGuide()
    {
        Assert.Null(PortGuides.Json("atlantis"));
        Assert.Null(PortGuides.Json(""));
    }
}

public class PortGuidesApiTests : IDisposable
{
    private readonly ApiFactory _f = new();

    public void Dispose()
    {
        _f.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task TheListAndAGuideAreServedWithNoSignIn()
    {
        using var http = _f.CreateClient();
        var list = await http.GetAsync("/api/v1/reference/port-guides");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal("application/json", list.Content.Headers.ContentType!.MediaType);
        var first = JsonDocument.Parse(await list.Content.ReadAsStringAsync()).RootElement.GetProperty("ports")[0].GetProperty("id").GetString()!;

        var one = await http.GetAsync($"/api/v1/reference/port-guides/{first}");
        Assert.Equal(HttpStatusCode.OK, one.StatusCode);
        Assert.Equal(first, JsonDocument.Parse(await one.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString());
    }

    [Fact]
    public async Task AnUnknownPortIsNotFound()
    {
        using var http = _f.CreateClient();
        var r = await http.GetAsync("/api/v1/reference/port-guides/atlantis");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }
}
