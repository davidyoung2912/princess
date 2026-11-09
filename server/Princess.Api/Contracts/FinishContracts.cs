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

/// <summary>A port of call and where it is, in degrees, for the sailed map.</summary>
public sealed record PortPlaceDto(string Code, string Name, double Lat, double Lon);

public sealed record HistoryTripDto(string Id, string Title, string Ship, string Departure, int Nights, bool Current, bool Cancelled, long? FareCents, List<HistoryDocDto> Documents, List<PortPlaceDto> Ports);

public sealed record HistoryViewDto(List<HistoryTripDto> Trips, long? PhotosUntil, bool Sailed);

public sealed record FeedbackDto(int Overall, Dictionary<string, int> Areas, string Comment, List<string> Crew, bool AllowContact, bool ShareName);

public sealed record CrewDto(string Id, string Name, string Role);

public sealed record RecoveryDto(string Number, long DueAt, string Stage);

public sealed record FeedbackViewDto(bool Open, FeedbackDto? Feedback, long? SubmittedAt, long EditUntil, List<CrewDto> Crew, string Steward, RecoveryDto? Recovery);

public sealed record FeedbackRequest(int Overall, Dictionary<string, int>? Areas, string? Comment, List<string>? Crew, bool AllowContact, bool ShareName);

public sealed record ReferralFriendDto(Guid Id, string Name, string State);

public sealed record ReferralDto(string Code, long Credit, long Earned, List<ReferralFriendDto> Friends);

/// <summary>A future cruise credit. <c>ExpiresOn</c> is "YYYY-MM-DD"; <c>Eligible</c> is a code for who may use it (<c>booker</c>: the person it belongs to, on their own bookings).</summary>
public sealed record CreditDto(Guid Id, string Source, long Original, long Remaining, string ExpiresOn, bool Expired, string Eligible);

/// <summary>One redemption: <c>Amount</c> of a future cruise credit changed to onboard credit at <c>At</c>.</summary>
public sealed record CreditUseDto(long At, string What, long Amount);

public sealed record LoyaltyReportDto(Guid Id, string What, string Note, string Status, long At);

/// <summary><c>SyncedAt</c> is when the figures were last read from the loyalty record. <c>Currency</c> is the one every amount here is in.</summary>
public sealed record LoyaltyViewDto(
    LoyaltyStatus Status, bool Counted, string[] Perks, int WifiDevices, ReferralDto Referral, long SyncedAt, string Currency, List<CreditDto> Credits, List<CreditUseDto> Used, List<LoyaltyReportDto> Reports);

public sealed record LoyaltyReportRequest(string? What, string? Note);

public sealed record ReferralRequest(string? Name);

public sealed record HoldDto(
    Guid Id, string Departure, string Category, int Guests, long Total, long Deposit, long Credit, long FccApplied, bool Onboard, long PlacedAt, long ExpiresAt, bool Expired, bool Bookable);

/// <summary><c>Reasons</c> are codes for why the date is offered: <c>cabin</c>, <c>party</c>, <c>length</c> (the same number of nights as this cruise) and <c>credit</c> (onboard credit for holding now).</summary>
public sealed record RebookOptionDto(string Id, string Departure, bool Bookable, long Total, long Deposit, long Credit, string[] Reasons);

public sealed record DeskSlotDto(long At, int Day);

public sealed record AppointmentDto(long At);

public sealed record RebookViewDto(
    string Category, int Guests, string Tier, bool OnboardOffer, List<RebookOptionDto> Options, List<HoldDto> Holds, long FccLeft, long FccConverted, AppointmentDto? Appointment,
    List<DeskSlotDto> Slots, bool CanHold, bool Edited, List<string> Categories);

public sealed record HoldRequest(string? DepartureId, string? Category = null, int? Guests = null);

public sealed record SlotRequest(long At);

/// <summary>A birthday or anniversary during the trip. <c>Date</c> is "YYYY-MM-DD" or "MM-DD"; only the month and day are kept.</summary>
public sealed record CelebrationInput(string? Id, string? Label, string? Date, bool Surprise);
public sealed record CelebrationsRequest(List<CelebrationInput>? Items);
/// <summary><c>Date</c> is "MM-DD". <c>ToldAt</c> (milliseconds since 1970) is when the ship was told about this one.</summary>
public sealed record CelebrationDto(string Id, string Label, string Date, bool Surprise, long ToldAt);
public sealed record CelebrationsViewDto(List<CelebrationDto> Items, bool CanEdit);

/// <summary>A thank-you for a team (small delights D6-7). No rating and no tip.</summary>
public sealed record ThanksRequest(string? Team, string? Text);
public sealed record ThanksDto(Guid Id, string Team, string Text, long At, bool Mine);
public sealed record ThanksViewDto(List<ThanksDto> Items, bool CanAdd);

/// <summary>A message added to a celebration (small delights D6-8). <c>Author</c> is a first name.</summary>
public sealed record WishRequest(string? Text);
public sealed record WishDto(Guid Id, string CelebrationId, string Author, string Text, long At, bool Mine);
public sealed record WishesViewDto(List<WishDto> Items, bool CanAdd);
