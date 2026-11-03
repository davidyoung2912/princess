using Princess.Api.Data;
using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class ShipCatalogueRulesTests
{
    private static CatalogueSailingRow Sailing(string id, string ship, string departure, int nights, string region = "caribbean", string start = "fll", string end = "fll") =>
        new() { Id = id, ShipId = ship, Departure = DateTime.Parse(departure), Nights = nights, Title = id, RegionId = region, StartPortId = start, EndPortId = end, BookingOpen = false, DataStatus = "sample" };

    private static CatalogueSnapshot Snapshot() => new()
    {
        Sailings =
        [
            Sailing("sun-2027-03-07-14", "sun-princess", "2027-03-07", 14),
            Sailing("sun-2027-03-07-7", "sun-princess", "2027-03-07", 7),
            Sailing("sky-2027-03-01-10", "sky-princess", "2027-03-01", 10, "mediterranean", "barcelona", "rome"),
            Sailing("sap-2027-04-01-31", "sapphire-princess", "2027-04-01", 31, "asia", "tokyo", "sydney"),
        ],
        Legs = [new() { SailingId = "sun-2027-03-07-14", LegNo = 1, PatternId = "a", StartDay = 1 }, new() { SailingId = "sun-2027-03-07-14", LegNo = 2, PatternId = "b", StartDay = 8 }],
        SailingDays =
        [
            new() { OwnerId = "sky-2027-03-01-10", Day = 1, Date = new DateTime(2027, 3, 1), PortId = "barcelona", DepartLocal = new TimeSpan(17, 0, 0) },
            new() { OwnerId = "sky-2027-03-01-10", Day = 2, Date = new DateTime(2027, 3, 2), PortId = "sea", ClockChangeHours = 1, ClockChangeAtLocal = new TimeSpan(2, 0, 0) },
            new() { OwnerId = "sky-2027-03-01-10", Day = 3, Date = new DateTime(2027, 3, 3), PortId = "marseille", ArriveLocal = new TimeSpan(8, 0, 0), AllAboardLocal = new TimeSpan(16, 30, 0), DepartLocal = new TimeSpan(17, 0, 0) },
        ],
        Dress = [new() { SailingId = "sky-2027-03-01-10", Day = 3, Code = "elegant" }],
        Fares = [new() { SailingId = "sun-2027-03-07-14", CategoryId = "interior", PerNightCents = 10_000 }, new() { SailingId = "sun-2027-03-07-14", CategoryId = "balcony", PerNightCents = 15_000 }],
    };

    [Fact]
    public void Same_departure_at_two_lengths_stays_two_sailings()
    {
        var all = ShipCatalogueRules.Sailings(Snapshot(), SailingFilter.None);
        Assert.Equal(["sky-2027-03-01-10", "sun-2027-03-07-14", "sun-2027-03-07-7", "sap-2027-04-01-31"], all.Select(s => s.Id));
    }

    [Fact]
    public void Filters_by_ship_region_dates_nights_and_port()
    {
        var s = Snapshot();
        Assert.Equal(["sun-2027-03-07-14", "sun-2027-03-07-7"], ShipCatalogueRules.Sailings(s, SailingFilter.None with { Ship = "sun-princess" }).Select(x => x.Id));
        Assert.Equal(["sky-2027-03-01-10"], ShipCatalogueRules.Sailings(s, SailingFilter.None with { Region = "mediterranean" }).Select(x => x.Id));
        Assert.Equal(["sun-2027-03-07-14", "sun-2027-03-07-7"], ShipCatalogueRules.Sailings(s, SailingFilter.None with { From = "2027-03-05", To = "2027-03-31" }).Select(x => x.Id));
        Assert.Equal(["sky-2027-03-01-10", "sun-2027-03-07-14"], ShipCatalogueRules.Sailings(s, SailingFilter.None with { NightsMin = 8, NightsMax = 14 }).Select(x => x.Id));
        Assert.Equal(["sky-2027-03-01-10"], ShipCatalogueRules.Sailings(s, SailingFilter.None with { Port = "marseille" }).Select(x => x.Id));
        Assert.Equal(["sap-2027-04-01-31"], ShipCatalogueRules.Sailings(s, SailingFilter.None with { Port = "sydney" }).Select(x => x.Id));
    }

    [Fact]
    public void Joined_sailing_lists_its_legs_and_from_price_is_the_cheapest_fare_times_nights()
    {
        var joined = ShipCatalogueRules.Sailings(Snapshot(), SailingFilter.None).Single(x => x.Id == "sun-2027-03-07-14");
        Assert.Equal(2, joined.Legs.Count);
        Assert.Equal(140_000, joined.FromCents);
        Assert.Null(ShipCatalogueRules.Sailings(Snapshot(), SailingFilter.None).Single(x => x.Id == "sap-2027-04-01-31").FromCents);
    }

    [Theory]
    [InlineData("2027-13-01", null, false)]
    [InlineData(null, "../x", false)]
    [InlineData("2027-03-01", "sun-princess", true)]
    public void Filter_validation(string? from, string? ship, bool ok) => Assert.Equal(ok, SailingFilter.None with { From = from, Ship = ship } is var f && f.Valid());

    [Fact]
    public void Nights_range_must_be_in_order() => Assert.False((SailingFilter.None with { NightsMin = 10, NightsMax = 7 }).Valid());

    [Fact]
    public void Itinerary_carries_times_clock_changes_and_dress_code()
    {
        var it = ShipCatalogueRules.ItineraryOf(Snapshot(), "sky-2027-03-01-10")!;
        Assert.Equal(10, it.Nights);
        Assert.Equal("17:00", it.Days[0].Depart);
        Assert.Equal((1, "02:00"), (it.Days[1].ClockChangeHours!.Value, it.Days[1].ClockChangeAt));
        Assert.Equal(("08:00", "16:30", "elegant"), (it.Days[2].Arrive, it.Days[2].AllAboard, it.Days[2].Dress));
        Assert.Null(ShipCatalogueRules.ItineraryOf(Snapshot(), "nope"));
    }

    [Fact]
    public void Version_changes_with_content_and_not_otherwise()
    {
        var a = ShipCatalogueRules.Regions(new() { Regions = [new() { Id = "x", Name = "X" }] });
        var b = ShipCatalogueRules.Regions(new() { Regions = [new() { Id = "x", Name = "X" }] });
        var c = ShipCatalogueRules.Regions(new() { Regions = [new() { Id = "x", Name = "Y" }] });
        Assert.Equal(a.Version, b.Version);
        Assert.NotEqual(a.Version, c.Version);
    }
}
