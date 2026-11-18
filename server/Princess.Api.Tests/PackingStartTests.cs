using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class PackingStartTests
{
    private static Venue Place(string id, string name, string kind, string dress) => new(id, name, kind, 0, false, "", "", dress, "");

    [Fact]
    public void AddsADayBagPerTourAndAnOutfitPerDressyRestaurant()
    {
        var tour = ExcursionRules.ById("coz-beach")!;
        var items = PlanRules.StarterItems([tour, tour], [Place("v1", "Chops", "specialty", "Smart casual"), Place("v2", "Main", "main", "Smart casual"), Place("v3", "Pizza", "specialty", " ")], [], 20);
        Assert.Equal([$"Day bag for {tour.Name}", "Outfit for Chops: Smart casual"], items);
    }

    [Fact]
    public void SkipsWhatTheListHasRespectsRoomAndTheCap()
    {
        var tour = ExcursionRules.ById("coz-beach")!;
        Assert.Empty(PlanRules.StarterItems([tour], [], [$"day bag for {tour.Name}"], 20));
        Assert.Empty(PlanRules.StarterItems([tour], [], [], 0));
        var many = Enumerable.Range(0, 10).Select(i => Place("v" + i, "R" + i, "specialty", "Dressy")).ToList();
        Assert.Equal(PlanRules.StarterMax, PlanRules.StarterItems([], many, [], 20).Count);
        Assert.All(PlanRules.StarterItems([], [Place("v", new string('x', 80), "specialty", "Dressy")], [], 20), l => Assert.True(l.Length <= 60));
    }
}
