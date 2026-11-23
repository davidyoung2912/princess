using System.Text.Json.Nodes;
using Princess.Api.Services.Mcp;

namespace Princess.Api.Endpoints;

/// <summary>The app's public knowledge as an MCP server (docs/mcp-integration-plan.md, phase 7).</summary>
public static class McpServerEndpoints
{
    private const int MaxBody = 16 * 1024;
    public const string Limiter = "mcp";
    public const string SessionHeader = "Mcp-Session-Id";

    public static void MapMcpServerEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/mcp", async (HttpRequest req, CancellationToken ct) =>
            {
                if (req.ContentLength is > MaxBody) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
                using var reader = new StreamReader(req.Body);
                var buffer = new char[MaxBody + 1];
                var read = await reader.ReadBlockAsync(buffer, ct);
                if (read > MaxBody) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
                JsonNode? message;
                try { message = JsonNode.Parse(new string(buffer, 0, read)); }
                catch (System.Text.Json.JsonException) { return Results.Json(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = null, ["error"] = new JsonObject { ["code"] = -32700, ["message"] = "Parse error." } }, statusCode: StatusCodes.Status400BadRequest); }
                var answer = PrincessMcpServer.HandleAny(message);
                // The server keeps no state between calls, so the session id is only an identifier for clients that expect one; any value is accepted back.
                if (message is JsonObject { } o && o["method"]?.GetValue<string>() == "initialize") req.HttpContext.Response.Headers[SessionHeader] = Guid.NewGuid().ToString("N");
                return answer is null ? Results.Accepted() : Results.Json(answer);
            })
            .RequireRateLimiting(Limiter).WithTags("Reference").WithSummary("Needs a sign-in. 60 calls a minute per person. The app's public cruise-port knowledge as an MCP server (Streamable HTTP, single JSON replies): `list_ports`, `get_port_guide` and `plan_walking_day`. Read-only, no guest data. One JSON-RPC message (or a batch of up to 10) per request, at most 16 KB; `initialize` answers with an `Mcp-Session-Id` header and negotiates the protocol version (2025-03-26 or 2024-11-05); a notification answers 202 with no body. An assistant needs a signed-in token to use it.");

        api.MapGet("/mcp", () => Results.StatusCode(StatusCodes.Status405MethodNotAllowed))
            .WithTags("Reference").WithSummary("Needs a sign-in. Answers 405: this server has no event stream; use `POST /mcp`.");
    }
}
