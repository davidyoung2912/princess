using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The Family pack, first part (phase P9e): kids club ready and everyone's muster. Nothing is registered, marked or sent.</summary>
public class StanleyFamilyTests
{
    private static readonly DateOnly Departure = new(2027, 1, 10);

    private static FamilyFacts On(int daysToSail, params int[] ages) => new(Departure.AddDays(-daysToSail), Departure, ages);

    [Fact]
    public void SailingDayGivesMusterForEveryone() =>
        Assert.Contains(StanleyFamilyRules.Findings(On(0, 44, 41, 16, 12)), x => x.Rule == "SR-F.4" && x.Route == "/ship/muster");

    [Fact]
    public void KidsClubCountsChildrenOfClubAge()
    {
        var x = Assert.Single(StanleyFamilyRules.Findings(On(7, 44, 41, 16, 2)), x => x.Rule == "SR-F.1");
        Assert.Contains("do not", x.Detail);
        Assert.DoesNotContain(StanleyFamilyRules.Findings(On(7, 44, 2)), x => x.Rule == "SR-F.1");
    }

    [Fact]
    public void NothingWithoutAChildOrOutsideTheWindow()
    {
        Assert.Empty(StanleyFamilyRules.Findings(On(0, 44, 41)));
        Assert.Empty(StanleyFamilyRules.Findings(On(30, 44, 12)));
        Assert.Empty(StanleyFamilyRules.Findings(On(-1, 44, 12)));
    }

    [Fact]
    public void ItSaysWhatItCannotSee() =>
        Assert.Contains(StanleyFamilyRules.NotChecked(On(1, 12)), x => x.Contains("cannot see"));
}
