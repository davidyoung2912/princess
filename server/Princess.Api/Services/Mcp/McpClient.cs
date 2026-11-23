using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;

namespace Princess.Api.Services.Mcp;

/// <summary>
/// A small client for the MCP Streamable HTTP transport (docs/mcp-integration-plan.md, phase 2): <c>initialize</c>, the <c>initialized</c> notification, then
/// <c>tools/call</c>, keeping the session id the server hands out and starting again once if the server forgot it. It only ever calls tools; it offers the
/// server no capabilities (no sampling, no roots), so a provider cannot ask this app to do anything. Replies are read up to a size limit. If the official C#
/// SDK is adopted later, only this class changes.
/// </summary>
public sealed class McpClient(IHttpClientFactory factory, McpProviderOptions options)
{
    public const string ClientName = "princess-app";
    private const int MaxReplyBytes = 1_000_000;
    private readonly SemaphoreSlim gate = new(1, 1);
    private int nextId;
    private string? session;
    private bool ready;

    public async Task<McpToolResult> CallToolAsync(string tool, JsonObject args, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 1, 60)));
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await EnsureReadyAsync(timeout.Token);
                var reply = await SendAsync("tools/call", McpWire.CallParams(tool, args), timeout.Token);
                if (reply.Error is not null) throw new McpProtocolException(reply.Error);
                return McpWire.ToolResult(reply.Result);
            }
            catch (HttpRequestException e) when (attempt == 0 && session is not null && e.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // The server dropped our session: start a new one, once.
                await gate.WaitAsync(timeout.Token);
                try { ready = false; session = null; } finally { gate.Release(); }
            }
        }
    }

    private async Task EnsureReadyAsync(CancellationToken ct)
    {
        if (ready) return;
        await gate.WaitAsync(ct);
        try
        {
            if (ready) return;
            var reply = await SendAsync("initialize", McpWire.InitializeParams(ClientName), ct);
            if (reply.Error is not null) throw new McpProtocolException(reply.Error);
            // The notification gets no body back (202); a server that answers it with an error is ignored, since the next call will say what is wrong.
            try { await PostAsync(McpWire.Notification("notifications/initialized"), ct, expectReply: false, id: 0); }
            catch (HttpRequestException) { /* see above */ }
            ready = true;
        }
        finally { gate.Release(); }
    }

    private async Task<McpReply> SendAsync(string method, JsonNode? parameters, CancellationToken ct)
    {
        var id = Interlocked.Increment(ref nextId);
        return (await PostAsync(McpWire.Request(id, method, parameters), ct, expectReply: true, id))!;
    }

    private async Task<McpReply?> PostAsync(string body, CancellationToken ct, bool expectReply, int id)
    {
        using var http = factory.CreateClient("mcp");
        using var req = new HttpRequestMessage(HttpMethod.Post, options.Endpoint) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        if (session is not null) req.Headers.TryAddWithoutValidation("Mcp-Session-Id", session);
        if (!string.IsNullOrWhiteSpace(options.ApiKey)) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        using var res = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        if (res.Headers.TryGetValues("Mcp-Session-Id", out var sid) && sid.FirstOrDefault() is { Length: > 0 and <= 200 } s) session = s;
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"status {(int)res.StatusCode}", null, res.StatusCode);
        if (!expectReply) return null;
        await using var stream = await res.Content.ReadAsStreamAsync(ct);
        var buffer = new MemoryStream();
        var chunk = new byte[16 * 1024];
        int n;
        while ((n = await stream.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + n > MaxReplyBytes) throw new McpProtocolException("The reply was too large.");
            buffer.Write(chunk, 0, n);
        }
        return McpWire.ParseReply(res.Content.Headers.ContentType?.MediaType, Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length), id);
    }
}
