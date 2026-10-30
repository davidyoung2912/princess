namespace Princess.Api.Data;

public sealed class PlanEventRow
{
    public string EventId { get; set; } = "";
    public int Day { get; set; }
}

/// <summary>A stored charge or credit on the onboard account. A line with no person is the booker's.</summary>
public sealed class FolioRow
{
    public Guid PublicId { get; set; }
    public long? UserId { get; set; }
    public int Day { get; set; }
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public long Cents { get; set; }
    public string? CoveredBy { get; set; }
    public DateTime At { get; set; }
}

public sealed class ServiceMessageRow
{
    public long Id { get; set; }
    public string Text { get; set; } = "";
    public DateTime At { get; set; }
}

/// <summary>One chat channel for a booking: what the guest wrote (crew replies are made up on read) and the phone call asked for, if any.</summary>
public sealed class ServiceThreadRow
{
    public string Channel { get; set; } = "";
    public string? EscalatedPhone { get; set; }
    public DateTime? EscalatedAt { get; set; }
    public List<ServiceMessageRow> Messages { get; set; } = [];
}

/// <summary>Phase 10 store: the programme plan, muster check-ins, the onboard account and Guest Services chat. A booking is always an internal id; the service has already checked who may see it.</summary>
public interface IOnboardStore
{
    /// <summary>The events in a person's plan on a sailing, by day.</summary>
    Task<List<PlanEventRow>> ListPlanAsync(long userId, string sailingId, CancellationToken ct);
    Task SetPlanAsync(long userId, string sailingId, string eventId, int day, bool on, CancellationToken ct);

    /// <summary>When each guest checked in at the muster station.</summary>
    Task<Dictionary<long, DateTime>> ListMusterAsync(long bookingId, CancellationToken ct);
    /// <summary>Checks the guests in; a guest already checked in keeps their first time.</summary>
    Task SaveMusterAsync(long bookingId, IReadOnlyList<long> userIds, long byUserId, DateTime at, CancellationToken ct);

    Task<List<FolioRow>> ListFolioAsync(long bookingId, CancellationToken ct);

    Task<List<ServiceThreadRow>> ListThreadsAsync(long bookingId, CancellationToken ct);
    Task AddServiceMessageAsync(long bookingId, string channel, string text, DateTime at, CancellationToken ct);
    Task EscalateAsync(long bookingId, string channel, string phone, DateTime at, CancellationToken ct);
}
