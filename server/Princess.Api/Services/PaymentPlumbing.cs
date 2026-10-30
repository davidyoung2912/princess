using Princess.Api.Contracts;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>The steps every card payment shares, whatever it pays for: check the parts add up, resolve the saved cards, and shape the gateway's answer into a payment row.</summary>
public static class PaymentPlumbing
{
    /// <summary>Checks the parts add up and resolves each saved card. Nothing is charged here.</summary>
    public static async Task<List<ChargePart>> ResolvePartsAsync(ITripStore trips, UserRecord actor, List<PaymentPartDto>? dtos, long due, DateOnly today, CancellationToken ct)
    {
        var parts = (dtos ?? []).Select(p => new PaymentPart(p.Method ?? "", p.CardId, p.Cents)).ToList();
        if (PaymentRules.CheckParts(parts, due) is not null) throw ApiException.Invalid("payment");
        var cards = parts.Any(p => p.Method == "card") ? await trips.ListCardsAsync(actor.Id, ct) : [];
        var charge = new List<ChargePart>();
        foreach (var p in parts)
        {
            if (p.Method == "wallet") { charge.Add(new ChargePart("wallet", null, null, null, false, p.Cents)); continue; }
            var card = cards.FirstOrDefault(c => c.PublicId == p.CardId);
            if (card is null || AccountRules.CardExpired(card.Expiry, today)) throw ApiException.Invalid("card");
            charge.Add(new ChargePart("card", card.Id, card.Brand, card.Last4, card.IsDefault, p.Cents));
        }
        return charge;
    }

    public static NewBookingPayment PaymentOf(UserRecord actor, string label, string reference, DateTime at, ChargeResult result) =>
        new(actor.Id, label, result.Parts.Sum(p => p.Part.Cents), reference, at,
            [.. result.Parts.Select(p => new NewPaymentPart(p.Part.Method, p.Part.CardId, p.Part.Brand, p.Part.Last4, p.Part.Cents, p.ChallengeUsed))]);

    /// <summary>A refund to the card the money came from: a negative payment with no parts, as booking cancellation records it.</summary>
    public static NewBookingPayment RefundOf(UserRecord actor, string reference, long cents, DateTime at) => new(actor.Id, "refund", -cents, reference, at, []);
}
