namespace Princess.Api.Domain;

/// <summary>The flight watch: a notice when the guest's onward flight is late or cancelled and the day is close.</summary>
public static class FlightRules
{
    /// <summary>How many days ahead a changed flight is worth a notice.</summary>
    public const int WatchDays = 3;

    /// <summary>
    /// The guest's saved flight (as typed) on the day they leave the ship, when it is within <see cref="WatchDays"/> days (today included) and the status
    /// is delayed or cancelled. Nothing for an empty or invalid number, a day that is past or far off, or a flight that is on time.
    /// </summary>
    public static (string Flight, string Date, string State, int DelayMinutes)? Watch(string? flight, DateOnly date, DateOnly today, Func<string, string, FlightStatusDto> status)
    {
        var number = FeedRules.NormalizeFlight(flight ?? "");
        if (!FeedRules.ValidFlightNumber(number) || date < today || date > today.AddDays(WatchDays)) return null;
        var iso = date.ToString("yyyy-MM-dd");
        var s = status(number, iso);
        return s.State == "onTime" ? null : (number, iso, s.State, s.DelayMinutes);
    }
}
