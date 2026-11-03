using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Builds <see cref="StanleyTrip"/> from the stores: the guest's current or next confirmed trip, reduced to facts with no names, numbers, documents,
/// contact or payment data. Only the fields that make it into the record can reach a model or a reply.
/// </summary>
public sealed class StanleyTripLoader(ITripStore trips, IAccountStore accounts, IPlanStore plan, IUserClock clock) : IStanleyTrips
{
    public async Task<StanleyTrip?> LoadAsync(UserRecord user, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(await clock.NowAsync(user, ct));
        var booking = (await trips.ListForUserAsync(user.Id, ct))
            .Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today).OrderBy(b => b.Departure).FirstOrDefault();
        if (booking is null) return null;

        var ages = (await accounts.GetPartyAsync(booking.BookingId, ct)).Select(g =>
        {
            var dob = DateOnly.FromDateTime(g.Dob);
            return today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
        }).ToList();
        var tours = (await plan.ListToursAsync(booking.BookingId, ct)).Where(x => x.Status == "booked" && ExcursionRules.ById(x.ExcursionId) is not null)
            .Select(x => { var e = ExcursionRules.ById(x.ExcursionId)!; return new StanleyItem(x.Day, e.Name, e.Start); }).ToList();
        var meals = (await plan.ListTablesAsync(booking.BookingId, ct)).Select(x => new StanleyItem(x.Day, DiningRules.VenueById(x.VenueId)?.Name ?? "Dinner", x.Time)).ToList();
        var packages = (await plan.ListPurchasesAsync(booking.BookingId, ct)).Where(x => x.Status == "active")
            .Select(x => PackageRules.NameOf(x.ItemId)).OfType<string>().Distinct().ToList();
        return new StanleyTrip(today, DateOnly.FromDateTime(booking.Departure), booking.Nights, booking.ShipName, booking.CategoryName, booking.Dining, ages, tours, meals, packages, booking.SailingId);
    }
}
