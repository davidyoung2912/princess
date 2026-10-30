using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>One part of a charge, with the card already resolved from the person's saved cards.</summary>
public sealed record ChargePart(string Method, long? CardId, string? Brand, string? Last4, bool IsDefaultCard, long Cents)
{
    /// <summary>How the screens word the method: "Visa ending 4242", or "Device wallet".</summary>
    public string Description => Method == "wallet" ? "Device wallet" : $"{TripService.BrandName(Brand ?? "")} ending {Last4}";
}

public sealed record ChargedPart(ChargePart Part, bool ChallengeUsed);

/// <summary>What was taken: one reference for the payment and how each part was made.</summary>
public sealed record ChargeResult(string Reference, IReadOnlyList<ChargedPart> Parts);

/// <summary>
/// The card network behind a payment (D11). The real one would talk to a processor; <see cref="MockPaymentGateway"/> keeps the pretend bank's behaviour
/// the screens already handle. It throws <c>declined</c> or <c>challenge</c> before any money moves, so the caller records a payment only after it returns.
/// </summary>
public interface IPaymentGateway
{
    Task<ChargeResult> ChargeAsync(string reference, IReadOnlyList<ChargePart> parts, string? challenge, CancellationToken ct);
}

/// <summary>A card ending 0002 is declined; a card that is not the default, or any card payment of $3,000 or more, needs the one-time code 123456.</summary>
public sealed class MockPaymentGateway : IPaymentGateway
{
    public Task<ChargeResult> ChargeAsync(string reference, IReadOnlyList<ChargePart> parts, string? challenge, CancellationToken ct)
    {
        foreach (var p in parts)
            if (p.Method == "card" && p.Last4 == Pricing.DeclinedLast4) throw ApiException.Declined(p.Description);

        var asked = parts.Any(p => PaymentRules.ScaRequired(p.Method, p.IsDefaultCard, p.Cents));
        if (asked)
        {
            if (string.IsNullOrWhiteSpace(challenge)) throw ApiException.Challenge("required");
            if (challenge.Trim() != Pricing.ScaDemoCode) throw ApiException.Challenge("wrong");
        }
        return Task.FromResult(new ChargeResult(reference, [.. parts.Select(p => new ChargedPart(p, asked && PaymentRules.ScaRequired(p.Method, p.IsDefaultCard, p.Cents)))]));
    }
}
