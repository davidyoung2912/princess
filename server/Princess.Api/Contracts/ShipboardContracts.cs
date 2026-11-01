using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 10b wire shapes; they match OrderMenuView, OrderView, FamilyView, HealthView, RoomView, PhotosView, LaundryView, WifiView and UpdateView in src/api/types.ts, src/api/careTypes.ts and the domain files they use.
// Guests are the public guid of their user (D2). Instants are epoch ms (D6), dates "YYYY-MM-DD".

// ---- Orders ----

public sealed record OrderGuestDto(Guid Id, string Name, int Age, int DrinkCapUsd);

public sealed record OrderMenuDto(bool Open, List<string> OutOfStock, List<OrderGuestDto> Guests, string Cabin, int Deck, List<Morning> Mornings, bool Isolating, bool CanOrder);

public sealed record OrderDto(
    Guid Id, string Kind, long PlacedAt, long? DeliverAt, OrderLocation Location, long Tip, string Stage, long? EtaAt, List<PricedLine> Lines, long Fee, long Service, long Total, long Covered,
    List<int> Unavailable, long Refund, bool CanCancel, bool CanMove, int Contacted, bool Free);

public sealed record OrderLineRequest(string? ItemId, int Qty, List<string>? Extras, Guid Guest, string? Note);

public sealed record PlaceOrderRequest(string? Kind, List<OrderLineRequest>? Lines, OrderLocation? Location, long Tip, long? DeliverAt);

public sealed record ResolveOrderRequest(Dictionary<int, string>? Choices);

public sealed record MoveOrderRequest(OrderLocation? Location);

// ---- Family ----

public sealed record KidClubDto(string Id, string Name, bool Open, string Opens, string Closes);

public sealed record InClubDto(string ClubId, long At);

public sealed record FamilyKidDto(
    Guid Id, string Name, int Age, KidClubDto? Club, InClubDto? InClub, Seen Seen, string Status, List<string> Zones, Authorisation Auth, bool CanCheckOut);

public sealed record FamilyLogDto(Guid Id, long At, string Text);

public sealed record FamilyViewDto(List<FamilyKidDto> Kids, List<GuestDto> Adults, ReunionPlan Reunion, List<FamilyLogDto> Log, bool CanEdit);

public sealed record SetZonesRequest(List<string>? Zones);

public sealed record SetAuthRequest(List<Guid>? Pickup, bool SignOutAlone, bool Photos);

public sealed record SetReunionRequest(string? PlaceId, string? BackupId, string? Note);

// ---- Health ----

public sealed record HealthReportDto(Guid Id, long At, List<Guid> Guests, List<string> Symptoms, int StartedHoursAgo);

public sealed record HealthRequestDto(Guid Id, long At, string Kind, string Note);

public sealed record HealthViewDto(
    string Day, bool Open, string? NextOpen, bool Notice, bool Isolating, List<HealthReportDto> Reports, List<HealthRequestDto> Requests, List<GuestDto> Guests);

public sealed record HealthReportRequest(List<Guid>? Guests, List<string>? Symptoms, int? StartedHoursAgo);

public sealed record HealthRequestRequest(string? Kind, string? Note);

// ---- Stateroom ----

public sealed record RoomViewDto(
    string Number, int Deck, string Steward, List<string> Amenities, string Muster, bool HasView, Housekeeping Housekeeping, Devices Devices, bool CheckDue, bool CanEdit);

// ---- Photos ----

public sealed record PhotoReceiptDto(Guid Id, long At, string Option, List<string> PhotoIds, long Paid, int Saved, bool Verified, long Until);

public sealed record PhotosViewDto(
    List<Photo> Photos, List<string> Favourites, List<string> Owned, List<PhotoReceiptDto> Receipts, int IncludedLeft, List<PhotographerSlot> Schedule, List<GuestDto> People, int ThroughDay);

public sealed record PhotoQuoteDto(int Included, int Paid, List<PhotoOption> Options, string Cheapest);

public sealed record PhotoIdsRequest(List<string>? PhotoIds);

public sealed record BuyPhotosRequest(List<string>? PhotoIds, string? Option);

// ---- Laundry ----

public sealed record LaundryRequestDto(Guid Id, string Service, int Qty, long PickupAt, long ReturnAt, string Stage, long Total, long Free, string Note);

public sealed record LaundryViewDto(List<LaundryRequestDto> Requests, Dictionary<string, List<PickupOption>> Pickups, bool FreeBagLeft, bool CanRequest);

public sealed record LaundryRequestBody(string? Service, int Qty, long PickupAt, string? Note);

// ---- Wi-Fi ----

public sealed record WifiDeviceDto(Guid Id, string Name, string Plan, long AddedAt, int Days, bool Included, long Paid, long UsedMb, int? CapMb, long ExpiresAt, bool Expired);

public sealed record WifiViewDto(List<WifiDeviceDto> Devices, int IncludedLeft, bool CanBuy);

public sealed record AddWifiRequest(string? Name, string? Plan, int? Days);

public sealed record UpgradeWifiRequest(string? Plan);

// ---- Trip updates ----

public sealed record UpdateAckDto(string Option, long At);

public sealed record UpdateViewDto(string Id, string Severity, bool Active, UpdateAckDto? Ack);

public sealed record AcknowledgeRequest(string? Option);
