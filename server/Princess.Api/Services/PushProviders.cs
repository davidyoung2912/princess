using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using Princess.Api.Data;

namespace Princess.Api.Services;

/// <summary>What a phone is told. The service worker shows <see cref="Title"/> and <see cref="Body"/> and opens <see cref="Path"/> when tapped.</summary>
public sealed record PushMessage(string Key, string Kind, string Title, string Body, string Path, bool Critical, Dictionary<string, object> Params)
{
    /// <summary>The body sent to the phone. Small, with no personal data beyond what the notice says.</summary>
    public string ToJson() => JsonSerializer.Serialize(new { id = Key, kind = Kind, title = Title, body = Body, path = Path, critical = Critical, @params = Params }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
}

public enum PushResult { Delivered, Gone, Failed }

/// <summary>
/// Sends a message to one phone through the browser's push service (next-level plan N3.2). <see cref="PublicKey"/> is the application server key the browser needs to subscribe, or null when
/// this server cannot send. A real provider (Web Push with VAPID keys) replaces the simulation by registration only; the rules that decide whether to send live elsewhere.
/// </summary>
public interface IPushSender
{
    string? PublicKey { get; }
    Task<PushResult> SendAsync(PushSubscriptionRow target, PushMessage message, CancellationToken ct);
}

/// <summary>Records what would be sent and delivers nothing. Its key is a real P-256 point, so a browser can subscribe against it.</summary>
public sealed class SimPushSender : IPushSender
{
    private readonly ConcurrentQueue<(string Endpoint, PushMessage Message)> _sent = new();

    public string? PublicKey { get; } = NewKey();

    /// <summary>Everything "sent" so far, oldest first; for tests and the local log.</summary>
    public IReadOnlyCollection<(string Endpoint, PushMessage Message)> Sent => _sent;

    public Task<PushResult> SendAsync(PushSubscriptionRow target, PushMessage message, CancellationToken ct)
    {
        _sent.Enqueue((target.Endpoint, message));
        while (_sent.Count > 200) _sent.TryDequeue(out _);
        return Task.FromResult(PushResult.Delivered);
    }

    private static string NewKey()
    {
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var p = ec.ExportParameters(false);
        byte[] point = [0x04, .. p.Q.X!, .. p.Q.Y!];
        return Convert.ToBase64String(point).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
