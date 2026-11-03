using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class SeaRulesTests
{
    [Fact]
    public void TextHasItsSpacesCollapsedAndIsLimited()
    {
        Assert.Equal("Thank you so much", SeaRules.CleanThanks("  Thank   you so  much "));
        Assert.Null(SeaRules.CleanThanks("   "));
        Assert.Null(SeaRules.CleanThanks(new string('x', SeaRules.MaxThanks + 1)));
        Assert.NotNull(SeaRules.CleanThanks(new string('x', SeaRules.MaxThanks)));
    }

    [Fact]
    public void TeamAndWishHaveTheirOwnLimits()
    {
        Assert.Null(SeaRules.CleanTeam(new string('x', SeaRules.MaxTeam + 1)));
        Assert.NotNull(SeaRules.CleanTeam("Soleil Dining Room"));
        Assert.Null(SeaRules.CleanWish(null));
        Assert.Null(SeaRules.CleanWish(new string('x', SeaRules.MaxWish + 1)));
        Assert.Equal("Happy day", SeaRules.CleanWish(" Happy  day "));
    }
}
