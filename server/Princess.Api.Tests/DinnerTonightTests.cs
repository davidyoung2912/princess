using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class DinnerTonightTests
{
    [Fact]
    public void PicksTheTimeNearestTheUsualOneAndTheEarlierOnATie()
    {
        Assert.Equal("19:30", DiningRules.PickNearest("19:30", ["17:30", "19:30", "20:30"]));
        Assert.Equal("19:30", DiningRules.PickNearest("19:30", ["17:30", "19:00", "19:30"]));
        Assert.Equal("19:00", DiningRules.PickNearest("19:15", ["19:00", "19:30"]));
        Assert.Equal("18:30", DiningRules.PickNearest("18:00", ["18:30", "19:00"]));
        Assert.Equal("20:00", DiningRules.PickNearest("19:30", ["20:00", "20:30", "17:30"]));
    }

    [Fact]
    public void UsesNineteenHundredWhenThereIsNoUsualTimeOrItIsNotADinnerTime()
    {
        Assert.Equal("19:00", DiningRules.PickNearest(null, ["17:30", "19:00", "20:30"]));
        Assert.Equal("19:00", DiningRules.PickNearest("", ["17:30", "19:00", "20:30"]));
        Assert.Equal("19:00", DiningRules.PickNearest("12:00", ["17:30", "19:00", "20:30"]));
    }

    [Fact]
    public void NoPossibleTimeMeansNoTable()
    {
        Assert.Null(DiningRules.PickNearest("19:00", []));
        Assert.Null(DiningRules.PickNearest("19:00", ["03:00"]));
    }
}
