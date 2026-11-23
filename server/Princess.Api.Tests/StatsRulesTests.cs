using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The stats page rules (docs/stats-plan.md): streaks, stable made-up numbers, the counter keys the app accepts, and the shape of the whole report.</summary>
public class StatsRulesTests
{
    private static readonly DateTime Now = new(2027, 3, 9, 15, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2027, 3, 9);
    private static readonly Guid Ana = Guid.Parse("11111111-2222-3333-4444-555555555555");
    private static readonly Guid Ben = Guid.Parse("99999999-8888-7777-6666-000000000001");

    private static List<StatsDay> Days(params string[] days) => [.. days.Select(d => new StatsDay(DateOnly.Parse(d), 600, 20, 1))];

    private static StatsRaw Raw(Action<StatsRaw>? fill = null)
    {
        var r = new StatsRaw();
        r.D["created_at"] = new DateTime(2027, 3, 1, 9, 0, 0, DateTimeKind.Utc);
        fill?.Invoke(r);
        return r;
    }

    private static StatsReport Report(StatsRaw? raw = null, Guid? who = null, DateTime? now = null) => StatsRules.Build(raw ?? Raw(), "Ana", who ?? Ana, now ?? Now);
    private static List<StatItem> All(StatsReport r) => [.. r.Sections.SelectMany(s => s.Stats)];
    private static StatItem Find(StatsReport r, string id) => All(r).Single(s => s.Id == id);

    // ---- streaks ----

    [Fact]
    public void ARunOfDaysEndingTodayIsTheCurrentStreak() =>
        Assert.Equal((3, 3), StatsRules.Streaks(Days("2027-03-07", "2027-03-08", "2027-03-09"), Today));

    [Fact]
    public void AStreakThatEndedYesterdayIsStillCurrentBecauseTodayIsNotOverYet() =>
        Assert.Equal((2, 2), StatsRules.Streaks(Days("2027-03-07", "2027-03-08"), Today));

    [Fact]
    public void AStreakThatEndedTwoDaysAgoIsBrokenButStaysTheLongest() =>
        Assert.Equal((0, 2), StatsRules.Streaks(Days("2027-03-06", "2027-03-07"), Today));

    [Fact]
    public void TheLongestStreakIsFoundAnywhereInTheHistory() =>
        Assert.Equal((1, 4), StatsRules.Streaks(Days("2027-02-01", "2027-02-02", "2027-02-03", "2027-02-04", "2027-02-10", "2027-03-09"), Today));

    [Fact]
    public void NoDaysMeansNoStreak() => Assert.Equal((0, 0), StatsRules.Streaks([], Today));

    // ---- made-up numbers ----

    [Fact]
    public void ARollStaysInsideItsRangeAndNeverChanges()
    {
        for (var i = 0; i < 200; i++)
        {
            var v = StatsRules.Roll((uint)i * 7919, "salt" + i, 3, 9);
            Assert.InRange(v, 3, 9);
            Assert.Equal(v, StatsRules.Roll((uint)i * 7919, "salt" + i, 3, 9));
        }
    }

    [Fact]
    public void ARollWithOneChoiceIsThatChoice() => Assert.Equal(4, StatsRules.Roll(123, "x", 4, 4));

    [Fact]
    public void APickAlwaysReturnsOneOfTheOptionsAndIsStable()
    {
        string[] options = ["a", "b", "c"];
        for (uint seed = 0; seed < 100; seed++)
        {
            var p = StatsRules.Pick(seed, "salt", options);
            Assert.Contains(p, options);
            Assert.Equal(p, StatsRules.Pick(seed, "salt", options));
        }
    }

    [Fact]
    public void DifferentSaltsAndGuestsGiveDifferentNumbersSoNothingIsAllTheSame()
    {
        Assert.True(Enumerable.Range(0, 30).Select(i => StatsRules.Roll(5, "s" + i, 0, 1000)).Distinct().Count() > 20);
        Assert.True(Enumerable.Range(0, 30).Select(i => StatsRules.Roll((uint)i + 1, "same", 0, 1000)).Distinct().Count() > 20);
    }

    // ---- what the app may count ----

    [Theory]
    [InlineData("opens", 1, true)]
    [InlineData("views", 100000, true)]
    [InlineData("seconds", 30, true)]
    [InlineData("shares", 1, true)]
    [InlineData("hour.00", 10, true)]
    [InlineData("hour.23", 10, true)]
    [InlineData("hour.24", 10, false)]
    [InlineData("hour.7", 10, false)]
    [InlineData("area.chat", 1, true)]
    [InlineData("area.cabin", 1, false)]
    [InlineData("route.me.stats", 1, true)]
    [InlineData("route.dining-today", 1, true)]
    [InlineData("route.", 1, false)]
    [InlineData("route..x", 1, false)]
    [InlineData("route.x.", 1, false)]
    [InlineData("route.Upper", 1, false)]
    [InlineData("route.has space", 1, false)]
    [InlineData("route.a'; drop table", 1, false)]
    [InlineData("secrets", 1, false)]
    [InlineData("opens", -1, false)]
    [InlineData("opens", 100001, false)]
    public void OnlyCountersOfAKnownShapeAndSizeAreAccepted(string key, long value, bool ok) =>
        Assert.Equal(ok, StatsRules.KnownCounter(key, value));

    [Fact]
    public void ARouteKeyOfFortyCharactersIsAcceptedAndOneOfFortyOneIsNot()
    {
        Assert.True(StatsRules.KnownCounter("route." + new string('a', 34), 1));
        Assert.False(StatsRules.KnownCounter("route." + new string('a', 35), 1));
    }

    // ---- the whole report ----

    [Fact]
    public void AGuestWithNothingStillGetsAFullReportWithoutErrors()
    {
        var r = Report();
        Assert.True(r.Sections.Count >= 18);
        Assert.All(r.Sections, s => Assert.NotEmpty(s.Stats));
        Assert.True(r.RealCount > 60);
        Assert.True(r.JokeCount > 80);
        Assert.Equal(All(r).Count, r.RealCount + r.JokeCount);
    }

    [Fact]
    public void EveryStatHasAUniqueIdStartingWithItsSectionAndSomeWords()
    {
        var r = Report();
        var ids = All(r).Select(s => s.Id).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        foreach (var s in r.Sections)
            Assert.All(s.Stats, x => Assert.StartsWith(s.Id + ".", x.Id));
        Assert.All(All(r), s => { Assert.False(string.IsNullOrWhiteSpace(s.Label)); Assert.False(string.IsNullOrWhiteSpace(s.Value) && s.Route is null); });
    }

    [Fact]
    public void AJokeSectionHoldsOnlyJokesAndARealSectionHoldsRealStatsFirst()
    {
        var r = Report();
        foreach (var s in r.Sections.Where(s => s.Joke)) Assert.All(s.Stats, x => Assert.True(x.Joke));
        foreach (var s in r.Sections.Where(s => !s.Joke))
        {
            Assert.Contains(s.Stats, x => !x.Joke);
            // Made-up stats come after the real ones, never between them.
            var firstJoke = s.Stats.FindIndex(x => x.Joke);
            if (firstJoke >= 0) Assert.All(s.Stats.Skip(firstJoke), x => Assert.True(x.Joke));
        }
        Assert.Contains(r.Sections, s => s.Joke);
    }

    [Fact]
    public void TheSameGuestOnTheSameDayAlwaysSeesTheSameReport()
    {
        var a = Report();
        var b = Report();
        Assert.Equal(All(a).Select(s => (s.Id, s.Value)), All(b).Select(s => (s.Id, s.Value)));
    }

    [Fact]
    public void MadeUpNumbersDifferBetweenGuests() =>
        Assert.NotEqual(All(Report(who: Ana)).Where(s => s.Joke).Select(s => s.Value), All(Report(who: Ben)).Where(s => s.Joke).Select(s => s.Value));

    [Fact]
    public void OnlyTheFortuneSectionsMadeUpNumbersChangeFromDayToDay()
    {
        var today = Report();
        var later = Report(now: Now.AddDays(1));
        string Values(StatsReport r, bool fortune) => string.Join("|", r.Sections.Where(s => (s.Id == "fortune") == fortune).SelectMany(s => s.Stats).Where(s => s.Joke && s.Id != "fortune.animal").Select(s => s.Value));
        Assert.NotEqual(Values(today, true), Values(later, true));
        Assert.Equal(Values(today, false), Values(later, false));
    }

    [Fact]
    public void RealNumbersFollowTheData()
    {
        var r = Report(Raw(x =>
        {
            x.N["msgs"] = 1234;
            x.N["logins"] = 7;
            x.N["folio_cents"] = 123456;
            x.N["nights"] = 7; x.N["past_nights"] = 14;
            x.T["venue"] = "Crown Grill";
        }));
        Assert.Equal("1,234", Find(r, "chat.msgs").Value);
        Assert.Equal("7", Find(r, "signins.logins").Value);
        Assert.Equal("$1,234.56", Find(r, "money.total").Value);
        Assert.Equal("21", Find(r, "voyages.nights").Value);
        Assert.Equal("Crown Grill", Find(r, "dining.fav").Value);
    }

    [Fact]
    public void FavouritesAreLeftOutUntilThereIsOne()
    {
        Assert.DoesNotContain(All(Report()), s => s.Id is "dining.fav" or "chat.emoji" or "ashore.fav" or "app.fav");
        Assert.Contains(All(Report(Raw(x => x.T["emoji"] = "😂"))), s => s.Id == "chat.emoji");
    }

    [Fact]
    public void TheFavouriteScreenIsAPathNotAWord()
    {
        var r = Report(Raw(x => { x.Counters["route.me.stats"] = 9; x.Counters["route.plan"] = 3; }));
        Assert.Equal("/me/stats", Find(r, "app.fav").Route);
        Assert.Equal("2", Find(r, "app.screens").Value);
    }

    [Fact]
    public void TimeInTheAppAndTheBusiestHourComeFromTheCounters()
    {
        var r = Report(Raw(x => { x.Counters["seconds"] = 3725; x.Counters["opens"] = 5; x.Counters["hour.21"] = 900; x.Counters["hour.08"] = 100; }));
        Assert.Equal("1h 2m", Find(r, "app.time").Value);
        Assert.Equal("12 min", Find(r, "app.avg").Value);
        Assert.Equal("9 pm", Find(r, "app.peak").Value);
    }

    [Fact]
    public void TheCurrentStreakAndActiveDaysComeFromTheDaysTable()
    {
        var r = Report(Raw(x => x.Days.AddRange(Days("2027-03-07", "2027-03-08", "2027-03-09"))));
        Assert.Equal("3 days", Find(r, "app.streak").Value);
        Assert.Equal("3", Find(r, "app.active").Value);
        // Sunday, Monday and Tuesday are tied on days and time, so the first of the week wins.
        Assert.Equal("Sunday", Find(r, "app.weekday").Value);
    }

    [Fact]
    public void BadgesAreEarnedAtTheirThresholdsAndTheNextOneIsNamed()
    {
        var none = Find(Report(), "records.badges");
        Assert.StartsWith("0 of ", none.Value);
        var some = Find(Report(Raw(x => { x.N["logins"] = 12; x.N["msgs"] = 60; x.N["venues"] = 3; })), "records.badges");
        Assert.StartsWith("4 of ", some.Value);
        Assert.Contains("Chatterbox", some.Note);
        Assert.Contains("Regular", some.Note);
        Assert.DoesNotContain("Fixture", some.Note);
        Assert.Contains(All(Report()), s => s.Id == "records.next");
    }

    [Fact]
    public void TheHighlightsNameRealStatsInTheReport()
    {
        var r = Report();
        var ids = All(r).Select(s => s.Id).ToHashSet();
        Assert.NotEmpty(r.Highlights);
        Assert.All(r.Highlights, h => Assert.Contains(h, ids));
        Assert.Contains(r.Highlights, h => !Find(r, h).Joke);
    }

    [Fact]
    public void TheHeadlineUsesTheRealNumbers()
    {
        var r = Report(Raw(x => { x.N["msgs"] = 40; x.N["dinners"] = 2; x.N["tours"] = 1; x.Days.AddRange(Days("2027-03-08", "2027-03-09")); }));
        Assert.Equal("2 days in the app, 40 chat messages, 3 things booked and counting.", r.Headline);
        Assert.Equal("Ana", r.Name);
    }

    [Fact]
    public void ADateInTheFutureIsCountedAsDaysToGo()
    {
        var r = Report(Raw(x => x.D["next_departure_at"] = new DateTime(2027, 3, 21)));
        var next = Find(r, "voyages.next");
        Assert.Equal("March 21, 2027", next.Value);
        Assert.Equal("In 12 days", next.Note);
    }

    [Fact]
    public void TimeOfDayIsNamedFromTheBusiestPartOfTheDay()
    {
        Assert.Equal("Not yet", Find(Report(), "app.persona").Value);
        Assert.Equal("Night owl", Find(Report(Raw(x => { x.Counters["hour.23"] = 100; x.Counters["hour.01"] = 100; x.Counters["hour.10"] = 150; })), "app.persona").Value);
        Assert.Equal("Early bird", Find(Report(Raw(x => x.Counters["hour.06"] = 50)), "app.persona").Value);
    }

    [Fact]
    public void ScreensAreCountedPerTab()
    {
        var r = Report(Raw(x => { x.Counters["area.chat"] = 12; x.Counters["area.me"] = 3; }));
        Assert.Equal("12", Find(r, "app.inchat").Value);
        Assert.Equal("3", Find(r, "app.inme").Value);
        Assert.Equal("0", Find(r, "app.inplan").Value);
    }

    [Fact]
    public void ChangesOfPlanAreAddedUp()
    {
        var r = Report(Raw(x => { x.N["dinner_changes"] = 2; x.N["tours_cancelled"] = 1; x.N["spa_cancelled"] = 1; x.N["show_changes"] = 3; }));
        Assert.Equal("7", Find(r, "ready.changes").Value);
    }

    [Fact]
    public void ThereAreManyMadeUpSectionsAndEachHasSeveralStats()
    {
        var jokes = Report().Sections.Where(s => s.Joke).ToList();
        Assert.True(jokes.Count >= 14);
        Assert.All(jokes, s => Assert.True(s.Stats.Count >= 7));
    }
}
