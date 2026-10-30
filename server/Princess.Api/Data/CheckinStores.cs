namespace Princess.Api.Data;

/// <summary>One answered step for one guest. <see cref="Data"/> is the step's JSON payload (the photo itself is never kept).</summary>
public sealed class CheckinStepRow
{
    public long UserId { get; set; }
    public string Step { get; set; } = "";
    public DateTime DoneAt { get; set; }
    public string Data { get; set; } = "{}";
}

/// <summary>The booking-level part of check-in: the onboard-account card, the arrival window and when check-in was finished.</summary>
public sealed class CheckinBookingRow
{
    public long? PaymentCardId { get; set; }
    public string? PaymentLabel { get; set; }
    public DateTime? PaymentAt { get; set; }
    public DateTime? ArrivalAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}

public sealed class PassRow
{
    public long UserId { get; set; }
    public int Seq { get; set; }
    public string Code { get; set; } = "";
    public bool InWallet { get; set; }
}

public sealed class EmbarkRow
{
    public DateTime? LuggageDroppedAt { get; set; }
    /// <summary>A terminal other than the usual one, set by operations; empty when none.</summary>
    public string Terminal { get; set; } = "";
}

/// <summary>Phase 9 store: check-in answers, the boarding passes and embarkation progress. A booking is always an internal id; the service has already checked who may see it.</summary>
public interface ICheckinStore
{
    /// <summary>The booking with this (normalised) number, or null. Used by the public pass lookup, which has no signed-in person.</summary>
    Task<long?> FindBookingIdAsync(string number, CancellationToken ct);

    Task<List<CheckinStepRow>> ListStepsAsync(long bookingId, CancellationToken ct);
    /// <summary>Saves the same payload for each guest, replacing an earlier answer to the step.</summary>
    Task SaveStepAsync(long bookingId, string step, IReadOnlyList<long> userIds, DateTime at, string dataJson, CancellationToken ct);

    Task<CheckinBookingRow?> GetBookingAsync(long bookingId, CancellationToken ct);
    Task SavePaymentAsync(long bookingId, long cardId, string label, DateTime at, CancellationToken ct);
    Task SaveArrivalAsync(long bookingId, string windowId, DateTime at, CancellationToken ct);
    Task FinishAsync(long bookingId, DateTime at, CancellationToken ct);

    Task<List<PassRow>> ListPassesAsync(long bookingId, CancellationToken ct);
    /// <summary>Stores each guest's pass code, keeping whether it is in the wallet.</summary>
    Task SavePassesAsync(long bookingId, IReadOnlyList<PassRow> passes, DateTime at, CancellationToken ct);
    Task SetWalletAsync(long bookingId, CancellationToken ct);

    Task<EmbarkRow?> GetEmbarkAsync(long bookingId, CancellationToken ct);
    Task<HashSet<string>> ListTicksAsync(long bookingId, string kind, CancellationToken ct);
    Task SetTickAsync(long bookingId, string kind, string itemId, bool done, CancellationToken ct);
    /// <summary>Records the bags dropped at this moment, or not dropped when null.</summary>
    Task SetBagsAsync(long bookingId, DateTime? droppedAt, CancellationToken ct);
}
