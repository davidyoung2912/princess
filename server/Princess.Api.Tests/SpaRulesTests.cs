using Princess.Api.Domain;
using Xunit;

namespace Princess.Api.Tests;

/// <summary>The spa content of each ship and the rules of spa appointments (<see cref="SpaRules"/>).</summary>
public class SpaRulesTests
{
    private static readonly Timeline Week = Timeline.Legacy(new DateOnly(2027, 3, 21));
    public static TheoryData<string> Ships => new() { "sun-princess", "sky-princess", "sapphire-princess" };

    [Theory]
    [MemberData(nameof(Ships))]
    public void Every_treatment_belongs_to_a_bookable_spa_venue_of_its_ship_and_fits_a_day_it_runs(string ship)
    {
        var s = ExplorerCatalogue.For(ship)!;
        Assert.NotEmpty(s.TreatmentList);
        Assert.Equal(s.TreatmentList.Length, s.TreatmentList.Select(t => t.Id).Distinct().Count());
        foreach (var t in s.TreatmentList)
        {
            var v = s.Venues.Single(x => x.Id == t.VenueId);
            Assert.Equal("spa", v.Bookable);
            Assert.All(t.When, k => Assert.True(DayKinds.Valid(k)));
            Assert.Contains(Enumerable.Range(1, Week.Days.Count), d => DayKinds.Runs(Week, d, t.When) && SpaRules.Times(ExplorerRules.Hours(v.Hours, Week, d), t.Minutes).Count > 0);
        }
    }

    [Fact]
    public void The_grid_is_on_the_half_hour_and_ends_by_closing()
    {
        var hours = new HoursDayDto([["08:00", "10:00"]], [], null);
        Assert.Equal(new[] { "08:00", "08:30", "09:00" }, SpaRules.Times(hours, 60));
        Assert.Equal(new[] { "08:00" }, SpaRules.Times(new HoursDayDto([["08:00", "09:00"]], [], null), 60));
        Assert.Empty(SpaRules.Times(new HoursDayDto([], [], "alongside"), 30));
        Assert.Equal("11:30", SpaRules.Times(new HoursDayDto([["11:15", "13:00"]], [], null), 30)[0]);
    }

    [Fact]
    public void Spans_overlap_only_when_they_share_time()
    {
        Assert.True(SpaRules.Overlaps("10:00", 60, "10:30", 30));
        Assert.False(SpaRules.Overlaps("10:00", 60, "11:00", 30));
        Assert.False(SpaRules.Overlaps("11:00", 30, "10:00", 60));
    }

    [Fact]
    public void Cancelling_is_free_until_the_policy_hours_before_then_a_share_is_kept()
    {
        var start = 10L * 24 * 3_600_000;
        Assert.True(SpaRules.CancelTerms(start, start - 25 * 3_600_000L, 10_000).Free);
        var late = SpaRules.CancelTerms(start, start - 23 * 3_600_000L, 10_000);
        Assert.False(late.Free);
        Assert.Equal(5_000, late.Fee);
        Assert.Equal(start - 24 * 3_600_000L, late.FreeUntil);
    }

    [Fact]
    public void Rooms_taken_by_others_never_exceed_the_rooms_and_are_the_same_every_time()
    {
        var t = ExplorerCatalogue.For("sun-princess")!.TreatmentList[0];
        for (var day = 1; day <= 7; day++)
            foreach (var time in new[] { "09:00", "10:30", "15:00" })
            {
                var taken = SpaRules.TakenByOthers(t, "S1", day, time);
                Assert.InRange(taken, 0, t.Rooms);
                Assert.Equal(taken, SpaRules.TakenByOthers(t, "S1", day, time));
            }
    }
}
