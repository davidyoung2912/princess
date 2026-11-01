using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 11 wire shapes; they match the views in src/api/finishTypes.ts.
// Guests are the public guid of their user (D2). Instants are epoch ms (D6).

// ---- Disembarkation ----

public sealed record DisembarkGuestDto(Guid Id, string Name, string Printed, int Bags, string Cabin, string? Label);

public sealed record DisembarkTimesDto(long ArrivalAt, long BagsOutAt, long VacateAt, long TipBy);

public sealed record DisembarkViewDto(
    string? Option, TagGroup Group, bool Priority, List<DisembarkGuestDto> Guests, bool TagsOn, DisembarkTimesDto Times, Dictionary<string, long> OffAt,
    bool CanChoose, bool Closed, bool NeedsHelp, bool CustomsDone, bool OnwardSaved, long PhotosUntil);

/// <summary>Bags by guest guid; a guest left out has none.</summary>
public sealed record DisembarkChoiceRequest(string? Option, Dictionary<Guid, int>? Bags);

public sealed record TagsOnRequest(bool On);

public sealed record CustomsDeclarationDto(bool Food, bool Cash, int GoodsUsd, string Note);

public sealed record CustomsViewDto(CustomsDeclarationDto? Declaration, long? SubmittedAt, int People, int AllowanceUsd, List<string> Declare, int OverUsd, bool CanEdit);

public sealed record CustomsRequest(bool Food, bool Cash, int GoodsUsd, string? Note);

public sealed record OnwardPlanDto(string Mode, string FlightAt, string Flight, string Note);

public sealed record OnwardViewDto(OnwardPlanDto? Plan, OnwardCheck? Check, long OffFrom, int People, bool CanEdit);

public sealed record OnwardRequest(string? Mode, string? FlightAt, string? Flight, string? Note);

public sealed record NightViewDto(List<NightEntry> Entries, string? Option);

public sealed record NightTickRequest(bool Done);

public sealed record TipDto(long Charged, int KeepPercent, long Credit, long By, bool CanAdjust);

public sealed record BillReceiptDto(string Id, bool Available);

public sealed record BillQueryDto(Guid Id, string LineId, string Number, string Stage, long Cents);

public sealed record FinalBillViewDto(string? Card, TipDto Tip, List<BillReceiptDto> Receipts, long? EmailedAt, string? EmailedTo, List<BillQueryDto> Queries, bool Settled);

public sealed record TipKeepRequest(int KeepPercent);

// ---- Cases ----

public sealed record CaseRefundDto(long Cents, bool Sent, long ExpectedBy);

public sealed record CaseDto(
    Guid Id, string Kind, string Number, string Summary, string Place, long Cents, long OpenedAt, long DueAt, string Stage, string? Outcome, CaseRefundDto? Refund, bool CanWithdraw, bool FromFeedback);

public sealed record CasesViewDto(List<CaseDto> Cases, bool CanOpen);

public sealed record OpenCaseRequest(string? Kind, string? Summary, string? Place, string? LineId, long Cents);

// ---- After the cruise ----

public sealed record HistoryDocDto(string Id, bool Ready);

public sealed record HistoryTripDto(string Id, string Title, string Ship, string Departure, int Nights, bool Current, bool Cancelled, long? FareCents, List<HistoryDocDto> Documents);

public sealed record HistoryViewDto(List<HistoryTripDto> Trips, long? PhotosUntil, bool Sailed);

public sealed record FeedbackDto(int Overall, Dictionary<string, int> Areas, string Comment, List<string> Crew, bool AllowContact, bool ShareName);

public sealed record CrewDto(string Id, string Name, string Role);

public sealed record RecoveryDto(string Number, long DueAt, string Stage);

public sealed record FeedbackViewDto(bool Open, FeedbackDto? Feedback, long? SubmittedAt, long EditUntil, List<CrewDto> Crew, string Steward, RecoveryDto? Recovery);

public sealed record FeedbackRequest(int Overall, Dictionary<string, int>? Areas, string? Comment, List<string>? Crew, bool AllowContact, bool ShareName);

public sealed record ReferralFriendDto(string Name, string State);

public sealed record ReferralDto(string Code, long Credit, long Earned, List<ReferralFriendDto> Friends);

public sealed record LoyaltyViewDto(LoyaltyStatus Status, bool Counted, string[] Perks, int WifiDevices, ReferralDto Referral);

public sealed record HoldDto(
    Guid Id, string Departure, string Category, int Guests, long Total, long Deposit, long Credit, long FccApplied, bool Onboard, long PlacedAt, long ExpiresAt, bool Expired, bool Bookable);

public sealed record RebookOptionDto(string Id, string Departure, bool Bookable, long Total, long Deposit, long Credit);

public sealed record DeskSlotDto(long At, int Day);

public sealed record AppointmentDto(long At);

public sealed record RebookViewDto(
    string Category, int Guests, string Tier, bool OnboardOffer, List<RebookOptionDto> Options, List<HoldDto> Holds, long FccLeft, long FccConverted, AppointmentDto? Appointment,
    List<DeskSlotDto> Slots, bool CanHold);

public sealed record HoldRequest(string? DepartureId);

public sealed record SlotRequest(long At);
