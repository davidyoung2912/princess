namespace Princess.Api.Data;

public sealed record PushSubscriptionRow(string Endpoint, string P256dh, string Auth, int Budget, bool Calm, string Watch);

public sealed record PushDeliveryRow(string NoticeKey, string Kind, bool Bypass, string Outcome, string? Reason, int Devices, string ParamsJson, DateTime At, bool Read, bool Acked = false);

/// <summary>Phones that asked for alerts, what was sent or held back and why, and the one calendar feed address a guest may have (next-level plan N3).</summary>
public interface IPushStore
{
    Task<List<PushSubscriptionRow>> ListSubscriptionsAsync(long userId, CancellationToken ct);
    /// <summary>Adds the phone, or updates it when its address is already known (for the same person only). Returns false when the person already has the most phones allowed.</summary>
    Task<bool> SaveSubscriptionAsync(long userId, PushSubscriptionRow row, int maxDevices, DateTime now, CancellationToken ct);
    Task RemoveSubscriptionAsync(long userId, string endpoint, CancellationToken ct);
    /// <summary>Drops a phone the push service said is gone.</summary>
    Task RemoveEndpointAsync(string endpoint, CancellationToken ct);

    Task<List<PushDeliveryRow>> ListDeliveriesAsync(long userId, int max, CancellationToken ct);
    Task AddDeliveryAsync(long userId, PushDeliveryRow row, DateTime now, CancellationToken ct);
    Task MarkDeliveriesReadAsync(long userId, DateTime now, CancellationToken ct);
    /// <summary>Records that the guest acknowledged the alert with this key (only a sent phone alert counts). False when there is none, or it was already acknowledged.</summary>
    Task<bool> AckDeliveryAsync(long userId, string noticeKey, DateTime now, CancellationToken ct);

    /// <summary>The calendar feed's token hash, or null when the guest has no feed.</summary>
    Task<string?> GetFeedHashAsync(long userId, CancellationToken ct);
    /// <summary>Makes (or replaces) the feed; the old address stops working at once.</summary>
    Task SaveFeedHashAsync(long userId, string hash, DateTime now, CancellationToken ct);
    Task DeleteFeedAsync(long userId, CancellationToken ct);
    Task<long?> FindFeedUserAsync(string hash, CancellationToken ct);
}
