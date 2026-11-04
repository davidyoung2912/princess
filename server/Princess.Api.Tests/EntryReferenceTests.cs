using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The passport rules by stop and citizenship are served, with a version that changes when they do.</summary>
public class EntryReferenceTests
{
    [Fact]
    public void EveryCatalogueCountryHasARuleAndTheVersionIsStable()
    {
        var a = ReferenceRules.Entry();
        Assert.Equal(a.Rules.Count, a.Rules.Select(r => r.Country).Distinct().Count());
        Assert.All(["US", "MX", "BZ", "HN", "ES", "JP", "AU"], c => Assert.Contains(a.Rules, r => r.Country == c));
        Assert.All(a.Rules, r => Assert.InRange(r.MonthsUs, 0, 12));
        Assert.Equal(a.Version, ReferenceRules.Entry().Version);
        Assert.Equal(16, a.Version.Length);
    }
}
