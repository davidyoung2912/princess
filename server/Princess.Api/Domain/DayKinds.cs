namespace Princess.Api.Domain;

/// <summary>
/// Which days of a sailing an authored event, show or desk runs on. Events say when they run with day kinds instead of day numbers, so the same programme fits a 3-night or a 31-night sailing:
/// <c>embark</c> (day 1), <c>night</c> (every day that has a night aboard, day 1 to the last night), <c>last</c> (the last night, the evening before disembarkation),
/// <c>sea</c> (every sea day), <c>seaMid</c> (every sea day except the last night), <c>firstSea</c>, <c>port</c> (every port of call), <c>portOdd</c> and <c>portEven</c> (the first, third... and the second, fourth... port of call) and <c>friday</c> (a calendar Friday, for the Shabbat service).
/// The client has the same rule in <c>src/domain/dayKinds.ts</c>; both are tested against the sample week.
/// </summary>
public static class DayKinds
{
    public static readonly string[] All = ["embark", "night", "last", "sea", "seaMid", "firstSea", "port", "portOdd", "portEven", "friday"];

    public static bool Valid(string? kind) => kind is not null && All.Contains(kind);

    public static bool Is(Timeline timeline, int day, string kind)
    {
        if (day < 1 || day > timeline.Days.Count) return false;
        var d = timeline.Days[day - 1];
        var nights = timeline.Nights;
        switch (kind)
        {
            case "embark": return day == 1;
            case "night": return day <= nights;
            case "last": return day == nights;
            case "sea": return d.Port == "sea";
            case "seaMid": return d.Port == "sea" && day < nights;
            case "firstSea": return d.Port == "sea" && timeline.Days.First(x => x.Port == "sea").Day == day;
            case "port": return timeline.IsCall(d);
            case "portOdd": return timeline.IsCall(d) && timeline.Days.Count(x => x.Day <= day && timeline.IsCall(x)) % 2 == 1;
            case "portEven": return timeline.IsCall(d) && timeline.Days.Count(x => x.Day <= day && timeline.IsCall(x)) % 2 == 0;
            case "friday": return d.Date.DayOfWeek == DayOfWeek.Friday;
            default: return false;
        }
    }

    /// <summary>Whether an event with these kinds runs on the day (any one kind is enough).</summary>
    public static bool Runs(Timeline timeline, int day, IReadOnlyList<string> when) => when.Any(k => Is(timeline, day, k));

    /// <summary>The days of the sailing on which any of the kinds holds.</summary>
    public static List<int> DaysOf(Timeline timeline, params string[] when) => [.. Enumerable.Range(1, timeline.Days.Count).Where(d => Runs(timeline, d, when))];
}
