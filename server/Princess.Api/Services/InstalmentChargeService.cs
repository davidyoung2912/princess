using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// Takes a due instalment from the saved card the guest chose for it (X10j). There is no background scheduler, so this runs when that guest's app next checks
/// (the notifications centre and the push check), on or after the payment's date. A payment that is declined, needs a code or has an expired card is left unpaid:
/// the reminder stays and the guest pays by hand. Only the person who switched it on can trigger it, because the card is theirs.
/// </summary>
public sealed class InstalmentChargeService(TripService trips, IBookingStore bookings, ITripStore tripStore, IPaymentGateway gateway, IAccountStore accounts)
{
    /// <summary>Whether an instalment was taken.</summary>
    public async Task<bool> ChargeDueAsync(UserRecord actor, DateTime now, CancellationToken ct)
    {
        if (await trips.CurrentAsync(actor, now, ct) is not { } current || current.PaidCents >= current.TotalCents) return false;
        if (await bookings.GetInstalmentChoiceAsync(current.BookingId, ct) is not { AutoCard: { } cardId } choice || choice.AutoUserId != actor.Id) return false;

        var trip = await trips.BuildAsync(current, current: true, now, ct);
        var today = TripRules.Today(now);
        var next = InstalmentRules.Next(choice, DateOnly.ParseExact(trip.Plan.FinalDue, "yyyy-MM-dd"), current.TotalCents - current.PaidCents);
        if (next is null || string.CompareOrdinal(next.Date, today.ToString("yyyy-MM-dd")) > 0) return false;

        try
        {
            var parts = await PaymentPlumbing.ResolvePartsAsync(tripStore, actor, [new PaymentPartDto("card", cardId, next.Cents)], next.Cents, today, ct);
            var reference = $"PAY-{current.Number}-I-{next.Date.Replace("-", "")}";
            var charged = await gateway.ChargeAsync(reference, parts, null, ct);
            await bookings.AddPaymentAsync(current.BookingId, PaymentPlumbing.PaymentOf(actor, "balance", reference, now, charged), ct);
            await accounts.AddHistoryAsync(actor.Id, actor.Id, "payment", $"{current.Number}: instalment paid automatically", now, ct);
            return true;
        }
        catch (ApiException)
        {
            return false;
        }
    }
}
