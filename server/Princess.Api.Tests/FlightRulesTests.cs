using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

public class FlightRulesTests
{
    private static readonly DateOnly Today = new(2027, 3, 20);
    private static FlightStatusDto Late(string n, string d) => new("delayed", 50, "sim");
    private static FlightStatusDto Cancelled(string n, string d) => new("cancelled", 0, "sim");
    private static FlightStatusDto OnTime(string n, string d) => new("onTime", 0, "sim");

    [Fact]
    public void WatchSkipsBlankInvalidPastFarAndOnTime()
    {
        Assert.Null(FlightRules.Watch("", Today, Today, Late));
        Assert.Null(FlightRules.Watch(null, Today, Today, Late));
        Assert.Null(FlightRules.Watch("nonsense", Today, Today, Late));
        Assert.Null(FlightRules.Watch("AA123", Today.AddDays(-1), Today, Late));
        Assert.Null(FlightRules.Watch("AA123", Today.AddDays(4), Today, Late));
        Assert.Null(FlightRules.Watch("AA123", Today.AddDays(1), Today, OnTime));
    }

    [Fact]
    public void WatchReportsLateAndCancelledFlightsNormalised()
    {
        Assert.Equal(("AA123", "2027-03-22", "delayed", 50), FlightRules.Watch("aa 123", Today.AddDays(2), Today, Late)!.Value);
        Assert.Equal("cancelled", FlightRules.Watch("AA123", Today, Today, Cancelled)!.Value.State);
    }

    [Fact]
    public void FlightNoticeSitsBeforeCheckin()
    {
        var ids = NotificationRules.BuildNotices(new("paid", "2027-03-11", 0, 0, "open", "2027-03-18", null, 0, "2027-03-20", null, "", "", 0, "AA123", "2027-03-22", "delayed", 50)).Select(n => n.Id);
        Assert.Equal(["flightWatch", "checkinOpens"], ids);
    }

    [Fact]
    public void PushBuildsTenderFlightAndInstalmentNotices()
    {
        var now = new DateTime(2027, 3, 20, 12, 0, 0, DateTimeKind.Utc);
        var input = new PushInput(now, "ok", "", null, false, 45, false, [], [], 0, [],
            Instalment: new InstalmentPayment("2027-03-25", 50_000), Tender: ("belize", "2027-03-22", "mixed", 14), Flight: ("AA123", "2027-03-22", "delayed", 50));
        var kinds = PushRules.Build(input).Select(n => n.Kind).OrderBy(k => k).ToList();
        Assert.Equal(["payment", "travel", "travel"], kinds);
        Assert.Empty(PushRules.Build(input with { Instalment = new InstalmentPayment("2027-04-25", 50_000), Tender = null, Flight = null }));
    }

    [Fact]
    public void WalletCopyIsOutdatedOnlyWhenACodeNoLongerMatches()
    {
        WalletCopy[] now = [new(1, "a"), new(2, "b")];
        Assert.False(BoardingRules.WalletOutdated([], now));
        Assert.False(BoardingRules.WalletOutdated(now, now));
        Assert.True(BoardingRules.WalletOutdated([new(1, "a"), new(2, "old")], now));
        Assert.True(BoardingRules.WalletOutdated([new(1, "a")], now));
    }

    [Fact]
    public void AutoInstalmentStillDueShowsAsCouldNotTake()
    {
        var ids = NotificationRules.BuildNotices(new("ok", "2027-05-01", 0, 0, "done", "2027-03-18", "2027-03-20", 50_000, "2027-03-20", InstalmentAutoFailed: true)).Select(n => n.Id);
        Assert.Equal(["instalmentAutoFailed"], ids);
    }
}
