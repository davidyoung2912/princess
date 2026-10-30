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
        return Pricing.Categories.Select(c => new RoomOptionDto(c.Id, Pricing.FareFor(sailingId, c.Id)!.Value, Pricing.CapacityOf(c.Id), Pricing.FareIncluded(c.Id))).ToList();
    }

    public async Task<List<CabinInfo>> CabinsAsync(string sailingId, string? category, CancellationToken ct)
    {
        await SailingAsync(sailingId, ct);
        if (Pricing.Category(category) is null) throw ApiException.Invalid("category");
        return CabinRules.CabinsFor(sailingId, category!, await bookings.TakenCabinsAsync(sailingId, ct));
    }
}
