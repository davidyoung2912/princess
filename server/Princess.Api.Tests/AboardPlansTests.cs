using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>Each ship's deck plan (<see cref="AboardPlans"/>): the same shape for every ship, the place ids other content names, and muster stations at places that exist.</summary>
public class AboardPlansTests
{
    public static TheoryData<string> Ships => new() { "sun-princess", "sky-princess", "sapphire-princess" };

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_ship_has_a_plan_with_six_banks_and_six_stations(string ship)
    {
        var plan = AboardPlans.For(ship)!;
        Assert.Equal(ship, plan.ShipId);
        Assert.Equal(["A", "B", "C", "D", "E", "F"], plan.Elevators.Select(e => e.Bank));
        Assert.Equal(["A", "B", "C", "D", "E", "F"], plan.Muster.Select(m => m.Letter));
        Assert.NotEmpty(plan.Accessibility);
    }

    [Theory]
    [MemberData(nameof(Ships))]
    public void Place_ids_are_unique_and_the_core_ids_are_all_there(string ship)
    {
        var ids = AboardPlans.For(ship)!.Places.Select(p => p.Id).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.Empty(AboardPlans.CoreIds.Except(ids));
    }

    [Theory]
    [MemberData(nameof(Ships))]
    public void Muster_stations_stand_at_places_on_their_own_deck(string ship)
    {
        var plan = AboardPlans.For(ship)!;
        foreach (var m in plan.Muster) Assert.Equal(m.Deck, plan.Places.Single(p => p.Id == m.PlaceId).Deck);
    }

    [Theory]
    [MemberData(nameof(Ships))]
    public void No_place_is_on_a_deck_the_ship_does_not_have(string ship)
    {
        var decks = ship switch { "sun-princess" => 18, "sky-princess" => 19, _ => 13 };
        Assert.All(AboardPlans.For(ship)!.Places, p => Assert.InRange(p.Deck, 1, decks));
    }

    [Fact]
    public void The_versions_differ_between_ships_and_an_unknown_ship_has_no_plan()
    {
        Assert.Equal(3, AboardPlans.Ships.Select(s => AboardPlans.For(s)!.Version).Distinct().Count());
        Assert.Null(AboardPlans.For("nowhere"));
    }

    [Fact]
    public void A_sailing_the_book_does_not_list_runs_on_Sun_Princess()
    {
        Assert.Equal("sun-princess", AboardPlans.ShipOfSailing("not-listed"));
    }

    [Fact]
    public void Stations_and_places_are_found_on_the_ships_own_plan()
    {
        Assert.Equal("princess-theater", AboardPlans.Station("sky-princess", "A")!.PlaceId);
        Assert.Equal("arena", AboardPlans.Station("sun-princess", "A")!.PlaceId);
        Assert.Equal("Vivaldi Dining Room", AboardPlans.PlaceName("sapphire-princess", "vivaldi"));
        Assert.Equal("F", AboardPlans.StationByLabel("sapphire-princess", "Station F")!.Letter);
        Assert.Null(AboardPlans.StationByLabel("sky-princess", "Station G"));
        Assert.Null(AboardPlans.Station("nowhere", "A"));
    }

    [Fact]
    public void The_emergency_card_places_the_medical_center_and_guest_services_on_the_ships_own_deck()
    {
        var sun = AboardRules.EmergencyCardOf("Sam", "8123", 8, "Station D");
        Assert.Equal("Guest Services, Deck 6 forward", sun.Contacts.Single(c => c.Label == "guestServices").Note);
        var sky = AboardRules.EmergencyCardOf("Sam", "8123", 8, "Station D", "sky-princess");
        Assert.Equal("Guest Services, Deck 5 forward", sky.Contacts.Single(c => c.Label == "guestServices").Note);
        Assert.Equal("The Piazza, starboard side", sky.MusterPlace!.Name);
    }
}
