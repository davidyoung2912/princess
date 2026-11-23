using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Princess.Api.Services.Mcp;

/// <summary>What a tool call came back with: whether the server called it an error, the structured answer if it gave one, and its text.</summary>
public sealed record McpToolResult(bool IsError, JsonNode? Structured, string Text);

/// <summary>A JSON-RPC answer: the <c>result</c> object, or the error message.</summary>
public sealed record McpReply(JsonNode? Result, string? Error);

public sealed class McpProtocolException(string message) : Exception(message);

/// <summary>
/// The MCP message format, as plain functions on strings so it can be tested without a network. Servers answer a POST either with one JSON body or with a
/// <c>text/event-stream</c> (the Open-Meteo server does); both are read here.
/// </summary>
public static class McpWire
{
    public const string ProtocolVersion = "2025-03-26";

    public static string Request(int id, string method, JsonNode? parameters = null)
    {
        var o = new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id, ["method"] = method };
        if (parameters is not null) o["params"] = parameters.DeepClone();
        return o.ToJsonString();
    }

    public static string Notification(string method) => new JsonObject { ["jsonrpc"] = "2.0", ["method"] = method }.ToJsonString();

    public static JsonObject InitializeParams(string clientName) => new()
    {
        ["protocolVersion"] = ProtocolVersion,
        ["capabilities"] = new JsonObject(),
        ["clientInfo"] = new JsonObject { ["name"] = clientName, ["version"] = "1.0" },
    };

    public static JsonObject CallParams(string tool, JsonObject args) => new() { ["name"] = tool, ["arguments"] = args.DeepClone() };

    /// <summary>The reply with the given id from a body that is JSON or an event stream. Throws <see cref="McpProtocolException"/> when there is none.</summary>
    public static McpReply ParseReply(string? contentType, string body, int id)
    {
        var isStream = contentType?.Contains("text/event-stream", StringComparison.OrdinalIgnoreCase) == true;
        foreach (var json in isStream ? EventData(body) : [body])
        {
            JsonNode? node;
            try { node = JsonNode.Parse(json); }
            catch (JsonException) { continue; }
            // A batch answers with an array; take the message with our id.
            var candidates = node is JsonArray arr ? arr.OfType<JsonObject>() : node is JsonObject one ? [one] : [];
            foreach (var m in candidates)
            {
                if (m["id"] is not JsonValue v || !v.TryGetValue<int>(out var got) || got != id) continue;
                if (m["error"] is JsonObject e) return new McpReply(null, e["message"]?.GetValue<string>() ?? "error");
                if (m["result"] is not null) return new McpReply(m["result"]!.DeepClone(), null);
            }
        }
        throw new McpProtocolException("No reply to the request.");
    }

    /// <summary>The <c>data:</c> payloads of an event stream, one string per event (multi-line data joined with newlines).</summary>
    public static IEnumerable<string> EventData(string body)
    {
        var sb = new StringBuilder();
        foreach (var raw in body.Split('\n'))
        {
            var line = raw.TrimEnd('\r');
            if (line.Length == 0)
            {
                if (sb.Length > 0) { yield return sb.ToString(); sb.Clear(); }
                continue;
            }
            if (!line.StartsWith("data:", StringComparison.Ordinal)) continue;
            if (sb.Length > 0) sb.Append('\n');
            sb.Append(line[5..].TrimStart());
        }
        if (sb.Length > 0) yield return sb.ToString();
    }

    /// <summary>A tool-call result: the structured content when the server gave it, else the text parsed as JSON when it is JSON, plus all the text.</summary>
    public static McpToolResult ToolResult(JsonNode? result)
    {
        if (result is not JsonObject o) throw new McpProtocolException("The tool answered with no result.");
        var text = string.Concat((o["content"] as JsonArray ?? []).OfType<JsonObject>()
            .Where(c => c["type"]?.GetValue<string>() == "text").Select(c => c["text"]?.GetValue<string>() ?? ""));
        var structured = o["structuredContent"]?.DeepClone();
        if (structured is null && text.TrimStart().StartsWith('{'))
        {
            try { structured = JsonNode.Parse(text); } catch (JsonException) { /* plain text that starts with a brace */ }
        }
        return new McpToolResult(o["isError"] is JsonValue v && v.TryGetValue<bool>(out var bad) && bad, structured, text);
    }
}
