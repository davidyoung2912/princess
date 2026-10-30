using System.Text.Json.Serialization;
using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 8 wire shapes for the pre-cruise plan; they match ExcursionsView, DiningView, PackagesView, ChecklistView, PackingView, TravelView and AssistanceView in src/api/types.ts.
// Guests are the public guid of their user (D2). Instants are epoch ms (D6), dates "YYYY-MM-DD", times "HH:mm".

public sealed record PlanOverviewDto(List<PlanRules.PlanDay> Days, int DaysToDeparture, string Departure);

public sealed record ExcursionOfferDto(Excursion Item, string Date, int Day, int Spots, string? Timing, string BackBy, int DaysToTour, bool Tender);

public sealed record TourBookingDto(Guid Id, string ExcursionId, List<Guid> Guests, long Total, long Credit, List<string> Methods, long At, string Status, TourRefund Cancel);

public sealed record CartLineDto(string ExcursionId, List<Guid> Guests, long Total);

public sealed record ExcursionsViewDto(
    List<ExcursionOfferDto> Offers, List<TourBookingDto> Booked, List<CartLineDto> Cart, long CartTotal, long CreditLeft, long CreditApplied,
    List<PartyMemberDto> Party, bool CanBook, int DaysToDeparture);

public sealed record CartRequest(List<Guid>? Guests);

public sealed record ChangeGuestsRequest(List<Guid>? Guests);

/// <summary>The excursion cart is paid with the credit first, then these parts. Not needed when the credit covers it all.</summary>
public sealed record CheckoutRequest(List<PaymentPartDto>? Parts, string? Challenge);

public sealed record DietaryNoteDto(string Name, string[] Needs);

public sealed record ReservationDto(
    Guid Id, string VenueId, int Day, string Time, List<Guid> Guests, string Note, List<DietaryNoteDto> Dietary, List<Guid> Covered, long Charge, long At, string ReminderOn, int LateMinutes);

public sealed record DiningViewDto(
    DiningWindowResult Window, string Plan, [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] string? Seating, List<ReservationDto> Reservations,
    List<PartyMemberDto> Party, int MealsLeft, bool CanBook, int DaysToDeparture);

public sealed record ReserveRequest(string? VenueId, int Day, string? Time, List<Guid>? Guests, string? Note);

public sealed record MoveRequest(int Day, string? Time);

public sealed record LateRequest(int Minutes);

public sealed record AddOnOfferDto(string Id, string Unit, long Price, long Base, string ChangeOn, long ChangesTo, List<PartyMemberDto> Eligible);

public sealed record UpgradeOptionDto(string To, long Price, string ChangeOn, long ChangesTo);

public sealed record UpgradeOfferDto(Guid Guest, string Name, string From, List<UpgradeOptionDto> Options);

public sealed record PurchasePriceDto(string State, long PerUnit, long Total);

public sealed record PurchaseViewDto(
    Guid Id, string Kind, string Item, List<Guid> Guests, long Unit, int Units, long Total, long At, List<string> Methods, string Status, PurchasePriceDto Price, long Credited, bool CanCancel);

public sealed record PersonEntitlementsDto(Guid Id, string Name, string Package, Entitlements Entitlements, Balances Balances);

public sealed record PooledDto(long Total, long Used, long Remaining);

public sealed record PackagesViewDto(
    List<AddOnOfferDto> AddOns, List<UpgradeOfferDto> Upgrades, List<PurchaseViewDto> Purchases, List<PersonEntitlementsDto> People, PooledDto Credit,
    List<PartyMemberDto> Party, int DaysToDeparture, bool CanBuy);

/// <summary><c>kind</c> is <c>addOn</c> (with <c>item</c>) or <c>upgrade</c> (with <c>to</c>).</summary>
public sealed record BuyRequest(string? Kind, string? Item, string? To, List<Guid>? Guests, List<PaymentPartDto>? Parts, string? Challenge);

public sealed record ChecklistViewDto(List<ChecklistEntry> Entries, List<Milestone> Milestones, ProgressDto Progress, ChecklistEntry? Next, int DaysToDeparture);

public sealed record ProgressDto(int Done, int Total);

public sealed record TickRequest(bool Done);

public sealed record PackingViewDto(List<PackItem> Items, List<string> Ticked, Weather Weather, int Nights, int DaysToDeparture);

public sealed record TravelViewDto(TravelPlan Plan, List<ArrivalWindow> Windows, bool Priority, string Suggested, bool CanEdit);

public sealed record SaveTravelRequest(string? Window, string? Mode, string? Hotel);

public sealed record DeadlineEntryDto(string Kind, Deadline Deadline);

public sealed record AssistRequestDto(Guid Id, string Kind, Guid Guest, string Note, long At, string Status);

public sealed record AssistanceViewDto(
    List<DeadlineEntryDto> Deadlines, List<AssistRequestDto> Requests, List<PartyMemberDto> Party, bool CanRequest, int DaysToDeparture, Dictionary<Guid, string[]> Needs);

public sealed record AssistRequestInput(string? Kind, Guid? Guest, string? Note);
