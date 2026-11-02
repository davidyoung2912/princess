using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class AutopilotRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static WeekPrefsDto Prefs(string pace = "balanced", string mobility = "any", long? maxTour = null, bool noEarly = false, bool kids = false) =>
        new(pace, mobility, kids, [], [], maxTour, noEarly);

    private static int Minutes(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..5]);

    private static int Span(WeekItemDto i) => i.Kind switch
    {
        "dinner" => 90,
        "tour" => (int)Math.Round(ExcursionRules.ById(i.Id)!.Hours * 60),
        _ => ProgramRules.ById(i.Id)!.Minutes,
    };

    [Theory]
    [InlineData("relaxed")]
    [InlineData("balanced")]
    [InlineData("packed")]
    public void EightDaysWithNoCrossingItemsAtEveryPace(string pace)
    {
        var week = AutopilotRules.OptimiseWeek(Departure, Prefs(pace));
        Assert.Equal(8, week.Days.Count);
        foreach (var d in week.Days)
            for (var x = 0; x < d.Items.Count; x++)
                for (var y = x + 1; y < d.Items.Count; y++)
                {
                    var a = d.Items[x]; var b = d.Items[y];
                    Assert.False(Minutes(a.Start) < Minutes(b.Start) + Span(b) && Minutes(b.Start) < Minutes(a.Start) + Span(a), $"day {d.Day}: {a.Title} and {b.Title}");
                }
    }

    [Fact]
    public void AHigherPaceHasMoreEvents()
    {
        int Count(string pace) => AutopilotRules.OptimiseWeek(Departure, Prefs(pace)).Days.SelectMany(d => d.Items).Count(i => i.Kind == "event");
        Assert.True(Count("relaxed") < Count("balanced"));
        Assert.True(Count("balanced") <= Count("packed"));
    }

    [Fact]
    public void TheTourBudgetIsKeptAndTheCostAddsUp()
    {
        var week = AutopilotRules.OptimiseWeek(Departure, Prefs(maxTour: 10_000));
        Assert.All(week.Days, d => Assert.True(d.TourCost <= 10_000));
        Assert.Equal(week.Days.Sum(d => d.TourCost), week.TotalTours);
    }

    [Fact]
    public void EarlyStartsAreLeftOutWhenAskedAndAPortDayWithNoTourIsARestDay()
    {
        var early = AutopilotRules.OptimiseWeek(Departure, Prefs(noEarly: true));
        Assert.All(early.Days.SelectMany(d => d.Items).Where(i => i.Kind != "dinner"), i => Assert.True(string.CompareOrdinal(i.Start, "09:00") >= 0));
        Assert.Contains(AutopilotRules.OptimiseWeek(Departure, Prefs(maxTour: 1)).Days, d => d.RestDay);
    }

    [Fact]
    public void ARelaxedWeekKeepsToursEasyAndDinnerIsOnTheFirstSevenDays()
    {
        var week = AutopilotRules.OptimiseWeek(Departure, Prefs("relaxed"));
        foreach (var t in week.Days.SelectMany(d => d.Items).Where(i => i.Kind == "tour")) Assert.Equal("easy", ExcursionRules.ById(t.Id)!.Activity);
        Assert.Equal(7, week.Days.Count(d => d.Items.Any(i => i.Kind == "dinner")));
        Assert.DoesNotContain(week.Days[7].Items, i => i.Kind == "dinner");
    }

    [Fact]
    public void PreferencesAreChecked()
    {
        Assert.True(AutopilotRules.Valid(Prefs()));
        Assert.False(AutopilotRules.Valid(Prefs("frantic")));
        Assert.False(AutopilotRules.Valid(Prefs("balanced", "flying")));
        Assert.False(AutopilotRules.Valid(Prefs(maxTour: -1)));
        Assert.False(AutopilotRules.Valid(new WeekPrefsDto("balanced", "any", false, ["diving"], [], null, false)));
        Assert.False(AutopilotRules.Valid(null));
    }
}
