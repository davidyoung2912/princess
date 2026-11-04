using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>Price and length from data (<see cref="FareBook"/>): sailings of 3, 6, 14 and 31 nights are priced from their per-night fares, and the seven-night rules still hold for the older sailings.</summary>
[Collection("FareBook")]
public class NightsPricingTests : IDisposable
{
    public NightsPricingTests() => FareBook.Set(
        [("t-3", 3, true), ("t-6", 6, true), ("t-14", 14, true), ("t-31", 31, true), ("t-closed", 7, false)],
        [.. new[] { "t-3", "t-6", "t-14", "t-31", "t-closed" }.SelectMany(id => new[] { (id, "interior", 10_000L), (id, "balcony", 14_000L) })]);

    public void Dispose() => FareBook.Clear();

    [Theory]
    [InlineData("t-3", 3)]
    [InlineData("t-6", 6)]
    [InlineData("t-14", 14)]
    [InlineData("t-31", 31)]
    public void Fare_is_the_per_night_fare_times_the_nights(string id, int nights)
    {
        Assert.Equal(nights, Pricing.NightsOf(id));
        Assert.Equal(10_000L * nights, Pricing.FareFor(id, "interior"));
        Assert.Equal(14_000L * nights, Pricing.FareFor(id, "balcony"));
    }

    [Theory]
    [InlineData("t-3", 3)]
    [InlineData("t-14", 14)]
    [InlineData("t-31", 31)]
    public void Gratuities_and_package_follow_the_nights(string id, int nights)
    {
        var q = Pricing.Quote(id, "interior", 2)!;
        Assert.Equal(Pricing.GratuityPerNight * nights * 2, q.Gratuities);
        var plus = Pricing.BookingQuote(id, "interior", 2, "plus")!;
        Assert.Equal(Pricing.Fare("plus")!.PerNight * nights * 2, plus.Lines.Single(l => l.Key == "package").Cents);
        Assert.Equal(Pricing.GratuityPerNight * nights, Pricing.FromPriceOf(id)!.Gratuities);
    }

    [Fact]
    public void Only_open_priced_sailings_are_offered()
    {
        Assert.True(Pricing.HasPrice("t-14"));
        Assert.False(Pricing.HasPrice("t-closed"));
        Assert.False(Pricing.HasPrice("t-unknown"));
        Assert.NotNull(Pricing.Quote("t-closed", "interior", 2));   // a closed sailing can still be quoted, as a next-season one can
    }

    [Fact]
    public void Older_sailings_keep_their_code_fares_and_seven_nights()
    {
        Assert.Equal(7, Pricing.NightsOf("sun-2027-03-21"));
        Assert.Equal(189_900, Pricing.FareFor("sun-2027-03-21", "interior"));
        Assert.Equal(7, Pricing.NightsOf("unknown"));
    }

    [Fact]
    public void Rules_take_the_nights()
    {
        Assert.Equal(Pricing.GratuityPerNight * 14, ServiceRules.GratuityDue([(false, false)], 14));
        Assert.Equal(Pricing.GratuityPerNightSuite * 31, DisembarkRules.GratuityCharged([new GratuityGuest(true, false)], 31));
        Assert.Equal(6 * 2, PackageRules.Units("night", 2, 6));
        Assert.Equal(Pricing.Fare("plus")!.PerNight * 3 - Pricing.GratuityPerNight * 3, PackageRules.UpgradeBase("none", "plus", 3));
        var dep = new DateOnly(2027, 5, 1);
        var at = (int n) => Itinerary.LocalToUtc(dep.AddDays(n), new TimeOnly(7, 0), Itinerary.ShipHomeZone);
        Assert.False(Itinerary.Aboard(dep, at(10), 7));
        Assert.True(Itinerary.Aboard(dep, at(10), 14));
        Assert.False(Itinerary.Aboard(dep, at(31), 31));
    }

    [Fact]
    public void AShipsOwnCategoriesPriceItsSailings()
    {
        FareBook.Set([("sky-1", 10, true), ("sky-closed", 10, false)],
            [("sky-1", "sky-interior", 20_000L), ("sky-1", "sky-balcony", 30_000L), ("sky-closed", "sky-interior", 20_000L), ("sky-closed", "sky-balcony", 30_000L)]);
        FareBook.SetShips([("sky-1", "sky-princess"), ("sky-closed", "sky-princess")],
            [new("sky-interior", "sky-princess", "Interior", false, 4, 160, "Best value.", 1), new("sky-balcony", "sky-princess", "Balcony", false, 4, 200, "A balcony.", 2), new("interior", "sun-princess", "Interior", false, 4, 140, "Sun.", 1)]);
        Assert.Equal(["sky-interior", "sky-balcony"], Pricing.CategoriesOf("sky-1").Select(c => c.Id));
        Assert.Equal(300_000L, Pricing.FareFor("sky-1", "sky-balcony"));
        Assert.Null(Pricing.FareFor("sky-1", "balcony"));          // a Sun category is not sold on a Sky sailing
        Assert.NotNull(Pricing.Quote("sky-1", "sky-balcony", 2));
        Assert.Equal("sky-interior", Pricing.CheapestCategory("sky-1"));
        Assert.Equal(200_000L, Pricing.FromPriceOf("sky-1")!.Fare);
        Assert.True(Pricing.HasPrice("sky-1"));
        Assert.False(Pricing.HasPrice("sky-closed"));              // closed: not offered, though FareBook.Priced says it has sample prices
        Assert.True(FareBook.Priced("sky-closed"));
        Assert.Equal(6, Pricing.CategoriesOf("sun-2027-03-21").Count);   // the older sailings keep the older six
        Assert.Null(Pricing.FareFor("sun-2027-03-21", "sky-balcony"));
    }
}
