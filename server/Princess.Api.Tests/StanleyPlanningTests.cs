using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The Dream, Discover and Book pack, first part (phase P9f): pointers only, for a guest with no trip still to sail.</summary>
public class StanleyPlanningTests
{
    [Fact]
    public void WithoutATripItPointsToFiveScreens()
    {
        var f = StanleyPlanningRules.Findings(new PlanningFacts(false));
        Assert.Equal(["SR-1.3", "SR-2.1", "SR-2.4", "SR-2.5", "SR-3.3"], f.Select(x => x.Rule));
        Assert.All(f, x => Assert.StartsWith("/", x.Route));
    }

    [Fact]
    public void NothingWithATripToSail() => Assert.Empty(StanleyPlanningRules.Findings(new PlanningFacts(true)));

    [Fact]
    public void ItSaysWhatItCannotSee() =>
        Assert.Contains(StanleyPlanningRules.NotChecked(new PlanningFacts(false)), x => x.Contains("cannot see"));
}
