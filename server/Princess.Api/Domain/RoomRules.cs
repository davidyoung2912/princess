using System.Text.Json;

namespace Princess.Api.Domain;

public sealed record Housekeeping(string Mode, string Window, bool Turndown, long? Since);

public sealed record Devices(string Lights, int TempF, bool Tv, string Shades);

public sealed record HousekeepingPatch(string? Mode, string? Window, bool? Turndown);

public sealed record DevicesPatch(string? Lights, double? TempF, bool? Tv, string? Shades);

/// <summary>
/// The stateroom (ROM-01 to ROM-03, ROM-05), ported from <c>src/domain/room.ts</c>: the information card, housekeeping preferences, Do Not Disturb and mock smart-room controls.
/// The door cannot be unlocked from a web page, so the keycard stays the key. Names, amenities and ranges are authored concept values.
/// </summary>
public static class RoomRules
{
    public static readonly string[] Stewards = ["Marisol", "Dennis", "Aiko", "Rafael", "Joy", "Tomas"];

    public static string StewardFor(string cabin) => Stewards[(int)(ExcursionRules.Hash(cabin) % (uint)Stewards.Length)];

    private static readonly string[] Basic = ["bed", "bath", "tv", "safe"];

    /// <summary>The amenities of a room type (the server's categories). A step-free cabin adds <c>accessible</c>.</summary>
    public static List<string> AmenitiesFor(string category, bool accessible)
    {
        string[] extra = category switch
        {
            "oceanview" => ["window"],
            "balcony" => ["balcony", "fridge"],
            "miniSuite" or "sanctuaryMiniSuite" or "signatureSuite" => ["balcony", "fridge", "sitting"],
            _ => [],
        };
        var list = new List<string>([.. Basic, .. extra]);
        if (accessible) list.Add("accessible");
        return list;
    }

    /// <summary>Whether there is a window or balcony to open the shades on.</summary>
    public static bool HasView(string category) => category != "interior";

    public static readonly string[] CleaningWindows = ["any", "morning", "midday", "afternoon", "evening"];
    public static readonly string[] ServiceModes = ["none", "dnd", "makeUp"];
    public static readonly string[] Lights = ["off", "dim", "bright"];

    public const int TempMin = 62, TempMax = 78;

    public static readonly Housekeeping DefaultHousekeeping = new("none", "any", true, null);
    public static readonly Devices DefaultDevices = new("bright", 72, false, "open");

    private static T? Parse<T>(string? json, Func<JsonElement, T> read)
    {
        if (string.IsNullOrWhiteSpace(json)) return default;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object ? read(doc.RootElement.Clone()) : default;
        }
        catch (JsonException) { return default; }
    }

    private static string Pick(JsonElement o, string name, string[] allowed, string fallback) =>
        o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String && allowed.Contains(v.GetString()) ? v.GetString()! : fallback;

    public static Housekeeping NormalizeHousekeeping(string? json) =>
        Parse(json, o => new Housekeeping(
            Pick(o, "mode", ServiceModes, "none"), Pick(o, "window", CleaningWindows, "any"),
            !o.TryGetProperty("turndown", out var t) || t.ValueKind == JsonValueKind.True,
            o.TryGetProperty("since", out var s) && s.ValueKind == JsonValueKind.Number ? s.GetInt64() : null)) ?? DefaultHousekeeping;

    public static Devices NormalizeDevices(string? json) =>
        Parse(json, o =>
        {
            var temp = o.TryGetProperty("tempF", out var t) && t.ValueKind == JsonValueKind.Number ? (int)Math.Round(t.GetDouble(), MidpointRounding.AwayFromZero) : DefaultDevices.TempF;
            return new Devices(
                Pick(o, "lights", Lights, "bright"), Math.Clamp(temp, TempMin, TempMax),
                o.TryGetProperty("tv", out var tv) && tv.ValueKind == JsonValueKind.True, Pick(o, "shades", ["open", "closed"], "open"));
        }) ?? DefaultDevices;

    public static string ToJson(Housekeeping h) => JsonSerializer.Serialize(new { mode = h.Mode, window = h.Window, turndown = h.Turndown, since = h.Since });

    public static string ToJson(Devices d) => JsonSerializer.Serialize(new { lights = d.Lights, tempF = d.TempF, tv = d.Tv, shades = d.Shades });

    public static string? HousekeepingProblem(HousekeepingPatch p)
    {
        if (p.Mode is not null && !ServiceModes.Contains(p.Mode)) return "badMode";
        if (p.Window is not null && !CleaningWindows.Contains(p.Window)) return "badWindow";
        return null;
    }

    public static string? DevicesProblem(DevicesPatch p, bool view)
    {
        if (p.Lights is not null && !Lights.Contains(p.Lights)) return "badLights";
        if (p.TempF is { } t && (double.IsNaN(t) || t < TempMin || t > TempMax)) return "badTemp";
        if (p.Shades is not null && (p.Shades is not ("open" or "closed") || (!view && p.Shades == "closed"))) return "noView";
        return null;
    }

    /// <summary>After this many hours of Do Not Disturb the steward checks on the guest (a safety rule on many ships).</summary>
    public const int DndCheckHours = 24;

    public static bool DndCheckDue(Housekeeping h, long now) => h.Mode == "dnd" && h.Since is { } s && now - s >= DndCheckHours * 3_600_000L;
}
