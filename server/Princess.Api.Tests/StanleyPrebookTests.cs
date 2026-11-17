using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The Manage and Prebook pack, first part (phase P9b): one "what to expect" note with one action, and a dinner poll offered to a party of three or more. Nothing is started or sent.</summary>
public class StanleyPrebookTests
{
    private static readonly DateOnly Today = new(2027, 1, 10);

    private static PrebookFacts Facts(int toGo = 30, int adults = 2, int tours = 0, int dinners = 0, PollGap[]? polls = null, DateOnly? due = null) =>
        new(Today, Today.AddDays(toGo), 7, adults, tours, dinners, due, Today.AddDays(toGo - 20), polls ?? []);

    [Fact]
    public void ExpectIsOneNoteWithOneAction()
    {
        var f = Assert.Single(StanleyPrebookRules.Findings(Facts()));
        Assert.Equal("SR-4.5", f.Rule);
        Assert.Contains("30 days", f.Detail);
        Assert.Equal("/plan/dining", f.Route);
    }

    [Fact]
    public void TheNextStepMovesOnWhenDinnerAndToursAreBooked()
    {
        Assert.Equal("/plan/excursions", StanleyPrebookRules.Findings(Facts(dinners: 1)).Single().Route);
        Assert.Equal("/plan/autopilot", StanleyPrebookRules.Findings(Facts(dinners: 1, tours: 1)).Single().Route);
    }

    [Fact]
    public void TheNearestDateIsNamed()
    {
        var f = StanleyPrebookRules.Findings(Facts(due: Today.AddDays(3))).Single();
        Assert.Contains("final payment is due", f.Detail);
    }

    [Fact]
    public void NoExpectNoteFarOutOrAfterSailing()
    {
        Assert.Empty(StanleyPrebookRules.Findings(Facts(toGo: 200)));
        Assert.Empty(StanleyPrebookRules.Findings(Facts(toGo: -2)));
    }

    [Fact]
    public void ADinnerPollIsOfferedOnlyToThreeOrMoreAdultsWithoutOne()
    {
        Assert.DoesNotContain(StanleyPrebookRules.Findings(Facts(adults: 2)), x => x.Rule == "SR-5.4");
        Assert.Contains(StanleyPrebookRules.Findings(Facts(adults: 4)), x => x.Rule == "SR-5.4" && x.Route == "/plan/group-poll");
        Assert.DoesNotContain(StanleyPrebookRules.Findings(Facts(adults: 4, polls: [new("Which dinner night?", 1, 2)])), x => x.Rule == "SR-5.4");
    }

    [Fact]
    public void ItSaysWhatItCannotSee()
    {
        Assert.Contains(StanleyPrebookRules.NotChecked(Facts()), x => x.Contains("availability"));
    }
}
