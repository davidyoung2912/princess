using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Princess.Api.Contracts;

// Wire shapes match the TypeScript types in src/api/types.ts, careTypes.ts and aboardTypes.ts. Ids are public guids (D2), instants epoch ms (D6), dates "YYYY-MM-DD".

public sealed record PartyMemberDto(Guid Id, string Name, int Age, bool Child);

public sealed record EmergencyDto(string Name, string Phone, string Relationship);

public sealed record ProfileDto(
    string FirstName, string LastName, string Dob, string Email, string Phone, string Citizenship,
    string[] Dietary, string[] Needs, string Bedding, string SpecialRequests, EmergencyDto Emergency);

public sealed record ProfileViewDto(ProfileDto Profile, Guid Id, bool CanEdit, int DaysToDeparture);

public sealed record SaveHelperRequest(string? Name, string? Relationship, string[]? Permissions, string? Status);

/// <summary><paramref name="Linked"/> is true once the helper has accepted with their own account; until then <paramref name="InviteCode"/> is the code to give them (BM9).</summary>
public sealed record HelperDto(string Name, string Relationship, string[] Permissions, string Status, long At, bool Linked, string? InviteCode);
public sealed record AcceptHelperRequest(string? Code);
public sealed record AcceptedHelperDto(string GuestName, string Relationship);

public sealed record HistoryEntryDto(Guid Id, long At, string By, string What, string Detail);

public sealed record CheckinStatusDto(string State, long OpensAt, long ClosesAt);

public sealed record PlanDto(long Total, long Deposit, long Balance, string FinalDue, string Booked);

public sealed record TripDocumentsDto(int Guests, int Missing, int PassportProblems);

public sealed record TripViewDto(
    string Number, string Kind, string SailingId, string Departure, string CategoryName, int Guests, int DaysToDeparture,
    PlanDto Plan, string Payment, TripDocumentsDto? Documents, CheckinStatusDto Checkin, string Next,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Agent);

/// <summary>What a helper with the Trip permission sees of a guest's sailing: no prices, documents or check-in.</summary>
public sealed record HelperTripDto(string Number, string SailingId, string Departure, string CategoryName, int Guests, int DaysToDeparture);

public sealed record PastTripDto(
    string Id, string Title, string Ship, string Departure, int Nights,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Cancelled);

public sealed record TripsViewDto(List<TripViewDto> Upcoming, List<PastTripDto> Past);

public sealed record LinkTripRequest(string? Number, string? LastName, string? Departure);

public sealed record ReceiptDto(string Id, string Label, long Cents, long At, string Method);

public sealed record CardDto(Guid Id, string Brand, string Last4, string Expiry);

public sealed record PaymentsViewDto(TripViewDto Trip, List<ReceiptDto> Receipts, List<CardDto> Cards, bool CanPay);

public sealed record AddCardRequest(string? Brand, string? Last4, string? Expiry);

/// <summary>A guest this person helps. <paramref name="Booking"/> is the guest's current booking, only when the grant holds view and payments, folio, checkin or trip.</summary>
public sealed record HelpedGuestDto(Guid GuestId, string Name, string Relationship, string[] Permissions, long Since, string? Booking);

public sealed record PayBalanceRequest(Guid? CardId);

public sealed record BookingCoreDto(
    string Number, Guid PersonaId, Guid BookerId, string SailingId, string Departure, List<Guid> Party,
    string Category, string Stateroom, string? CabinNumber, string Tier, string Package);

public sealed record SailingDto(string Id, string Departure, bool Holiday, bool Reference);

public sealed record RequirementDto(string Id, string Level, string[] SatisfiedBy);

public sealed record ReqResultDto(
    RequirementDto Requirement, string Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? UsedDoc,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Problem);

public sealed record HeldDocDto([property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Expires);

public sealed record GuestDocumentsDto(
    Guid Id, string Name, int Age, string Citizenship, Dictionary<string, HeldDocDto> Held, List<ReqResultDto> Results, int Blocking);

public sealed record DocumentsViewDto(string ReturnDate, List<GuestDocumentsDto> Guests, bool CanEdit);

public sealed record SetDocumentRequest(string? Expires);

public sealed record NoticeDto(string Id, string Category, Dictionary<string, object> Params, bool Read);

public sealed record NotificationsDto(List<NoticeDto> Notices, JsonObject Prefs);

public sealed record MarkReadRequest(string[]? Ids);

public sealed record TicketDto(Guid Id, string Kind, long At, string Status, string Detail);

public sealed record CreateTicketRequest(string? Kind, string? Phone, string? Message);

public sealed record ContactsDto(string GuestServices, string Emergency);

public sealed record FeedbackRowDto(Guid Id, string Kind, string Text, long At, string[] Log, string Reference, bool Screenshot);

public sealed record SendFeedbackRequest(string? Kind, string? Text, string[]? Log, string? Screenshot);

public sealed record ToggleFavouriteRequest(string? Key);

public sealed record PrivacyPersonDto(Guid Id, string Name, int Age, Dictionary<string, bool> Consents, bool CanEdit);

public sealed record DeletedRunDto(string[] Kinds, long At);

public sealed record AccessEntryDto(long At, string What, string Action, string By);

public sealed record PrivacyViewDto(
    string CruiseEnds, Dictionary<string, string?> DeleteOn, List<DeletedRunDto> Deleted, List<PrivacyPersonDto> People, List<AccessEntryDto> Access);

public sealed record SetConsentRequest(bool? On);

public sealed record BudgetKidDto(Guid Id, string Name, int Age);

public sealed record BudgetViewDto(JsonObject Budget, List<BudgetKidDto> Kids, bool CanEdit);

// ---- Account state (multi-device, docs/multi-device-plan.md) ----

/// <summary>One saved document. <c>Version</c> starts at 1 and goes up by one with each save.</summary>
public sealed record StateDto(string Key, int Version, JsonNode? Data, long UpdatedAt);
public sealed record StateSummaryDto(string Key, int Version, long UpdatedAt);
/// <summary><c>BaseVersion</c> is the version the caller last saw (0 for none); a different current version is a 409.</summary>
public sealed record SaveStateRequest(JsonNode? Data, int BaseVersion);
/// <summary>Everything kept as account state: the person's own documents and, per booking they are on, the booking's.</summary>
public sealed record StateExportDto(long ExportedAt, List<StateDto> Account, List<BookingStateExportDto> Bookings, List<ExportTripDto> Trips);
/// <summary>One booking in the whole-history download: what the guest sailed (or will sail) on.</summary>
public sealed record ExportTripDto(string Number, string Sailing, string Ship, string Departure, int Nights, string Category);
public sealed record BookingStateExportDto(string Number, List<StateDto> Documents);

/// <summary>A person on the trip. <c>Booker</c> is the person who holds the booking (themselves for an adult booker).</summary>
public sealed record PersonDto(Guid Id, string Name, string FirstName, int? Age, bool Child, Guid Booker, string Tier);

public sealed record ContextBookingDto(string Number, string SailingId, string Package, string Category);

/// <summary>
/// Everything a device needs to know about who and when: the signed-in person, the people on their current trip, the trip, the sailing the app is on
/// (a demo account's chosen one), the phone zone a demo account chose, and the server's "now" in milliseconds since 1970. <c>Stage</c> is the journey stage
/// (docs/stage-experience-plan.md section 3), <c>FocusSailingId</c> the sailing it is about (null in dream) and <c>StageReason</c> the event that put the guest there.
/// </summary>
public sealed record ContextDto(PersonDto Person, List<PersonDto> Party, ContextBookingDto? Booking, string? SailingId, string? PhoneZone, long NowMs, bool IsDemo, string Stage, string? FocusSailingId, string StageReason);

public sealed record JourneyEventRequest(string? Kind, string? SailingId);
