using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The passport rules by stop and citizenship are served, with a version that changes when they do.</summary>
public class EntryReferenceTests
{
    [Fact]
    public void EveryStopHasARuleAndTheVersionIsStable()
    {
        var a = ReferenceRules.Entry();
        Assert.Equal(["fll", "cozumel", "belize", "roatan"], a.Rules.Select(r => r.Port));
        Assert.All(a.Rules, r => Assert.InRange(r.MonthsUs, 0, 12));
        Assert.Equal(a.Version, ReferenceRules.Entry().Version);
        Assert.Equal(16, a.Version.Length);
    }
}
