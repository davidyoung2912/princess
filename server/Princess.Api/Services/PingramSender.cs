using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace Princess.Api.Services;

/// <summary>Settings for <see cref="PingramSender"/> (<c>Providers:Email</c> and <c>Providers:Sms</c> = <c>pingram</c>). The key goes in user-secrets or an environment variable (<c>Pingram__ApiKey</c>), never in a file.</summary>
public sealed class PingramOptions
{
    public const string Section = "Pingram";
    public string BaseUrl { get; set; } = "https://api.pingram.io";
    public string? ApiKey { get; set; }
    /// <summary>The notification types Pingram groups the sends under. A type that does not exist is created on first use.</summary>
    public string EmailType { get; set; } = "princess_notice_email";
    public string SmsType { get; set; } = "princess_notice_sms";
    public int TimeoutSeconds { get; set; } = 8;
}

/// <summary>
/// Sends email and text through Pingram's <c>POST /send</c> (COM-04). Returns true only when Pingram answers 200, so a refused or failed send is tried again at the next check
/// rather than logged as sent. The message and the address or number go to Pingram; nothing else about the guest does, and the key is never logged.
/// The one-click unsubscribe headers (RFC 8058) are not sent, because the endpoint takes no custom headers; the unsubscribe link stays in the body footer.
/// </summary>
public sealed class PingramSender(HttpClient http, IOptions<PingramOptions> options, ILogger<PingramSender> log) : IEmailSender, ISmsSender
{
    public Task<bool> SendAsync(EmailMessage message, CancellationToken ct) =>
        PostAsync(EmailBody(options.Value, message), "email", ct);

    public Task<bool> SendAsync(SmsMessage message, CancellationToken ct) =>
        PostAsync(SmsBody(options.Value, message), "sms", ct);

    /// <summary>The request body for an email. Plain text becomes escaped HTML paragraphs; the address is also the recipient id.</summary>
    public static JsonObject EmailBody(PingramOptions o, EmailMessage m) => new()
    {
        ["type"] = o.EmailType,
        ["to"] = new JsonObject { ["id"] = m.To, ["email"] = m.To },
        ["email"] = new JsonObject { ["subject"] = m.Subject, ["html"] = Html(m.Body) },
    };

    public static JsonObject SmsBody(PingramOptions o, SmsMessage m) => new()
    {
        ["type"] = o.SmsType,
        ["to"] = new JsonObject { ["id"] = m.To, ["number"] = m.To },
        ["sms"] = new JsonObject { ["message"] = m.Body },
    };

    public static string Html(string text) =>
        string.Join("", text.Replace("\r\n", "\n").Split("\n\n").Select(p => $"<p>{WebUtility.HtmlEncode(p).Replace("\n", "<br>")}</p>"));

    private async Task<bool> PostAsync(JsonObject body, string channel, CancellationToken ct)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.ApiKey)) { log.LogWarning("Pingram {Channel} not sent: Pingram:ApiKey is not set", channel); return false; }
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{o.BaseUrl.TrimEnd('/')}/send") { Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json") };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", o.ApiKey);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(o.TimeoutSeconds, 1, 30)));
            using var res = await http.SendAsync(req, timeout.Token);
            if (res.StatusCode == HttpStatusCode.OK) return true;
            // The reply's error code and message say what was wrong; the body of the request (the guest's address and text) is not logged.
            var detail = res.Content is null ? "" : await res.Content.ReadAsStringAsync(ct);
            log.LogWarning("Pingram {Channel} refused: {Status} {Error}", channel, (int)res.StatusCode, ErrorOf(detail));
            return false;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or OperationCanceledException && !ct.IsCancellationRequested)
        {
            log.LogWarning("Pingram {Channel} failed: {Reason}", channel, e.GetType().Name);
            return false;
        }
    }

    private static string ErrorOf(string json)
    {
        try { return JsonNode.Parse(json)?["error"]?["code"]?.ToString() ?? ""; } catch (JsonException) { return ""; }
    }
}
