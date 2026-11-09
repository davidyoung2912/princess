using Princess.Api.Domain;

namespace Princess.Api.Tests;

public class TenderRulesTests
{
    [Fact]
    public void TheSameQuestionGetsTheSameAnswer()
    {
        Assert.Equal(TenderRules.Outlook("belize", "2027-03-23"), TenderRules.Outlook("belize", "2027-03-23") with { });
    }

    [Fact]
    public void ThePercentMatchesTheBandAndAdviceGrowsWithIt()
    {
        foreach (var day in Enumerable.Range(1, 28))
        {
            var o = TenderRules.Outlook("belize", $"2027-01-{day:00}");
            Assert.Equal(o.Percent < 10 ? "good" : o.Percent < 16 ? "mixed" : "rough", o.Band);
            Assert.Equal(o.Band == "good" ? 1 : 3, o.YouCan.Length);
        }
    }

    [Fact]
    public void BadQueriesAreRefused()
    {
        Assert.False(TenderRules.ValidQuery("sea", "2027-03-23"));
        Assert.False(TenderRules.ValidQuery("belize", "2027-13-01"));
        Assert.True(TenderRules.ValidQuery("belize", "2027-03-23"));
    }
}
