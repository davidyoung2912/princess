namespace Princess.Api.Domain;

/// <summary>One time a treatment can start: <see cref="Left"/> is the rooms not yet taken by anyone on the sailing.</summary>
public sealed record SpaSlot(string Time, int Left);

/// <summary>What cancelling an appointment would cost right now, worked out here so the app only shows it.</summary>
public sealed record SpaCancelTerms(bool Free, long Fee, long FreeUntil);

/// <summary>The rules of spa and salon appointments (docs/explorer-harmony-plan.md section 2.6): the time grid, rooms left, overlaps and the cancellation policy. Mirrors <see cref="DiningRules"/>.</summary>
public static class SpaRules
{
    public const int MaxParty = 4;
    public const int StepMinutes = 30;

    /// <summary>Cancelling at least this many hours before the start is free (the Lotus Spa policy).</summary>
    public const int CancelFreeHours = 24;

    /// <summary>Within the free window, this share of the price is kept, in whole percent.</summary>
    public const int LateFeePercent = 50;

    /// <summary>The most characters in the note to the therapist.</summary>
    public const int MaxNote = 200;

    private static int Mins(string t) => int.Parse(t[..2]) * 60 + int.Parse(t[3..]);

    private static string Clock(int m) => $"{m / 60:00}:{m % 60:00}";

    /// <summary>The start times of a treatment inside the venue's open windows, on the half hour, so that it ends by closing.</summary>
    public static List<string> Times(HoursDayDto hours, int minutes)
    {
        var times = new SortedSet<int>();
        foreach (var w in hours.Windows)
            for (var m = (Mins(w[0]) + StepMinutes - 1) / StepMinutes * StepMinutes; m + minutes <= Mins(w[1]); m += StepMinutes) times.Add(m);
        return [.. times.Select(Clock)];
    }

    /// <summary>Whether a time is one the grid offers.</summary>
    public static bool OnGrid(HoursDayDto hours, int minutes, string? time) => time is not null && Times(hours, minutes).Contains(time);

    /// <summary>The rooms other guests have taken: the same every time for the same sailing, busier around the middle of the morning and afternoon.</summary>
    public static int TakenByOthers(SpaTreatment t, string sailingId, int day, string time)
    {
        var h = ExcursionRules.Hash($"{t.Id}|{sailingId}|{day}|{time}");
        var m = Mins(time);
        var busy = m is >= 600 and < 720 or >= 840 and < 960;
        var span = (uint)(busy ? t.Rooms + 1 : t.Rooms);
        return (int)(h % span);
    }

    /// <summary>Whether two spans on the same day overlap (end exclusive).</summary>
    public static bool Overlaps(string startA, int minutesA, string startB, int minutesB) =>
        Mins(startA) < Mins(startB) + minutesB && Mins(startB) < Mins(startA) + minutesA;

    /// <summary>The cost of cancelling now: free until <see cref="CancelFreeHours"/> before the start, then <see cref="LateFeePercent"/> of the price.</summary>
    public static SpaCancelTerms CancelTerms(long startAtMs, long nowMs, long totalCents)
    {
        var freeUntil = startAtMs - CancelFreeHours * 3_600_000L;
        return nowMs <= freeUntil ? new(true, 0, freeUntil) : new(false, totalCents * LateFeePercent / 100, freeUntil);
    }
}
