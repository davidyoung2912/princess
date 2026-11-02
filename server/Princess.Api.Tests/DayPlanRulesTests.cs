using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class DayPlanRulesTests
{
    private static readonly DateOnly Departure = new(2027, 3, 21);
    private static DayWishDto Wish(string mobility = "any", bool kids = false, params string[] tours) => new(tours, [], mobility, kids, null);
    private static DayPlanDto Day(int day, DayWishDto w) => DayPlanRules.Plan(Departure, day, w, ProgramRules.PlanChanges);
    private static int Minutes(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..5]);

    [Fact]
    public void ATourFitsTheShipsDayAndThereIsATimeToBeBack()
    {
        var plan = Day(3, Wish("any", false, "water"));
        Assert.Equal("coz-snorkel", plan.Items.Single(i => i.Kind == "tour").Id);
        Assert.Equal("15:45", plan.BackBy);
        Assert.Contains(plan.Items, i => i.Kind == "dinner");
    }

    [Fact]
    public void OnlyLevelWheelchairFriendlyToursWhenAsked()
    {
        Assert.Equal("bze-walk", Day(4, Wish("wheelchair")).Items.Single(i => i.Kind == "tour").Id);
    }

    [Fact]
    public void ASeaDaySpreadsEventsInTimeOrderAndKeepsAdultsOnlyAwayFromChildren()
    {
        var plan = Day(2, Wish("any", true));
        Assert.Contains(plan.Items, i => i.Kind == "event");
        Assert.Null(plan.BackBy);
        var starts = plan.Items.Select(i => Minutes(i.Start)).ToList();
        Assert.Equal(starts.OrderBy(x => x), starts);
        Assert.All(plan.Items.Where(i => i.Kind == "event"), i => Assert.NotEqual("adults", ProgramRules.ById(i.Id)!.Age));
    }

    [Fact]
    public void TheSameEveryTimeWithNoDinnerOnTheLastMorning()
    {
        Assert.Equal(Day(5, Wish()).Items, Day(5, Wish()).Items);
        Assert.DoesNotContain(Day(8, Wish()).Items, i => i.Kind == "dinner");
    }

    [Fact]
    public void TheShipsChangesAndTheIncludedAlternativesAreAnswered()
    {
        var plan = Day(2, Wish());
        Assert.Contains(plan.ShipChanges, c => c is { Id: "stage-show", Kind: "moved", Start: "21:15" });
        Assert.Contains(plan.ShipChanges, c => c is { Id: "trivia", Kind: "cancelled" });
        Assert.All(plan.Alternatives, a => Assert.Equal(0, ProgramRules.ById(a.Id)!.Extra));
        Assert.DoesNotContain(plan.Alternatives, a => a.Id == "trivia");   // cancelled events are not offered
    }

    [Fact]
    public void WishesAreChecked()
    {
        Assert.True(DayPlanRules.Valid(Wish()));
        Assert.False(DayPlanRules.Valid(Wish("flying")));
        Assert.False(DayPlanRules.Valid(Wish("any", false, "diving")));
        Assert.False(DayPlanRules.Valid(new DayWishDto([], [], "any", false, -5)));
        Assert.False(DayPlanRules.Valid(null));
    }

    [Fact]
    public void AWeekDayCarriesTheDayUnderTheGuestsWishesAndUnderTheWeeks()
    {
        var prefs = new WeekPrefsDto("relaxed", "any", false, [], [], null, false);
        var day = AutopilotRules.OptimiseWeek(Departure, prefs).Days[2];
        Assert.Equal(DayPlanRules.Build(Departure, 3, Wish("any")).Items, day.Base);
        Assert.Equal(DayPlanRules.Build(Departure, 3, Wish("easy")).Items, day.Target);
    }
}
