using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class CelebrationRulesTests
{
    private static CelebrationInputView Item(string id = "a", string label = "Maya's birthday", string date = "2015-03-22") => new(id, label, date);

    [Theory]
    [InlineData("2015-03-22", "03-22")]
    [InlineData("03-22", "03-22")]
    [InlineData("2016-02-29", "02-29")]
    [InlineData("02-30", null)]
    [InlineData("13-01", null)]
    [InlineData("00-10", null)]
    [InlineData("2015-3-22", null)]
    [InlineData("ab-cd", null)]
    [InlineData("", null)]
    public void OnlyARealMonthAndDayIsKept(string date, string? expected) => Assert.Equal(expected, CelebrationRules.MonthDay(date));

    [Fact]
    public void LabelsHaveTheirSpacesCollapsedAndAreLimited()
    {
        Assert.Equal("Maya birthday", CelebrationRules.CleanLabel("  Maya   birthday "));
        Assert.Null(CelebrationRules.CleanLabel("   "));
        Assert.Null(CelebrationRules.CleanLabel(new string('x', 41)));
        Assert.NotNull(CelebrationRules.CleanLabel(new string('x', 40)));
    }

    [Fact]
    public void AGoodListHasNoProblem()
    {
        Assert.Null(CelebrationRules.Problem([Item("a"), Item("b", "Anniversary", "06-01")]));
        Assert.Null(CelebrationRules.Problem([]));
    }

    [Fact]
    public void ABadListSaysWhy()
    {
        Assert.Equal("badCelebrations", CelebrationRules.Problem(null));
        Assert.Equal("badCelebrations", CelebrationRules.Problem([Item("a"), Item("a")]));
        Assert.Equal("badCelebrations", CelebrationRules.Problem([Item("bad id")]));
        Assert.Equal("badLabel", CelebrationRules.Problem([Item(label: " ")]));
        Assert.Equal("badDate", CelebrationRules.Problem([Item(date: "2015-02-31")]));
        Assert.Equal("tooManyCelebrations", CelebrationRules.Problem(Enumerable.Range(0, CelebrationRules.MaxItems + 1).Select(i => Item($"i{i}")).ToList()));
    }
}
