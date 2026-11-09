using System.Globalization;

namespace Princess.Api.Domain;

/// <summary>The weather at the ship now. Metric: Celsius, knots, hectopascals, kilometres. <c>Condition</c> is sunny, partlyCloudy, cloudy, showers, rain or storm; <c>Daylight</c> says whether the sun is up on the ship's clock.</summary>
public sealed record WeatherNowDto(
    string Condition, bool Daylight, double TempC, double FeelsLikeC, int HumidityPercent, int WindKnots, int GustKnots, string WindFrom, int PressureHpa, double VisibilityKm,
    int UvIndex, int CloudPercent, int RainChancePercent);

/// <summary>One day of the forecast: the cruise day, its ship date, where the ship is at midday (a port id or "sea"), and the day's figures.</summary>
public sealed record WeatherDayDto(
    int Day, string Date, string Place, string Condition, int HighC, int LowC, int RainChancePercent, int WindKnots, string WindFrom, double WaveM, int UvIndex, int CloudPercent);

public sealed record ShipWeatherDto(long Now, double Lat, double Lon, int? Day, string Place, WeatherNowDto Current, WeatherDayDto[] Forecast, string Source);

/// <summary>
/// The simulated weather around the ship. Each day's sky is chosen from the date, the air temperature follows the season, the water and the latitude,
/// and the wind is the same wind the sea feed reports. A real forecast feed replaces this behind <c>IShipNavigation</c> and keeps the shape.
/// </summary>
public static class ShipWeatherRules
{
    private const long Hour = 3_600_000;
    public const int MaxForecastDays = 7;

    private sealed record Sky(string Condition, int Cloud, int Rain, int Uv, double VisibilityKm, int PressureDelta, int Humidity);

    private static Sky SkyOf(string date)
    {
        var roll = (int)(OnboardFeedRules.Hash31($"wx{date}") % 100);
        var jitter = (int)(OnboardFeedRules.Hash31($"wxj{date}") % 11) - 5;
        static int Clamp(int v) => Math.Clamp(v, 0, 100);
        return roll switch
        {
            < 35 => new Sky("sunny", Clamp(10 + jitter), Clamp(5 + jitter / 2), 11, 30, 3, 65 + jitter),
            < 60 => new Sky("partlyCloudy", Clamp(40 + jitter * 2), Clamp(15 + jitter), 9, 26, 1, 70 + jitter),
            < 78 => new Sky("cloudy", Clamp(80 + jitter), Clamp(30 + jitter), 5, 20, 0, 75 + jitter),
            < 92 => new Sky("showers", Clamp(85 + jitter), Clamp(60 + jitter), 4, 12, -2, 82 + jitter),
            < 98 => new Sky("rain", Clamp(95 + jitter / 2), Clamp(85 + jitter), 2, 8, -4, 88 + jitter),
            _ => new Sky("storm", 100, 95, 1, 5, -8, 92),
        };
    }

    private static (int High, int Low) Range(double lat, DateTime utc, Sky sky)
    {
        var water = NavigationRules.MonthlyWaterC[utc.Month - 1];
        var north = Math.Max(0, lat - 20) * (utc.Month is 12 or <= 4 ? 0.5 : 0.2);
        var cool = sky.Condition switch { "rain" => 2.0, "storm" => 3.0, "showers" => 1.0, "cloudy" => 0.5, _ => 0.0 };
        var high = (int)Math.Round(water + 2 - north - cool);
        return (high, high - 4);
    }

    private static double Round1(double v) => Math.Round(v, 1);

    private static (DateOnly Date, int Hour) ShipLocal(Timeline timeline, DateTime utc)
    {
        var (date, time) = Itinerary.LocalAt(utc, timeline.ShipZoneAt(utc));
        return (date, time.Hour);
    }

    public static ShipWeatherDto Weather(Timeline timeline, long ms)
    {
        var utc = DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;
        var pos = NavigationRules.Position(timeline, ms);
        var (date, hour) = ShipLocal(timeline, utc);
        var dateText = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var sky = SkyOf(dateText);
        var (high, low) = Range(pos.Lat, utc, sky);
        // The air warms from a low at 05:00 to a high at 15:00 and cools again overnight.
        var temp = Round1((high + low) / 2.0 + (high - low) / 2.0 * Math.Sin((hour - 9) / 24.0 * 2 * Math.PI));
        var wind = (int)Math.Round(NavigationRules.WindAt(ms));
        var windFrom = NavigationRules.Compass(NavigationRules.WindFromDegrees[(int)(OnboardFeedRules.Hash31($"from{ms / (6 * Hour)}") % (uint)NavigationRules.WindFromDegrees.Length)]);
        var daylight = hour is >= 6 and < 18;
        var humidity = Math.Clamp(sky.Humidity, 40, 100);
        // Heat index: humid air feels warmer, a breeze cools it a little.
        var feels = Round1(temp + Math.Max(0, (humidity - 60) / 10.0) - Math.Min(2, wind / 15.0));
        var current = new WeatherNowDto(
            sky.Condition, daylight, temp, feels, humidity, wind, (int)Math.Round(wind * 1.35), windFrom, 1013 + sky.PressureDelta + (int)(OnboardFeedRules.Hash31($"hpa{ms / (6 * Hour)}") % 3),
            sky.VisibilityKm, daylight ? sky.Uv : 0, sky.Cloud, sky.Rain);

        var days = timeline.Days;
        int today;
        if (pos.Day is { } d) today = d;
        else today = date < days[0].Date ? 1 : days.Count;
        var forecast = new List<WeatherDayDto>();
        for (var n = today; n <= days.Count && forecast.Count < MaxForecastDays; n++)
        {
            var day = days[n - 1];
            var noonUtc = Itinerary.LocalToUtc(day.Date, new TimeOnly(12, 0), timeline.HomeZone);
            var noon = new DateTimeOffset(DateTime.SpecifyKind(noonUtc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
            var at = NavigationRules.Position(timeline, noon);
            var ds = SkyOf(day.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            var (h, l) = Range(at.Lat, noonUtc, ds);
            var w = NavigationRules.WindAt(noon);
            var wf = NavigationRules.Compass(NavigationRules.WindFromDegrees[(int)(OnboardFeedRules.Hash31($"from{noon / (6 * Hour)}") % (uint)NavigationRules.WindFromDegrees.Length)]);
            forecast.Add(new WeatherDayDto(n, day.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), at.InPort ?? "sea", ds.Condition, h, l, ds.Rain, (int)Math.Round(w), wf, Round1(0.02 * Math.Pow(w, 1.5)), ds.Uv, ds.Cloud));
        }
        return new ShipWeatherDto(ms, pos.Lat, pos.Lon, pos.Day, pos.InPort ?? "sea", current, [.. forecast], FeedRules.Sim);
    }
}
