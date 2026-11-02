using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>The guest services requests a person has made, kept so every device and the desk see the same ticket (multi-device plan 3, Phase 5).</summary>
public interface IStaffTicketStore
{
    Task AddAsync(long userId, StaffTicketDto ticket, CancellationToken ct);
    /// <summary>The person's tickets asked for at or after <paramref name="sinceMs"/> that are not cancelled, newest first.</summary>
    Task<List<StaffTicketDto>> ListAsync(long userId, long sinceMs, CancellationToken ct);
    /// <summary>Cancels one of the person's tickets; false when it is not theirs.</summary>
    Task<bool> CancelAsync(long userId, Guid id, DateTime now, CancellationToken ct);
}
