namespace Princess.Api.Data;

public sealed class SpaRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string VenueId { get; set; } = "";
    public string TreatmentId { get; set; } = "";
    public int Day { get; set; }
    /// <summary>"HH:mm" ship time.</summary>
    public string Time { get; set; } = "";
    public int Minutes { get; set; }
    /// <summary>Per person.</summary>
    public long PriceCents { get; set; }
    public string Note { get; set; } = "";
    public DateTime At { get; set; }
    public List<long> GuestIds { get; set; } = [];
}

public sealed record NewSpa(string VenueId, string TreatmentId, int Day, string Time, int Minutes, long PriceCents, string Note, List<long> GuestIds, DateTime At);

/// <summary>Spa and salon appointments (Spa Explorer). A booking is always an internal id; the service has already checked who may see it.</summary>
public interface ISpaStore
{
    Task<List<SpaRow>> ListAsync(long bookingId, CancellationToken ct);
    /// <summary>Appointments of this treatment at this time across the whole sailing, optionally leaving one out.</summary>
    Task<int> CountAsync(string sailingId, string treatmentId, int day, string time, long? exceptId, CancellationToken ct);
    Task<SpaRow> AddAsync(long bookingId, NewSpa row, CancellationToken ct);
    /// <summary>Moves the appointment in place, so it keeps its address.</summary>
    Task MoveAsync(long bookingId, long id, int day, string time, CancellationToken ct);
    /// <summary>Replaces who is in it and the note.</summary>
    Task UpdateAsync(long bookingId, long id, List<long> guestIds, string note, CancellationToken ct);
    Task CancelAsync(long bookingId, long id, long feeCents, CancellationToken ct);
}
