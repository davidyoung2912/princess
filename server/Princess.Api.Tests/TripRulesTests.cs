using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>Mirrors <c>src/domain/trip.ts</c> and the check-in window.</summary>
public class TripRulesTests
{
    private static TripRules.PaymentPlan Plan(long balance = 78_000) => new(97_000 + balance, 97_000, balance, "2027-03-11", "2027-01-10");

    [Theory]
    [InlineData("2027-01-10", "upcoming")]   // 60 days out
    [InlineData("2027-02-09", "dueSoon")]    // exactly 30 days out
    [InlineData("2027-02-08", "upcoming")]   // 31 days out
    [InlineData("2027-03-11", "dueSoon")]    // due today
    [InlineData("2027-03-12", "overdue")]
    public void PaymentStateFollowsTheDueDate(string today, string expected) =>
        Assert.Equal(expected, TripRules.PaymentState(Plan(), false, DateOnly.Parse(today)));

    [Fact]
    public void PaidOrNothingOwedIsPaidWhateverTheDate()
    {
        Assert.Equal("paid", TripRules.PaymentState(Plan(), true, new DateOnly(2027, 6, 1)));
        Assert.Equal("paid", TripRules.PaymentState(Plan(balance: 0), false, new DateOnly(2027, 6, 1)));
    }

    [Theory]
    [InlineData("overdue", 3, true, false, "payOverdue")]
    [InlineData("upcoming", 1, true, false, "documents")]
    [InlineData("dueSoon", 0, true, false, "payDue")]
    [InlineData("upcoming", 0, true, false, "checkin")]
    [InlineData("upcoming", 0, true, true, "allSet")]
    [InlineData("upcoming", 0, false, false, "allSet")]
    public void NextActionPutsMoneyFirstThenPaperworkThenCheckin(string payment, int missing, bool open, bool done, string expected) =>
        Assert.Equal(expected, TripRules.NextAction(payment, missing, open, done));

    [Fact]
    public void CheckinOpensThreeDaysBeforeAtMidnightShipTimeAndClosesAtTenOnSailingDay()
    {
        var departure = new DateOnly(2027, 3, 21);
        // New York is on daylight time from 14 March 2027, so UTC-4.
        Assert.Equal(new DateTime(2027, 3, 18, 4, 0, 0, DateTimeKind.Utc), TripRules.CheckinOpensAt(departure));
        Assert.Equal(new DateTime(2027, 3, 21, 14, 0, 0, DateTimeKind.Utc), TripRules.CheckinClosesAt(departure));
    }

    [Fact]
    public void TheWindowIsNotOpenOpenThenClosed()
    {
        var opens = new DateTime(2027, 3, 18, 4, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2027, 3, 21, 14, 0, 0, DateTimeKind.Utc);
        Assert.Equal("notOpen", TripRules.CheckinWindow(opens.AddSeconds(-1), opens, closes));
        Assert.Equal("open", TripRules.CheckinWindow(opens, opens, closes));
        Assert.Equal("open", TripRules.CheckinWindow(closes.AddSeconds(-1), opens, closes));
        Assert.Equal("closed", TripRules.CheckinWindow(closes, opens, closes));
    }

    [Fact]
    public void TodayIsTheShipHomeDateNotTheUtcDate()
    {
        // 02:00 UTC on 21 March is still the evening of the 20th in New York.
        Assert.Equal(new DateOnly(2027, 3, 20), TripRules.Today(new DateTime(2027, 3, 21, 2, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(new DateOnly(2027, 3, 21), TripRules.Today(new DateTime(2027, 3, 21, 5, 0, 0, DateTimeKind.Utc)));
    }

    [Theory]
    [InlineData("ag4k72q", "Whitfield", "2027-03-21", true, "AG4K72Q")]
    [InlineData(" AG4-K72Q ", "Whitfield", "2027-03-21", true, "AG4K72Q")]
    [InlineData("AG4K7", "Whitfield", "2027-03-21", false, "AG4K7")]
    [InlineData("AG4K72Q", " ", "2027-03-21", false, "AG4K72Q")]
    [InlineData("AG4K72Q", "Whitfield", "21/03/2027", false, "AG4K72Q")]
    [InlineData("AG4K72Q", "Whitfield", null, false, "AG4K72Q")]
    public void LinkFormat(string number, string lastName, string? departure, bool ok, string normalized)
    {
        Assert.Equal(ok, TripRules.LinkFormatOk(number, lastName, departure, out var n));
        Assert.Equal(normalized, n);
    }
}
