using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 8b wire shapes for waits, shows and the before-the-cruise services; they match WaitsView, TicketView (careTypes.ts) and the Ahead views (aheadTypes.ts).
// Guests are the public guid of their user (D2). Instants are epoch ms (D6), times "HH:mm".

public sealed record GuestDto(Guid Id, string Name);

public sealed record QueueDto(Guid Id, string VenueId, long JoinedAt, string Stage, int Position, int WaitMinutes, long ReadyAt, long ExpiresAt);

public sealed record WaitlistDto(Guid Id, string VenueId, int Day, string Time, long SlotAt, List<GuestDto> Guests, string Stage, int Position, long OfferAt, long ExpiresAt, bool Auto);

public sealed record AutoBookedDto(Guid Id, string VenueId, int Day, string Time);

public sealed record WaitsViewDto(List<string> Open, List<QueueDto> Queues, List<WaitlistDto> Waitlist, List<AutoBookedDto> AutoBooked);

public sealed record JoinQueueRequest(string? VenueId);

public sealed record JoinWaitlistRequest(string? VenueId, int Day, string? Time, List<Guid>? Guests, bool Auto);

public sealed record ShowSeatsDto(string EventId, int Left);

public sealed record ShowTicketDto(Guid Id, string EventId, string Title, int Day, long StartAt, string PlaceId, string Status, List<GuestDto> Guests, bool CanReturn);

public sealed record ReserveTicketsRequest(string? EventId, int Day, List<Guid>? Guests);

// ---- Advisors, marketing, loyalty ----

public sealed record AdvisorRequestDto(Guid Id, string AdvisorId, string Advisor, string Way, string Question, long At, string? Reply, long? CallbackBy);

public sealed record AskAdvisorRequest(string? AdvisorId, string? Way, string? Phone, string? Question);

public sealed record MarketingChoiceDto(string Channel, string Contact, string Region, string State, long? AskedAt, long? ConfirmedAt, bool NeedsCode, string? DemoCode);

public sealed record MarketingViewDto(List<MarketingChoiceDto> Choices, bool CanEdit);

public sealed record SubscribeRequest(string? Contact, string? Region);

public sealed record ConfirmConsentRequest(string? Code);

public sealed record LoyaltyDto(string Number, string Tier, long CreditLeft);

// ---- Upgrades ----

public sealed record UpgradeBidDto(Guid Id, string Category, long Cents, long At, string Status, bool BuyNow);

public sealed record UpgradesViewDto(string Current, List<UpgradeOffer> Offers, List<UpgradeBidDto> Bids, long DecidedAt, bool Open, bool CanEdit);

public sealed record PlaceBidRequest(string? Category, long Cents);

// ---- Clubs ----

public sealed record ClubFormDto(Guid ChildId, string Allergies, string Medical, string Medication, bool PhotoConsent, List<Pickup> Pickups, bool SelfSignOut, string EmergencyPhone, bool Confirmed);

public sealed record ClubChildDto(Guid Id, string Name, int Age, string? Club, bool Registered, ClubFormDto? Registration);

public sealed record ClubsViewDto(List<ClubChildDto> Children, bool CanEdit, bool Open);

public sealed record SaveClubRequest(string? Allergies, string? Medical, string? Medication, bool PhotoConsent, List<Pickup>? Pickups, bool SelfSignOut, string? EmergencyPhone, bool Confirmed);

// ---- Medallion and tags ----

public sealed record MedallionEventDto(string Id, long At);

public sealed record MedallionViewDto(
    string Stage, List<MedallionEventDto> Events, bool CanActivate, long? ActivatedAt, long? LostAt, bool Replacement, List<GuestDto> Guests, string Address, string TrackingNumber, bool CanEdit);

public sealed record TagGuestDto(Guid Id, string Name, string Printed, string Cabin, int Deck);

public sealed record TagsViewDto(string? Way, List<TagGuestDto> Guests, long? OrderedAt, int DaysToDeparture, long? HandedOverAt, string Stage, bool CanEdit);

public sealed record ChooseTagRequest(string? Way);

public sealed record HandedOverRequest(bool On);

// ---- Cases ----

public sealed record FixCaseDto(Guid Id, string Flow, string Note, long At, string Reference, string Stage, long ContactBy);

public sealed record EscalateRequest(string? Flow, string? Note);

public sealed record AssistCaseDto(Guid Id, string Kind, string Note, string Phone, long At, string Stage, string Reference, string? BookingNumber, CompassionTerms? Terms, string? Choice);

public sealed record AskAssistCaseRequest(string? Kind, string? Phone, string? Note);

public sealed record ChoiceRequest(string? Choice);
