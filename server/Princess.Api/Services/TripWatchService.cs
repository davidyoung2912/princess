using Princess.Api.Data;
using Princess.Api.Contracts;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>What is worth telling the guest about their current trip beyond the basics: the next instalment, the tender boats and the onward flight. Shared by the notifications centre and the push check so the two never disagree.</summary>
public sealed record TripWatches(
    InstalmentPayment? Instalment,
    bool InstalmentAuto,
    (string Port, string Date, string Band, int Percent)? Tender,
    (string Flight, string Date, string State, int DelayMinutes)? Flight,
    InstalmentPayment? InstalmentTaken = null);

public sealed class TripWatchService(IBookingStore bookings, ITenderOutlook tender, IFinishStore finish, IFlightStatusProvider flights, ITripStore tripStore)
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
        var taken = await TakenAsync(current, today, ct);
        return new(next, choice?.AutoCard is not null, tenderWatch, flight, taken);
    }

    /// <summary>The latest instalment taken automatically (reference <c>PAY-number-I-yyyymmdd</c>) in the last <see cref="InstalmentRules.TakenDays"/> days, so a guest hears it was paid.</summary>
    private async Task<InstalmentPayment?> TakenAsync(BookingRow current, DateOnly today, CancellationToken ct)
    {
        var prefix = $"PAY-{current.Number}-I-";
        var rows = await tripStore.ListPaymentsAsync(current.BookingId, ct);
        var last = rows.Where(p => p.Status == "captured" && p.Reference is not null && p.Reference.StartsWith(prefix, StringComparison.Ordinal)).OrderBy(p => p.At).LastOrDefault();
        if (last is null) return null;
        var paidOn = DateOnly.FromDateTime(last.At);
        if (today.DayNumber - paidOn.DayNumber is < 0 or > InstalmentRules.TakenDays) return null;
        var d = last.Reference![prefix.Length..];
        return DateOnly.TryParseExact(d, "yyyyMMdd", out var due) ? new(due.ToString("yyyy-MM-dd"), last.AmountCents) : null;
    }
}
