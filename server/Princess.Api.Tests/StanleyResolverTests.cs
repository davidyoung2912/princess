using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Stanley's deterministic resolvers (docs/stanley-gap-analysis-and-plan.md, phase 3): each question returns a card with a correct data time and no model; stale or missing data produces the abstention wording.</summary>
public class StanleyResolverTests
{
    private static readonly DateTime AsOf = new(2027, 3, 22, 12, 0, 0, DateTimeKind.Unspecified);

    /// <summary>Day 3 of a sailing that left on 20 March 2027.</summary>
    private static StanleyTrip Trip(DateTime? asOf = null, int today = 22) => new(new DateOnly(2027, 3, today), new DateOnly(2027, 3, 20), 7, "Sun Princess", "Balcony", "late", [41, 39, 9],
        [new(3, "Cozumel Reef Snorkel", "09:00")], [new(4, "Crown Grill", "19:30")], ["Drinks package"], null, asOf);

    private static StanleyCardDto Ask(string question, StanleyTrip trip) => StanleyResolvers.Resolve(question, trip, trip.AsOf ?? AsOf) ?? throw new InvalidOperationException("No resolver took: " + question);

    private static readonly (string Id, string Question)[] Questions =
    [
        ("tender", "Will we tender at Roatan?"), ("checkin", "When does online check-in close?"), ("allAboard", "What time is all aboard?"), ("bill", "What is on my bill?"),
        ("cases", "What is the status of my refund?"), ("readiness", "Do I have my boarding pass?"), ("changed", "What has changed?"), ("nextEvent", "What is next?"),
        ("tours", "What are my tours?"), ("dinner", "What time is my dinner?"), ("packages", "What does my package include?"), ("itinerary", "What is the itinerary?"),
        ("portToday", "Where is the ship today?"), ("countdown", "When do we sail?"), ("stateroom", "What is my cabin category?"), ("party", "How many people are travelling?"),
    ];

    [Fact]
    public void ThereAreSixteenResolversWithUniqueShortIds()
    {
        Assert.Equal(16, StanleyResolvers.All.Count);
        Assert.Equal(StanleyResolvers.All.Count, StanleyResolvers.All.Select(r => r.Id).Distinct().Count());
        Assert.All(StanleyResolvers.All, r => Assert.InRange(r.Id.Length, 1, 20));
        Assert.Equal(StanleyResolvers.All.Select(r => r.Id).Order(), Questions.Select(q => q.Id).Order());
    }

    [Fact]
    public void EveryQuestionIsTakenByItsOwnResolverAndNoOtherQuestionIs()
    {
        foreach (var (id, question) in Questions) Assert.Equal(id, Ask(question, Trip(AsOf)).Id);
        foreach (var other in new[] { "Is Cozumel good for snorkelling?", "What is on for dinner?", "What are Cozumel's reefs like?", "What should I pack for the Caribbean?", "What is my plan for the evening?" })
            Assert.Null(StanleyResolvers.Resolve(other, Trip(AsOf), AsOf));
    }

    [Fact]
    public void EveryCardNamesItsSourceAndTheTimeOfTheDataNotOfTheReply()
    {
        foreach (var (id, question) in Questions)
        {
            var card = Ask(question, Trip(AsOf));
            Assert.False(string.IsNullOrWhiteSpace(card.Provenance.Owner), id);
            Assert.Contains(card.Provenance.Freshness, new[] { "live", "cached", "estimated", "provisional" });
            Assert.NotEmpty(card.Lines);
            if (card.Provenance.Chips.Contains(StanleyChips.Booking)) Assert.Equal((AsOf, "live"), (card.Provenance.DataTime, card.Provenance.Freshness));
            if (card.Provenance.Chips.Contains(StanleyChips.Schedule) || card.Provenance.Chips.Contains(StanleyChips.Policy)) Assert.Equal((StanleyResolvers.PublishedAt, "provisional"), (card.Provenance.DataTime, "provisional"));
        }
    }

    [Fact]
    public void AGuestsOwnBookingAnswersAreLiveAndCarryTheTimeTheyWereRead()
    {
        var dinner = Ask("What time is my dinner?", Trip(AsOf));
        Assert.Contains(dinner.Lines, l => l.Contains("Crown Grill") && l.Contains("19:30"));
        Assert.Equal([StanleyChips.Booking], dinner.Provenance.Chips);
        Assert.False(dinner.Abstained);
        Assert.Contains(Ask("What are my tours?", Trip(AsOf)).Lines, l => l.Contains("Cozumel Reef Snorkel") && l.Contains("09:00"));
        Assert.Contains("Drinks package", Ask("What does my package include?", Trip(AsOf)).Lines[0]);
        Assert.Contains("Balcony", Ask("What is my cabin category?", Trip(AsOf)).Lines[0]);
        Assert.Contains("3 travellers", Ask("How many people are travelling?", Trip(AsOf)).Lines[0]);
    }

    [Fact]
    public void NextShowsTheNextBookedThingAfterNowOrSaysThereIsNone()
    {
        Assert.Contains("Crown Grill on day 4", Ask("What is next?", Trip(AsOf)).Lines[0]);
        var before = Ask("What is next?", Trip(AsOf, today: 10));
        Assert.Contains("You sail on", before.Lines[0]);
        Assert.Contains("Cozumel Reef Snorkel", before.Lines[1]);
        var done = new StanleyTrip(new DateOnly(2027, 3, 24), new DateOnly(2027, 3, 20), 7, "Sun Princess", "Balcony", "late", [], [], [], [], null, AsOf.AddDays(2));
        Assert.Contains("no more", Ask("What is next?", done).Lines[0]);
    }

    [Fact]
    public void AllAboardIsTheScheduleInPortTimeAndIsProvisional()
    {
        var card = Ask("What time is all aboard?", Trip(AsOf));
        Assert.Equal([StanleyChips.Schedule], card.Provenance.Chips);
        Assert.Equal("provisional", card.Provenance.Freshness);
        Assert.Equal(StanleyResolvers.PublishedAt, card.Provenance.DataTime);
        Assert.Matches(@"all aboard at \d\d:\d\d, local time in port", card.Lines[0]);
        Assert.True(card.Provenance.CheckWithPerson);
    }

    [Fact]
    public void TenderAlwaysSaysItCannotConfirmAndMarksTheOutlookEstimated()
    {
        var card = Ask("Will we tender?", Trip(AsOf));
        Assert.Contains(card.Lines, l => l.StartsWith("I cannot confirm whether tenders will run"));
        Assert.True(card.Provenance.CheckWithPerson);
        if (card.Lines.Any(l => l.Contains("Outlook"))) Assert.Contains(StanleyChips.Estimated, card.Provenance.Chips);
    }

    [Fact]
    public void BillCasesAndReadinessNeverGuess()
    {
        foreach (var q in new[] { "What is on my bill?", "What is the status of my case?", "Do I have my boarding pass?" })
        {
            var card = Ask(q, Trip(AsOf));
            Assert.True(card.Abstained, q);
            Assert.StartsWith("I cannot confirm", card.Lines[0]);
            Assert.True(card.Provenance.CheckWithPerson);
            Assert.NotEmpty(card.Links!);
        }
    }

    [Fact]
    public void StaleOrMissingDataGivesTheAbstentionWordingOnEveryRiskTopic()
    {
        foreach (var q in new[] { "Will we tender at Roatan?", "When does online check-in close?", "What time is all aboard?", "What is on my bill?", "What is the status of my refund?", "Do I have my boarding pass?" })
        {
            foreach (var trip in new[] { Trip(null), Trip(AsOf.AddHours(-3)) })
            {
                var card = StanleyResolvers.Resolve(q, trip, AsOf)!;
                Assert.True(card.Abstained, q);
                Assert.StartsWith("I cannot confirm", card.Lines[0]);
                Assert.True(card.Provenance.CheckWithPerson);
                Assert.Empty(card.Provenance.Chips);
            }
        }
    }

    [Fact]
    public void StaleDataOnAPlainLookupIsLabelledCachedWithTheTimeItWasRead()
    {
        var old = AsOf.AddHours(-3);
        var card = StanleyResolvers.Resolve("What time is my dinner?", Trip(old), AsOf)!;
        Assert.False(card.Abstained);
        Assert.Equal([StanleyChips.Booking, StanleyChips.Cached], card.Provenance.Chips);
        Assert.Equal((old, "cached"), (card.Provenance.DataTime, card.Provenance.Freshness));
        Assert.True(card.Provenance.CheckWithPerson);
    }

    [Fact]
    public void CheckInTimeIsFortLauderdaleTimeAndAClosedWindowIsNotGuessed()
    {
        var open = StanleyResolvers.Resolve("When does online check-in close?", Trip(new DateTime(2027, 3, 18, 9, 0, 0), 18), new DateTime(2027, 3, 18, 9, 0, 0))!;
        Assert.Contains("10:00", open.Lines[0]);
        Assert.Contains("Fort Lauderdale time", open.Lines[0]);
        Assert.Equal([StanleyChips.Policy], open.Provenance.Chips);
        var closed = StanleyResolvers.Resolve("When does online check-in close?", Trip(new DateTime(2027, 3, 20, 11, 0, 0), 20), new DateTime(2027, 3, 20, 11, 0, 0))!;
        Assert.True(closed.Abstained);
    }

    [Fact]
    public void TheCardTextCarriesTheTitleAndEveryLine()
    {
        var card = Ask("What is the itinerary?", Trip(AsOf));
        Assert.StartsWith("Your ports", card.Text);
        Assert.All(card.Lines, l => Assert.Contains(l, card.Text));
    }
}
