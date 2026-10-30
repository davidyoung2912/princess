using System.Text.RegularExpressions;

namespace Princess.Api.Domain;

/// <summary>Ported from <c>src/domain/trip.ts</c> and the check-in window: payment state, the next action and day arithmetic.</summary>
public static partial class TripRules
{
    public const string HomeZone = "America/New_York";
    public const int DueSoonDays = 30;
    public const int CheckinOpenDaysBefore = 3;
    public static readonly TimeOnly CheckinCloseTime = new(10, 0);

    public static int DaysBetween(DateOnly from, DateOnly to) => to.DayNumber - from.DayNumber;

    /// <summary>The calendar date on a wall clock in the ship's home zone.</summary>
    public static DateOnly Today(DateTime utc) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.SpecifyKind(utc, DateTimeKind.Utc), HomeZone));

    /// <summary>The moment a home-zone wall clock shows this date and time, as UTC.</summary>
    public static DateTime ZonedToUtc(DateOnly date, TimeOnly time)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(HomeZone);
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(local)) local = local.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(local, zone);
    }

    public static DateTime CheckinOpensAt(DateOnly departure) => ZonedToUtc(departure.AddDays(-CheckinOpenDaysBefore), TimeOnly.MinValue);

    public static DateTime CheckinClosesAt(DateOnly departure) => ZonedToUtc(departure, CheckinCloseTime);

    public static string CheckinWindow(DateTime now, DateTime opensAt, DateTime closesAt) => now < opensAt ? "notOpen" : now >= closesAt ? "closed" : "open";

    public sealed record PaymentPlan(long Total, long Deposit, long Balance, string FinalDue, string Booked);

    public static string PaymentState(PaymentPlan plan, bool balancePaid, DateOnly today)
    {
        if (balancePaid || plan.Balance == 0) return "paid";
        var left = DaysBetween(today, DateOnly.ParseExact(plan.FinalDue, "yyyy-MM-dd"));
        return left < 0 ? "overdue" : left <= DueSoonDays ? "dueSoon" : "upcoming";
    }

    /// <summary>The one thing to do next: money owed first, then paperwork, then check-in.</summary>
    public static string NextAction(string payment, int documentsMissing, bool checkinOpen, bool checkinDone)
    {
        if (payment == "overdue") return "payOverdue";
        if (documentsMissing > 0) return "documents";
        if (payment == "dueSoon") return "payDue";
        if (checkinOpen && !checkinDone) return "checkin";
        return "allSet";
    }

    [GeneratedRegex("^[A-Z0-9]{6,8}$")]
    private static partial Regex LinkNumber();

    /// <summary>Format check for linking an agent booking: the same answer for any mismatch later, so a stranger learns nothing.</summary>
    public static bool LinkFormatOk(string? number, string? lastName, string? departure, out string normalized)
    {
        normalized = new string((number ?? "").Where(c => !char.IsWhiteSpace(c) && c != '-').ToArray()).ToUpperInvariant();
        return LinkNumber().IsMatch(normalized) && !string.IsNullOrWhiteSpace(lastName) && AccountRules.IsIsoDate(departure);
    }

    public static long ToMs(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
}
