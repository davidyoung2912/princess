using System.Text.Json;
using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 9 wire shapes for check-in and boarding; they match CheckinView, ReceiptView, BoardingView and EmbarkView in src/api/types.ts.
// Guests are the public guid of their user (D2). Instants are epoch ms (D6).

public sealed record StepAtDto(long At);

public sealed record DocumentStepDto(string Kind, string Country, string Last4, string Expires, long At);

public sealed record EmergencyStepDto(string Name, string Phone, string Relationship, long At);

public sealed record ContractStepDto(string Version, long At, string By);

public sealed record HealthStepDto(Dictionary<string, bool> Answers, bool Flagged, long At);

/// <summary>What one guest has answered. A step not answered is absent.</summary>
public sealed record GuestRecordDto(StepAtDto? Confirm, DocumentStepDto? Document, StepAtDto? Photo, EmergencyStepDto? Emergency, ContractStepDto? Contract, HealthStepDto? Health);

public sealed record GuestDefaultsDto(EmergencyDto Emergency, string DocumentKind, string PassportExpires);

public sealed record CheckinGuestDto(Guid Id, string Name, string First, int Age, bool Child, string Citizenship, GuestRecordDto Record, GuestProgress Progress, GuestDefaultsDto Defaults);

/// <summary><see cref="CardId"/> is null when the card was chosen by another guest and is not among the viewer's own.</summary>
public sealed record CheckinPaymentDto(Guid? CardId, string Label, long At);

public sealed record CheckinViewDto(
    CheckinStatusDto Status, List<CheckinGuestDto> Guests, CheckinPaymentDto? Payment, string? Arrival, List<CardDto> Cards, List<ArrivalWindow> Windows, bool Priority, string Suggested,
    CheckinProgress Progress, string ReturnDate, bool CanEdit, long? FinishedAt);

/// <summary>One body for every step; which fields are read depends on the step in the route.</summary>
public sealed record CheckinSaveRequest(
    List<Guid>? Guests, Guid? Guest, string? Kind, string? Country, string? Number, string? Expires, PhotoMetrics? Metrics, string? Name, string? Phone, string? Relationship,
    Dictionary<string, JsonElement>? Answers, Guid? CardId, string? Window);

public sealed record ReceiptItemDto(string Step, string? Detail, long? SavedAt);

public sealed record ReceiptGuestDto(Guid Id, string Name, List<ReceiptItemDto> Items);

public sealed record ReceiptViewDto(string Number, List<ReceiptGuestDto> Guests, List<ReceiptItemDto> Booking, bool Complete, long? FinishedAt);

public sealed record GuestPassDto(Guid Id, string Name, string Printed, int Seq, bool Ready, string Code, string Cabin, int Deck, string Muster, string Group);

public sealed record BoardingViewDto(
    string Number, string Departure, bool CheckinDone, string Lane, TerminalInfo Terminal, ArrivalWindow? Arrival, int? WaitMinutes, List<GuestPassDto> Passes, bool InWallet, long IssuedAt);

public sealed record LuggageDto(string Status, long? DroppedAt);

public sealed record TickDto(string Id, bool Done);

public sealed record DocumentReadyDto(Guid Id, string Name, bool Ready);

public sealed record AfternoonDto(string Id, long At);

public sealed record EmbarkViewDto(
    BoardingViewDto Boarding, long OpensAt, long GangwayClosesAt, long StateroomReadyAt, bool StateroomReady, string? Traffic, LuggageDto Luggage, List<TickDto> CarryOn,
    List<TickDto> Companion, string? Current, List<DocumentReadyDto> Documents, List<AfternoonDto> Afternoon, List<string> NurseCheck, bool CanEdit);

public sealed record BagsRequest(bool Dropped);
