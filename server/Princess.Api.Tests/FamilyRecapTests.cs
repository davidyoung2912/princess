using Princess.Api.Domain;
using Princess.Api.Services;
using Xunit;

namespace Princess.Api.Tests;

public class FamilyRecapTests
{
    [Fact]
    public void ARecapIsTrimmedLineByLineAndKeepsItsBreaks()
    {
        Assert.True(FamilyHomeRules.ValidRecap("  Ana and Ben’s Western Caribbean \r\n\r\n 7 nights on Sun Princess.\t\n", out var clean));
        Assert.Equal("Ana and Ben’s Western Caribbean\n7 nights on Sun Princess.", clean);
    }

    [Fact]
    public void ControlCharactersAreDroppedAndNothingIsCutToFit()
    {
        Assert.True(FamilyHomeRules.ValidRecap("Hello\u0000 there\u001b", out var clean));
        Assert.Equal("Hello there", clean);
        Assert.False(FamilyHomeRules.ValidRecap(new string('a', FamilyHomeRules.MaxRecapLine + 1), out _));
        Assert.False(FamilyHomeRules.ValidRecap(string.Join('\n', Enumerable.Repeat("line", FamilyHomeRules.MaxRecapLines + 1)), out _));
        Assert.False(FamilyHomeRules.ValidRecap(string.Join('\n', Enumerable.Repeat(new string('a', 150), 6)), out _));   // 6 x 150 = 905 with breaks
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \n \r\n ")]
    public void NothingToSayIsNotARecap(string? text) => Assert.False(FamilyHomeRules.ValidRecap(text, out _));

    [Fact]
    public void TheLimitsAreTheOnesTheDocumentationStates()
    {
        Assert.Equal(800, FamilyHomeRules.MaxRecapChars);
        Assert.Equal(12, FamilyHomeRules.MaxRecapLines);
        Assert.Equal(200, FamilyHomeRules.MaxRecapLine);
        Assert.True(FamilyHomeRules.ValidRecap(string.Join('\n', Enumerable.Repeat(new string('a', 60), 12)), out _));   // 12 x 60 + 11 = 731
    }

    [Fact]
    public void TheRecapRidesOnThePublicPageDtoAndIsOptional()
    {
        var page = new FamilyPublicDto(true, null, "Ana", 0, [], []);
        Assert.Null(page.Recap);
        Assert.Equal("text", (page with { Recap = "text" }).Recap);
    }
}
