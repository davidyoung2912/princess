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

public sealed record HelperDto(string Name, string Relationship, string[] Permissions, string Status, long At);

public sealed record HistoryEntryDto(Guid Id, long At, string By, string What, string Detail);

public sealed record CheckinStatusDto(string State, long OpensAt, long ClosesAt);

public sealed record PlanDto(long Total, long Deposit, long Balance, string FinalDue, string Booked);

public sealed record TripDocumentsDto(int Guests, int Missing, int PassportProblems);

public sealed record TripViewDto(
    string Number, string Kind, string SailingId, string Departure, string CategoryName, int Guests, int DaysToDeparture,
    PlanDto Plan, string Payment, TripDocumentsDto? Documents, CheckinStatusDto Checkin, string Next,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Agent);

public sealed record PastTripDto(
    string Id, string Title, string Ship, string Departure, int Nights,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Cancelled);

public sealed record TripsViewDto(List<TripViewDto> Upcoming, List<PastTripDto> Past);

public sealed record LinkTripRequest(string? Number, string? LastName, string? Departure);

public sealed record ReceiptDto(string Id, string Label, long Cents, long At, string Method);

public sealed record CardDto(Guid Id, string Brand, string Last4, string Expiry);

public sealed record PaymentsViewDto(TripViewDto Trip, List<ReceiptDto> Receipts, List<CardDto> Cards, bool CanPay);

public sealed record AddCardRequest(string? Brand, string? Last4, string? Expiry);

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
