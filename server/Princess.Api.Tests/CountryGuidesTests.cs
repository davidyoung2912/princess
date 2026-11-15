using System.Net;
using System.Text.Json;
using Princess.Api.Domain;
using Princess.Api.Tests.Support;

namespace Princess.Api.Tests;

/// <summary>The country profiles behind the Country Details page: the embedded content loads, every port guide points at a profile, and the route answers.</summary>
public class CountryGuidesRulesTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void ThereAreThirtyFiveProfilesEachWithItsOwnId()
    {
        Assert.Equal(35, CountryGuides.Ids.Count);
        Assert.All(CountryGuides.Ids, id =>
        {
            var g = Parse(CountryGuides.Json(id)!);
            Assert.Equal(id, g.GetProperty("id").GetString());
            Assert.Matches("^[a-z]{2}$", id);
            Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("name").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("atAGlance").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("government").GetString()));
            Assert.NotEmpty(g.GetProperty("ports").EnumerateArray());
            Assert.NotEmpty(g.GetProperty("links").EnumerateArray());
        });
    }

    [Fact]
    public void EveryPortGuideNamesAProfileThatExistsAndListsThePort()
    {
        foreach (var p in Parse(PortGuides.ListJson).GetProperty("ports").EnumerateArray())
        {
            var portId = p.GetProperty("id").GetString()!;
            var port = Parse(PortGuides.Json(portId)!);
            var countryId = port.GetProperty("countryId").GetString()!;
            var country = Parse(CountryGuides.Json(countryId) ?? throw new Xunit.Sdk.XunitException($"{portId}: no profile {countryId}"));
            Assert.Contains(country.GetProperty("ports").EnumerateArray(), c => c.GetProperty("id").GetString() == portId);
        }
    }

    [Fact]
    public void TerritoriesAreLabelledAsNotCountries()
    {
        Assert.All(new[] { "pr", "tc", "hk", "tw" }, id => Assert.False(string.IsNullOrWhiteSpace(Parse(CountryGuides.Json(id)!).GetProperty("status").GetString())));
        Assert.Equal("", Parse(CountryGuides.Json("mx")!).GetProperty("status").GetString());
    }

    [Fact]
    public void AnUnknownCodeHasNoProfile()
    {
        Assert.Null(CountryGuides.Json("zz"));
        Assert.Null(CountryGuides.Json(""));
    }
}

public class CountryGuidesApiTests : IDisposable
{
    private readonly ApiFactory _f = new();

    public void Dispose()
    {
        _f.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task AProfileIsServedWithNoSignIn()
    {
        using var http = _f.CreateClient();
        var r = await http.GetAsync("/api/v1/reference/country-guides/mx");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("Mexico", JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task AnUnknownCodeIsNotFound()
    {
        using var http = _f.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/api/v1/reference/country-guides/zz")).StatusCode);
    }
}
