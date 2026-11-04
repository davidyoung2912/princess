using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>Each ship's dining (<see cref="ShipDining"/>): rooms on places the ship has, menus under the ship's own ids, queues from the walk-in rooms.</summary>
public class ShipDiningTests
{
    public static TheoryData<string> Ships => new() { "sun-princess", "sky-princess", "sapphire-princess" };

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_ship_has_rooms_a_menu_and_delivery_zones_on_its_own_plan(string ship)
    {
        var dining = ShipDining.For(ship)!;
        var places = AboardPlans.For(ship)!.Places.Select(p => p.Id).ToHashSet();
        Assert.Contains(dining.Venues, v => v.Kind == "main");
        Assert.Contains(dining.Venues, v => v.Kind == "specialty");
        Assert.NotEmpty(OrderRules.MenuFor("room", ship));
        Assert.NotEmpty(OrderRules.MenuFor("delivery", ship));
        Assert.All(dining.DeliveryZones, z => Assert.Contains(z, places));
        Assert.NotEmpty(ShipDining.QueueOf(ship));
    }

    [Fact]
    public void Venue_and_item_ids_belong_to_one_ship()
    {
        var venues = ShipDining.Ships.SelectMany(s => ShipDining.VenuesOf(s).Select(v => v.Id)).ToList();
        Assert.Equal(venues.Count, venues.Distinct().Count());
        var items = ShipDining.Ships.SelectMany(s => ShipDining.MenuOf(s).Select(m => m.Id)).ToList();
        Assert.Equal(items.Count, items.Distinct().Count());
    }

    [Fact]
    public void A_booking_reserves_only_its_own_ships_rooms()
    {
        Assert.NotNull(DiningRules.VenueOn("sky-princess", "sky-crown"));
        Assert.Null(DiningRules.VenueOn("sky-princess", "crown"));
        Assert.Null(DiningRules.VenueOn("sun-princess", "sky-crown"));
        Assert.Equal("Crown Grill", DiningRules.VenueById("sapphire-crown")!.Name);
    }

    [Fact]
    public void Orders_use_the_ships_menu_and_zones()
    {
        Assert.Equal("sky-fish-tacos", OrderRules.OutAtMenuOn("sky-princess").Single());
        Assert.Equal("fish-tacos", OrderRules.OutAtMenuOn("sun-princess").Single());
        Assert.Null(OrderRules.LocationProblem(new OrderLocation("zone", PlaceId: "piazza"), "sky-princess"));
        Assert.Equal("badLocation", OrderRules.LocationProblem(new OrderLocation("zone", PlaceId: "dome"), "sky-princess"));
        Assert.DoesNotContain(OrderRules.MenuFor("delivery", "sapphire-princess"), m => m.Id == "cheeseburger");
        Assert.Contains(OrderRules.MenuFor("delivery", "sapphire-princess"), m => m.Id == "sapphire-cheeseburger");
    }
}
