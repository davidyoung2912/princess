using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Princess.Api.Domain;

namespace Princess.Api.Services.Mcp;

/// <summary>
/// The app's own public knowledge as an MCP server (docs/mcp-integration-plan.md, phase 7): port guides and the walking port-day plan. Read-only, no guest data, no
/// tool that changes anything. <see cref="Handle"/> is the whole protocol (initialize, ping, tools/list, tools/call) as a pure function on JSON, so it can be tested without a
/// web host; <see cref="CallTool"/> is the same tools without the envelope, which the gateway uses to consume this server in-process through the same policy, guard and
/// log as any outside provider. Other assistants can read it through <c>POST /api/v1/mcp</c> with a signed-in token.
/// </summary>
public static class PrincessMcpServer
{
    public const string ServerName = "princess-public";
    public const string Provider = "princess";

    private static readonly string[] ToolNames = ["list_ports", "get_port_guide", "plan_walking_day"];

    private const string ToolList = """
    [
      {"name":"list_ports","description":"Every cruise port the guide covers: id, name, country and a one-line summary. Optionally filter by a word in the name or country.","inputSchema":{"type":"object","properties":{"query":{"type":"string","maxLength":60}},"additionalProperties":false}},
      {"name":"get_port_guide","description":"One port's guide: how to get ashore, the things to do with how easy each is to reach and where they are on the map, and traveller tips. General information; confirm times and prices before going.","inputSchema":{"type":"object","properties":{"port":{"type":"string","description":"A port id from list_ports, such as cozumel."}},"required":["port"],"additionalProperties":false}},
      {"name":"plan_walking_day","description":"A walking plan for a port day from the guide's places, timed between getting ashore and a safety margin before the ship's all-aboard time. A suggestion, not a booking; the ship's notice has the last word on when to be back.","inputSchema":{"type":"object","properties":{"port":{"type":"string"},"arrive":{"type":"string","description":"Ship arrival, port time HH:MM."},"allAboard":{"type":"string","description":"Everyone aboard by, port time HH:MM."},"tender":{"type":"boolean"},"pace":{"type":"string","enum":["steady","easy"]},"meal":{"type":"boolean","description":"Leave an hour for a meal."}},"required":["port","arrive","allAboard"],"additionalProperties":false}}
    ]
    """;

    /// <summary>One JSON-RPC message in, the answer out (null for a notification, which gets none).</summary>
    public static JsonNode? Handle(JsonNode? message)
    {
        if (message is not JsonObject m || m["jsonrpc"]?.GetValue<string>() != "2.0" || m["method"] is not JsonValue mv || !mv.TryGetValue<string>(out var method))
            return Error(null, -32600, "Invalid request.");
        var id = m["id"]?.DeepClone();
        if (id is null) return null;   // a notification: initialized, cancelled and so on
        switch (method)
        {
            case "initialize":
                return Result(id, new JsonObject
                {
                    ["protocolVersion"] = McpWire.ProtocolVersion,
                    ["capabilities"] = new JsonObject { ["tools"] = new JsonObject() },
                    ["serverInfo"] = new JsonObject { ["name"] = ServerName, ["version"] = "1.0" },
                    ["instructions"] = "Public cruise-port knowledge from Princess Voyages. Read-only. Times are port times; the ship's own notice has the last word.",
                });
            case "ping":
                return Result(id, new JsonObject());
            case "tools/list":
                return Result(id, new JsonObject { ["tools"] = JsonNode.Parse(ToolList) });
            case "tools/call":
            {
                var p = m["params"] as JsonObject;
                var name = p?["name"] is JsonValue nv && nv.TryGetValue<string>(out var n) ? n : null;
                if (name is null || !ToolNames.Contains(name)) return Error(id, -32602, "Unknown tool.");
                var r = CallTool(name, p?["arguments"] as JsonObject ?? new JsonObject());
                var result = new JsonObject { ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = r.Text }) };
                if (r.Structured is not null) result["structuredContent"] = r.Structured.DeepClone();
                if (r.IsError) result["isError"] = true;
                return Result(id, result);
            }
            default:
                return Error(id, -32601, "Method not found.");
        }
    }

    private static JsonObject Result(JsonNode id, JsonNode result) => new() { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result };
    private static JsonObject Error(JsonNode? id, int code, string message) => new() { ["jsonrpc"] = "2.0", ["id"] = id, ["error"] = new JsonObject { ["code"] = code, ["message"] = message } };

    private static McpToolResult Ok(JsonNode data) => new(false, data, data.ToJsonString());
    private static McpToolResult Fail(string message) => new(true, null, message);
    private static string? Str(JsonObject a, string k) => a[k] is JsonValue v && v.TryGetValue<string>(out var s) && s.Length > 0 ? s : null;
    private static bool Flag(JsonObject a, string k) => a[k] is JsonValue v && v.TryGetValue<bool>(out var b) && b;
    private static bool Time(string? s) => s is { Length: 5 } && System.Text.RegularExpressions.Regex.IsMatch(s, @"^([01]\d|2[0-3]):[0-5]\d$");

    public static McpToolResult CallTool(string tool, JsonObject args) => tool switch
    {
        "list_ports" => ListPorts(Str(args, "query")),
        "get_port_guide" => GetPortGuide(Str(args, "port")),
        "plan_walking_day" => PlanWalkingDay(args),
        _ => Fail("Unknown tool."),
    };

    private static McpToolResult ListPorts(string? query)
    {
        using var doc = JsonDocument.Parse(PortGuides.ListJson);
        var ports = new JsonArray();
        foreach (var p in doc.RootElement.GetProperty("ports").EnumerateArray())
        {
            string S(string k) => p.GetProperty(k).GetString() ?? "";
            if (query is { Length: > 0 } && !(S("name") + " " + S("countryName")).Contains(query, StringComparison.OrdinalIgnoreCase)) continue;
            ports.Add(new JsonObject { ["id"] = S("id"), ["name"] = S("name"), ["country"] = S("countryName"), ["summary"] = Cap(S("shortDescription"), 240) });
            if (ports.Count >= 120) break;
        }
        return Ok(new JsonObject { ["count"] = ports.Count, ["ports"] = ports });
    }

    private static string Cap(string s, int max) => s.Length <= max ? s : s[..max].TrimEnd() + "…";

    private static McpToolResult GetPortGuide(string? port)
    {
        if (port is null || PortGuides.Json(port) is not { } json) return Fail("No guide for that port.");
        using var doc = JsonDocument.Parse(json);
        var g = doc.RootElement;
        string S(JsonElement e, string k) => e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
        var things = new JsonArray();
        if (g.TryGetProperty("attractions", out var items))
            foreach (var a in items.EnumerateArray())
            {
                var o = new JsonObject { ["name"] = S(a, "name"), ["reach"] = S(a, "tier"), ["why"] = Cap(S(a, "why"), 500) };
                if (a.TryGetProperty("map", out var map) && map.ValueKind == JsonValueKind.Object && map.TryGetProperty("lat", out var lat) && map.TryGetProperty("lng", out var lng))
                    o["map"] = new JsonObject { ["lat"] = lat.GetDouble(), ["lng"] = lng.GetDouble() };
                things.Add(o);
            }
        var tips = new JsonArray();
        if (g.TryGetProperty("tips", out var t))
            foreach (var tip in t.EnumerateArray().Take(8)) tips.Add(new JsonObject { ["title"] = S(tip, "title"), ["text"] = Cap(S(tip, "text"), 400) });
        return Ok(new JsonObject
        {
            ["id"] = S(g, "id"), ["name"] = S(g, "name"), ["country"] = S(g, "countryName"), ["area"] = S(g, "area"), ["summary"] = Cap(S(g, "shortDescription"), 400),
            ["gettingAshore"] = Cap(S(g, "gettingAshore"), 900), ["thingsToDo"] = things, ["tips"] = tips,
            ["note"] = "General information from Princess Voyages' port guide. Confirm opening times, access and conditions for your call date.",
        });
    }

    private static McpToolResult PlanWalkingDay(JsonObject a)
    {
        var port = Str(a, "port");
        var arrive = Str(a, "arrive");
        var aboard = Str(a, "allAboard");
        var pace = Str(a, "pace");
        if (port is null || PortGuides.Places(port) is not { Count: > 0 } places) return Fail("No guide with places for that port.");
        if (!Time(arrive) || !Time(aboard) || PortDayRules.ToMinutes(aboard!) <= PortDayRules.ToMinutes(arrive!)) return Fail("arrive and allAboard must be port times HH:MM, with allAboard later.");
        if (pace is not null && pace is not ("steady" or "easy")) return Fail("pace is steady or easy.");
        var plan = PortDayRules.Plan([.. places.Select(p => new PortDayCandidate(p.Name, p.Tier, p.Why, p.Lat, p.Lng))], arrive!, aboard!, Flag(a, "tender"), pace == "easy", Flag(a, "meal") ? 60 : 0);
        var stops = new JsonArray();
        foreach (var s in plan.Stops)
            stops.Add(new JsonObject { ["name"] = s.Name, ["arriveAt"] = s.ArriveAt, ["leaveAt"] = s.LeaveAt, ["walkMinutesFromPrevious"] = s.WalkFromPrevious, ["map"] = new JsonObject { ["lat"] = s.Lat, ["lng"] = s.Lng } });
        return Ok(new JsonObject
        {
            ["port"] = port, ["reason"] = plan.Reason, ["stops"] = stops, ["walkingMinutes"] = plan.Walking, ["spareMinutes"] = plan.Spare, ["headBackBy"] = plan.HeadBackBy, ["allAboard"] = plan.AllAboard,
            ["note"] = "A suggestion from the port guide, in port time. The pier position is not known, so the walk is counted from the first stop and back to it. The ship's notice on the day has the last word on when to be back.",
        });
    }
}
