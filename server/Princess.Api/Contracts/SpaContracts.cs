using Princess.Api.Domain;

namespace Princess.Api.Contracts;

/// <summary>A treatment as the app sees it (the kinds of day it runs on stay on the server).</summary>
public sealed record SpaTreatmentDto(string Id, string VenueId, string Title, string Detail, int Minutes, long Price, int? MinAge, int Rooms);

/// <summary>One appointment. <see cref="Price"/> is the total for everyone in it; <see cref="Cancel"/> is what cancelling now would cost.</summary>
public sealed record SpaAppointmentDto(
    Guid Id, string VenueId, string TreatmentId, string Title, int Day, string Time, int Minutes, long StartAt, List<Guid> Guests, string Note, long Price, bool CanChange, SpaCancelTerms Cancel, long At);

public sealed record SpaViewDto(List<SpaTreatmentDto> Treatments, List<SpaAppointmentDto> Appointments, List<PartyMemberDto> Party, bool CanBook, int CancelFreeHours, int LateFeePercent, int MaxParty);

public sealed record SpaReserveRequest(string? TreatmentId, int Day, string? Time, List<Guid>? Guests, string? Note);

public sealed record SpaMoveRequest(int Day, string? Time);

/// <summary>Changes who is in an appointment and the note to the therapist; either may be left out.</summary>
public sealed record SpaUpdateRequest(List<Guid>? Guests, string? Note);
