using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>docs/chat-stanley-plan.md, phase 1: Stanley's chat voice. Kind, quiet about declines, never reveals a block, never says "AI".</summary>
public class ChatStanleyVoiceTests
{
    private static IEnumerable<string> EveryLine() =>
        ChatStanleyVoice.All().Values.Concat([ChatStanleyVoice.Incoming("Sam R."), ChatStanleyVoice.Declined("Sam R.")]);

    [Fact]
    public void ADeclineNeverSaysRejectedOrWhy()
    {
        var line = ChatStanleyVoice.Declined("Sam R.");
        Assert.DoesNotContain("reject", line, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("declin", line, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("because", line, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Sam R.", line);
    }

    [Fact]
    public void NoLineSaysAIOrShowsAWordFilterWord()
    {
        foreach (var line in EveryLine())
        {
            Assert.DoesNotMatch(@"\bAI\b", line);
            Assert.False(ProfanityFilter.IsBlocked(line));
        }
    }

    [Fact]
    public void ANoteIsGivenForTheRequestKindsAndNotForAConnection()
    {
        Assert.Equal(ChatStanleyVoice.Waiting, ChatStanleyVoice.Note("outgoing", "Sam R."));
        Assert.Contains("Sam R.", ChatStanleyVoice.Note("incoming", "Sam R."));
        Assert.Contains("Sam R.", ChatStanleyVoice.Note("declined", "Sam R."));
        Assert.Null(ChatStanleyVoice.Note("connected", "Sam R."));
        Assert.Null(ChatStanleyVoice.Note("approval", "Sam R."));
    }

    [Fact]
    public void AWaitingRequestAndABlockedOneReadTheSame() =>
        // The sender of a request to someone who blocked them is shown the ordinary waiting line (the service builds it from the same constant).
        Assert.Equal(ChatStanleyVoice.Note("outgoing", "Anyone"), ChatStanleyVoice.Waiting);

    [Theory]
    [InlineData("cooldown")]
    [InlineData("tooManyOpen")]
    [InlineData("tooMany")]
    [InlineData("alreadyAsked")]
    public void EachRequestProblemHasAKindLine(string title) => Assert.False(string.IsNullOrWhiteSpace(ChatStanleyVoice.ForProblem(title)));

    [Theory]
    [InlineData("notFound")]
    [InlineData(null)]
    public void OtherProblemsKeepTheirOwnWording(string? title) => Assert.Null(ChatStanleyVoice.ForProblem(title));

    [Fact]
    public void TheLinesCarryNoLinkOrNumber()
    {
        foreach (var line in EveryLine())
        {
            Assert.DoesNotContain("http", line);
            Assert.DoesNotMatch(@"\d{5,}", line);
        }
    }

    [Fact]
    public void TheRequestNoticeStillNamesOnlyAShortNameAndOffersANotNow()
    {
        var (title, body) = ChatConnectionRules.RequestNotice("Sam R.");
        Assert.Equal("Sam R. wants to chat", title);
        Assert.Contains("not now", body);
    }
}
