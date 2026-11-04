using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>Each ship's programme (<see cref="ShipPrograms"/>): the same event ids on every ship, held in rooms the ship's own deck plan has.</summary>
public class ShipProgramTests
{
    public static TheoryData<string> Ships => new() { "sun-princess", "sky-princess", "sapphire-princess" };

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_event_is_held_in_a_place_on_the_ships_own_plan(string ship)
    {
        var places = AboardPlans.For(ship)!.Places.Select(p => p.Id).ToHashSet();
        var events = ShipPrograms.For(ship)!;
        Assert.All(events, e => Assert.Contains(e.PlaceId, places));
        Assert.Equal(events.Count, events.Select(e => e.Id).Distinct().Count());
    }

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_ship_runs_the_core_events_and_a_main_show(string ship)
    {
        var ids = ShipPrograms.For(ship)!.Select(e => e.Id).ToHashSet();
        foreach (var core in new[] { "muster", "sailaway", "stage-show", "welcome-show", "farewell-show", "movie" })
            Assert.Contains(core, ids);
        Assert.Contains(ShipPrograms.For(ship)!, e => e.Id == "stage-show" && e.Interest == "shows");
    }

    [Fact]
    public void Only_sun_has_the_dome_events()
    {
        Assert.Contains(ShipPrograms.For("sun-princess")!, e => e.Id == "dome-show");
        foreach (var ship in new[] { "sky-princess", "sapphire-princess" })
        {
            Assert.DoesNotContain(ShipPrograms.For(ship)!, e => e.PlaceId is "dome" or "arena" or "live" or "eclipse" or "crooners");
            Assert.Contains(ShipPrograms.For(ship)!, e => e.Id == "late-show");
        }
    }

    [Fact]
    public void Ticketed_shows_follow_the_ships_programme()
    {
        var departure = new DateOnly(2027, 3, 21);
        var timeline = TimelineBook.For("unknown", departure);
        var days = Enumerable.Range(1, 7);
        var sun = days.SelectMany(d => ShowRules.On(timeline, d, "sun-princess")).Select(e => e.PlaceId).ToList();
        var sky = days.SelectMany(d => ShowRules.On(timeline, d, "sky-princess")).Select(e => e.PlaceId).ToList();
        Assert.Contains("arena", sun);
        Assert.DoesNotContain("arena", sky);
        Assert.Contains("princess-theater", sky);
        Assert.True(ShowRules.IsTicketed("late-show"));
    }

    [Fact]
    public void The_programme_version_differs_per_ship_and_an_unknown_ship_has_none()
    {
        Assert.NotEqual(ProgramRules.Reference([], "sun-princess").Version, ProgramRules.Reference([], "sky-princess").Version);
        Assert.Null(ShipPrograms.For("nope"));
    }
}
