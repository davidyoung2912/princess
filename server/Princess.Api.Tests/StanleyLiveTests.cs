using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Short live ship answers (docs/stanley-answers-plan.md, phase 3b): read at the moment of the question, short, with a link for the long ones, and abstaining when the sailing is not under way.</summary>
public class StanleyLiveTests
{
    private static readonly DateTime Now = new(2027, 3, 22, 17, 0, 0, DateTimeKind.Utc);

    private static StanleyTrip Trip(int departureDay = 20) => new(new DateOnly(2027, 3, 22), new DateOnly(2027, 3, departureDay), 7, "Sun Princess", "Balcony", "late", [41], [], [], [], null, Now);

    private static StanleyCardDto Ask(string question, StanleyTrip? trip = null) => StanleyLive.Resolve(question, trip ?? Trip(), Now) ?? throw new InvalidOperationException("No live card took: " + question);

    [Theory]
    [InlineData("nextPort", "What is the next port?")]
    [InlineData("weather", "What's the weather like?")]
    [InlineData("seaState", "How rough is the sea?")]
    [InlineData("onNext", "What's on in the next hour?")]
    public void EachLiveTopicAnswersWithAShortCardReadAtTheMomentOfTheQuestion(string id, string question)
    {
        var card = Ask(question);
        Assert.Equal(id, card.Id);
        Assert.False(card.Abstained);
        Assert.InRange(card.Lines.Count, 1, 4);
        Assert.Equal(([StanleyChips.Live], Now, "live"), (card.Provenance.Chips, card.Provenance.DataTime, card.Provenance.Freshness));
        Assert.NotEmpty(card.Links ?? []);
    }

    [Fact]
    public void ALongWeatherQuestionIsOneSentenceAndThePillToTheScreen()
    {
        var card = Ask("What is the weather forecast for the week?");
        Assert.Single(card.Lines);
        Assert.Contains(card.Links!, l => l.Path == "/plan/weather");
    }

    [Fact]
    public void WithTheSailingNotUnderWayTheCardAbstainsAndNeverGuesses()
    {
        var card = Ask("What is the next port?", Trip(departureDay: 28));
        Assert.True(card.Abstained);
        Assert.Contains("cannot confirm", card.Lines[0]);
    }

    [Fact]
    public void OtherQuestionsAreLeftAlone()
    {
        foreach (var other in new[] { "Where is the ship today?", "What time is all aboard?", "Compare the reef snorkel and the Mayan ruins", "What is on my bill?" })
            Assert.Null(StanleyLive.Resolve(other, Trip(), Now));
    }
}
