using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Trip check-up, plan lint and deadline radar (phase P3). Reads the signed-in guest's current or next confirmed trip (booking, party, tours, dinners), hands <see cref="StanleyCheckupRules"/> facts that carry
/// no names, numbers or document detail (travellers are only "Traveller 2"), and returns ranked findings each with a screen to fix it. It writes nothing and changes nothing; a finding is advice with a route.
/// </summary>
public sealed class StanleyCheckupService(ITripStore trips, IAccountStore accounts, IPlanStore plan, IUserClock clock)
{
    public async Task<CheckupDto> RunAsync(UserRecord user, CancellationToken ct)
    {
        var now = await clock.NowAsync(user, ct);
        var today = TripRules.Today(now);
        var booking = (await trips.ListForUserAsync(user.Id, ct))
            .Where(b => b.Status == "confirmed" && DateOnly.FromDateTime(b.Departure).AddDays(b.Nights) >= today).OrderBy(b => b.Departure).FirstOrDefault();
        if (booking is null) return new CheckupDto(false, [], [], [], false, null);

        var departure = DateOnly.FromDateTime(booking.Departure);
        var agent = booking.Kind == "agent";
        var travellers = new List<CheckTraveller>();
        if (!agent)
        {
            var position = 0;
            foreach (var g in await accounts.GetPartyAsync(booking.BookingId, ct))
                travellers.Add(new CheckTraveller(++position, AccountRules.AgeOn(DateOnly.FromDateTime(g.Dob), departure), DocumentService.Check(g, booking.Departure, booking.Nights)));
        }

        var tours = (await plan.ListToursAsync(booking.BookingId, ct)).Where(x => x.Status == "booked")
            .Select(x => (Row: x, Excursion: ExcursionRules.ById(x.ExcursionId))).Where(x => x.Excursion is not null)
            .Select(x => new CheckTour(x.Row.Day, x.Excursion!.Name, x.Excursion.Start, x.Excursion.Hours)).ToList();
        var meals = (await plan.ListTablesAsync(booking.BookingId, ct)).Select(x => new StanleyItem(x.Day, DiningRules.VenueById(x.VenueId)?.Name ?? "Dinner", x.Time)).ToList();

        var finalDue = DateOnly.FromDateTime(booking.FinalDueDate);
        var paymentPlan = new TripRules.PaymentPlan(booking.TotalCents, booking.DepositCents, booking.TotalCents - booking.DepositCents, finalDue.ToString("yyyy-MM-dd"), "");
        var payment = TripRules.PaymentState(paymentPlan, booking.PaidCents >= booking.TotalCents, today);
        var opens = TripRules.CheckinOpensAt(departure);
        var closes = TripRules.CheckinClosesAt(departure);
        var checkin = booking.CheckinFinishedAt is not null ? "done" : TripRules.CheckinWindow(now, opens, closes);

        var facts = new CheckupFacts(today, now, departure, booking.Nights, TimelineBook.For(booking.SailingId, departure), payment, finalDue, checkin, opens, closes, agent, travellers, tours, meals);
        return StanleyCheckupRules.Build(facts, now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
}
