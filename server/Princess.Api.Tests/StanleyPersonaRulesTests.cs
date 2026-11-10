using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-features-research.md, section 15 and phase 0a: who Stanley speaks for at each of the eleven stages, and the lines that mark a change. Written, not run here: the owner runs the server tests.</summary>
public class StanleyPersonaRulesTests
{
    [Theory]
    [InlineData("dream", "company")]
    [InlineData("discover", "company")]
    [InlineData("book", "company")]
    [InlineData("manage", "company")]
    [InlineData("prebook", "company")]
    [InlineData("getToShip", "company")]
    [InlineData("embark", "ship")]
    [InlineData("sea", "ship")]
    [InlineData("port", "ship")]
    [InlineData("disembark", "ship")]
    [InlineData("remember", "company")]
    public void TheVoiceIsTheCompanyBeforeAndAfterTheTripAndTheShipWhileAboard(string stage, string voice) =>
        Assert.Equal(voice, StanleyPersonaRules.For(stage, "Sun Princess").Voice);

    [Fact]
    public void EveryStageIsCovered() =>
        Assert.All(StageRules.All, stage => Assert.Contains(StanleyPersonaRules.For(stage, "Sun Princess").Voice, new[] { "company", "ship" }));

    [Fact]
    public void TheSubtitleIsTheCompanyNameOrTheShipsName()
    {
        Assert.Equal("Princess Cruises", StanleyPersonaRules.For(StageRules.Book, "Sun Princess").Subtitle);
        Assert.Equal("Sun Princess", StanleyPersonaRules.For(StageRules.Sea, "Sun Princess").Subtitle);
        Assert.Equal("Princess Cruises", StanleyPersonaRules.For(StageRules.Remember, "Sun Princess").Subtitle);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void AShipStageWithNoShipNameFallsBackToTheCompanyRatherThanAnEmptySubtitle(string? ship) =>
        Assert.Equal(new StanleyPersona("company", "Princess Cruises"), StanleyPersonaRules.For(StageRules.Sea, ship));

    [Fact]
    public void TwoBookingsGiveTheShipOfTheSailingTheStageIsAbout()
    {
        // The caller passes the ship of the focus sailing, so the other booking's ship never shows.
        Assert.Equal("Sky Princess", StanleyPersonaRules.For(StageRules.Port, "Sky Princess").Subtitle);
        Assert.Equal("Sun Princess", StanleyPersonaRules.For(StageRules.Port, "Sun Princess").Subtitle);
    }

    [Theory]
    [InlineData("sun-princess", "Sun Princess")]
    [InlineData("sapphire-princess", "Sapphire Princess")]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void AShipNameCanBeReadFromItsId(string? id, string? name) => Assert.Equal(name, StanleyPersonaRules.ShipNameFromId(id));

    [Fact]
    public void BoardingFlipsTheVoiceToTheShipAndTheEndOfTheTripFlipsItBack()
    {
        var company = StanleyPersonaRules.For(StageRules.GetToShip, "Sun Princess");
        var ship = StanleyPersonaRules.For(StageRules.Embark, "Sun Princess");
        Assert.Equal("You're aboard. I'm now speaking for Sun Princess.", StanleyPersonaRules.ChangeLine(company, ship));
        Assert.Equal("Welcome home. I'm speaking for Princess Cruises again.", StanleyPersonaRules.ChangeLine(ship, StanleyPersonaRules.For(StageRules.Remember, null)));
    }

    [Fact]
    public void NothingIsSaidWhenTheVoiceDoesNotChangeOrNoneWasSetYet()
    {
        var sea = StanleyPersonaRules.For(StageRules.Sea, "Sun Princess");
        Assert.Null(StanleyPersonaRules.ChangeLine(sea, StanleyPersonaRules.For(StageRules.Port, "Sun Princess")));
        Assert.Null(StanleyPersonaRules.ChangeLine(null, sea));
    }

    [Fact]
    public void AnotherShipIsNamedWithoutSayingTheGuestIsAboardAgain() =>
        Assert.Equal("I'm now speaking for Sky Princess.", StanleyPersonaRules.ChangeLine(StanleyPersonaRules.For(StageRules.Sea, "Sun Princess"), StanleyPersonaRules.For(StageRules.Sea, "Sky Princess")));

    [Fact]
    public void TheWelcomeSaysWhoStanleyIsAndThatThreadCannotBeRemoved()
    {
        var text = StanleyPersonaRules.Welcome("Daniel");
        Assert.StartsWith("Hello, Daniel.", text);
        Assert.Contains("Stanley", text);
        Assert.Contains("cannot be removed", text);
        Assert.StartsWith("Hello.", StanleyPersonaRules.Welcome(null));
    }

    [Fact]
    public void NoGuestFacingStanleyWordingSaysAI()
    {
        var words = new List<string> { StanleyPersonaRules.Welcome("Daniel"), StanleyPersonaRules.NeverAsk, StanleyPersonaRules.Name, StanleyPersonaRules.CompanyName };
        foreach (var stage in StageRules.All)
            foreach (var ship in new[] { "Sun Princess", "Sky Princess" })
                words.Add(StanleyPersonaRules.ChangeLine(StanleyPersonaRules.For(StageRules.Book, ship), StanleyPersonaRules.For(stage, ship)) ?? "");
        Assert.All(words, w => Assert.DoesNotMatch(@"\bAI\b", w));
    }
}
