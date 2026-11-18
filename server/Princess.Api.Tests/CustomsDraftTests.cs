using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class CustomsDraftTests
{
    private static FolioLine Line(string category, long cents, string state = FolioStates.Posted) =>
        new(Guid.NewGuid().ToString(), 3, 0, category, "x", Guid.NewGuid(), cents, null, null, state);

    [Fact]
    public void AddsUpShopPurchasesRoundedUpToAWholeDollar()
    {
        var plan = DisembarkRules.CustomsDraftFrom([Line("shops", 1899), Line("shops", 3200), Line("drinks", 1400)]);
        Assert.NotNull(plan);
        Assert.Equal(51, plan!.GoodsUsd);
        Assert.Equal(2, plan.Purchases);
    }

    [Fact]
    public void LeavesFoodAndCashToTheGuest()
    {
        var d = DisembarkRules.CustomsDraftFrom([Line("shops", 5000)])!.Declaration;
        Assert.False(d.Food);
        Assert.False(d.Cash);
        Assert.Null(DisembarkRules.CustomsProblem(d));
    }

    [Fact]
    public void IgnoresRefundedAndNonShopLinesAndHasNothingToDraftWithoutGoods()
    {
        Assert.Null(DisembarkRules.CustomsDraftFrom([Line("shops", 5000, FolioStates.Refunded), Line("spa", 15900), Line("credit", -500)]));
        Assert.Null(DisembarkRules.CustomsDraftFrom([]));
    }
}
