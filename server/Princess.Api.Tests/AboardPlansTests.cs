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

/// <summary>Staterooms per ship (<see cref="CabinRules"/>): each ship's own categories, decks and unique numbers; Sun Princess unchanged.</summary>
public class CabinsPerShipTests
{
    public static TheoryData<string> Ships => new() { "sun-princess", "sky-princess", "sapphire-princess" };

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_class_has_nine_staterooms_on_the_ships_decks_with_unique_numbers(string ship)
    {
        var profile = CabinRules.ProfileOf(ship);
        var numbers = new List<string>();
        foreach (var (roomClass, decks) in profile.Decks)
        {
            var category = ship == "sun-princess" ? roomClass : CabinRules.OwnId(ship, roomClass);
            var list = CabinRules.CabinsOn(ship, "x", category);
            Assert.Equal(9, list.Count);
            Assert.All(list, c => Assert.Contains(c.Deck, decks));
            numbers.AddRange(list.Select(c => c.Number));
        }
        Assert.Equal(numbers.Count, numbers.Distinct().Count());
    }

    [Fact]
    public void Class_of_a_ship_category_is_the_room_class()
    {
        Assert.Equal("balcony", CabinRules.ClassOf("sky-balcony"));
        Assert.Equal("miniSuite", CabinRules.ClassOf("sapphire-minisuite"));
        Assert.Equal("interior", CabinRules.ClassOf("interior"));
        Assert.Equal("sky-minisuite", CabinRules.OwnId("sky-princess", "miniSuite"));
    }

    [Fact]
    public void Sun_staterooms_are_unchanged_and_other_ships_differ()
    {
        Assert.Equal(["10177", "11214", "12251"], CabinRules.CabinsOn("sun-princess", "s", "balcony").Take(3).Select(c => c.Number));
        Assert.NotEqual("10177", CabinRules.CabinsOn("sky-princess", "s", "sky-balcony")[0].Number);
        Assert.Empty(CabinRules.CabinsOn("sky-princess", "s", "sky-suite"));
    }
}

public class SharedRoomTests
{
    [Theory]
    [InlineData("sun-princess", "arena", "arena")]
    [InlineData("sky-princess", "arena", "princess-theater")]
    [InlineData("sapphire-princess", "eclipse", "santa-fe")]
    [InlineData("sky-princess", "eclipse", "allegro")]
    [InlineData("sky-princess", "dome", "seawalk")]
    [InlineData("sky-princess", "lido-pool", "lido-pool")]
    public void SunOnlyRoomsMapToTheShipsOwn(string ship, string id, string expected) => Assert.Equal(expected, AboardPlans.Room(ship, id));

    [Fact]
    public void ARoomTheShipLacksIsDropped()
    {
        Assert.Null(AboardPlans.Room("sky-princess", "americana"));
        Assert.Equal(["firefly", "lido-pool", "eatery"], FamilyRules.DefaultZones(5, "sky-princess"));
        Assert.Equal(FamilyRules.KidZones.ToList(), FamilyRules.KidZonesOn("sun-princess"));
    }

    [Fact]
    public void EveryMappedRoomExistsOnItsShip()
    {
        foreach (var ship in AboardPlans.Ships)
            foreach (var id in FamilyRules.KidZones.Concat(["arena", "eclipse", "dome"]))
                if (AboardPlans.Room(ship, id) is { } room)
                    Assert.Contains(AboardPlans.For(ship)!.Places, p => p.Id == room);
    }

    [Fact]
    public void ThePulseIsKeyedByTheShipsOwnTheatre()
    {
        var timeline = Timeline.Legacy(new DateOnly(2027, 3, 6));
        var sky = OnboardFeedRules.Pulse(timeline, 1_800_000_000_000, "sky-princess");
        var sun = OnboardFeedRules.Pulse(timeline, 1_800_000_000_000, "sun-princess");
        Assert.True(sky.Venues.ContainsKey("princess-theater") && !sky.Venues.ContainsKey("arena"));
        Assert.Equal(sun.Venues["arena"].Observed, sky.Venues["princess-theater"].Observed);
        Assert.Equal("allegro", DayPlanRules.Build(timeline, 2, new DayWishDto([], [], "any", false, null), "sky-princess").Items.Single(i => i.Kind == "dinner").Id);
    }
}
