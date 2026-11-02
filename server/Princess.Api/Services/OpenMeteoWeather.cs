using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>Settings for <see cref="OpenMeteoWeatherService"/> (<c>Providers:Weather</c> = <c>openmeteo</c>). The service is key-less for non-commercial use; a commercial pilot needs their paid plan, set via <c>BaseUrl</c> and <c>ApiKey</c>.</summary>
public sealed class OpenMeteoOptions
{
    public const string Section = "OpenMeteo";
    public string BaseUrl { get; set; } = "https://api.open-meteo.com/v1";
    public string? ApiKey { get; set; }
    public int TimeoutSeconds { get; set; } = 4;
}

/// <summary>
/// The sky at a port from a real forecast. It covers only what a forecast can: a port the app knows, on a day within the forecast window. Anything else (a sea day, a date
/// far ahead, a failure, an open circuit) is the simulated sky, and <c>source</c> says which it was (<c>forecast</c> or <c>sim</c>). Climate and today's weather stay simulated.
/// </summary>
public sealed class OpenMeteoWeatherService(IHttpClientFactory factory, IOptions<OpenMeteoOptions> options, IClock clock, ILogger<OpenMeteoWeatherService> log, ProviderHealth? health = null) : IWeatherService
{
    public const string ForecastSource = "forecast";
    public const int ForecastDays = 15;
    private static readonly SimWeatherService Sim = new();
    private readonly ProviderGuard guard = Register(new ProviderGuard("Weather", clock, log), health);
    private static ProviderGuard Register(ProviderGuard g, ProviderHealth? h) { h?.Register(g); return g; }

    public static readonly IReadOnlyDictionary<string, (double Lat, double Lon)> Ports = new Dictionary<string, (double, double)>
    {
        ["fll"] = (26.09, -80.12),
        ["cozumel"] = (20.51, -86.95),
        ["belize"] = (17.50, -88.19),
        ["roatan"] = (16.32, -86.54),
    };

    public SkyDto Sky(DateOnly date, string port)
    {
        var today = DateOnly.FromDateTime(clock.UtcNow);
        if (!Ports.TryGetValue(port, out var at) || date < today || date > today.AddDays(ForecastDays)) return Sim.Sky(date, port);
        return guard.Run(() => Fetch(date, at.Lat, at.Lon), () => Sim.Sky(date, port));
    }

    public Weather Climate(DateOnly date) => Sim.Climate(date);
    public WeatherToday Today(DateOnly date, bool rough) => Sim.Today(date, rough);

    private SkyDto? Fetch(DateOnly date, double lat, double lon)
    {
        var o = options.Value;
        var d = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var url = $"{o.BaseUrl.TrimEnd('/')}/forecast?latitude={lat.ToString(CultureInfo.InvariantCulture)}&longitude={lon.ToString(CultureInfo.InvariantCulture)}"
                  + $"&daily=uv_index_max,temperature_2m_max&hourly=precipitation_probability&temperature_unit=fahrenheit&timezone=auto&start_date={d}&end_date={d}"
                  + (string.IsNullOrWhiteSpace(o.ApiKey) ? "" : $"&apikey={Uri.EscapeDataString(o.ApiKey)}");
        using var http = factory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(Math.Clamp(o.TimeoutSeconds, 1, 30));
        using var res = http.Send(new HttpRequestMessage(HttpMethod.Get, url));
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"status {(int)res.StatusCode}");
        using var reader = new StreamReader(res.Content.ReadAsStream());
        return Parse(reader.ReadToEnd());
    }

    /// <summary>The sky in a forecast answer, or null when it is not in the expected shape. Rain is the first to the last daytime hour (9 to 20) at 50 percent or more.</summary>
    public static SkyDto? Parse(string json)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(json); }
        catch (System.Text.Json.JsonException) { return null; }
        if (root?["daily"] is not JsonObject daily || root["hourly"] is not JsonObject hourly) return null;
        var uv = Number(daily["uv_index_max"]);
        var temp = Number(daily["temperature_2m_max"]);
        if (uv is null || temp is null) return null;
        int? first = null, last = null;
        if (hourly["precipitation_probability"] is JsonArray probs)
            for (var h = 9; h <= 20 && h < probs.Count; h++)
                if (probs[h] is JsonValue v && v.TryGetValue<double>(out var p) && p >= 50) { first ??= h; last = h; }
        return new SkyDto((int)Math.Round(uv.Value), (int)Math.Round(temp.Value),
            first is { } f ? $"{f:00}:00" : null, last is { } l ? $"{l + 1:00}:00" : null, ForecastSource);
    }

    private static double? Number(JsonNode? array) =>
        array is JsonArray { Count: > 0 } a && a[0] is JsonValue v && v.TryGetValue<double>(out var n) ? n : null;
}
