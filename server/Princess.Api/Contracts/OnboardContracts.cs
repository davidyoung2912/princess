using Princess.Api.Domain;

namespace Princess.Api.Contracts;

// Phase 10a wire shapes for the on-board day; they match OnboardToday, ProgramView, PortDayView, MusterView, FolioView, EmergencyCard and the service chat types in src/api/types.ts.
// Guests are the public guid of their user (D2). Instants are epoch ms (D6), dates "YYYY-MM-DD".

public sealed record ClockChangeDto(long At, int Hours);

public sealed record MusterBriefDto(bool Required, bool Done, long At);

public sealed record OnboardTodayDto(
    bool Aboard, int? Day, string Date, string Port, string ShipZone, WeatherToday? Weather, PortDayWithState? PortDay, MusterBriefDto Muster, long? SailAwayAt, bool Changes, ClockChangeDto? ClockChange);

public sealed record PortTodayDto(string Port, int? Day);

public sealed record ProgramViewDto(int Day, string Date, string Port, List<DatedEvent> Events, List<string> Mine, bool Changed, bool CanEdit);

/// <summary>An event is in the plan for one day: an event that runs on several days is planned day by day.</summary>
public sealed record PlanToggleRequest(bool On, int Day);

public sealed record MusterGuestDto(Guid Id, string Name, long? ConfirmedAt);

public sealed record MusterViewDto(
    long At, bool Required, bool Done, string Station, string StationName, string StationPlace, int Deck, List<MusterGuestDto> Guests, bool CanConfirm);

public sealed record MusterConfirmRequest(List<Guid>? Guests);

public sealed record TourGuestDto(Guid Id, string Name, string Code);

public sealed record TourTodayDto(string Id, string ExcursionId, string Name, string Meeting, string Start, string BackBy, bool Tender, List<TourGuestDto> Guests);

public sealed record TenderInfoDto(TenderGroup Group, long CallAt, string Status, int DelayMinutes, int WaitMinutes, long LastTenderAt, bool MayTender, bool Assistance);

public sealed record PortDayViewDto(PortDayWithState Day, TenderInfoDto? Tender, List<TourTodayDto> Tours, int DelayMinutes, bool Skipped);

public sealed record FolioViewDto(List<FolioLine> Lines, FolioTotals Totals, List<GuestDto> Guests, int ThroughDay);

public sealed record OwnEntitlementsDto(Entitlements Entitlements, Balances Balances);

public sealed record ServiceChannelDto(string Id, int Minutes, bool Slow, bool Unanswered);

public sealed record ServiceMessageDto(string Id, string From, string? Crew, string Text, long At);

public sealed record ServiceThreadDto(string Channel, List<ServiceMessageDto> Messages, ChatState? State, bool Slow);

public sealed record ServiceSendRequest(string? Text);

public sealed record ServiceEscalateRequest(string? Phone);
