using Princess.Api.Domain;

namespace Princess.Api.Tests;

/// <summary>The walking port-day planner (docs/mcp-integration-plan.md, phase 4). Its numbers match <c>src/maps/portDay.ts</c>.</summary>
public class PortDayRulesTests
{
    private static readonly List<PortDayCandidate> Places =
    [
        new("Old Town", "Walk-Off / Independent", "", 42.4251, 18.7712),
        new("Fortress", "Walk-Off / Independent", "", 42.4207, 18.7703),
        new("Market", "Walk-Off / Independent", "", 42.4235, 18.769),
        new("Church", "Local Transit / Independent", "", 42.4243, 18.7725),
        new("Far", "Local Transit / Independent", "", 42.3, 18.9),
    ];

    [Fact]
    public void MatchesTheFrontEndPlannerOnAKnownDay()
    {
        var p = PortDayRules.Plan(Places, "08:00", "16:30", false, false, 0);
        Assert.Null(p.Reason);
        Assert.Equal(["Old Town", "Church", "Market", "Fortress"], p.Stops.Select(s => s.Name));
        Assert.Equal("08:20", p.Stops[0].ArriveAt);
        Assert.Equal(430, p.Usable);
        Assert.Equal(20, p.Walking);
        Assert.Equal(230, p.Spare);
        Assert.Equal("11:32", p.HeadBackBy);
    }

    [Fact]
    public void NeverPlansPastTheBufferBeforeAllAboard()
    {
        foreach (var (arrive, aboard, tender) in new[] { ("08:00", "16:30", false), ("07:00", "13:00", true), ("12:00", "15:00", false) })
        {
            var p = PortDayRules.Plan(Places, arrive, aboard, tender, false, 0);
            if (p.Reason is not null) continue;
            var buffer = tender ? PortDayRules.BufferTender : PortDayRules.BufferDock;
            Assert.True(PortDayRules.ToMinutes(p.HeadBackBy) + p.ReturnWalk <= PortDayRules.ToMinutes(aboard) - buffer);
            Assert.True(p.Spare >= 0);
        }
    }

    [Fact]
    public void SaysWhyThereIsNoPlan()
    {
        Assert.Equal("noTime", PortDayRules.Plan(Places, "12:00", "13:30", false, false, 0).Reason);
        Assert.Equal("fewPlaces", PortDayRules.Plan(Places.Skip(3).ToList(), "08:00", "16:30", false, false, 0).Reason);
    }

    [Fact]
    public void KeepsWalkOffPlacesAndNearbyOnesOnly() =>
        Assert.Equal(["Old Town", "Fortress", "Market", "Church"], PortDayRules.Walkable(Places).Select(p => p.Name));

    [Fact]
    public void WeatherNotesFlagRainOnlyInsideTheHoursAshore()
    {
        var rainy = PortDayRules.WeatherNotes(new SkyDto(5, 78, "13:00", "16:00", "forecast"), "08:00", "16:30");
        Assert.Contains("Rain is likely from 13:00 to 16:00", rainy[0]);
        var later = PortDayRules.WeatherNotes(new SkyDto(5, 78, "17:00", "19:00", "forecast"), "08:00", "16:30");
        Assert.DoesNotContain(later, n => n.StartsWith("Rain"));
        Assert.Equal(3, PortDayRules.WeatherNotes(new SkyDto(10, 95, "10:00", "12:00", "forecast"), "08:00", "16:30").Count);
    }

    [Fact]
    public void EveryGuidePlaceIsReadable()
    {
        var places = PortGuides.Places("cozumel");
        Assert.NotNull(places);
        Assert.NotEmpty(places!);
        Assert.All(places!, p => Assert.InRange(p.Lat, -90, 90));
        Assert.Null(PortGuides.Places("nowhere"));
    }

    [Fact]
    public void TheToolIsDeclaredAndAllowed()
    {
        Assert.Contains("plan_port_day", StanleyReadTools.Names);
        Assert.Contains("\"name\":\"plan_port_day\"", StanleyReadTools.ToolsJson);
    }
}
