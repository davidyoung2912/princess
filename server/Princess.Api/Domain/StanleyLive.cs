using System.Globalization;
using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>
/// Short live ship answers (docs/stanley-answers-plan.md, phase 3b): the next port, the weather now and at the next port, the sea state, and what is on in the next hour. Each is read from the ship's navigation, weather and
/// programme services at the moment of the question (so the card's data time is that moment), never from the booking, and no model is involved. A card is short (three lines at most). A question that wants more
/// (a forecast for the week) gets one plain sentence and the link to the full screen; a reading that cannot be made (not sailing, source unreadable) abstains with the way to a person, as the other cards do.
/// The card does not say whether a source is simulated: a real provider replaces the mock behind <c>IShipNavigation</c> and nothing here changes.
/// </summary>
public static class StanleyLive
{
    private sealed record Live(string Id, Regex Asks, Func<StanleyTrip, long, string, StanleyCardDto> Run);

    private static Regex R(string pattern) => new(pattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly CitationDto WeatherScreen = new("Weather", "/plan/weather"), SeaScreen = new("Sea", "/ship/sea"), TodayScreen = new("Today", "/today"), Ports = new("Ports", "/home/ports");

    private static readonly Regex LongWeather = R(@"\b(forecast|this week|all week|rest of the (week|trip|cruise|sailing)|each day|every day|next few days|weekend|days ahead)\b");

    private static readonly IReadOnlyList<Live> All =
    [
        new("nextPort", R(@"\bnext (port|stop)\b|\bwhen (do|will|are) we (arrive|arriving|dock|docking|get there|reach (the )?(next )?port)\b|\bwhen (is|will) the ship (arriving|arrive|dock|docking)\b|\bhow (far|long) (is it |until |to )(the )?next port\b"), NextPort),
        new("weather", R(@"\b(weather|temperature|how (hot|cold|warm) is it|is it (raining|going to rain|sunny|cold|hot)|will it rain)\b"), Weather),
        new("seaState", R(@"\b(sea state|how rough|rough (sea|seas|water|crossing)|choppy|how (big|high) are the waves|wave height|swell|waves today|wind speed|beaufort)\b"), Sea),
        new("onNext", R(@"\bwhat('s| is) (on|happening) (in|for|during) the next (hour|\d+ ?hours?)\b|\bwhat('s| is) (happening|on) (soon|right now|this hour|now)\b|\banything (on|happening) (soon|now|this hour|in the next hour)\b"), OnNext),
    ];

    /// <summary>Whether a live card takes the question, before any trip facts are known.</summary>
    public static bool Takes(string message) => All.Any(l => l.Asks.IsMatch(message));

    /// <summary>The ids of the live cards, for the tests.</summary>
    public static IReadOnlyList<string> Ids => [.. All.Select(l => l.Id)];

    /// <summary>The card for a question one live topic takes, or null when none does. <paramref name="now"/> is the real time of the question.</summary>
    public static StanleyCardDto? Resolve(string message, StanleyTrip trip, DateTime now)
    {
        if (StanleyRouter.Route(message, "unknown", true).Planning) return null;
        var live = All.FirstOrDefault(l => l.Asks.IsMatch(message));
        if (live is null) return null;
        try { return live.Run(trip, TripRules.ToMs(now), message); }
        catch (Exception e) when (e is not OperationCanceledException) { return Cannot(live.Id, Title(live.Id), "The ship's live readings could not be read just now.", now); }
    }

    private static string Title(string id) => id switch { "nextPort" => "Next port", "weather" => "Weather", "seaState" => "Sea state", _ => "On in the next hour" };

    private static StanleyCardDto Fresh(string id, string title, List<string> lines, long ms, params CitationDto[] links) =>
        new(id, title, lines, new StanleyProvenance([StanleyChips.Live], "The ship's live readings", DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime, "live", false, "Read from the ship's systems when you asked. The ship's own notice is the last word."), false, [.. links]);

    private static StanleyCardDto Cannot(string id, string title, string reason, DateTime now, params CitationDto[] links) =>
        new(id, title, [$"I cannot confirm this. {reason}", "Please check with a person at Guest Services, or on the screen shown."],
            new StanleyProvenance([], "The ship's live readings", null, "provisional", true, "I did not have a current reading, so I did not answer from memory."), true, [.. links]);

    private static StanleyCardDto NotSailing(string id, string title, long ms, params CitationDto[] links) =>
        Cannot(id, title, "The ship's live readings are only available while your sailing is under way.", DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime, links);

    private static string PortName(string id) => id == "sea" ? "At sea" : Itinerary.PortOf(id)?.Name ?? "At sea";
    private static string Whole(double v) => ((int)Math.Round(v)).ToString(CultureInfo.InvariantCulture);
    private static string One(double v) => v.ToString("0.#", CultureInfo.InvariantCulture);
    private static string Hm(TimeOnly t) => t.ToString("HH:mm", CultureInfo.InvariantCulture);

    private static string Words(string condition) => condition switch
    {
        "partlyCloudy" => "partly cloudy", "showers" => "showers", "rain" => "rain", "storm" => "storms", "cloudy" => "cloudy", _ => "sunny",
    };

    private static readonly string[] SeaWords = ["calm (glassy)", "calm (rippled)", "smooth", "slight", "moderate", "rough", "very rough", "high", "very high", "phenomenal"];

    private static string Away(long ms, long at)
    {
        var minutes = Math.Max(0, (int)Math.Round((at - ms) / 60000.0));
        return minutes < 60 ? $"{minutes} {(minutes == 1 ? "minute" : "minutes")}" : $"about {(minutes + 30) / 60} {((minutes + 30) / 60 == 1 ? "hour" : "hours")}";
    }

    // ---- next port ----------------------------------------------------------------------------------------------------------------------

    private static StanleyCardDto NextPort(StanleyTrip trip, long ms, string message)
    {
        var timeline = trip.Timeline;
        var pos = NavigationRules.Position(timeline, ms);
        if (pos.Day is null) return NotSailing("nextPort", "Next port", ms, Ports);
        var lines = new List<string>();
        if (pos.InPort is { } here) lines.Add($"The ship is in {PortName(here)} now.");
        if (pos.NextPort is not { } next || pos.Arrival is not { } arrival) lines.Add("That is the last port on your sailing.");
        else
        {
            lines.Add(pos.InPort is null
                ? $"Next port: {PortName(next)}, arriving at {arrival.ShipTime} ship time on day {arrival.Day}, in {Away(ms, arrival.At)}."
                : $"Next port: {PortName(next)}, arriving at {arrival.ShipTime} ship time on day {arrival.Day}.");
        }
        // The all-aboard time that matters most: today's while the ship is still in port, otherwise the next port's, in the port's own time.
        var aboardDay = pos.InPort is not null && timeline.AllAboardAt(pos.Day.Value) is { } due && TripRules.ToMs(due) > ms ? pos.Day.Value : pos.Arrival?.Day;
        if (aboardDay is { } d && timeline.Days.FirstOrDefault(x => x.Day == d)?.AllAboard is { } aboard)
            lines.Add($"All aboard {(d == pos.Day ? "today" : "on day " + d)} at {Hm(aboard)}, local time in port.");
        return Fresh("nextPort", "Next port", lines, ms, pos.NextPort is { } p ? new CitationDto(PortName(p), $"/home/ports/{p}") : Ports);
    }

    // ---- weather ------------------------------------------------------------------------------------------------------------------------

    private static StanleyCardDto Weather(StanleyTrip trip, long ms, string message)
    {
        if (LongWeather.IsMatch(message))
            return new("weather", "Weather", ["The forecast for the days ahead is on the Weather screen."],
                new StanleyProvenance([], "Ship weather", null, "provisional", false, "The full forecast is on its own screen."), false, [WeatherScreen]);
        var timeline = trip.Timeline;
        var wx = ShipWeatherRules.Weather(timeline, ms);
        if (wx.Day is null) return NotSailing("weather", "Weather", ms, WeatherScreen);
        var pos = NavigationRules.Position(timeline, ms);
        var lines = new List<string>();
        var aheadAsked = Regex.IsMatch(message, @"\b(next port|tomorrow)\b", RegexOptions.IgnoreCase);
        if (aheadAsked)
        {
            var wanted = Regex.IsMatch(message, @"\bnext port\b", RegexOptions.IgnoreCase)
                ? wx.Forecast.FirstOrDefault(f => pos.NextPort is not null && f.Place == pos.NextPort)
                : wx.Forecast.FirstOrDefault(f => f.Day == wx.Day + 1);
            if (wanted is null) return new("weather", "Weather", ["I do not have a forecast for that. The Weather screen shows the days I do have."],
                new StanleyProvenance([], "Ship weather", null, "provisional", false, "The full forecast is on its own screen."), false, [WeatherScreen]);
            lines.Add($"Day {wanted.Day}, {PortName(wanted.Place)}: {Words(wanted.Condition)}, high {Whole(wanted.HighC)}°C, low {Whole(wanted.LowC)}°C.");
            lines.Add($"{wanted.RainChancePercent}% chance of rain; wind {wanted.WindKnots} knots from {wanted.WindFrom}.");
            return Fresh("weather", "Weather ahead", lines, ms, WeatherScreen);
        }
        var c = wx.Current;
        lines.Add($"{PortName(wx.Place)} now: {Words(c.Condition)}, {Whole(c.TempC)}°C (feels like {Whole(c.FeelsLikeC)}°C).");
        lines.Add($"Wind {c.WindKnots} knots from {c.WindFrom}; {c.RainChancePercent}% chance of rain.");
        if (wx.Forecast.FirstOrDefault(f => f.Day == wx.Day) is { } today) lines.Add($"Today: high {Whole(today.HighC)}°C, low {Whole(today.LowC)}°C.");
        return Fresh("weather", "Weather now", lines, ms, WeatherScreen);
    }

    // ---- sea state ----------------------------------------------------------------------------------------------------------------------

    private static StanleyCardDto Sea(StanleyTrip trip, long ms, string message)
    {
        var timeline = trip.Timeline;
        if (NavigationRules.Position(timeline, ms).Day is null) return NotSailing("seaState", "Sea state", ms, SeaScreen);
        var s = NavigationRules.Sea(timeline, ms);
        var word = SeaWords[Math.Clamp(s.SeaState, 0, SeaWords.Length - 1)];
        return Fresh("seaState", "Sea state", [
            $"The sea is {word} (sea state {s.SeaState}): waves about {One(s.WaveM)} m.",
            $"Swell {One(s.SwellM)} m from {s.SwellFrom}; wind {s.WindKnots} knots from {s.WindFrom} (force {s.Beaufort}).",
        ], ms, SeaScreen);
    }

    // ---- what is on ---------------------------------------------------------------------------------------------------------------------

    private static StanleyCardDto OnNext(StanleyTrip trip, long ms, string message)
    {
        var timeline = trip.Timeline;
        var pos = NavigationRules.Position(timeline, ms);
        if (pos.Day is not { } day) return NotSailing("onNext", "On in the next hour", ms, TodayScreen);
        var shipId = trip.Ship.ToLowerInvariant().Replace(' ', '-');
        var hour = ms + 3_600_000;
        var soon = ProgramRules.On(timeline, day, true, null, shipId).Where(e => e.Status != "cancelled" && e.EndAt > ms && e.StartAt < hour).ToList();
        var lines = new List<string>();
        if (soon.Count == 0) lines.Add("Nothing is on the programme in the next hour. The Today screen shows the rest of the day.");
        else
        {
            foreach (var e in soon.Take(3)) lines.Add(e.StartAt <= ms ? $"{e.Title}: on now, until {EndOf(e)}." : $"{e.Title} at {e.Start}.");
            if (soon.Count > 3) lines.Add($"{soon.Count - 3} more on the Today screen.");
        }
        return Fresh("onNext", "On in the next hour", lines, ms, TodayScreen);
    }

    private static string EndOf(DatedEvent e) => TimeOnly.ParseExact(e.Start, "HH:mm", CultureInfo.InvariantCulture).AddMinutes(e.Minutes).ToString("HH:mm", CultureInfo.InvariantCulture);
}
