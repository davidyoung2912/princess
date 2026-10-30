using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 7 wire shapes; they match SailingOffer, BookableSailing, RoomOption, FareOption, QuoteView, PrefillView, ResumeSent, BookingView and ChangePreview in src/api/types.ts.

public sealed record SailingOfferDto(string Id, string Departure, bool Holiday, FromPrice From);

public sealed record BookableSailingDto(string Id, string Departure, bool Holiday, FromPrice From, int DaysToDeparture, bool Open);

public sealed record RoomOptionDto(string Id, long Fare, int Capacity, string? Includes);

public sealed record FareOptionDto(string Id, long Total, long Difference, bool Included, long PerNight);

public sealed record PerksDto(bool NumberOk, string Tier, long Discount, long Credit, long CreditLeft);

public sealed record QuoteViewDto(QuoteResult Quote, List<Promotion> Promotions, long LockedUntil, PayPlan Pay, int DaysToDeparture, long Total, PerksDto Perks);

public sealed record PrefillDto(List<GuestDraft> People, LeadContact Contact);

public sealed record SendResumeLinkRequest(string? Via, string? To);

public sealed record ResumeSentDto(string Via, string To, string Link, long At);

/// <summary><c>cardId</c> is the public id of a saved card (<c>GET /me/payments</c>); a device wallet has none.</summary>
public sealed record PaymentPartDto(string? Method, Guid? CardId, long Cents);

public sealed record BookRequest(Draft? Draft, long ExpectedTotal, string? Option, List<PaymentPartDto>? Parts, string? Challenge);

public sealed record PayBalancePartsRequest(List<PaymentPartDto>? Parts, string? Challenge);

public sealed record BookingReceiptDto(string Id, string Label, long Cents, long At, string[] Methods);

public sealed record NotifiedDto(string Via, string To);

public sealed record CancelledDto(long At, long Fee, long Refund);

public sealed record BookingViewDto(
    string Number, string Status, string SailingId, string Departure, string ReturnDate, string Category, string CategoryName, string? Cabin, string Fare,
    List<GuestDraft> People, LeadContact Contact, string Dining, string Occasion, long Total, long Paid, long Balance, string FinalDue, string Payment,
    List<BookingReceiptDto> Receipts, List<AcceptanceDto> Accepted, List<NotifiedDto> Notified, int DaysToDeparture, long CreatedAt,
    CancelTerms Cancel, bool CanCancel, bool CanChange, CancelledDto? Cancelled);

public sealed record ChangePreviewDto(string Check, long NewTotal, long Difference, bool CabinKept);
