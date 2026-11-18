using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class TravelStartTests
{
    private static readonly DateOnly Today = new(2026, 11, 1), Sail = new(2026, 12, 1);

    [Fact]
    public void ChoosesTheQuietestWindowTheGuestMayUse()
    {
        Assert.Equal("11:00", PlanRules.TravelStart(new(null, null, null), false, Today, Sail));
        Assert.Equal("10:30", PlanRules.TravelStart(new(null, "drive", "harbour"), true, Today, Sail));
    }

    [Fact]
    public void NeverReplacesAChosenWindowOrActsOnceTheShipHasGone()
    {
        Assert.Null(PlanRules.TravelStart(new("12:00", null, null), false, Today, Sail));
        Assert.Null(PlanRules.TravelStart(new(null, null, null), false, Sail, Sail));
    }
}
