using Princess.Api.Domain;

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
}
