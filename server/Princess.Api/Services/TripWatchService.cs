using Princess.Api.Data;
using Princess.Api.Contracts;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What is worth telling the guest about their current trip beyond the basics: the next instalment, the tender boats and the onward flight. Shared by the notifications centre and the push check so the two never disagree.</summary>
public sealed record TripWatches(
    InstalmentPayment? Instalment,
    bool InstalmentAuto,
    (string Port, string Date, string Band, int Percent)? Tender,
    (string Flight, string Date, string State, int DelayMinutes)? Flight);

public sealed class TripWatchService(IBookingStore bookings, ITenderOutlook tender, IFinishStore finish, IFlightStatusProvider flights)
{
    public async Task<TripWatches> WatchAsync(BookingRow current, TripViewDto trip, DateOnly today, CancellationToken ct)
    {
        var choice = current.PaidCents < current.TotalCents ? await bookings.GetInstalmentChoiceAsync(current.BookingId, ct) : null;
        var next = choice is null ? null : InstalmentRules.Next(choice, DateOnly.ParseExact(trip.Plan.FinalDue, "yyyy-MM-dd"), current.TotalCents - current.PaidCents);
        var timeline = TimelineBook.For(current.SailingId, DateOnly.FromDateTime(current.Departure));
        var tenderWatch = TenderRules.Watch(timeline.Days.Select(d => (d.Port, d.Date)), today, tender.Outlook);
        // The onward flight (saved on the disembark screens) leaves on the last day of the sailing.
        var onward = await finish.GetOnwardAsync(current.BookingId, ct);
        var flight = onward is null ? null : FlightRules.Watch(onward.Flight, timeline.LastDay, today, flights.Status);
        return new(next, choice?.AutoCard is not null, tenderWatch, flight);
    }
}
