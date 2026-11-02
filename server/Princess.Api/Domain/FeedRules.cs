namespace Princess.Api.Domain;

public sealed record FlightStatusDto(string State, int DelayMinutes, string Source);

public sealed record RouteConditionsDto(string Traffic, string Sky, int LeaveEarlierMinutes, string Source);

public sealed record SkyDto(int Uv, int TempF, string? RainFrom, string? RainTo, string Source);

/// <summary>
/// Simulated feeds (multi-device plan Phase 5). Each is the same stub the screens used to run alone, so every device sees the same value.
/// A real provider would replace the body of each method and keep the shape.
/// </summary>
public static class FeedRules
{
    public const string Sim = "sim";

    /// <summary>The sky for a cruise day: UV and heat from the port, and sometimes an afternoon of rain. As <c>simWeather</c> in the client.</summary>
    public static SkyDto Sky(string sailingId, int day, string port)
    {
        var h = RatesRules.Hash($"{sailingId}|{day}");
        var rain = h % 4 == 0;
        var start = 12 + (int)(h % 4);
        return new SkyDto((port == "sea" ? 7 : 9) + (int)(h % 3), 80 + (int)(h % 9), rain ? $"{start:00}:00" : null, rain ? $"{start + 3:00}:00" : null, Sim);
    }

    /// <summary>A flight number as the client normalises it: spaces removed, upper case.</summary>
    public static string NormalizeFlight(string number) => string.Concat(number.Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();

    public static bool ValidFlightNumber(string normalized) =>
        System.Text.RegularExpressions.Regex.IsMatch(normalized, @"^[A-Z]{2}[0-9]{1,4}$");

    private static readonly int[] Delays = [20, 35, 50, 75, 110, 160];

    /// <summary>A stable status per flight and date: most are on time, some late, a few cancelled. As <c>flightStatus</c> in the client. Not a real feed.</summary>
    public static FlightStatusDto Flight(string normalizedNumber, string date)
    {
        var h = (int)(CabinRules.Hash($"{normalizedNumber}|{date}") % 100);
        if (h < 65) return new("onTime", 0, Sim);
        if (h < 96) return new("delayed", Delays[h % 6], Sim);
        return new("cancelled", 0, Sim);
    }

    public static bool ValidCrowd(string crowd) => crowd is "quiet" or "busy" or "busiest";

    /// <summary>Traffic to the port from how busy the guest's arrival window is, and the sky from a stable draw for the date. As <c>conditionsFor</c> in the client.</summary>
    public static RouteConditionsDto Route(string departure, string crowd)
    {
        var traffic = crowd == "quiet" ? "light" : crowd == "busy" ? "moderate" : "heavy";
        var d = CabinRules.Hash($"sky|{departure}") % 10;
        var sky = d < 5 ? "clear" : d < 8 ? "cloudy" : d < 9 ? "rain" : "storm";
        var extra = (traffic == "heavy" ? 20 : traffic == "moderate" ? 10 : 0) + (sky == "storm" ? 25 : sky == "rain" ? 10 : 0);
        return new(traffic, sky, extra, Sim);
    }
}
