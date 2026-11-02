using System.Text.Json.Nodes;

namespace Princess.Api.Contracts;

// Next-level plan N4: between people. Instants are epoch ms.

public sealed record CheckinShareDto(int Done, int Total);

/// <summary><see cref="Checkin"/> and <see cref="Documents"/> are null when the person has not shared their status with the party.</summary>
public sealed record OrganiserGuestDto(Guid Id, string Name, bool Child, bool IsYou, bool SharesStatus, CheckinShareDto? Checkin, int? Documents);

/// <summary>Only the booker sees the money.</summary>
public sealed record OrganiserMoneyDto(long PaidCents, long TotalCents, bool PaidInFull, long FinalDueMs);

public sealed record OrganiserDto(string Number, string Ship, long DepartureMs, int DaysToGo, bool YouAreBooker, List<OrganiserGuestDto> Guests, OrganiserMoneyDto? Money);

public sealed record PartyLogDto(string Kind, string Label, long At, bool Deleted);

public sealed record ShareLinkRequest(string? Kind, string? Label);

public sealed record ShareLinkDto(Guid Id, string Kind, string Label, long CreatedAt, long ExpiresAt, long? LastCheckInAt, string Note, string? Path);

public sealed record ShareCheckInRequest(string? Note);

/// <summary>What someone holding a share link sees. Never a position: only what the guest chose to say and the plain facts of the sailing.</summary>
public sealed record SharedViewDto(string Kind, string Label, string GuestFirstName, string Ship, long DepartureMs, int Nights, int DaysToGo, long? LastCheckInAt, string Note, bool? CheckinDone, bool? PaidInFull, CheckinShareDto? Progress, int? Guests);
