using System.Text.Json.Nodes;
using Princess.Api.Services.Mcp;

namespace Princess.Api.Endpoints;

/// <summary>The app's public knowledge as an MCP server (docs/mcp-integration-plan.md, phase 7).</summary>
public static class McpServerEndpoints
{
    private const int MaxBody = 16 * 1024;

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
                var answer = PrincessMcpServer.Handle(message);
                return answer is null ? Results.Accepted() : Results.Json(answer);
            })
            .WithTags("Reference").WithSummary("Needs a sign-in. The app's public cruise-port knowledge as an MCP server (Streamable HTTP, single JSON replies): `list_ports`, `get_port_guide` and `plan_walking_day`. Read-only, no guest data. One JSON-RPC message per request, at most 16 KB; a notification answers 202 with no body. An assistant needs a signed-in token to use it.");

        api.MapGet("/mcp", () => Results.StatusCode(StatusCodes.Status405MethodNotAllowed))
            .WithTags("Reference").WithSummary("Needs a sign-in. Answers 405: this server has no event stream; use `POST /mcp`.");
    }
}
