using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>The public side of booking: what sails, what it costs and which staterooms are free. Anonymous callers get real time (D4 only applies to a signed-in demo user).</summary>
public sealed class DiscoverService(ITripStore trips, IBookingStore bookings, IClock clock)
{
    private static string Iso(DateTime d) => DateOnly.FromDateTime(d).ToString("yyyy-MM-dd");

    private async Task<List<SailingRow>> PricedAsync(CancellationToken ct) =>
        (await trips.ListSailingsAsync(ct)).Where(s => Pricing.HasPrice(s.Id)).ToList();

    private async Task<SailingRow> SailingAsync(string sailingId, CancellationToken ct) =>
        (await trips.ListSailingsAsync(ct)).FirstOrDefault(s => s.Id == sailingId && Pricing.HasPrice(s.Id)) ?? throw ApiException.Invalid("sailing");

    public async Task<List<SailingOfferDto>> OffersAsync(CancellationToken ct) =>
        (await PricedAsync(ct)).Select(s => new SailingOfferDto(s.Id, Iso(s.Departure), s.IsHoliday, Pricing.FromPriceOf(s.Id)!)).ToList();

    public async Task<QuoteResult> QuoteAsync(string sailingId, string? category, int guests, CancellationToken ct)
    {
        await SailingAsync(sailingId, ct);
        return Pricing.Quote(sailingId, category ?? "", guests) ?? throw ApiException.Invalid("quote");
    }

    public async Task<List<BookableSailingDto>> DatesAsync(CancellationToken ct)
    {
        var today = TripRules.Today(clock.UtcNow);
        return (await PricedAsync(ct)).Select(s =>
        {
            var days = TripRules.DaysBetween(today, DateOnly.FromDateTime(s.Departure));
            return new BookableSailingDto(s.Id, Iso(s.Departure), s.IsHoliday, Pricing.FromPriceOf(s.Id)!, days, s.BookingOpen && Pricing.Bookable(days));
        }).ToList();
    }

    public async Task<List<RoomOptionDto>> RoomsAsync(string sailingId, CancellationToken ct)
    {
        await SailingAsync(sailingId, ct);
        return [.. Pricing.CategoriesOf(sailingId).Select(c => (Cat: c, Fare: Pricing.FareFor(sailingId, c.Id))).Where(x => x.Fare is not null)
            .Select(x => new RoomOptionDto(x.Cat.Id, x.Fare!.Value, Pricing.CapacityOf(x.Cat.Id), Pricing.FareIncluded(x.Cat.Id), x.Cat.Name, x.Cat.Suite, FareBook.Category(x.Cat.Id)?.SizeSqFt ?? 0, FareBook.Category(x.Cat.Id)?.Description ?? ""))];
    }

    /// <summary>The room types of any sailing that has prices in data, open for booking or not, with the ship's own words for each and a sample fare. 400 for a sailing with no prices.</summary>
    public async Task<List<SampleRoomDto>> SampleRoomsAsync(string sailingId, CancellationToken ct)
    {
        if (!(await trips.ListSailingsAsync(ct)).Any(s => s.Id == sailingId) || !(Pricing.HasPrice(sailingId) || FareBook.Priced(sailingId))) throw ApiException.Invalid("sailing");
        var nights = Pricing.NightsOf(sailingId);
        return [.. Pricing.CategoriesOf(sailingId).Select(c =>
        {
            var own = FareBook.Category(c.Id);
            var fare = Pricing.FareFor(sailingId, c.Id);
            return fare is null ? null : new SampleRoomDto(c.Id, c.Name, c.Suite, c.Capacity, own?.SizeSqFt ?? 0, own?.Description ?? "", fare.Value / nights, fare.Value);
        }).OfType<SampleRoomDto>()];
    }

    /// <summary>The cabins already booked on a sailing, after checking the sailing and room type.</summary>
    public async Task<HashSet<string>> TakenAsync(string sailingId, string? category, CancellationToken ct)
    {
        await SailingAsync(sailingId, ct);
        if (!CabinGuideRules.ValidCategory(category)) throw ApiException.Invalid("category");
        return await bookings.TakenCabinsAsync(sailingId, ct);
    }

    public async Task<List<CabinInfo>> CabinsAsync(string sailingId, string? category, CancellationToken ct)
    {
        await SailingAsync(sailingId, ct);
        if (Pricing.Category(category) is null) throw ApiException.Invalid("category");
        return CabinRules.CabinsFor(sailingId, category!, await bookings.TakenCabinsAsync(sailingId, ct));
    }
}
