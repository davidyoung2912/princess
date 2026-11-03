using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>The timeline of a sailing built from its day rows: any length, route and clock changes. The older single-route behaviour is the reference.</summary>
[Collection("FareBook")]
public class TimelineTests : IDisposable
{
    public TimelineTests() => TimelineBook.Set([], [],
    [
        new Port("barcelona", "Barcelona", "Europe/Madrid", false, 41.35, 2.17), new Port("marseille", "Marseille", "Europe/Paris", false, 43.3, 5.35),
        new Port("southampton", "Southampton", "Europe/London", false, 50.9, -1.4),
    ]);

    public void Dispose() => TimelineBook.Clear();

    private static TimeOnly T(string t) => TimeOnly.ParseExact(t, "HH:mm");
    private static DateTime Utc(DateOnly d, string time, string zone) => Itinerary.LocalToUtc(d, T(time), zone);

    [Theory]
    [InlineData("2026-11-08")]
    [InlineData("2027-02-28")]
    [InlineData("2027-03-21")]
    public void Day_rows_of_the_older_route_give_the_same_answers_as_the_built_in_route(string date)
    {
        var dep = DateOnly.Parse(date);
        var legacy = Timeline.Legacy(dep);
        var changes = legacy.ClockChanges();
        // The same eight days, now carrying their clock changes as the database rows do.
        var days = legacy.Days.Select(d => d.Day switch
        {
            4 => d with { ClockChangeHours = changes[0].Hours, ClockChangeAt = T("02:00") },
            7 => d with { ClockChangeHours = changes[1].Hours, ClockChangeAt = T("02:00") },
            _ => d,
        }).ToList();
        var fromRows = Timeline.FromDays("x", dep, days);

        Assert.Equal(changes, fromRows.ClockChanges());
        Assert.Equal(legacy.HomeZone, fromRows.HomeZone);
        for (var h = 0; h < 9 * 24; h += 5)
        {
            var at = Utc(dep, "00:00", Itinerary.ShipHomeZone).AddHours(h);
            Assert.Equal(legacy.ShipZoneAt(at), fromRows.ShipZoneAt(at));
            Assert.Equal(legacy.PortAt(at), fromRows.PortAt(at));
            Assert.Equal(legacy.AtSea(at), fromRows.AtSea(at));
            Assert.Equal(legacy.Aboard(at), fromRows.Aboard(at));
        }
        for (var day = 1; day <= 8; day++) Assert.Equal(legacy.AllAboardAt(day), fromRows.AllAboardAt(day));
    }

    private static List<ItineraryDay> Med(DateOnly dep) =>
    [
        new(1, dep, "barcelona", null, null, T("17:00")), new(2, dep.AddDays(1), "sea", null, null, null),
        new(3, dep.AddDays(2), "marseille", T("08:00"), T("16:30"), T("17:00")), new(4, dep.AddDays(3), "sea", null, null, null),
        new(5, dep.AddDays(4), "barcelona", T("07:00"), null, null),
    ];

    [Fact]
    public void A_four_night_sailing_has_its_own_ports_zones_and_length()
    {
        var dep = new DateOnly(2027, 5, 10);
        var t = Timeline.FromDays("sky-2027-05-10-4", dep, Med(dep));
        Assert.Equal(4, t.Nights);
        Assert.Equal(dep.AddDays(4), t.LastDay);
        Assert.Equal("Europe/Madrid", t.HomeZone);
        Assert.Empty(t.ClockChanges());
        Assert.Null(t.AllAboardAt(1));
        Assert.Null(t.AllAboardAt(5));
        Assert.Equal(Utc(dep.AddDays(2), "16:30", "Europe/Paris"), t.AllAboardAt(3));
        Assert.Equal(("marseille", 3), t.PortAt(Utc(dep.AddDays(2), "12:00", "Europe/Paris")));
        Assert.True(t.AtSea(Utc(dep.AddDays(2), "20:00", "Europe/Paris")));
        Assert.False(t.AtSea(Utc(dep.AddDays(2), "12:00", "Europe/Paris")));
        Assert.False(t.Aboard(Utc(dep, "10:00", "Europe/Madrid")));
        Assert.True(t.Aboard(Utc(dep.AddDays(3), "12:00", "Europe/Madrid")));
        Assert.False(t.Aboard(Utc(dep.AddDays(4), "07:00", "Europe/Madrid")));
        Assert.True(t.IsCall(t.Days[2]));
        Assert.False(t.IsCall(t.Days[0]));
        Assert.False(t.IsCall(t.Days[4]));
    }

    [Fact]
    public void A_clock_change_between_zones_moves_the_ship_clock_at_two_in_the_morning()
    {
        var dep = new DateOnly(2027, 12, 5);
        var days = new List<ItineraryDay>
        {
            new(1, dep, "southampton", null, null, T("17:00")),
            new(2, dep.AddDays(1), "sea", null, null, null),
            new(3, dep.AddDays(2), "sea", null, null, null, -1, T("02:00")),
            new(4, dep.AddDays(3), "southampton", T("07:00"), null, null),
        };
        var t = Timeline.FromDays("t", dep, days);
        var change = Assert.Single(t.ClockChanges());
        Assert.Equal(-1, change.Hours);
        Assert.Equal(Utc(dep.AddDays(2), "02:00", "Europe/London"), change.At);
        Assert.Equal("Europe/London", t.ShipZoneOnDate(dep.AddDays(1)));
        Assert.Equal("Etc/GMT+1", t.ShipZoneOnDate(dep.AddDays(2)));
        Assert.Equal("Europe/London", t.ShipZoneAt(change.At.AddMinutes(-1)));
        Assert.Equal("Etc/GMT+1", t.ShipZoneAt(change.At));
        Assert.Equal("Etc/GMT+1", t.FinalZone);
    }

    [Fact]
    public void A_sailing_with_no_day_rows_gets_the_older_route()
    {
        var dep = new DateOnly(2027, 1, 17);
        Assert.Equal(8, TimelineBook.For("unknown", dep).Days.Count);
        Assert.Equal(7, TimelineBook.For(null, dep).Nights);
    }
}
