using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>
/// One alert to whoever is on duty (docs/runbook.md, "Who is told"). It holds a kind of problem, a one-line summary and a reference: never a guest's name, booking or words.
/// </summary>
public sealed record OperatorAlert(string Severity, string Area, string Summary, string Reference);

/// <summary>
/// Where an operator alert goes (<c>Providers:OperatorAlerts</c>): <c>sim</c> writes it to the log, <c>webhook</c> posts it to a URL the operator sets (a paging or chat service's incoming webhook).
/// A failed send is logged and never stops what the guest was doing.
/// </summary>
public interface IOperatorAlerts
{
    /// <summary>Tells the operator. Returns true when the alert was handed on (the simulation always does); never throws.</summary>
    Task<bool> NotifyAsync(OperatorAlert alert, CancellationToken ct);
}

public sealed class SimOperatorAlerts(ILogger<SimOperatorAlerts> log) : IOperatorAlerts
{
    public Task<bool> NotifyAsync(OperatorAlert alert, CancellationToken ct)
    {
        log.LogWarning("Operator alert ({Severity}, {Area}): {Summary} [{Reference}]", alert.Severity, alert.Area, alert.Summary, alert.Reference);
        return Task.FromResult(true);
    }
}

/// <summary>Settings for <see cref="WebhookOperatorAlerts"/> (<c>Providers:OperatorAlerts</c> = <c>webhook</c>). The URL and the secret go in user-secrets or environment variables (<c>OperatorAlerts__Url</c>), never in a file.</summary>
public sealed class OperatorAlertOptions
{
    public const string Section = "OperatorAlerts";
    /// <summary>An https address the alert is posted to.</summary>
    public string? Url { get; set; }
    /// <summary>Sent as the <c>X-Alert-Secret</c> header when set, so the receiver can tell the alert is ours.</summary>
    public string? Secret { get; set; }
    public int TimeoutSeconds { get; set; } = 5;

    /// <summary>The address is usable: absolute and https.</summary>
    public static bool IsUsable(string? url) => Uri.TryCreate(url, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps;
}

public sealed class WebhookOperatorAlerts(HttpClient http, IOptions<OperatorAlertOptions> options, IClock clock, ILogger<WebhookOperatorAlerts> log) : IOperatorAlerts
{
    /// <summary>The JSON that is posted. Plain fields, so any chat or paging webhook can take it.</summary>
    public static object Body(OperatorAlert a, DateTime at) => new { severity = a.Severity, area = a.Area, summary = a.Summary, reference = a.Reference, at = DateTime.SpecifyKind(at, DateTimeKind.Utc).ToString("O"), text = $"[{a.Severity}] {a.Area}: {a.Summary} ({a.Reference})" };

    public async Task<bool> NotifyAsync(OperatorAlert alert, CancellationToken ct)
    {
        var o = options.Value;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, o.Url) { Content = JsonContent.Create(Body(alert, clock.UtcNow)) };
            if (!string.IsNullOrEmpty(o.Secret)) request.Headers.Add("X-Alert-Secret", o.Secret);
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(o.TimeoutSeconds, 1, 30)));
            using var response = await http.SendAsync(request, cts.Token);
            if (response.IsSuccessStatusCode) return true;
            log.LogWarning("Operator alert webhook answered {Status}", (int)response.StatusCode);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // The address is not logged: it can carry a token.
            log.LogWarning(e, "Operator alert webhook failed");
        }
        return false;
    }
}
